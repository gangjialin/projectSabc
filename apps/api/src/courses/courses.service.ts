import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';
import { CourseType, RoleCode } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';

const INIT_PASSWORD = process.env.INIT_PASSWORD ?? '123456';
const BRACKET = /^\[([^\]]+)\]\s*(.*)$/;

function cellStr(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('richText' in v && Array.isArray(v.richText))
      return v.richText.map((t) => t.text).join('').trim();
    if ('text' in v) return String(v.text).trim();
  }
  return String(v).trim();
}

export interface ScheduleImportResult {
  courses: number;
  teachersMatched: number;
  teachersCreated: number;
  parseErrors: string[];
}

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  /**
   * 导入学校课表（一次一个学期文件）：解析 `课程[代码]名称` / `教师[拼音]姓名` / `上课班级构成`，
   * 按 (课程代码+教师+学年) 去重并合并班级，教师按拼音账号关联（缺则新建），upsert 落库。
   * @param courseType 该文件统一课程类型（理论文件=THEORY，实践文件=PRACTICE）
   */
  async importSchedule(
    buffer: Buffer,
    academicYear: string,
    courseType: CourseType,
  ): Promise<ScheduleImportResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('课表为空或格式不正确');

    const header = ws.getRow(1);
    const colOf = (name: string) => {
      for (let c = 1; c <= ws.columnCount; c++) {
        if (cellStr(header.getCell(c).value) === name) return c;
      }
      return -1;
    };
    const cCourse = colOf('课程');
    const cTeacher = colOf('教师');
    const cClasses = colOf('上课班级构成');
    if (cCourse < 0 || cTeacher < 0) {
      throw new BadRequestException('课表缺少「课程」或「教师」列');
    }

    interface Group {
      code: string;
      name: string;
      account: string;
      teacherName: string;
      classes: Set<string>;
    }
    const groups = new Map<string, Group>();
    const parseErrors: string[] = [];

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const courseRaw = cellStr(row.getCell(cCourse).value);
      const teacherRaw = cellStr(row.getCell(cTeacher).value);
      if (!courseRaw && !teacherRaw) continue;
      const cm = courseRaw.match(BRACKET);
      const tm = teacherRaw.match(BRACKET);
      if (!cm || !tm) {
        parseErrors.push(`第 ${r} 行格式异常：课程「${courseRaw}」教师「${teacherRaw}」`);
        continue;
      }
      const code = cm[1].trim();
      const account = tm[1].trim();
      const key = `${code}::${account}`;
      if (!groups.has(key)) {
        groups.set(key, {
          code,
          name: cm[2].trim(),
          account,
          teacherName: tm[2].trim(),
          classes: new Set(),
        });
      }
      const g = groups.get(key)!;
      if (cClasses > 0) {
        cellStr(row.getCell(cClasses).value)
          .split(/[;；,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((x) => g.classes.add(x));
      }
    }

    const teacherRole = await this.prisma.role.findUnique({
      where: { code: RoleCode.TEACHER },
    });
    const pwdHash = await bcrypt.hash(INIT_PASSWORD, 10);
    const teacherIdByAccount = new Map<string, string>();
    let matched = 0;
    let created = 0;
    let courses = 0;

    for (const g of groups.values()) {
      let teacherId = teacherIdByAccount.get(g.account);
      if (!teacherId) {
        const existing = await this.prisma.user.findUnique({
          where: { loginAccount: g.account },
          select: { id: true },
        });
        if (existing) {
          teacherId = existing.id;
          matched++;
        } else {
          const u = await this.prisma.user.create({
            data: {
              loginAccount: g.account,
              name: g.teacherName || g.account,
              passwordHash: pwdHash,
              mustChangePwd: true,
              userType: 'TEACHER',
              roles: teacherRole ? { create: { roleId: teacherRole.id } } : undefined,
            },
            select: { id: true },
          });
          teacherId = u.id;
          created++;
        }
        teacherIdByAccount.set(g.account, teacherId);
      }

      const classNames = [...g.classes];
      await this.prisma.course.upsert({
        where: {
          courseCode_teacherId_academicYear: {
            courseCode: g.code,
            teacherId,
            academicYear,
          },
        },
        create: {
          courseCode: g.code,
          name: g.name,
          type: courseType,
          academicYear,
          semester: '',
          classNames,
          teacherId,
        },
        update: { name: g.name, type: courseType, classNames },
      });
      courses++;
    }

    return { courses, teachersMatched: matched, teachersCreated: created, parseErrors };
  }

  /** 教师本学年的全部课程（来自课表），供"选参评课程" */
  myCourses(teacherId: string, academicYear: string) {
    return this.prisma.course.findMany({
      where: { teacherId, academicYear },
      orderBy: { courseCode: 'asc' },
    });
  }

  /** 教师从自己的课程里选一门为参评（每学年限一门），可改类型/课程负责人 */
  async selectTarget(
    teacherId: string,
    courseId: string,
    opts: { type?: CourseType; isCourseOwner?: boolean },
  ) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
    });
    if (course.teacherId !== teacherId) {
      throw new BadRequestException('只能选择自己的课程');
    }
    await this.prisma.$transaction([
      this.prisma.course.updateMany({
        where: {
          teacherId,
          academicYear: course.academicYear,
          isTargetCourse: true,
        },
        data: { isTargetCourse: false },
      }),
      this.prisma.course.update({
        where: { id: courseId },
        data: { isTargetCourse: true, ...(opts.type ? { type: opts.type } : {}) },
      }),
    ]);
    if (opts.isCourseOwner !== undefined) {
      await this.prisma.user.update({
        where: { id: teacherId },
        data: { isCourseOwner: opts.isCourseOwner },
      });
    }
    return this.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  }

  list(academicYear?: string) {
    return this.prisma.course.findMany({
      where: academicYear ? { academicYear } : undefined,
      include: { teacher: { select: { name: true, loginAccount: true } } },
      orderBy: { courseCode: 'asc' },
    });
  }

  /** 管理员设/取消参评课程（每师每学年限一门） */
  async setTargetCourse(courseId: string, isTarget: boolean) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
    });
    if (isTarget) {
      const existing = await this.prisma.course.findFirst({
        where: {
          teacherId: course.teacherId,
          academicYear: course.academicYear,
          isTargetCourse: true,
          id: { not: courseId },
        },
      });
      if (existing) {
        throw new BadRequestException(
          `该教师在 ${course.academicYear} 已有参评课程「${existing.name}」，每学年限选一门`,
        );
      }
    }
    return this.prisma.course.update({
      where: { id: courseId },
      data: { isTargetCourse: isTarget },
    });
  }
}

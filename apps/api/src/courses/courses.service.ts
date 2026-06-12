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

  /**
   * 教师手工录入课程（课表里没有、或选修课无固定教学班时使用）。
   * 同 (课程代码+本人+学年) 已存在则直接返回该课（提示前端去导名单），不重复建。
   * @returns { course, existed }
   */
  async createManual(
    teacherId: string,
    input: {
      courseCode: string;
      name: string;
      type: CourseType;
      isElective: boolean;
      academicYear: string;
      classNames?: string[];
    },
  ) {
    const teacher = await this.prisma.user.findUniqueOrThrow({
      where: { id: teacherId },
      select: { userType: true },
    });
    if (teacher.userType !== 'TEACHER') {
      throw new BadRequestException('只有教师可录入课程');
    }
    const courseCode = input.courseCode.trim();
    const name = input.name.trim();
    if (!courseCode || !name) {
      throw new BadRequestException('课程代码与课程名称均为必填');
    }
    const existing = await this.prisma.course.findUnique({
      where: {
        courseCode_teacherId_academicYear: {
          courseCode,
          teacherId,
          academicYear: input.academicYear,
        },
      },
    });
    if (existing) {
      return { course: existing, existed: true };
    }
    const classNames = (input.classNames ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    const course = await this.prisma.course.create({
      data: {
        courseCode,
        name,
        type: input.type,
        isElective: input.isElective,
        isManual: true,
        academicYear: input.academicYear,
        semester: '',
        classNames,
        teacherId,
      },
    });
    return { course, existed: false };
  }

  /** 校验课程属于该教师，返回课程 */
  private async ownCourseOrThrow(teacherId: string, courseId: string) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
    });
    if (course.teacherId !== teacherId) {
      throw new BadRequestException('只能操作自己的课程');
    }
    return course;
  }

  /**
   * 导入选课名单（教师端）：只与系统中**已存在**的学号匹配并登记选课关系，
   * 查无的学号一律跳过并在报告中列出（不新建学生、不改其原班级/专业）。
   * 重复导入按学号合并（已在的跳过）。模板列：学号(必填) / 姓名(选填，仅核对)。
   */
  async importRoster(teacherId: string, courseId: string, buffer: Buffer) {
    await this.ownCourseOrThrow(teacherId, courseId);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('名单为空或格式不正确');

    const header = ws.getRow(1);
    let cNo = -1;
    for (let c = 1; c <= ws.columnCount; c++) {
      if (cellStr(header.getCell(c).value) === '学号') cNo = c;
    }
    if (cNo < 0) throw new BadRequestException('名单缺少「学号」列');

    const accounts: string[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const no = cellStr(ws.getRow(r).getCell(cNo).value);
      if (no) accounts.push(no);
    }
    const uniqAccounts = [...new Set(accounts)];
    if (uniqAccounts.length === 0) {
      throw new BadRequestException('名单中未解析到任何学号');
    }

    const students = await this.prisma.user.findMany({
      where: { loginAccount: { in: uniqAccounts }, userType: 'STUDENT' },
      select: { id: true, loginAccount: true },
    });
    const idByAccount = new Map(students.map((s) => [s.loginAccount, s.id]));
    const unmatched = uniqAccounts.filter((a) => !idByAccount.has(a));

    const existing = await this.prisma.courseEnrollment.findMany({
      where: { courseId, studentId: { in: [...idByAccount.values()] } },
      select: { studentId: true },
    });
    const enrolledSet = new Set(existing.map((e) => e.studentId));

    const toAdd = students.filter((s) => !enrolledSet.has(s.id));
    if (toAdd.length > 0) {
      await this.prisma.courseEnrollment.createMany({
        data: toAdd.map((s) => ({ courseId, studentId: s.id })),
        skipDuplicates: true,
      });
    }

    return {
      added: toAdd.length,
      alreadyIn: idByAccount.size - toAdd.length,
      unmatched, // 系统中查无的学号
    };
  }

  /** 某课的选课名单（教师本人或管理员核查用） */
  async roster(courseId: string) {
    const rows = await this.prisma.courseEnrollment.findMany({
      where: { courseId },
      include: {
        student: {
          select: { id: true, loginAccount: true, name: true, className: true },
        },
      },
      orderBy: { student: { loginAccount: 'asc' } },
    });
    return rows.map((e) => ({
      enrollmentId: e.id,
      studentId: e.student.id,
      studentNo: e.student.loginAccount,
      studentName: e.student.name,
      className: e.student.className,
    }));
  }

  /** 移出名单中一名学生（教师本人） */
  async removeEnrollment(teacherId: string, courseId: string, studentId: string) {
    await this.ownCourseOrThrow(teacherId, courseId);
    await this.prisma.courseEnrollment.deleteMany({
      where: { courseId, studentId },
    });
    return { ok: true };
  }

  /** 清空某课名单（教师本人） */
  async clearRoster(teacherId: string, courseId: string) {
    await this.ownCourseOrThrow(teacherId, courseId);
    const { count } = await this.prisma.courseEnrollment.deleteMany({
      where: { courseId },
    });
    return { removed: count };
  }

  /** 管理员核查：手工录入的课程 + 各课名单人数 */
  async manualCourses(academicYear?: string) {
    const courses = await this.prisma.course.findMany({
      where: { isManual: true, ...(academicYear ? { academicYear } : {}) },
      include: {
        teacher: { select: { name: true, loginAccount: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ academicYear: 'desc' }, { courseCode: 'asc' }],
    });
    return courses.map((c) => ({
      id: c.id,
      courseCode: c.courseCode,
      name: c.name,
      type: c.type,
      isElective: c.isElective,
      isTargetCourse: c.isTargetCourse,
      academicYear: c.academicYear,
      classNames: c.classNames,
      teacherName: c.teacher.name,
      teacherAccount: c.teacher.loginAccount,
      enrolledCount: c._count.enrollments,
    }));
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

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportCourseDto } from './dto/report-course.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  /**
   * 从学生名单按 专业 / 年级 取真实班级（去重），供教师填报时级联多选。
   * 不传则返回全部班级。
   */
  async listClasses(major?: string, grade?: string): Promise<string[]> {
    const students = await this.prisma.user.findMany({
      where: {
        userType: 'STUDENT',
        ...(major ? { major } : {}),
        ...(grade ? { grade } : {}),
        className: { not: null },
      },
      select: { className: true },
    });
    return [
      ...new Set(students.map((s) => s.className).filter((c): c is string => !!c)),
    ].sort();
  }

  /** 教师查询本人某学年已填报的参评课程（无则 null） */
  getMyReport(teacherId: string, academicYear: string) {
    return this.prisma.course.findFirst({
      where: { teacherId, academicYear, isTargetCourse: true },
    });
  }

  /**
   * 教师填报参评课程（每学年限一门）。已填报则更新，否则新建；
   * 课程编号全局唯一，冲突（被他人占用）则拒绝。同时写入教师"课程负责人"标记。
   */
  async reportCourse(teacherId: string, dto: ReportCourseDto) {
    const existing = await this.prisma.course.findFirst({
      where: { teacherId, academicYear: dto.academicYear, isTargetCourse: true },
    });

    // 课程编号唯一性校验（排除自己正在更新的那门）
    const codeOwner = await this.prisma.course.findUnique({
      where: { courseCode: dto.courseCode },
    });
    if (codeOwner && codeOwner.id !== existing?.id) {
      throw new BadRequestException(`课程编号 ${dto.courseCode} 已被占用`);
    }

    // 更新教师"课程负责人"标记
    await this.prisma.user.update({
      where: { id: teacherId },
      data: { isCourseOwner: dto.isCourseOwner ?? false },
    });

    const data = {
      courseCode: dto.courseCode,
      name: dto.name,
      type: dto.type,
      level: dto.level,
      classNames: dto.classNames,
      academicYear: dto.academicYear,
      semester: dto.semester,
      isReformCourse: dto.isReformCourse ?? false,
      isTargetCourse: true,
      teacherId,
    };

    if (existing) {
      return this.prisma.course.update({ where: { id: existing.id }, data });
    }
    return this.prisma.course.create({ data });
  }

  list(academicYear?: string) {
    return this.prisma.course.findMany({
      where: academicYear ? { academicYear } : undefined,
      include: { teacher: { select: { name: true, loginAccount: true } } },
      orderBy: { courseCode: 'asc' },
    });
  }

  /**
   * 设为参评课程，强制"每位教师每学年限一门参评课程"（需求 §4.3）。
   */
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

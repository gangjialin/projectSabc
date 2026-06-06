import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

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

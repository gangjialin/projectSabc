import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { FormType } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import type { SubmitSurveyDto } from './dto/submit-survey.dto';

@Injectable()
export class StudentService {
  constructor(
    private prisma: PrismaService,
    private evaluation: EvaluationService,
  ) {}

  /**
   * 学生可评价的教师列表（T-601）：按 学生班级 ∈ 课程授课班级 匹配本学年参评课程，
   * 返回授课教师 + 是否已评。
   */
  async myTeachers(studentId: string, academicYear: string) {
    const student = await this.prisma.user.findUniqueOrThrow({
      where: { id: studentId },
      select: { className: true },
    });
    if (!student.className) return [];

    const courses = await this.prisma.course.findMany({
      where: {
        isTargetCourse: true,
        academicYear,
        classNames: { has: student.className },
      },
      include: { teacher: { select: { id: true, name: true } } },
    });

    const audits = await this.prisma.studentEvalAudit.findMany({
      where: { studentId, academicYear },
      select: { teacherId: true, courseId: true },
    });
    const done = new Set(audits.map((a) => `${a.teacherId}:${a.courseId}`));

    return courses.map((c) => ({
      courseId: c.id,
      courseName: c.name,
      courseType: c.type,
      teacherId: c.teacherId,
      teacherName: c.teacher.name,
      submitted: done.has(`${c.teacherId}:${c.id}`),
    }));
  }

  /**
   * 学生提交匿名问卷：校验班级匹配 + 防重复 → 复用 EvaluationService.submit（自动匿名、算 5 维度快照）
   * → 另写 StudentEvalAudit（与匿名提交分离，仅用于防重复，不暴露身份）。
   */
  async submitSurvey(studentId: string, dto: SubmitSurveyDto, ip?: string) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: dto.courseId },
    });
    if (!course.isTargetCourse) {
      throw new BadRequestException('该课程不在评价范围');
    }
    if (course.teacherId !== dto.teacherId) {
      throw new BadRequestException('教师与课程不匹配');
    }

    const student = await this.prisma.user.findUniqueOrThrow({
      where: { id: studentId },
      select: { className: true },
    });
    if (!student.className || !course.classNames.includes(student.className)) {
      throw new BadRequestException('你不在该课程的授课班级，无法评价该教师');
    }

    const exists = await this.prisma.studentEvalAudit.findUnique({
      where: {
        studentId_teacherId_courseId_academicYear: {
          studentId,
          teacherId: dto.teacherId,
          courseId: dto.courseId,
          academicYear: course.academicYear,
        },
      },
    });
    if (exists) {
      throw new ConflictException('你已提交过对该教师的评价');
    }

    // 匿名提交（evaluation.submit 对 STUDENT 自动置 evaluatorId=null）
    await this.evaluation.submit(
      {
        formType: FormType.STUDENT,
        evaluateeTeacherId: dto.teacherId,
        courseId: dto.courseId,
        semester: course.semester,
        academicYear: course.academicYear,
        comment: dto.comment,
        answers: dto.answers,
      },
      { userId: studentId, roles: ['STUDENT'] },
      ip,
    );

    await this.prisma.studentEvalAudit.create({
      data: {
        studentId,
        teacherId: dto.teacherId,
        courseId: dto.courseId,
        academicYear: course.academicYear,
      },
    });

    return { ok: true };
  }
}

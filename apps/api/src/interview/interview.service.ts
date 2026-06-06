import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInterviewDto, ScoreInterviewDto } from './dto/interview.dto';

@Injectable()
export class InterviewService {
  constructor(private prisma: PrismaService) {}

  /** 管理员配置访谈：选课程（推出被评教师）、抽取学生、约定时间 */
  async create(dto: CreateInterviewDto) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: dto.courseId },
    });
    return this.prisma.interview.create({
      data: {
        courseId: dto.courseId,
        teacherId: course.teacherId,
        academicYear: dto.academicYear ?? course.academicYear,
        selectedStudentIds: dto.selectedStudentIds,
        interviewDate: dto.interviewDate ? new Date(dto.interviewDate) : null,
      },
    });
  }

  /** 管理端列表（含教师/课程名、已打分委员数） */
  async list(academicYear?: string) {
    const interviews = await this.prisma.interview.findMany({
      where: academicYear ? { academicYear } : undefined,
      include: { scores: true },
      orderBy: { id: 'desc' },
    });
    return this.enrich(interviews);
  }

  /** 访谈委员的待评/可评列表（排除被评教师本人） */
  async assignedFor(reviewerId: string) {
    const interviews = await this.prisma.interview.findMany({
      where: { teacherId: { not: reviewerId } },
      include: { scores: true },
      orderBy: { id: 'desc' },
    });
    const enriched = await this.enrich(interviews);
    return enriched.map((i) => ({
      ...i,
      myScored: i.scores.some((s) => s.reviewerId === reviewerId),
    }));
  }

  private async enrich(
    interviews: {
      id: string;
      courseId: string;
      teacherId: string;
      academicYear: string;
      selectedStudentIds: string[];
      interviewDate: Date | null;
      status: string;
      scores: { reviewerId: string }[];
    }[],
  ) {
    const teacherIds = [...new Set(interviews.map((i) => i.teacherId))];
    const courseIds = [...new Set(interviews.map((i) => i.courseId))];
    const [users, courses] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true, name: true },
      }),
      this.prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, name: true, courseCode: true },
      }),
    ]);
    const uMap = new Map(users.map((u) => [u.id, u.name]));
    const cMap = new Map(courses.map((c) => [c.id, c]));
    return interviews.map((i) => ({
      id: i.id,
      courseId: i.courseId,
      teacherId: i.teacherId,
      teacherName: uMap.get(i.teacherId) ?? i.teacherId,
      courseName: cMap.get(i.courseId)?.name ?? i.courseId,
      academicYear: i.academicYear,
      selectedStudentIds: i.selectedStudentIds,
      interviewDate: i.interviewDate,
      status: i.status,
      scoreCount: i.scores.length,
      scores: i.scores,
    }));
  }

  /** 访谈委员提交评分（不得评价自己；每委员每访谈一次，可更新） */
  async score(interviewId: string, reviewerId: string, dto: ScoreInterviewDto) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
    });
    if (!interview) throw new NotFoundException('访谈不存在');
    if (interview.teacherId === reviewerId) {
      throw new BadRequestException('不得评价自己');
    }

    const saved = await this.prisma.interviewScore.upsert({
      where: { interviewId_reviewerId: { interviewId, reviewerId } },
      create: {
        interviewId,
        reviewerId,
        capabilityScore: dto.capabilityScore,
        methodScore: dto.methodScore,
        assessmentScore: dto.assessmentScore,
        comment: dto.comment,
      },
      update: {
        capabilityScore: dto.capabilityScore,
        methodScore: dto.methodScore,
        assessmentScore: dto.assessmentScore,
        comment: dto.comment,
      },
    });

    // ≥2 名委员评分则标记完成
    const count = await this.prisma.interviewScore.count({
      where: { interviewId },
    });
    if (count >= 2 && interview.status !== 'COMPLETED') {
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: { status: 'COMPLETED' },
      });
    }
    return saved;
  }
}

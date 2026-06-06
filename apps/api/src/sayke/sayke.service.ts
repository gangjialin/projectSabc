import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_CONFIG,
  DIMENSION_NOS,
  FormType,
  mean,
  trimmedMean,
  type DimensionNo,
} from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSessionDto } from './dto/create-session.dto';

export interface LiveState {
  teacherId: string;
  count: number;
  avgTotal: number | null;
  dims: Record<DimensionNo, number | null>;
}

@Injectable()
export class SaykeService {
  constructor(private prisma: PrismaService) {}

  /** 创建说课场次 + 教师顺序（T-501） */
  async createSession(dto: CreateSessionDto) {
    return this.prisma.saykeSession.create({
      data: {
        name: dto.name,
        scheduledDate: new Date(dto.scheduledDate),
        academicYear: dto.academicYear,
        teachers: {
          create: dto.teachers.map((t, i) => ({
            teacherId: t.teacherId,
            courseId: t.courseId,
            orderNo: i + 1,
          })),
        },
      },
      include: { teachers: { orderBy: { orderNo: 'asc' } } },
    });
  }

  /** 取场次详情（含教师/课程名称，供大屏与移动端展示） */
  async getSession(id: string) {
    const s = await this.prisma.saykeSession.findUnique({
      where: { id },
      include: { teachers: { orderBy: { orderNo: 'asc' } } },
    });
    if (!s) throw new NotFoundException('说课场次不存在');

    const teacherIds = s.teachers.map((t) => t.teacherId);
    const courseIds = s.teachers.map((t) => t.courseId);
    const [users, courses] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true, name: true, loginAccount: true },
      }),
      this.prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, name: true, courseCode: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    return {
      id: s.id,
      name: s.name,
      scheduledDate: s.scheduledDate,
      academicYear: s.academicYear,
      status: s.status,
      currentTeacherId: s.currentTeacherId,
      teachers: s.teachers.map((t) => ({
        id: t.id,
        orderNo: t.orderNo,
        status: t.status,
        teacherId: t.teacherId,
        teacherName: userMap.get(t.teacherId)?.name ?? t.teacherId,
        courseId: t.courseId,
        courseName: courseMap.get(t.courseId)?.name ?? t.courseId,
      })),
    };
  }

  /** 设为当前说课教师（管理员推进流程） */
  async setCurrent(sessionId: string, sessionTeacherId: string) {
    const st = await this.prisma.sessionTeacher.findUniqueOrThrow({
      where: { id: sessionTeacherId },
    });
    // 其余教师置等待，当前置进行中
    await this.prisma.sessionTeacher.updateMany({
      where: { sessionId, status: 'ACTIVE' },
      data: { status: 'WAITING' },
    });
    await this.prisma.sessionTeacher.update({
      where: { id: sessionTeacherId },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });
    return this.prisma.saykeSession.update({
      where: { id: sessionId },
      data: { status: 'IN_PROGRESS', currentTeacherId: st.teacherId },
    });
  }

  /** 锁定当前说课教师（停止接收打分） */
  async lockCurrent(sessionId: string) {
    const s = await this.prisma.saykeSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (s.currentTeacherId) {
      await this.prisma.sessionTeacher.updateMany({
        where: { sessionId, teacherId: s.currentTeacherId },
        data: { status: 'LOCKED', lockedAt: new Date() },
      });
    }
    return this.prisma.saykeSession.update({
      where: { id: sessionId },
      data: { currentTeacherId: null },
    });
  }

  /** 当前教师的实时聚合（去极值均分 + 5 维度平均得分率，design §4.3） */
  async liveState(sessionId: string, teacherId: string): Promise<LiveState> {
    const subs = await this.prisma.evalSubmission.findMany({
      where: {
        sessionId,
        evaluateeTeacherId: teacherId,
        formType: FormType.PEER,
      },
      select: {
        totalScore: true,
        dim1Rate: true,
        dim2Rate: true,
        dim3Rate: true,
        dim4Rate: true,
        dim5Rate: true,
      },
    });

    const peerMin = DEFAULT_CONFIG.minEvaluatorCount.peer;
    const totals = subs
      .map((s) => s.totalScore)
      .filter((v): v is number => v !== null);

    const dims = {} as Record<DimensionNo, number | null>;
    for (const n of DIMENSION_NOS) {
      const key = `dim${n}Rate` as keyof (typeof subs)[number];
      const rates = subs
        .map((s) => s[key] as number | null)
        .filter((v): v is number => v !== null);
      dims[n] = trimmedMean(rates, peerMin) ?? mean(rates);
    }

    return {
      teacherId,
      count: subs.length,
      avgTotal: trimmedMean(totals, peerMin) ?? mean(totals),
      dims,
    };
  }
}

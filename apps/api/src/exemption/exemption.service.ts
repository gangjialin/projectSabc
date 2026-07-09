import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExemptionStatus } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateExemptionDto, ReviewLevel } from './dto/exemption.dto';

/** 每位教师每学期免计入申请上限（防滥用 design §7.4） */
const MAX_PER_SEMESTER = 5;

interface ReviewStamp {
  status: 'AGREE' | 'REJECT';
  opinion?: string;
  reviewedAt: string;
  reviewerId: string;
  reviewerName: string;
}

@Injectable()
export class ExemptionService {
  constructor(private prisma: PrismaService) {}

  /** 教师发起免计入申请 */
  async create(teacherId: string, dto: CreateExemptionDto) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: dto.courseId },
    });
    if (course.teacherId !== teacherId) {
      throw new BadRequestException('只能对自己的课程发起免计入申请');
    }
    const student = await this.prisma.user.findUnique({
      where: { loginAccount: dto.studentId },
      select: { id: true, name: true, className: true },
    });
    if (!student) {
      throw new BadRequestException(`学号不存在：${dto.studentId}`);
    }

    // 防滥用：每师每学期 ≤ MAX_PER_SEMESTER
    const count = await this.prisma.studentEvalExemption.count({
      where: { teacherId, semester: course.semester, academicYear: course.academicYear },
    });
    if (count >= MAX_PER_SEMESTER) {
      throw new BadRequestException(
        `本学期免计入申请已达上限（${MAX_PER_SEMESTER} 条）`,
      );
    }

    // 同一(教师,学生,课程,学期)不可重复申请
    const dup = await this.prisma.studentEvalExemption.findFirst({
      where: {
        teacherId,
        studentId: dto.studentId,
        courseId: dto.courseId,
        semester: course.semester,
        finalStatus: { not: ExemptionStatus.REJECTED },
      },
    });
    if (dup) throw new ConflictException('该申请已存在');

    return this.prisma.studentEvalExemption.create({
      data: {
        teacherId,
        studentId: dto.studentId,
        studentName: student.name,
        className: student.className ?? '',
        courseId: dto.courseId,
        semester: course.semester,
        academicYear: course.academicYear,
        reason: dto.reason,
        finalStatus: ExemptionStatus.PROCESSING,
      },
    });
  }

  /** 教师查本人申请 */
  myApplications(teacherId: string) {
    return this.prisma.studentEvalExemption.findMany({
      where: { teacherId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * 各级待审列表（V7.0 两级）：
   *  DEPT 系部主任 = 尚无系部审核；UNIVERSITY 质保部 = 系部已过、学校未审。
   */
  async pending(level: ReviewLevel) {
    const all = await this.prisma.studentEvalExemption.findMany({
      where: { finalStatus: ExemptionStatus.PROCESSING },
      orderBy: { submittedAt: 'asc' },
    });
    return all.filter((e) => {
      if (level === 'DEPT') return !e.deptChiefReview;
      return !!e.deptChiefReview && !e.universityReview;
    });
  }

  /** 两级审核统一处理：顺序校验 + 驳回即终止 + 两级通过即免计入（系部主任 → 质保部） */
  async review(
    id: string,
    level: ReviewLevel,
    reviewer: { userId: string; name: string },
    agree: boolean,
    opinion?: string,
  ) {
    const ex = await this.prisma.studentEvalExemption.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('申请不存在');
    if (ex.finalStatus !== ExemptionStatus.PROCESSING) {
      throw new ConflictException('该申请已结束审核');
    }

    // 顺序校验
    if (level === 'DEPT' && ex.deptChiefReview) {
      throw new ConflictException('系部已审核');
    }
    if (level === 'UNIVERSITY' && (!ex.deptChiefReview || ex.universityReview)) {
      throw new BadRequestException('需系部主任先审核，且学校未审核');
    }

    const stamp: ReviewStamp = {
      status: agree ? 'AGREE' : 'REJECT',
      opinion,
      reviewedAt: new Date().toISOString(),
      reviewerId: reviewer.userId,
      reviewerName: reviewer.name,
    };
    const field = level === 'DEPT' ? 'deptChiefReview' : 'universityReview';

    const data: Record<string, unknown> = { [field]: stamp };
    if (!agree) {
      data.finalStatus = ExemptionStatus.REJECTED;
      data.decidedAt = new Date();
    } else if (level === 'UNIVERSITY') {
      data.finalStatus = ExemptionStatus.APPROVED; // 两级全过
      data.decidedAt = new Date();
    }

    return this.prisma.studentEvalExemption.update({
      where: { id },
      data: data as never,
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppealLevel,
  AppealStatus,
  ResultStatus,
} from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAppealDto } from './dto/appeal.dto';

/** 申诉答复时限（工作日，简化为日历日）。design §附录 appeal_window_days=3 */
const WINDOW_DAYS = 3;

interface ProcessStamp {
  processor: string;
  result: 'ACCEPTED' | 'REJECTED';
  opinion?: string;
  processedAt: string;
}

@Injectable()
export class AppealService {
  constructor(private prisma: PrismaService) {}

  private deadline(): Date {
    const d = new Date();
    d.setDate(d.getDate() + WINDOW_DAYS);
    return d;
  }

  /** 教师提交院级申诉（成绩须已发布） */
  async create(teacherId: string, dto: CreateAppealDto) {
    const result = await this.prisma.finalResult.findUnique({
      where: {
        teacherId_academicYear: { teacherId, academicYear: dto.academicYear },
      },
    });
    if (!result || result.status !== ResultStatus.PUBLISHED) {
      throw new BadRequestException('成绩尚未发布，暂不可申诉');
    }
    const existing = await this.prisma.appeal.findFirst({
      where: {
        teacherId,
        academicYear: dto.academicYear,
        status: { in: [AppealStatus.SUBMITTED, AppealStatus.PROCESSING] },
      },
    });
    if (existing) throw new ConflictException('已有进行中的申诉');

    return this.prisma.appeal.create({
      data: {
        teacherId,
        academicYear: dto.academicYear,
        appealLevel: AppealLevel.COLLEGE,
        reason: dto.reason,
        evidenceFiles: dto.evidenceFiles ?? [],
        status: AppealStatus.SUBMITTED,
        deadline: this.deadline(),
      },
    });
  }

  myAppeals(teacherId: string) {
    return this.prisma.appeal.findMany({
      where: { teacherId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /** 待处理：院级=COLLEGE+SUBMITTED；校级=UNIVERSITY+SUBMITTED */
  async pending(level: AppealLevel) {
    const appeals = await this.prisma.appeal.findMany({
      where: { appealLevel: level, status: AppealStatus.SUBMITTED },
      orderBy: { submittedAt: 'asc' },
    });
    const teacherIds = [...new Set(appeals.map((a) => a.teacherId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.name]));
    return appeals.map((a) => ({ ...a, teacherName: nameMap.get(a.teacherId) ?? a.teacherId }));
  }

  /** 处理申诉（院级 ADMIN / 校级 QUALITY_DEPT） */
  async process(
    id: string,
    level: AppealLevel,
    processor: string,
    accept: boolean,
    opinion?: string,
  ) {
    const appeal = await this.prisma.appeal.findUnique({ where: { id } });
    if (!appeal) throw new NotFoundException('申诉不存在');
    if (appeal.appealLevel !== level) {
      throw new BadRequestException('该申诉不在当前处理级别');
    }
    if (appeal.status !== AppealStatus.SUBMITTED) {
      throw new ConflictException('该申诉已处理');
    }

    const stamp: ProcessStamp = {
      processor,
      result: accept ? 'ACCEPTED' : 'REJECTED',
      opinion,
      processedAt: new Date().toISOString(),
    };
    const field = level === AppealLevel.COLLEGE ? 'collegeProcess' : 'universityProcess';
    // 院级受理 → ACCEPTED；院级驳回 → REJECTED（教师可升校级）
    // 校级处理 → ACCEPTED/REJECTED 后 CLOSED
    const status =
      level === AppealLevel.UNIVERSITY
        ? AppealStatus.CLOSED
        : accept
          ? AppealStatus.ACCEPTED
          : AppealStatus.REJECTED;

    return this.prisma.appeal.update({
      where: { id },
      data: { [field]: stamp, status } as never,
    });
  }

  /** 教师升级到校级复核（院级被驳回后） */
  async escalate(id: string, teacherId: string, reason: string) {
    const appeal = await this.prisma.appeal.findUnique({ where: { id } });
    if (!appeal) throw new NotFoundException('申诉不存在');
    if (appeal.teacherId !== teacherId) throw new ForbiddenException('无权操作');
    if (appeal.appealLevel !== AppealLevel.COLLEGE || appeal.status !== AppealStatus.REJECTED) {
      throw new BadRequestException('仅院级被驳回的申诉可申请校级复核');
    }
    return this.prisma.appeal.update({
      where: { id },
      data: {
        appealLevel: AppealLevel.UNIVERSITY,
        status: AppealStatus.SUBMITTED,
        reason,
        deadline: this.deadline(),
      },
    });
  }

  async list(academicYear?: string) {
    return this.prisma.appeal.findMany({
      where: academicYear ? { academicYear } : undefined,
      orderBy: { submittedAt: 'desc' },
    });
  }
}

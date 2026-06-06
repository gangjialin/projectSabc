import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ApprovalType,
  Grade,
  ResultStatus,
  VoteDecision,
} from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { InitiateGradeChangeDto } from './dto/approval.dto';

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService) {}

  /** 当前审核委员会成员 id 列表 */
  private async committeeIds(): Promise<string[]> {
    const members = await this.prisma.user.findMany({
      where: { isApprover: true, isActive: true },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }

  /** 发起"发布"会签（管理员） */
  async initiatePublish(academicYear: string, initiatedById: string) {
    const committee = await this.committeeIds();
    if (committee.length === 0) {
      throw new BadRequestException('尚未设置审核委员会成员（isApprover），无法发起会签');
    }

    const resultCount = await this.prisma.finalResult.count({
      where: { academicYear },
    });
    if (resultCount === 0) {
      throw new BadRequestException('该学年暂无计算结果，请先全院重算');
    }

    const published = await this.prisma.finalResult.count({
      where: { academicYear, status: ResultStatus.PUBLISHED },
    });
    if (published > 0) {
      throw new ConflictException('该学年成绩已发布');
    }

    const pending = await this.prisma.approvalRequest.findFirst({
      where: {
        academicYear,
        type: ApprovalType.PUBLISH,
        status: ApprovalStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException('已有进行中的发布会签，请勿重复发起');
    }

    const req = await this.prisma.approvalRequest.create({
      data: { type: ApprovalType.PUBLISH, academicYear, initiatedById },
    });
    // 标记为待审核
    await this.prisma.finalResult.updateMany({
      where: { academicYear },
      data: { status: ResultStatus.PENDING_REVIEW },
    });
    return req;
  }

  /** 发起"修改最终等级"会签（管理员）。系统不提供直接改等级入口，只能走此流程 */
  async initiateGradeChange(dto: InitiateGradeChangeDto, initiatedById: string) {
    const committee = await this.committeeIds();
    if (committee.length === 0) {
      throw new BadRequestException('尚未设置审核委员会成员，无法发起会签');
    }
    await this.prisma.finalResult.findUniqueOrThrow({
      where: {
        teacherId_academicYear: {
          teacherId: dto.teacherId,
          academicYear: dto.academicYear,
        },
      },
    });
    return this.prisma.approvalRequest.create({
      data: {
        type: ApprovalType.GRADE_CHANGE,
        academicYear: dto.academicYear,
        initiatedById,
        payload: {
          teacherId: dto.teacherId,
          newGrade: dto.newGrade,
          reason: dto.reason,
        },
      },
    });
  }

  /** 委员投票（会签）。任一驳回 → 本轮作废；全员同意 → 执行 */
  async vote(
    requestId: string,
    memberId: string,
    decision: VoteDecision,
    opinion?: string,
  ) {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { isApprover: true },
    });
    if (!member?.isApprover) {
      throw new ForbiddenException('您不是审核委员会成员，无权会签');
    }

    const req = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('会签请求不存在');
    if (req.status !== ApprovalStatus.PENDING) {
      throw new ConflictException('该会签已结束，无法投票');
    }

    await this.prisma.approvalVote.upsert({
      where: { requestId_memberId: { requestId, memberId } },
      create: { requestId, memberId, decision, opinion },
      update: { decision, opinion, votedAt: new Date() },
    });

    // 任一驳回 → 整轮作废
    if (decision === VoteDecision.REJECT) {
      await this.reject(req.id, req.type as ApprovalType, req.academicYear);
      return { status: ApprovalStatus.REJECTED };
    }

    // 全员同意检查
    const committee = await this.committeeIds();
    const votes = await this.prisma.approvalVote.findMany({
      where: { requestId },
    });
    const agreed = new Set(
      votes
        .filter((v) => v.decision === VoteDecision.AGREE)
        .map((v) => v.memberId),
    );
    const allAgreed = committee.every((id) => agreed.has(id));

    if (allAgreed) {
      await this.execute(req.id, req.type as ApprovalType, req.academicYear);
      return { status: ApprovalStatus.APPROVED };
    }
    return {
      status: ApprovalStatus.PENDING,
      agreed: agreed.size,
      total: committee.length,
    };
  }

  private async reject(
    requestId: string,
    type: ApprovalType,
    academicYear: string,
  ) {
    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: ApprovalStatus.REJECTED, decidedAt: new Date() },
    });
    if (type === ApprovalType.PUBLISH) {
      // 退回草稿，需重新发起
      await this.prisma.finalResult.updateMany({
        where: { academicYear },
        data: { status: ResultStatus.DRAFT },
      });
    }
  }

  private async execute(
    requestId: string,
    type: ApprovalType,
    academicYear: string,
  ) {
    const req = await this.prisma.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });

    if (type === ApprovalType.PUBLISH) {
      const results = await this.prisma.finalResult.findMany({
        where: { academicYear },
        select: { teacherId: true, suggestedGrade: true },
      });
      const now = new Date();
      await this.prisma.$transaction(
        results.map((r) =>
          this.prisma.finalResult.update({
            where: {
              teacherId_academicYear: { teacherId: r.teacherId, academicYear },
            },
            data: {
              finalGrade: r.suggestedGrade,
              status: ResultStatus.PUBLISHED,
              publishedAt: now,
            },
          }),
        ),
      );
    } else if (type === ApprovalType.GRADE_CHANGE) {
      const payload = req.payload as {
        teacherId: string;
        newGrade: Grade;
      } | null;
      if (payload) {
        await this.prisma.finalResult.update({
          where: {
            teacherId_academicYear: {
              teacherId: payload.teacherId,
              academicYear,
            },
          },
          data: { finalGrade: payload.newGrade },
        });
      }
    }

    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: ApprovalStatus.APPROVED, decidedAt: new Date() },
    });
  }

  /** 待我会签的请求（委员） */
  async pendingForMember(memberId: string) {
    const reqs = await this.prisma.approvalRequest.findMany({
      where: { status: ApprovalStatus.PENDING },
      include: { votes: true },
      orderBy: { createdAt: 'desc' },
    });
    const committee = await this.committeeIds();
    return reqs.map((r) => ({
      id: r.id,
      type: r.type,
      academicYear: r.academicYear,
      payload: r.payload,
      createdAt: r.createdAt,
      myVote: r.votes.find((v) => v.memberId === memberId)?.decision ?? null,
      agreed: r.votes.filter((v) => v.decision === VoteDecision.AGREE).length,
      total: committee.length,
    }));
  }

  /** 会签历史与审签记录（管理员/留痕查询） */
  async list(academicYear?: string) {
    const reqs = await this.prisma.approvalRequest.findMany({
      where: academicYear ? { academicYear } : undefined,
      include: { votes: true },
      orderBy: { createdAt: 'desc' },
    });
    const memberIds = [
      ...new Set(reqs.flatMap((r) => r.votes.map((v) => v.memberId))),
    ];
    const members = await this.prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(members.map((m) => [m.id, m.name]));
    return reqs.map((r) => ({
      id: r.id,
      type: r.type,
      academicYear: r.academicYear,
      status: r.status,
      payload: r.payload,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      votes: r.votes.map((v) => ({
        memberName: nameMap.get(v.memberId) ?? v.memberId,
        decision: v.decision,
        opinion: v.opinion,
        votedAt: v.votedAt,
      })),
    }));
  }
}

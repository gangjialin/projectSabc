import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ScoreService } from './score.service';
import { PrismaService } from '../prisma/prisma.service';
import { SCORE_QUEUE, type RecalcJobData } from './score.processor';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('score')
export class ScoreController {
  constructor(
    private score: ScoreService,
    private prisma: PrismaService,
    @InjectQueue(SCORE_QUEUE) private queue: Queue<RecalcJobData>,
  ) {}

  /**
   * POST /api/v1/score/recalculate-async?year= —— 入队后台全院重算，立即返回 jobId（T-407）。
   * 大批量计算用此端点；小规模可用同步 /recalculate。
   */
  @Post('recalculate-async')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async recalculateAsync(@Query('year') year: string) {
    const job = await this.queue.add('recalc', { academicYear: year });
    return { jobId: job.id, status: 'queued' };
  }

  /** GET /api/v1/score/job/:id —— 查询重算任务状态 */
  @Get('job/:id')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async jobStatus(@Param('id') id: string) {
    const job = await this.queue.getJob(id);
    if (!job) return { found: false };
    return {
      found: true,
      state: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  /**
   * POST /api/v1/score/recalculate?year=2025-2026
   * 全院重算：逐人算 FinalResult（三维分→综合分→完整性→维度否决）→ 等级划定 + 排名。
   */
  @Post('recalculate')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async recalculate(@Query('year') year: string) {
    return this.score.recalculateYear(year);
  }

  /** POST /api/v1/score/recalculate-grades?year= —— 仅重跑等级划定（FinalResult 已就绪时） */
  @Post('recalculate-grades')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async recalculateGrades(@Query('year') year: string) {
    return this.score.assignGradesForYear(year);
  }

  /** GET /api/v1/score/veto-list?year= —— 触发维度否决的教师列表 */
  @Get('veto-list')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async vetoList(@Query('year') year: string) {
    return this.prisma.dimensionResult.findMany({
      where: { academicYear: year, hasDimVeto: true },
    });
  }

  /** GET /api/v1/score/results?year= —— 全院结果排名（管理端/报表用） */
  @Get('results')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async results(@Query('year') year: string) {
    return this.prisma.finalResult.findMany({
      where: { academicYear: year },
      include: { teacher: { select: { name: true, loginAccount: true } } },
      orderBy: [{ rank: 'asc' }],
    });
  }

  /** GET /api/v1/score/my-result?year= —— 教师查本人成绩单（T-802） */
  @Get('my-result')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  async myResult(
    @Req() req: { user: { userId: string } },
    @Query('year') year: string,
  ) {
    return this.score.getTeacherResult(req.user.userId, year, true);
  }

  /** GET /api/v1/score/teacher/:id/result?year= —— 管理端查指定教师成绩单 */
  @Get('teacher/:id/result')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async teacherResult(@Param('id') id: string, @Query('year') year: string) {
    return this.score.getTeacherResult(id, year);
  }
}

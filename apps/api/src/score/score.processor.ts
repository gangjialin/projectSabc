import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ScoreService } from './score.service';

export const SCORE_QUEUE = 'score-recalc';

export interface RecalcJobData {
  academicYear: string;
}

/**
 * 全院重算后台处理器（T-407）。HTTP 入队后立即返回 jobId，
 * 重算在 worker 中执行，避免大批量计算阻塞请求（design §8.1，单教师 <200ms）。
 */
@Processor(SCORE_QUEUE)
export class ScoreProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoreProcessor.name);

  constructor(private readonly score: ScoreService) {
    super();
  }

  async process(job: Job<RecalcJobData>) {
    this.logger.log(`开始全院重算 ${job.data.academicYear} (job ${job.id})`);
    const result = await this.score.recalculateYear(job.data.academicYear);
    this.logger.log(
      `完成全院重算 ${job.data.academicYear}：${result.teachers} 名教师`,
    );
    return result;
  }
}

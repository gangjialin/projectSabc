import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScoreService } from './score.service';
import { ScoreController } from './score.controller';
import { ScoreProcessor, SCORE_QUEUE } from './score.processor';

@Module({
  imports: [BullModule.registerQueue({ name: SCORE_QUEUE })],
  providers: [ScoreService, ScoreProcessor],
  controllers: [ScoreController],
  exports: [ScoreService],
})
export class ScoreModule {}

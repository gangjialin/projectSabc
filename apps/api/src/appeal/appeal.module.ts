import { Module } from '@nestjs/common';
import { AppealService } from './appeal.service';
import { AppealController } from './appeal.controller';

@Module({
  providers: [AppealService],
  controllers: [AppealController],
  exports: [AppealService],
})
export class AppealModule {}

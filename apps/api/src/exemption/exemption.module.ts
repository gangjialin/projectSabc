import { Module } from '@nestjs/common';
import { ExemptionService } from './exemption.service';
import { ExemptionController } from './exemption.controller';

@Module({
  providers: [ExemptionService],
  controllers: [ExemptionController],
  exports: [ExemptionService],
})
export class ExemptionModule {}

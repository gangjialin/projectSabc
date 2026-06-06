import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  imports: [TasksModule],
  providers: [ImportService],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}

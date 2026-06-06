import { Module } from '@nestjs/common';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';

@Module({
  imports: [EvaluationModule],
  providers: [StudentService],
  controllers: [StudentController],
})
export class StudentModule {}

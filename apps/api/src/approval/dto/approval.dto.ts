import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Grade, VoteDecision } from '@app/shared';

export class InitiateGradeChangeDto {
  @IsString()
  teacherId!: string;

  @IsString()
  academicYear!: string;

  @IsEnum(Grade)
  newGrade!: Grade;

  @IsString()
  reason!: string;
}

export class VoteDto {
  @IsEnum(VoteDecision)
  decision!: VoteDecision;

  @IsOptional()
  @IsString()
  opinion?: string;
}

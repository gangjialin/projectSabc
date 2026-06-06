import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { FormType } from '@app/shared';

export class SubmitAnswerDto {
  @IsString()
  questionId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  likertScore!: number;
}

export class SubmitEvaluationDto {
  @IsEnum(FormType)
  formType!: FormType;

  @IsString()
  evaluateeTeacherId!: string;

  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  semester!: string;

  @IsString()
  academicYear!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers!: SubmitAnswerDto[];
}

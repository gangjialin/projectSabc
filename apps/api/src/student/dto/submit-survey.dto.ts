import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class SurveyAnswerDto {
  @IsString()
  questionId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  likertScore!: number;
}

export class SubmitSurveyDto {
  @IsString()
  teacherId!: string;

  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SurveyAnswerDto)
  answers!: SurveyAnswerDto[];
}

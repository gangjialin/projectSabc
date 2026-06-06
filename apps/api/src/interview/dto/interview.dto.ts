import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateInterviewDto {
  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  academicYear?: string;

  /** 被抽取学生（学号），3-5 名 */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  selectedStudentIds!: string[];

  @IsOptional()
  @IsString()
  interviewDate?: string;
}

/** 访谈评分：能力培养感知 8 + 教学方法接受度 6 + 考核认可度 6 = 20（需求 §8.6） */
export class ScoreInterviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8)
  capabilityScore!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  methodScore!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  assessmentScore!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

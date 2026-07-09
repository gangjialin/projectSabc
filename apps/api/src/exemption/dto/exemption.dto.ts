import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExemptionDto {
  @IsString()
  studentId!: string; // 学号（学生 loginAccount）

  @IsString()
  courseId!: string;

  /** 申请理由：防滥用，必填且≥30字（design §7.4） */
  @IsString()
  @MinLength(30, { message: '申请理由需不少于 30 字' })
  reason!: string;
}

export class ReviewExemptionDto {
  @IsBoolean()
  agree!: boolean;

  @IsOptional()
  @IsString()
  opinion?: string;
}

/** 审核级别（V7.0 两级：系部主任 → 教学质量管理与保障部） */
export const REVIEW_LEVELS = ['DEPT', 'UNIVERSITY'] as const;
export type ReviewLevel = (typeof REVIEW_LEVELS)[number];

export class PendingQueryDto {
  @IsOptional()
  @IsIn(REVIEW_LEVELS)
  level?: ReviewLevel;
}

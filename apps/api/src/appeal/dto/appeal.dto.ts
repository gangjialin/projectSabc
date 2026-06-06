import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAppealDto {
  @IsString()
  academicYear!: string;

  @IsString()
  @MinLength(10, { message: '申诉理由需不少于 10 字' })
  reason!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceFiles?: string[];
}

export class ProcessAppealDto {
  @IsBoolean()
  accept!: boolean;

  @IsOptional()
  @IsString()
  opinion?: string;
}

export class EscalateAppealDto {
  @IsString()
  @MinLength(10, { message: '校级复核理由需不少于 10 字' })
  reason!: string;
}

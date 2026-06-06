import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FlagType } from '@app/shared';

export class CreateFlagDto {
  @IsString()
  teacherId!: string;

  @IsString()
  academicYear!: string;

  @IsEnum(FlagType)
  flagType!: FlagType;

  @IsOptional()
  @IsString()
  evidence?: string;
}

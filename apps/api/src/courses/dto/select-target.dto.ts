import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CourseType } from '@app/shared';

export class SelectTargetDto {
  @IsOptional()
  @IsEnum(CourseType)
  type?: CourseType;

  @IsOptional()
  @IsBoolean()
  isCourseOwner?: boolean;
}

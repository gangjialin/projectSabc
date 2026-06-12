import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CourseType } from '@app/shared';

export class CreateManualCourseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  courseCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @IsEnum(CourseType)
  type!: CourseType;

  @IsBoolean()
  isElective!: boolean;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  classNames?: string[];
}

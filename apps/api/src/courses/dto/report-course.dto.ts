import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { CourseLevel, CourseType } from '@app/shared';

/** 教师填报参评课程（每学年限一门） */
export class ReportCourseDto {
  @IsString()
  courseCode!: string;

  @IsString()
  name!: string;

  @IsEnum(CourseType)
  type!: CourseType;

  @IsEnum(CourseLevel)
  level!: CourseLevel;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  classNames!: string[];

  @IsString()
  academicYear!: string;

  @IsString()
  semester!: string;

  @IsOptional()
  @IsBoolean()
  isReformCourse?: boolean;

  /** 教师是否为课程负责人（写入 User.isCourseOwner） */
  @IsOptional()
  @IsBoolean()
  isCourseOwner?: boolean;
}

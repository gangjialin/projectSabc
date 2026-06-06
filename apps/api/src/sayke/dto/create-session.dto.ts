import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SessionTeacherInput {
  @IsString()
  teacherId!: string;

  @IsString()
  courseId!: string;
}

export class CreateSessionDto {
  @IsString()
  name!: string;

  /** ISO 日期字符串 */
  @IsString()
  scheduledDate!: string;

  @IsString()
  academicYear!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SessionTeacherInput)
  teachers!: SessionTeacherInput[];
}

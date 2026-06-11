import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TaskStatus, TaskType } from '@app/shared';

export class SetReviewerDto {
  @IsString()
  teacherId!: string;

  @IsEnum(TaskType)
  kind!: TaskType; // LECTURE=质量委员 / MATERIAL=材料评阅人

  @IsBoolean()
  value!: boolean;
}

export class AssignTargetsDto {
  @IsEnum(TaskType)
  kind!: TaskType;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  teacherIds!: string[];
}

export class AssignTaskDto {
  @IsString()
  courseId!: string;

  @IsString()
  reviewerId!: string;

  @IsEnum(TaskType)
  taskType!: TaskType;

  /** 计划日期（ISO 字符串，可选） */
  @IsOptional()
  @IsString()
  plannedDate?: string;
}

export class AssignBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssignTaskDto)
  items!: AssignTaskDto[];
}

export class ListTasksQueryDto {
  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  reviewerId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsEnum(TaskType)
  taskType?: TaskType;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}

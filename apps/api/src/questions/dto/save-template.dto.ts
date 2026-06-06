import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CourseType, FormType } from '@app/shared';

export class SaveQuestionDto {
  @IsString()
  indicator!: string;

  @IsString()
  scoreCriteria!: string;

  @IsNumber()
  @Min(0)
  maxScore!: number;
}

export class SaveDimensionDto {
  @IsInt()
  @Min(1)
  @Max(5)
  dimensionNo!: number;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  maxScore!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveQuestionDto)
  questions!: SaveQuestionDto[];
}

export class SaveTemplateDto {
  @IsEnum(FormType)
  formType!: FormType;

  /** 省略=通用模板（courseType=null）；否则按课程类型版本化 */
  @IsOptional()
  @IsEnum(CourseType)
  courseType?: CourseType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(5)
  @ValidateNested({ each: true })
  @Type(() => SaveDimensionDto)
  dimensions!: SaveDimensionDto[];
}

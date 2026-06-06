import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CourseType, FormType, RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QuestionsService } from './questions.service';
import { SaveTemplateDto } from './dto/save-template.dto';

interface UploadedExcel {
  buffer: Buffer;
  originalname: string;
}

function parseFormType(raw: string): FormType {
  if (raw in FormType) return raw as FormType;
  throw new BadRequestException(`未知评分表类型：${raw}`);
}
function parseCourseType(raw?: string): CourseType | undefined {
  if (!raw) return undefined;
  if (raw in CourseType) return raw as CourseType;
  throw new BadRequestException(`未知课程类型：${raw}`);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private questions: QuestionsService) {}

  /** GET /questions/template?formType=LECTURE&courseType=PROJECT —— 取生效模板用于渲染评分表 */
  @Get('template')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN, RoleCode.REVIEWER, RoleCode.PEER, RoleCode.STUDENT)
  getTemplate(
    @Query('formType') formType: FormType,
    @Query('courseType') courseType?: CourseType,
  ) {
    return this.questions.getActiveTemplate(formType, courseType);
  }

  @Get()
  @Roles(RoleCode.ADMIN)
  list() {
    return this.questions.list();
  }

  /**
   * POST /questions/template —— 保存题目模板（自动升版本、停用旧版）。
   * 落库前经 validateTemplate 合规校验（5 维度、分值和=满分、合计 100）。
   */
  @Post('template')
  @Roles(RoleCode.ADMIN)
  save(@Body() dto: SaveTemplateDto) {
    return this.questions.saveTemplate(dto);
  }

  /** GET /questions/export?formType=LECTURE&courseType= —— 导出题目 Excel（批量编辑用） */
  @Get('export')
  @Roles(RoleCode.ADMIN)
  async export(
    @Query('formType') formType: string,
    @Query('courseType') courseType: string | undefined,
    @Res() res: Response,
  ) {
    const ft = parseFormType(formType);
    const buf = await this.questions.exportTemplateExcel(
      ft,
      parseCourseType(courseType),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="questions_${ft}.xlsx"`,
    );
    res.send(buf);
  }

  /** POST /questions/import?formType=LECTURE&courseType= —— 上传题目 Excel 批量导入 */
  @Post('import')
  @Roles(RoleCode.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @Query('formType') formType: string,
    @Query('courseType') courseType: string | undefined,
    @UploadedFile() file: UploadedExcel,
  ) {
    if (!file) throw new BadRequestException('请上传 Excel 文件');
    return this.questions.importTemplateExcel(
      parseFormType(formType),
      parseCourseType(courseType),
      file.buffer,
    );
  }
}

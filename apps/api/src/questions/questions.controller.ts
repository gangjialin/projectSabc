import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CourseType, FormType, RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QuestionsService } from './questions.service';
import { SaveTemplateDto } from './dto/save-template.dto';

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
}

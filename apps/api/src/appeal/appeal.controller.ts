import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppealLevel, RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AppealService } from './appeal.service';
import {
  CreateAppealDto,
  EscalateAppealDto,
  ProcessAppealDto,
} from './dto/appeal.dto';

interface AuthedReq {
  user: { userId: string; account: string };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appeal')
export class AppealController {
  constructor(private appeal: AppealService) {}

  /** POST /appeal —— 教师提交院级申诉 */
  @Post()
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  create(@Req() req: AuthedReq, @Body() dto: CreateAppealDto) {
    return this.appeal.create(req.user.userId, dto);
  }

  /** GET /appeal/my —— 我的申诉 */
  @Get('my')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  my(@Req() req: AuthedReq) {
    return this.appeal.myAppeals(req.user.userId);
  }

  /** POST /appeal/:id/escalate —— 升级校级复核 */
  @Post(':id/escalate')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  escalate(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body() dto: EscalateAppealDto,
  ) {
    return this.appeal.escalate(id, req.user.userId, dto.reason);
  }

  /** GET /appeal/pending?level=COLLEGE|UNIVERSITY */
  @Get('pending')
  @Roles(RoleCode.ADMIN, RoleCode.QUALITY_DEPT, RoleCode.DEAN)
  pending(@Query('level') level: string) {
    return this.appeal.pending(
      level === 'UNIVERSITY' ? AppealLevel.UNIVERSITY : AppealLevel.COLLEGE,
    );
  }

  /** POST /appeal/:id/college-process —— 学院秘书组处理 */
  @Post(':id/college-process')
  @Roles(RoleCode.ADMIN)
  collegeProcess(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body() dto: ProcessAppealDto,
  ) {
    return this.appeal.process(
      id,
      AppealLevel.COLLEGE,
      req.user.account,
      dto.accept,
      dto.opinion,
    );
  }

  /** POST /appeal/:id/university-process —— 学校质保部处理 */
  @Post(':id/university-process')
  @Roles(RoleCode.QUALITY_DEPT, RoleCode.ADMIN)
  universityProcess(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body() dto: ProcessAppealDto,
  ) {
    return this.appeal.process(
      id,
      AppealLevel.UNIVERSITY,
      req.user.account,
      dto.accept,
      dto.opinion,
    );
  }

  /** GET /appeal?year= —— 全部申诉（归档查询） */
  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query('year') year?: string) {
    return this.appeal.list(year);
  }
}

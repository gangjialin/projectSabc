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
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ExemptionService } from './exemption.service';
import {
  CreateExemptionDto,
  PendingQueryDto,
  ReviewExemptionDto,
} from './dto/exemption.dto';

interface AuthedReq {
  user: { userId: string; account: string };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exemption')
export class ExemptionController {
  constructor(private exemption: ExemptionService) {}

  /** POST /exemption —— 教师发起免计入申请 */
  @Post()
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  create(@Req() req: AuthedReq, @Body() dto: CreateExemptionDto) {
    return this.exemption.create(req.user.userId, dto);
  }

  /** GET /exemption/my —— 我的申请 */
  @Get('my')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  my(@Req() req: AuthedReq) {
    return this.exemption.myApplications(req.user.userId);
  }

  /** GET /exemption/pending?level=DEPT|UNIVERSITY —— 待审列表（两级） */
  @Get('pending')
  @Roles(RoleCode.DEAN, RoleCode.ADMIN, RoleCode.QUALITY_DEPT)
  pending(@Query() q: PendingQueryDto) {
    return this.exemption.pending(q.level ?? 'DEPT');
  }

  /** POST /exemption/:id/dept-review —— 系部主任审核 */
  @Post(':id/dept-review')
  @Roles(RoleCode.DEAN)
  deptReview(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body() dto: ReviewExemptionDto,
  ) {
    return this.exemption.review(
      id,
      'DEPT',
      { userId: req.user.userId, name: req.user.account },
      dto.agree,
      dto.opinion,
    );
  }

  /** POST /exemption/:id/university-review —— 学校教学质量管理与保障部审核（第二级/终审） */
  @Post(':id/university-review')
  @Roles(RoleCode.QUALITY_DEPT, RoleCode.ADMIN)
  universityReview(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body() dto: ReviewExemptionDto,
  ) {
    return this.exemption.review(
      id,
      'UNIVERSITY',
      { userId: req.user.userId, name: req.user.account },
      dto.agree,
      dto.opinion,
    );
  }
}

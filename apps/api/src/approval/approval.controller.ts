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
import { ApprovalService } from './approval.service';
import { InitiateGradeChangeDto, VoteDto } from './dto/approval.dto';

interface AuthedReq {
  user: { userId: string };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approval')
export class ApprovalController {
  constructor(private approval: ApprovalService) {}

  /** POST /approval/publish?year= —— 管理员发起发布会签 */
  @Post('publish')
  @Roles(RoleCode.ADMIN)
  initiatePublish(@Req() req: AuthedReq, @Query('year') year: string) {
    return this.approval.initiatePublish(year, req.user.userId);
  }

  /** POST /approval/grade-change —— 管理员发起修改最终等级会签 */
  @Post('grade-change')
  @Roles(RoleCode.ADMIN)
  initiateGradeChange(
    @Req() req: AuthedReq,
    @Body() dto: InitiateGradeChangeDto,
  ) {
    return this.approval.initiateGradeChange(dto, req.user.userId);
  }

  /** GET /approval/pending —— 待我会签的请求（委员） */
  @Get('pending')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN, RoleCode.TEACHER)
  pending(@Req() req: AuthedReq) {
    return this.approval.pendingForMember(req.user.userId);
  }

  /** POST /approval/:id/vote —— 委员会签投票 */
  @Post(':id/vote')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN, RoleCode.TEACHER)
  vote(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body() dto: VoteDto,
  ) {
    return this.approval.vote(id, req.user.userId, dto.decision, dto.opinion);
  }

  /** GET /approval?year= —— 会签历史与审签记录 */
  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query('year') year?: string) {
    return this.approval.list(year);
  }
}

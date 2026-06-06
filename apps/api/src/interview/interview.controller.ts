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
import { InterviewService } from './interview.service';
import { CreateInterviewDto, ScoreInterviewDto } from './dto/interview.dto';

interface AuthedReq {
  user: { userId: string };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('interview')
export class InterviewController {
  constructor(private interview: InterviewService) {}

  /** POST /interview —— 管理员配置访谈 */
  @Post()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  create(@Body() dto: CreateInterviewDto) {
    return this.interview.create(dto);
  }

  /** GET /interview?year= —— 管理端列表 */
  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query('year') year?: string) {
    return this.interview.list(year);
  }

  /** GET /interview/assigned —— 访谈委员可评列表 */
  @Get('assigned')
  @Roles(RoleCode.INTERVIEWER, RoleCode.DEAN)
  assigned(@Req() req: AuthedReq) {
    return this.interview.assignedFor(req.user.userId);
  }

  /** POST /interview/:id/score —— 访谈委员提交评分 */
  @Post(':id/score')
  @Roles(RoleCode.INTERVIEWER, RoleCode.DEAN)
  score(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body() dto: ScoreInterviewDto,
  ) {
    return this.interview.score(id, req.user.userId, dto);
  }
}

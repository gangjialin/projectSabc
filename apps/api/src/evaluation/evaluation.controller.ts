import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EvaluationService } from './evaluation.service';
import { SubmitEvaluationDto } from './dto/submit.dto';

interface AuthedReq {
  user: { userId: string; roles: string[] };
  ip?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evaluation')
export class EvaluationController {
  constructor(private evaluation: EvaluationService) {}

  /** POST /evaluation/submit —— 委员/同行/学生提交 5 维度评分 */
  @Post('submit')
  @Roles(RoleCode.REVIEWER, RoleCode.DEAN, RoleCode.PEER, RoleCode.STUDENT, RoleCode.INTERVIEWER)
  submit(@Body() dto: SubmitEvaluationDto, @Req() req: AuthedReq) {
    return this.evaluation.submit(dto, req.user, req.ip);
  }
}

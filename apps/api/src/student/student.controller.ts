import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StudentService } from './student.service';
import { SubmitSurveyDto } from './dto/submit-survey.dto';

interface AuthedReq {
  user: { userId: string };
  ip?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('student')
export class StudentController {
  constructor(private student: StudentService) {}

  /** GET /student/my-teachers?year= —— 本学期给我上课、可评价的教师 */
  @Get('my-teachers')
  @Roles(RoleCode.STUDENT)
  myTeachers(@Req() req: AuthedReq, @Query('year') year: string) {
    return this.student.myTeachers(req.user.userId, year);
  }

  /** POST /student/survey —— 学生提交匿名问卷 */
  @Post('survey')
  @Roles(RoleCode.STUDENT)
  submit(@Req() req: AuthedReq, @Body() dto: SubmitSurveyDto) {
    return this.student.submitSurvey(req.user.userId, dto, req.ip);
  }
}

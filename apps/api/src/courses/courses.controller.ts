import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CoursesService } from './courses.service';
import { ReportCourseDto } from './dto/report-course.dto';

interface AuthedReq {
  user: { userId: string };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query('year') year?: string) {
    return this.courses.list(year);
  }

  /** GET /courses/classes?major=&grade= —— 按专业/年级从学生名单取真实班级（填报级联用） */
  @Get('classes')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN, RoleCode.ADMIN)
  classes(@Query('major') major?: string, @Query('grade') grade?: string) {
    return this.courses.listClasses(major, grade);
  }

  /** GET /courses/my-report?year= —— 教师查本人填报的参评课程 */
  @Get('my-report')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  myReport(@Req() req: AuthedReq, @Query('year') year: string) {
    return this.courses.getMyReport(req.user.userId, year);
  }

  /** POST /courses/report —— 教师填报/更新本学年参评课程 */
  @Post('report')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  report(@Req() req: AuthedReq, @Body() dto: ReportCourseDto) {
    return this.courses.reportCourse(req.user.userId, dto);
  }

  @Patch(':id/target')
  @Roles(RoleCode.ADMIN)
  setTarget(@Param('id') id: string, @Body('isTarget') isTarget: boolean) {
    return this.courses.setTargetCourse(id, isTarget);
  }
}

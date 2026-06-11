import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CourseType, RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CoursesService } from './courses.service';
import { SelectTargetDto } from './dto/select-target.dto';
import { XLSX_UPLOAD_OPTIONS } from '../import/import.controller';

interface AuthedReq {
  user: { userId: string };
}
interface UploadedExcel {
  buffer: Buffer;
  originalname: string;
}

function parseCourseType(raw?: string): CourseType {
  if (raw && raw in CourseType) return raw as CourseType;
  throw new BadRequestException(`未知课程类型：${raw}`);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  /**
   * POST /courses/import-schedule?year=2025-2026&type=THEORY —— 上传学校课表导入
   * （一次一个学期文件；type 为该文件统一课程类型）
   */
  @Post('import-schedule')
  @Roles(RoleCode.ADMIN)
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD_OPTIONS))
  importSchedule(
    @Query('year') year: string,
    @Query('type') type: string,
    @UploadedFile() file: UploadedExcel,
  ) {
    if (!file) throw new BadRequestException('请上传课表 xlsx');
    return this.courses.importSchedule(
      file.buffer,
      year || '2025-2026',
      parseCourseType(type),
    );
  }

  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query('year') year?: string) {
    return this.courses.list(year);
  }

  /** GET /courses/mine?year= —— 教师本学年的课程（来自课表，供选参评） */
  @Get('mine')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  mine(@Req() req: AuthedReq, @Query('year') year: string) {
    return this.courses.myCourses(req.user.userId, year || '2025-2026');
  }

  /** POST /courses/:id/select-target —— 教师选这门课为参评 */
  @Post(':id/select-target')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  selectTarget(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body() dto: SelectTargetDto,
  ) {
    return this.courses.selectTarget(req.user.userId, id, dto);
  }

  /** PATCH /courses/:id/target —— 管理员设/取消参评 */
  @Patch(':id/target')
  @Roles(RoleCode.ADMIN)
  setTarget(@Param('id') id: string, @Body('isTarget') isTarget: boolean) {
    return this.courses.setTargetCourse(id, isTarget);
  }
}

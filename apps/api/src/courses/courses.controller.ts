import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { CreateManualCourseDto } from './dto/create-manual.dto';
import { XLSX_UPLOAD_OPTIONS } from '../import/import.controller';

const DEFAULT_YEAR = '2025-2026';

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

  /** POST /courses/manual —— 教师手工录入课程（课表没有/选修课无班级时） */
  @Post('manual')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  createManual(@Req() req: AuthedReq, @Body() dto: CreateManualCourseDto) {
    return this.courses.createManual(req.user.userId, {
      courseCode: dto.courseCode,
      name: dto.name,
      type: dto.type,
      isElective: dto.isElective,
      academicYear: dto.academicYear || DEFAULT_YEAR,
      classNames: dto.classNames,
    });
  }

  /** POST /courses/:id/roster/import —— 教师导入选课名单（只匹配已有学号） */
  @Post(':id/roster/import')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD_OPTIONS))
  importRoster(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @UploadedFile() file: UploadedExcel,
  ) {
    if (!file) throw new BadRequestException('请上传名单 xlsx');
    return this.courses.importRoster(req.user.userId, id, file.buffer);
  }

  /** GET /courses/:id/roster —— 查看某课选课名单（教师本人/管理员/系主任） */
  @Get(':id/roster')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN, RoleCode.ADMIN)
  roster(@Param('id') id: string) {
    return this.courses.roster(id);
  }

  /** DELETE /courses/:id/roster/:studentId —— 移出名单中一名学生（教师本人） */
  @Delete(':id/roster/:studentId')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  removeEnrollment(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req: AuthedReq,
  ) {
    return this.courses.removeEnrollment(req.user.userId, id, studentId);
  }

  /** DELETE /courses/:id/roster —— 清空名单（教师本人） */
  @Delete(':id/roster')
  @Roles(RoleCode.TEACHER, RoleCode.DEAN)
  clearRoster(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.courses.clearRoster(req.user.userId, id);
  }

  /** GET /courses/manual?year= —— 管理员核查手工录入课程 + 名单人数 */
  @Get('manual/list')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  manualList(@Query('year') year?: string) {
    return this.courses.manualCourses(year);
  }
}

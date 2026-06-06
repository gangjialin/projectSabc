import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CoursesService } from './courses.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query('year') year?: string) {
    return this.courses.list(year);
  }

  @Patch(':id/target')
  @Roles(RoleCode.ADMIN)
  setTarget(@Param('id') id: string, @Body('isTarget') isTarget: boolean) {
    return this.courses.setTargetCourse(id, isTarget);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleCode, UserType } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(
    @Query('type') type?: UserType,
    @Query('department') department?: string,
  ) {
    return this.users.list(type, department);
  }

  /** POST /users/:id/dept-head —— 管理员设/取消系主任（DEAN 角色） */
  @Post(':id/dept-head')
  @Roles(RoleCode.ADMIN)
  setDeptHead(@Param('id') id: string, @Body('value') value: boolean) {
    return this.users.setDeptHead(id, value);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
}

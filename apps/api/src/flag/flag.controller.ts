import {
  Body,
  Controller,
  Delete,
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
import { FlagService } from './flag.service';
import { CreateFlagDto } from './dto/flag.dto';

interface AuthedReq {
  user: { userId: string };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('flag')
export class FlagController {
  constructor(private flag: FlagService) {}

  /** POST /flag —— 管理员录入前置限定标记 */
  @Post()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  create(@Req() req: AuthedReq, @Body() dto: CreateFlagDto) {
    return this.flag.create(req.user.userId, dto);
  }

  /** GET /flag?year= —— 前置限定列表 */
  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query('year') year?: string) {
    return this.flag.list(year);
  }

  /** DELETE /flag/:id —— 删除手工标记 */
  @Delete(':id')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  remove(@Param('id') id: string) {
    return this.flag.remove(id);
  }
}

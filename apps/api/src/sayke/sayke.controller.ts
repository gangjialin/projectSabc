import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SaykeService } from './sayke.service';
import { SaykeGateway } from './sayke.gateway';
import { CreateSessionDto } from './dto/create-session.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sayke')
export class SaykeController {
  constructor(
    private sayke: SaykeService,
    private gateway: SaykeGateway,
  ) {}

  /** POST /sayke —— 创建说课场次 */
  @Post()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  create(@Body() dto: CreateSessionDto) {
    return this.sayke.createSession(dto);
  }

  /** GET /sayke —— 历史场次列表（控制台恢复选择） */
  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query('year') year?: string) {
    return this.sayke.listSessions(year);
  }

  /** GET /sayke/:id —— 场次详情（含教师/课程名、当前进度、实时聚合） */
  @Get(':id')
  @Roles(
    RoleCode.ADMIN,
    RoleCode.DEAN,
    RoleCode.PEER,
    RoleCode.TEACHER,
    RoleCode.REVIEWER,
  )
  async get(@Param('id') id: string) {
    const session = await this.sayke.getSession(id);
    const live = session.currentTeacherId
      ? await this.sayke.liveState(id, session.currentTeacherId)
      : null;
    return { session, live };
  }

  /** POST /sayke/:id/current —— 设当前说课教师并广播 */
  @Post(':id/current')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async setCurrent(
    @Param('id') id: string,
    @Body('sessionTeacherId') sessionTeacherId: string,
  ) {
    await this.sayke.setCurrent(id, sessionTeacherId);
    await this.gateway.broadcastState(id);
    return { ok: true };
  }

  /** POST /sayke/:id/lock —— 锁定当前教师打分并广播 */
  @Post(':id/lock')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async lock(@Param('id') id: string) {
    await this.sayke.lockCurrent(id);
    await this.gateway.broadcastState(id);
    return { ok: true };
  }
}

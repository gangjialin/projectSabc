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
import { RoleCode, TaskStatus } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TasksService } from './tasks.service';
import {
  AssignBatchDto,
  AssignTaskDto,
  ListTasksQueryDto,
} from './dto/assign.dto';

interface AuthedReq {
  user: { userId: string; roles: string[] };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  /** POST /tasks/assign —— 管理员分配单个任务 */
  @Post('assign')
  @Roles(RoleCode.ADMIN)
  assign(@Body() dto: AssignTaskDto) {
    return this.tasks.assign(dto);
  }

  /** POST /tasks/assign-batch —— 管理员批量分配 */
  @Post('assign-batch')
  @Roles(RoleCode.ADMIN)
  assignBatch(@Body() dto: AssignBatchDto) {
    return this.tasks.assignBatch(dto.items);
  }

  /** GET /tasks —— 管理端查询（按学年/委员/课程/类型/状态筛选） */
  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  list(@Query() query: ListTasksQueryDto) {
    return this.tasks.list(query);
  }

  /** GET /tasks/my —— 委员待办任务列表 */
  @Get('my')
  @Roles(RoleCode.REVIEWER, RoleCode.DEAN)
  my(@Req() req: AuthedReq, @Query('status') status?: TaskStatus) {
    return this.tasks.listForReviewer(req.user.userId, status);
  }

  /** PATCH /tasks/:id/cancel —— 取消任务 */
  @Patch(':id/cancel')
  @Roles(RoleCode.ADMIN)
  cancel(@Param('id') id: string) {
    return this.tasks.cancel(id);
  }
}

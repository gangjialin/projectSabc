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
import { RoleCode, TaskStatus, TaskType } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TasksService } from './tasks.service';
import {
  AssignBatchDto,
  AssignTargetsDto,
  AssignTaskDto,
  ListTasksQueryDto,
  SetReviewerDto,
} from './dto/assign.dto';

interface AuthedReq {
  user: { userId: string; roles: string[] };
}

const EVAL_YEAR = '2025-2026';

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

  // ===== 系主任职能 =====

  /** GET /tasks/dept/teachers —— 系主任查看本系教师（含委员标记） */
  @Get('dept/teachers')
  @Roles(RoleCode.DEAN)
  deptTeachers(@Req() req: AuthedReq) {
    return this.tasks.deptTeachers(req.user.userId);
  }

  /** POST /tasks/dept/set-reviewer —— 任命/取消 质量委员或材料评阅人（本系） */
  @Post('dept/set-reviewer')
  @Roles(RoleCode.DEAN)
  setReviewer(@Req() req: AuthedReq, @Body() dto: SetReviewerDto) {
    return this.tasks.setReviewer(
      req.user.userId,
      dto.teacherId,
      dto.kind,
      dto.value,
    );
  }

  // ===== 委员自助选择评价对象 =====

  /** GET /tasks/reviewer/candidates?kind=LECTURE|MATERIAL —— 候选被评教师 */
  @Get('reviewer/candidates')
  @Roles(RoleCode.REVIEWER, RoleCode.DEAN)
  candidates(@Req() req: AuthedReq, @Query('kind') kind: string) {
    const k = kind === 'MATERIAL' ? TaskType.MATERIAL : TaskType.LECTURE;
    return this.tasks.reviewerCandidates(req.user.userId, k, EVAL_YEAR);
  }

  /** POST /tasks/reviewer/assign-targets —— 委员提交评价对象 */
  @Post('reviewer/assign-targets')
  @Roles(RoleCode.REVIEWER, RoleCode.DEAN)
  assignTargets(@Req() req: AuthedReq, @Body() dto: AssignTargetsDto) {
    return this.tasks.assignTargets(
      req.user.userId,
      dto.kind,
      dto.teacherIds,
      EVAL_YEAR,
    );
  }
}

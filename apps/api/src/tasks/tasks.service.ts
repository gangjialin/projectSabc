import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { RoleCode, TaskStatus, TaskType, UserType } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AssignTaskDto,
  ListTasksQueryDto,
} from './dto/assign.dto';
import { checkAssignment } from './tasks.validators';

export interface BatchAssignResult {
  created: number;
  failed: { index: number; courseId: string; reviewerId: string; message: string }[];
}

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  /**
   * 分配单个评价任务（T-305，管理员）。
   * 校验链：取课程/委员 → 查重复 & 听课计数 → 纯函数 checkAssignment → 落库。
   */
  async assign(dto: AssignTaskDto) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: dto.courseId },
    });
    const reviewer = await this.prisma.user.findUniqueOrThrow({
      where: { id: dto.reviewerId },
      select: { id: true, userType: true, name: true },
    });

    const hasDuplicate =
      (await this.prisma.reviewTask.count({
        where: {
          courseId: dto.courseId,
          reviewerId: dto.reviewerId,
          taskType: dto.taskType,
          status: { not: TaskStatus.CANCELED },
        },
      })) > 0;

    const existingLectureCount =
      dto.taskType === TaskType.LECTURE
        ? await this.prisma.reviewTask.count({
            where: {
              reviewerId: dto.reviewerId,
              taskType: TaskType.LECTURE,
              status: { not: TaskStatus.CANCELED },
              course: {
                teacherId: course.teacherId,
                academicYear: course.academicYear,
              },
            },
          })
        : 0;

    const check = checkAssignment({
      courseTeacherId: course.teacherId,
      reviewerId: dto.reviewerId,
      reviewerUserType: reviewer.userType as unknown as UserType,
      taskType: dto.taskType,
      hasDuplicate,
      existingLectureCount,
    });

    if (!check.ok) {
      if (check.code === 'DUPLICATE') {
        throw new ConflictException(check.message);
      }
      throw new BadRequestException(check.message);
    }

    return this.prisma.reviewTask.create({
      data: {
        courseId: dto.courseId,
        reviewerId: dto.reviewerId,
        taskType: dto.taskType,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        status: TaskStatus.PENDING,
      },
    });
  }

  /**
   * 批量分配：逐条独立校验，失败不影响其它条目，汇总结果（管理员批量分配 UI 用）。
   */
  async assignBatch(items: AssignTaskDto[]): Promise<BatchAssignResult> {
    const result: BatchAssignResult = { created: 0, failed: [] };
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      try {
        await this.assign(item);
        result.created++;
      } catch (e) {
        result.failed.push({
          index: i,
          courseId: item.courseId,
          reviewerId: item.reviewerId,
          message: e instanceof Error ? e.message : '分配失败',
        });
      }
    }
    return result;
  }

  /** 管理端按筛选条件查询任务 */
  list(query: ListTasksQueryDto) {
    return this.prisma.reviewTask.findMany({
      where: {
        reviewerId: query.reviewerId,
        courseId: query.courseId,
        taskType: query.taskType,
        status: query.status,
        course: query.year ? { academicYear: query.year } : undefined,
      },
      include: {
        course: { select: { courseCode: true, name: true, teacherId: true } },
        reviewer: { select: { name: true, loginAccount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 委员"待办任务"列表（需求 §8.3） */
  listForReviewer(reviewerId: string, status?: TaskStatus) {
    return this.prisma.reviewTask.findMany({
      where: { reviewerId, status: status ?? TaskStatus.PENDING },
      include: {
        course: {
          select: {
            id: true,
            courseCode: true,
            name: true,
            type: true,
            teacher: { select: { name: true } },
          },
        },
      },
      orderBy: { plannedDate: 'asc' },
    });
  }

  /** 取消任务（仅未完成可取消） */
  async cancel(id: string) {
    const task = await this.prisma.reviewTask.findUniqueOrThrow({
      where: { id },
    });
    if (task.status === TaskStatus.COMPLETED) {
      throw new BadRequestException('已完成的任务不可取消');
    }
    return this.prisma.reviewTask.update({
      where: { id },
      data: { status: TaskStatus.CANCELED },
    });
  }

  // ===== 系主任职能：任命质量委员 / 材料评阅人（本系范围） =====

  private async deptOf(userId: string): Promise<string> {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { department: true },
    });
    if (!u.department) {
      throw new BadRequestException('您未设置所属系部，无法管理本系人员');
    }
    return u.department;
  }

  /** 系主任查看本系教师（含质量委员/材料评阅人标记） */
  async deptTeachers(deptHeadId: string) {
    const department = await this.deptOf(deptHeadId);
    return this.prisma.user.findMany({
      where: { userType: UserType.TEACHER, department },
      select: {
        id: true,
        name: true,
        loginAccount: true,
        isLectureReviewer: true,
        isMaterialReviewer: true,
      },
      orderBy: { loginAccount: 'asc' },
    });
  }

  /** 系主任任命/取消 本系某教师为 质量委员(LECTURE) 或 材料评阅人(MATERIAL) */
  async setReviewer(
    deptHeadId: string,
    teacherId: string,
    kind: TaskType,
    value: boolean,
  ) {
    const department = await this.deptOf(deptHeadId);
    const teacher = await this.prisma.user.findUniqueOrThrow({
      where: { id: teacherId },
      select: { department: true },
    });
    if (teacher.department !== department) {
      throw new BadRequestException('只能任命本系教师');
    }
    const field =
      kind === TaskType.LECTURE ? 'isLectureReviewer' : 'isMaterialReviewer';
    await this.prisma.user.update({
      where: { id: teacherId },
      data: { [field]: value },
    });
    // 任命时授予 REVIEWER 角色（以便进入"我的评分任务"打分）
    if (value) {
      const role = await this.prisma.role.findUnique({
        where: { code: RoleCode.REVIEWER },
      });
      if (role) {
        await this.prisma.userRole.upsert({
          where: { userId_roleId: { userId: teacherId, roleId: role.id } },
          create: { userId: teacherId, roleId: role.id },
          update: {},
        });
      }
    }
    return { ok: true };
  }

  // ===== 委员自助选择评价对象 =====

  /**
   * 候选被评教师：LECTURE(质量委员)=全院除本人；MATERIAL(材料评阅人)=本系除本人。
   * 附其参评课程与"我是否已分配"。
   */
  async reviewerCandidates(
    reviewerId: string,
    kind: TaskType,
    academicYear: string,
  ) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: reviewerId },
      select: { department: true, isLectureReviewer: true, isMaterialReviewer: true },
    });
    const allowed =
      kind === TaskType.LECTURE ? me.isLectureReviewer : me.isMaterialReviewer;
    if (!allowed) {
      throw new BadRequestException('您不是该类型的评价人');
    }

    const where: Record<string, unknown> = {
      userType: UserType.TEACHER,
      id: { not: reviewerId },
    };
    if (kind === TaskType.MATERIAL) where.department = me.department; // 材料仅本系

    const teachers = await this.prisma.user.findMany({
      where,
      select: { id: true, name: true, loginAccount: true, department: true },
      orderBy: { loginAccount: 'asc' },
    });

    // 各教师参评课程
    const targetCourses = await this.prisma.course.findMany({
      where: { academicYear, isTargetCourse: true },
      select: { id: true, name: true, teacherId: true },
    });
    const courseByTeacher = new Map(targetCourses.map((c) => [c.teacherId, c]));

    // 我已分配的任务（该类型）
    const myTasks = await this.prisma.reviewTask.findMany({
      where: { reviewerId, taskType: kind, status: { not: TaskStatus.CANCELED } },
      select: { courseId: true },
    });
    const assignedCourseIds = new Set(myTasks.map((t) => t.courseId));

    return teachers.map((t) => {
      const c = courseByTeacher.get(t.id);
      return {
        teacherId: t.id,
        name: t.name,
        account: t.loginAccount,
        department: t.department,
        hasTargetCourse: !!c,
        courseId: c?.id ?? null,
        courseName: c?.name ?? null,
        assigned: c ? assignedCourseIds.has(c.id) : false,
      };
    });
  }

  /** 委员提交评价对象：对每个教师的参评课程建任务（复用 assign 的校验） */
  async assignTargets(
    reviewerId: string,
    kind: TaskType,
    teacherIds: string[],
    academicYear: string,
  ) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: reviewerId },
      select: { isLectureReviewer: true, isMaterialReviewer: true },
    });
    const allowed =
      kind === TaskType.LECTURE ? me.isLectureReviewer : me.isMaterialReviewer;
    if (!allowed) throw new BadRequestException('您不是该类型的评价人');

    let created = 0;
    const failed: { teacherId: string; message: string }[] = [];
    for (const teacherId of teacherIds) {
      const course = await this.prisma.course.findFirst({
        where: { teacherId, academicYear, isTargetCourse: true },
        select: { id: true },
      });
      if (!course) {
        failed.push({ teacherId, message: '该教师未选参评课程，跳过' });
        continue;
      }
      try {
        await this.assign({ courseId: course.id, reviewerId, taskType: kind });
        created++;
      } catch (e) {
        failed.push({
          teacherId,
          message: e instanceof Error ? e.message : '分配失败',
        });
      }
    }
    return { created, failed };
  }
}

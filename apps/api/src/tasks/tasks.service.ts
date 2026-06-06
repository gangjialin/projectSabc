import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { TaskStatus, TaskType, UserType } from '@app/shared';
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
}

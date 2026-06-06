import { TaskType, UserType } from '@app/shared';

/**
 * 单一委员对同一教师"全学年听课"次数上限（需求 §4.4：不超过 2 次）。
 * 仅约束听课（LECTURE）；材料审查不设此上限。
 */
export const LECTURE_MAX_PER_TEACHER_PER_YEAR = 2;

export type AssignRejectCode =
  | 'SELF_COURSE' // 评自己课程
  | 'REVIEWER_IS_STUDENT' // 学生不可作为委员
  | 'DUPLICATE' // 重复分配
  | 'LECTURE_LIMIT'; // 听课次数超限

export type AssignCheckResult =
  | { ok: true }
  | { ok: false; code: AssignRejectCode; message: string };

export interface AssignCheckInput {
  /** 课程主讲教师 id */
  courseTeacherId: string;
  /** 被分配的委员 id */
  reviewerId: string;
  /** 委员的用户类型 */
  reviewerUserType: UserType;
  taskType: TaskType;
  /** 是否已存在相同（课程+委员+类型、未取消）的任务 */
  hasDuplicate: boolean;
  /** 该委员本学年对此教师已有的听课任务数（未取消），用于 ≤2 判定 */
  existingLectureCount: number;
}

/**
 * 任务分配合法性校验（纯函数，不触库）。
 * 计数类前置（hasDuplicate / existingLectureCount）由 service 查库后传入。
 *
 * 规则（需求 §4.4 / §8.2）：
 *  1. 委员不得评价自己主讲的课程；
 *  2. 学生不可作为评审委员；
 *  3. 同一课程+委员+任务类型不可重复分配；
 *  4. 同一委员对同一教师全学年听课 ≤ 2 次。
 */
export function checkAssignment(input: AssignCheckInput): AssignCheckResult {
  if (input.reviewerUserType === UserType.STUDENT) {
    return {
      ok: false,
      code: 'REVIEWER_IS_STUDENT',
      message: '学生不可作为评审委员',
    };
  }
  if (input.courseTeacherId === input.reviewerId) {
    return {
      ok: false,
      code: 'SELF_COURSE',
      message: '委员不得评价自己主讲的课程',
    };
  }
  if (input.hasDuplicate) {
    return {
      ok: false,
      code: 'DUPLICATE',
      message: '该委员已被分配此课程的相同任务',
    };
  }
  if (
    input.taskType === TaskType.LECTURE &&
    input.existingLectureCount >= LECTURE_MAX_PER_TEACHER_PER_YEAR
  ) {
    return {
      ok: false,
      code: 'LECTURE_LIMIT',
      message: `该委员本学年对该教师的听课任务已达 ${LECTURE_MAX_PER_TEACHER_PER_YEAR} 次上限`,
    };
  }
  return { ok: true };
}

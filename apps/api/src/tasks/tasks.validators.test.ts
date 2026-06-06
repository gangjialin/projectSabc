import { TaskType, UserType } from '@app/shared';
import {
  checkAssignment,
  LECTURE_MAX_PER_TEACHER_PER_YEAR,
  type AssignCheckInput,
} from './tasks.validators';

function base(overrides: Partial<AssignCheckInput> = {}): AssignCheckInput {
  return {
    courseTeacherId: 'teacherA',
    reviewerId: 'reviewerX',
    reviewerUserType: UserType.TEACHER,
    taskType: TaskType.LECTURE,
    hasDuplicate: false,
    existingLectureCount: 0,
    ...overrides,
  };
}

describe('checkAssignment', () => {
  it('合法分配 → ok', () => {
    expect(checkAssignment(base())).toEqual({ ok: true });
  });

  it('评自己课程 → SELF_COURSE', () => {
    const r = checkAssignment(base({ reviewerId: 'teacherA' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SELF_COURSE');
  });

  it('学生作为委员 → REVIEWER_IS_STUDENT（优先于评自己课程判定）', () => {
    const r = checkAssignment(
      base({ reviewerUserType: UserType.STUDENT, reviewerId: 'teacherA' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('REVIEWER_IS_STUDENT');
  });

  it('重复分配 → DUPLICATE', () => {
    const r = checkAssignment(base({ hasDuplicate: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE');
  });

  it('听课已达 2 次 → LECTURE_LIMIT', () => {
    const r = checkAssignment(
      base({ existingLectureCount: LECTURE_MAX_PER_TEACHER_PER_YEAR }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('LECTURE_LIMIT');
  });

  it('听课第 2 次（已有 1 次）仍允许', () => {
    expect(checkAssignment(base({ existingLectureCount: 1 }))).toEqual({
      ok: true,
    });
  });

  it('材料审查不受听课次数上限约束', () => {
    const r = checkAssignment(
      base({ taskType: TaskType.MATERIAL, existingLectureCount: 5 }),
    );
    expect(r).toEqual({ ok: true });
  });
});

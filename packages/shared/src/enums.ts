/**
 * 领域枚举 —— 与 prisma/schema.prisma 严格对应。
 * 任何一侧改动，另一侧必须同步（design.md §3.2）。
 */

export enum UserType {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN',
}

/** 课程类型（题目库按此版本化） */
export enum CourseType {
  THEORY = 'THEORY', // 理论课
  PRACTICE = 'PRACTICE', // 实践课
  PROJECT = 'PROJECT', // 项目课
  THESIS = 'THESIS', // 毕业设计
}

export enum CourseLevel {
  CORE = 'CORE', // 专业核心课
  PROJECT_L1 = 'PROJECT_L1', // 一级项目课
  PROJECT_L2 = 'PROJECT_L2', // 二级项目课
  REGULAR = 'REGULAR', // 一般课
}

/** 评分表类型 */
export enum FormType {
  LECTURE = 'LECTURE', // 听课
  MATERIAL = 'MATERIAL', // 材料审查
  PEER = 'PEER', // 同行说课
  STUDENT = 'STUDENT', // 学生问卷
}

export enum TaskType {
  LECTURE = 'LECTURE',
  MATERIAL = 'MATERIAL',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

/** 综合评价等级 */
export enum Grade {
  S = 'S', // 示范级
  A = 'A', // 发展级 II
  B = 'B', // 发展级 I
  C = 'C', // 关注级
  D = 'D', // 不合格
}

/** 前置限定标记类型 */
export enum FlagType {
  ETHICS_ISSUE = 'ETHICS_ISSUE', // 严重师德问题
  MATERIAL_FRAUD = 'MATERIAL_FRAUD', // 考核材料伪造
  STUDENT_SCORE_LOW = 'STUDENT_SCORE_LOW', // 学生评分 < 90
  RESPONSIBILITY_ACCIDENT = 'RESPONSIBILITY_ACCIDENT', // 责任事故
  TEACHING_ERROR = 'TEACHING_ERROR', // 一般教学差错
  DIM_VETO = 'DIM_VETO', // 维度否决（系统自动）
}

/** 等级限制（前置限定的后果） */
export enum GradeRestriction {
  FORCE_D = 'FORCE_D', // 直接 D
  NO_S = 'NO_S', // 不得 S
  NO_B_OR_ABOVE = 'NO_B_OR_ABOVE', // 不得 B 及以上
  NO_A_OR_ABOVE = 'NO_A_OR_ABOVE', // 不得 A 及以上
}

export enum ExemptionStatus {
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum TrackingStatus {
  DRAFTING = 'DRAFTING',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum AppealLevel {
  COLLEGE = 'COLLEGE',
  UNIVERSITY = 'UNIVERSITY',
}

export enum AppealStatus {
  SUBMITTED = 'SUBMITTED',
  PROCESSING = 'PROCESSING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

export enum ResultStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PUBLISHED = 'PUBLISHED',
  APPEAL = 'APPEAL',
  CONFIRMED = 'CONFIRMED',
}

export enum SessionStatus {
  PREPARED = 'PREPARED',
  IN_PROGRESS = 'IN_PROGRESS',
  LOCKED = 'LOCKED',
}

export enum TeacherSayStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED',
}

export enum InterviewStatus {
  PLANNED = 'PLANNED',
  COMPLETED = 'COMPLETED',
}

/** 内置角色码（seed） */
export enum RoleCode {
  ADMIN = 'ADMIN', // 系统管理员（秘书组）
  DEAN = 'DEAN', // 院长/系主任
  REVIEWER = 'REVIEWER', // 听课/材料审查委员
  INTERVIEWER = 'INTERVIEWER', // 访谈委员
  PEER = 'PEER', // 同行教师
  STUDENT = 'STUDENT', // 学生
  TEACHER = 'TEACHER', // 被评教师
  QUALITY_DEPT = 'QUALITY_DEPT', // 教学质量保障部
}

/** 维度编号常量 */
export const DIMENSION_NOS = [1, 2, 3, 4, 5] as const;
export type DimensionNo = (typeof DIMENSION_NOS)[number];

export const DIMENSION_NAMES: Record<DimensionNo, string> = {
  1: '目标与思政',
  2: '内容与方式',
  3: '考核与评价',
  4: '效果与达成',
  5: '反思与改进',
};

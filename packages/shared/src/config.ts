import type { DimensionNo } from './enums';

/**
 * 系统配置 —— 对应 design.md §3.2 SystemConfig。
 * 所有权重、比例、阈值、维度满分均可配置（需求 §十 可维护性）。
 * 运行时从 DB 的 SystemConfig 读取并覆盖默认值。
 */
export interface EvalConfig {
  /** 三维评价权重，之和必须 = 1 */
  weights: { supervisor: number; peer: number; student: number };
  /** 上级评价内部权重（听课/材料），之和 = 1 */
  supervisorSub: { lecture: number; material: number };
  /** 学生评价内部权重（问卷/访谈），之和 = 1 */
  studentSub: { survey: number; interview: number };
  /** 5 维度满分，之和必须 = 100 */
  dimensionMaxScores: Record<DimensionNo, number>;
  /** 维度否决阈值：维度加权得分率 < 此值 → 不得 A 及以上 */
  dimensionVetoThreshold: number;
  /** 等级配额比例 */
  gradeQuota: { s: number; saTotal: number; b: number; c: number };
  /** 最低评分人数要求 */
  minEvaluatorCount: {
    lecture: number;
    peer: number;
    studentSurvey: number;
    interview: number;
  };
  /** 申诉窗口（工作日） */
  appealWindowDays: number;
  /** 访谈满分（用于归一化到 100） */
  interviewMaxScore: number;
  /** 学生问卷"不得 S"阈值 */
  studentScoreNoSThreshold: number;
}

export const DEFAULT_CONFIG: EvalConfig = {
  weights: { supervisor: 0.4, peer: 0.3, student: 0.3 },
  supervisorSub: { lecture: 0.6, material: 0.4 },
  studentSub: { survey: 0.8, interview: 0.2 },
  dimensionMaxScores: { 1: 20, 2: 25, 3: 20, 4: 20, 5: 15 },
  dimensionVetoThreshold: 0.7,
  gradeQuota: { s: 0.1, saTotal: 0.4, b: 0.3, c: 0.3 },
  minEvaluatorCount: { lecture: 2, peer: 3, studentSurvey: 10, interview: 2 },
  appealWindowDays: 3,
  interviewMaxScore: 20,
  studentScoreNoSThreshold: 90,
};

/** 李克特量表映射（界面只显文字，提交存 1-5） */
export const LIKERT_LABELS: Record<number, string> = {
  5: '完全符合 / 表现突出',
  4: '比较符合 / 表现较好',
  3: '基本符合 / 一般达成',
  2: '不太符合 / 存在明显不足',
  1: '完全不符合 / 严重不足',
};

/** 校验配置自洽性，返回错误清单（空数组表示合法） */
export function validateConfig(c: EvalConfig): string[] {
  const errors: string[] = [];
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const approx = (v: number, target: number) => Math.abs(v - target) < 1e-9;

  if (!approx(sum(Object.values(c.weights)), 1)) {
    errors.push('三维权重之和必须为 1');
  }
  if (!approx(sum(Object.values(c.supervisorSub)), 1)) {
    errors.push('上级评价内部权重之和必须为 1');
  }
  if (!approx(sum(Object.values(c.studentSub)), 1)) {
    errors.push('学生评价内部权重之和必须为 1');
  }
  if (!approx(sum(Object.values(c.dimensionMaxScores)), 100)) {
    errors.push('5 维度满分之和必须为 100');
  }
  if (c.dimensionVetoThreshold <= 0 || c.dimensionVetoThreshold > 1) {
    errors.push('维度否决阈值必须在 (0, 1] 区间');
  }
  return errors;
}

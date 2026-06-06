import { DEFAULT_CONFIG, type EvalConfig } from '../config';
import { round2 } from './dimension';

/**
 * 上级评价分 = 听课平均 × 60% + 材料审查平均 × 40%。
 * 需求 §6.2。任一子项缺失时按 null 处理（数据不完整由上层判定）。
 */
export function supervisorScore(
  lectureAvg: number | null,
  materialAvg: number | null,
  config: EvalConfig = DEFAULT_CONFIG,
): number | null {
  if (lectureAvg === null || materialAvg === null) return null;
  const { lecture, material } = config.supervisorSub;
  return round2(lectureAvg * lecture + materialAvg * material);
}

/**
 * 访谈分归一化到 100 分制：访谈平均(20分制) ÷ 20 × 100。
 * 需求 §6.4。
 */
export function normalizeInterview(
  interviewAvg: number | null,
  config: EvalConfig = DEFAULT_CONFIG,
): number | null {
  if (interviewAvg === null) return null;
  return round2((interviewAvg / config.interviewMaxScore) * 100);
}

/**
 * 学生评价分 = 问卷平均 × 80% + 访谈归一化 × 20%。
 * 需求 §6.4。问卷指已排除"免计入"记录后的平均。
 */
export function studentScore(
  surveyAvg: number | null,
  interviewAvg: number | null,
  config: EvalConfig = DEFAULT_CONFIG,
): number | null {
  if (surveyAvg === null) return null;
  const normInterview = normalizeInterview(interviewAvg, config);
  const { survey, interview } = config.studentSub;
  // 访谈缺失时，问卷分占满（避免因无访谈把学生分拉为 null）
  if (normInterview === null) return round2(surveyAvg);
  return round2(surveyAvg * survey + normInterview * interview);
}

/**
 * 综合评价分 S = 上级 × 40% + 同行 × 30% + 学生 × 30%。
 * 需求 §6.5。
 */
export function compositeScore(
  supervisor: number | null,
  peer: number | null,
  student: number | null,
  config: EvalConfig = DEFAULT_CONFIG,
): number | null {
  if (supervisor === null || peer === null || student === null) return null;
  const { supervisor: ws, peer: wp, student: wst } = config.weights;
  return round2(supervisor * ws + peer * wp + student * wst);
}

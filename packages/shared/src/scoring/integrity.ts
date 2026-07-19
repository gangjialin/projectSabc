import { DEFAULT_CONFIG, type EvalConfig } from '../config';

/** 各来源的评分人/记录数 */
export interface EvaluatorCounts {
  lecture: number; // 听课次数
  material: number; // 材料审查次数
  peer: number; // 同行打分人数
  studentSurvey: number; // 学生问卷有效份数（已排除免计入）
  interview: number; // 访谈委员人数（0=未安排访谈）
}

export interface IntegrityWarning {
  item: keyof EvaluatorCounts;
  required: number;
  actual: number;
  /** blocking=true 计入"数据不完整"，false 仅提示（如同行<3 改用算术平均） */
  blocking: boolean;
  message: string;
}

export interface IntegrityResult {
  /** 关键数据是否齐全（听课≥2、材料≥1、学生问卷≥阈值） */
  isComplete: boolean;
  warnings: IntegrityWarning[];
}

/**
 * 数据完整性检查（需求 §6.7）。纯函数，便于单测。
 *
 * 阻断项（blocking，影响 isComplete）：
 *  - 听课 ≥ 2 次
 *  - 材料审查 ≥ 1 次
 *  - 学生问卷 ≥ 阈值（默认 10）
 * 提示项（非阻断）：
 *  - 同行 < 3：仍可计算，但取算术平均不去极值（design §4.2）
 *  - 访谈已安排但委员 < 2：提示（访谈未安排即 0 不提示，学生分由问卷占满）
 */
export function checkDataCompleteness(
  counts: EvaluatorCounts,
  config: EvalConfig = DEFAULT_CONFIG,
): IntegrityResult {
  const warnings: IntegrityWarning[] = [];
  const min = config.minEvaluatorCount;
  // 权重为 0 的来源本轮不计入综合分，其数据量不作为完整性要求
  const useSupervisor = config.weights.supervisor > 0;
  const usePeer = config.weights.peer > 0;
  const useStudent = config.weights.student > 0;

  if (useSupervisor && counts.lecture < min.lecture) {
    warnings.push({
      item: 'lecture',
      required: min.lecture,
      actual: counts.lecture,
      blocking: true,
      message: `听课次数不足，需≥${min.lecture} 次，当前 ${counts.lecture} 次`,
    });
  }
  if (useSupervisor && counts.material < 1) {
    warnings.push({
      item: 'material',
      required: 1,
      actual: counts.material,
      blocking: true,
      message: `缺少材料审查记录，需≥1 次，当前 ${counts.material} 次`,
    });
  }
  if (useStudent && counts.studentSurvey < min.studentSurvey) {
    warnings.push({
      item: 'studentSurvey',
      required: min.studentSurvey,
      actual: counts.studentSurvey,
      blocking: true,
      message: `学生问卷份数不足，需≥${min.studentSurvey} 份，当前 ${counts.studentSurvey} 份`,
    });
  }
  if (usePeer && counts.peer > 0 && counts.peer < min.peer) {
    warnings.push({
      item: 'peer',
      required: min.peer,
      actual: counts.peer,
      blocking: false,
      message: `同行打分不足 ${min.peer} 人（当前 ${counts.peer}），将取算术平均不去极值`,
    });
  }
  if (useStudent && counts.interview > 0 && counts.interview < min.interview) {
    warnings.push({
      item: 'interview',
      required: min.interview,
      actual: counts.interview,
      blocking: false,
      message: `访谈委员不足 ${min.interview} 人（当前 ${counts.interview}）`,
    });
  }

  return {
    isComplete: !warnings.some((w) => w.blocking),
    warnings,
  };
}

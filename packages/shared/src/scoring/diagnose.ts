import { DEFAULT_CONFIG, type EvalConfig } from '../config';
import { DIMENSION_NAMES, DIMENSION_NOS, type DimensionNo } from '../enums';

/** 各维度改进建议（取自评价标准要点，用于成绩单文字诊断） */
export const DIMENSION_SUGGESTIONS: Record<DimensionNo, string> = {
  1: '进一步明确高阶能力目标，深化课程思政与专业内容的有机融合。',
  2: '强化项目/案例导引，提升学生课堂有效参与与数字化工具的运用。',
  3: '提高高阶能力考核占比，完善过程性评价记录与评分量规。',
  4: '加强学生达成度证据收集，提升目标达成与课程满意度。',
  5: '深化课程总结分析，形成具体可操作的持续改进闭环。',
};

export interface DimensionPoint {
  dim: DimensionNo;
  name: string;
  rate: number;
}

export interface Diagnosis {
  strongest: DimensionPoint | null;
  weakest: DimensionPoint | null;
  belowThreshold: DimensionPoint[]; // 低于否决阈值的维度
  suggestions: string[]; // 针对薄弱维度的建议
  summary: string; // 一段文字诊断
}

/**
 * 基于 5 维度加权得分率，规则化生成强弱诊断（T-805，确定性、可解释、无需 AI）。
 */
export function diagnose(
  weightedRates: Record<DimensionNo, number | null>,
  config: EvalConfig = DEFAULT_CONFIG,
): Diagnosis {
  const points: DimensionPoint[] = [];
  for (const n of DIMENSION_NOS) {
    const rate = weightedRates[n];
    if (rate !== null && rate !== undefined) {
      points.push({ dim: n, name: DIMENSION_NAMES[n], rate });
    }
  }

  if (points.length === 0) {
    return {
      strongest: null,
      weakest: null,
      belowThreshold: [],
      suggestions: [],
      summary: '暂无足够数据生成诊断。',
    };
  }

  const sorted = [...points].sort((a, b) => b.rate - a.rate);
  const strongest = sorted[0]!;
  const weakest = sorted[sorted.length - 1]!;
  const threshold = config.dimensionVetoThreshold;
  const belowThreshold = points
    .filter((p) => p.rate < threshold)
    .sort((a, b) => a.rate - b.rate);

  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;
  const suggestions = (belowThreshold.length > 0 ? belowThreshold : [weakest]).map(
    (p) => `「${p.name}」：${DIMENSION_SUGGESTIONS[p.dim]}`,
  );

  let summary = `您表现最突出的是「${strongest.name}」（得分率 ${pct(strongest.rate)}）；`;
  summary += `相对薄弱的是「${weakest.name}」（${pct(weakest.rate)}）。`;
  if (belowThreshold.length > 0) {
    summary +=
      `⚠ 其中 ${belowThreshold
        .map((p) => `「${p.name}」`)
        .join('、')} 低于 ${pct(threshold)} 的否决线，` +
      `根据规定将影响最终等级上限，建议优先改进。`;
  }

  return { strongest, weakest, belowThreshold, suggestions, summary };
}

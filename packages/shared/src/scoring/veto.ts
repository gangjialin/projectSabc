import { DEFAULT_CONFIG, type EvalConfig } from '../config';
import { DIMENSION_NOS, type DimensionNo } from '../enums';
import { round4 } from './dimension';
import type { DimensionRateTriple } from './types';

/** 教师 5 维度的三维得分率输入 */
export type DimensionRates = Record<
  DimensionNo,
  { supervisor: number | null; peer: number | null; student: number | null }
>;

export interface VetoResult {
  /** 5 维度的加权得分率明细 */
  dimensions: Record<DimensionNo, DimensionRateTriple>;
  /** 是否触发维度否决 */
  hasDimVeto: boolean;
  /** 触发否决的维度编号列表，如 [3, 5] */
  vetoDimensions: DimensionNo[];
}

/**
 * 维度加权得分率 = 上级 × 0.4 + 同行 × 0.3 + 学生 × 0.3（design.md §4.2）。
 *
 * 数据不完整处理：若三维中某些来源缺失（null），则在"已有来源"间按原比例
 * 重新归一化权重计算，避免因缺一项而把得分率误判为偏低进而误触发否决
 * （对应风险对策"维度否决误触发"）。三者全缺 → null（无法判定）。
 */
export function weightedDimensionRate(
  triple: { supervisor: number | null; peer: number | null; student: number | null },
  config: EvalConfig = DEFAULT_CONFIG,
): number | null {
  // 权重为 0 的来源本轮不计入（与 compositeScore 口径一致），亦不参与归一化
  const parts: { rate: number; weight: number }[] = [];
  if (triple.supervisor !== null && config.weights.supervisor > 0)
    parts.push({ rate: triple.supervisor, weight: config.weights.supervisor });
  if (triple.peer !== null && config.weights.peer > 0)
    parts.push({ rate: triple.peer, weight: config.weights.peer });
  if (triple.student !== null && config.weights.student > 0)
    parts.push({ rate: triple.student, weight: config.weights.student });

  if (parts.length === 0) return null;
  const weightSum = parts.reduce((a, p) => a + p.weight, 0);
  const weighted = parts.reduce((a, p) => a + p.rate * p.weight, 0) / weightSum;
  return round4(weighted);
}

/**
 * 维度否决判定（design.md §4.2 detectDimensionVeto）。
 *
 * 规则：任一维度的加权得分率 < 阈值（默认 0.7）→ 触发否决，该教师不得评 A 及以上。
 * 边界：恰好等于阈值（0.70）不触发（test_plan U-VETO-02）。
 */
export function detectDimensionVeto(
  rates: DimensionRates,
  config: EvalConfig = DEFAULT_CONFIG,
): VetoResult {
  const dimensions = {} as Record<DimensionNo, DimensionRateTriple>;
  const vetoDimensions: DimensionNo[] = [];

  for (const n of DIMENSION_NOS) {
    const src = rates[n];
    const weighted = weightedDimensionRate(src, config);
    dimensions[n] = {
      supervisor: src.supervisor,
      peer: src.peer,
      student: src.student,
      weighted,
    };
    if (weighted !== null && weighted < config.dimensionVetoThreshold) {
      vetoDimensions.push(n);
    }
  }

  return {
    dimensions,
    hasDimVeto: vetoDimensions.length > 0,
    vetoDimensions,
  };
}

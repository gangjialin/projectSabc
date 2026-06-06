import { DEFAULT_CONFIG } from '../config';
import type { DimensionNo } from '../enums';
import { detectDimensionVeto, weightedDimensionRate, type DimensionRates } from './veto';

/** 全维度统一三维得分率的便捷构造 */
function uniformRates(
  sup: number | null,
  peer: number | null,
  stu: number | null,
): DimensionRates {
  const r = {} as DimensionRates;
  for (const n of [1, 2, 3, 4, 5] as DimensionNo[]) {
    r[n] = { supervisor: sup, peer: peer, student: stu };
  }
  return r;
}

describe('weightedDimensionRate (U-VETO-04)', () => {
  it('加权 = 上级×0.4 + 同行×0.3 + 学生×0.3', () => {
    // 0.8*0.4 + 0.7*0.3 + 0.6*0.3 = 0.32 + 0.21 + 0.18 = 0.71
    expect(weightedDimensionRate({ supervisor: 0.8, peer: 0.7, student: 0.6 })).toBeCloseTo(
      0.71,
      6,
    );
  });

  it('部分来源缺失 → 在已有来源间按比例归一化', () => {
    // 仅上级 0.8、同行 0.6 → 权重 0.4:0.3 归一化 = (0.8*0.4+0.6*0.3)/0.7，存储四舍五入到 4 位 = 0.7143
    expect(weightedDimensionRate({ supervisor: 0.8, peer: 0.6, student: null })).toBe(0.7143);
  });

  it('三者全缺 → null', () => {
    expect(weightedDimensionRate({ supervisor: null, peer: null, student: null })).toBeNull();
  });
});

describe('detectDimensionVeto', () => {
  it('U-VETO-01 维度加权率 0.69 → 触发否决', () => {
    const rates = uniformRates(0.69, 0.69, 0.69);
    const r = detectDimensionVeto(rates);
    expect(r.hasDimVeto).toBe(true);
    expect(r.vetoDimensions).toEqual([1, 2, 3, 4, 5]);
  });

  it('U-VETO-02 恰好 0.70 → 不触发（边界 < 0.7 才触发）', () => {
    const rates = uniformRates(0.7, 0.7, 0.7);
    const r = detectDimensionVeto(rates);
    expect(r.hasDimVeto).toBe(false);
    expect(r.vetoDimensions).toEqual([]);
  });

  it('U-VETO-03 仅部分维度 <0.7 → 只记录这些维度', () => {
    const rates = uniformRates(0.9, 0.9, 0.9);
    // 把维度 3 和 5 压到 0.6
    rates[3] = { supervisor: 0.6, peer: 0.6, student: 0.6 };
    rates[5] = { supervisor: 0.6, peer: 0.6, student: 0.6 };
    const r = detectDimensionVeto(rates);
    expect(r.hasDimVeto).toBe(true);
    expect(r.vetoDimensions).toEqual([3, 5]);
    expect(r.dimensions[1].weighted).toBeCloseTo(0.9, 6);
  });

  it('阈值可配置', () => {
    const cfg = { ...DEFAULT_CONFIG, dimensionVetoThreshold: 0.8 };
    const rates = uniformRates(0.75, 0.75, 0.75);
    expect(detectDimensionVeto(rates, cfg).hasDimVeto).toBe(true);
    expect(detectDimensionVeto(rates).hasDimVeto).toBe(false); // 默认 0.7 不触发
  });
});

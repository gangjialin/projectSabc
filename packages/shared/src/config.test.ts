import { DEFAULT_CONFIG, validateConfig } from './config';

describe('validateConfig', () => {
  it('默认配置合法', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual([]);
  });

  it('三维权重之和 ≠ 1 → 报错', () => {
    const bad = {
      ...DEFAULT_CONFIG,
      weights: { supervisor: 0.5, peer: 0.3, student: 0.3 },
    };
    expect(validateConfig(bad)).toContain('三维权重之和必须为 1');
  });

  it('维度满分之和 ≠ 100 → 报错', () => {
    const bad = {
      ...DEFAULT_CONFIG,
      dimensionMaxScores: { 1: 20, 2: 25, 3: 20, 4: 20, 5: 10 } as typeof DEFAULT_CONFIG.dimensionMaxScores,
    };
    expect(validateConfig(bad)).toContain('5 维度满分之和必须为 100');
  });

  it('否决阈值越界 → 报错', () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, dimensionVetoThreshold: 1.5 }).length).toBeGreaterThan(0);
    expect(validateConfig({ ...DEFAULT_CONFIG, dimensionVetoThreshold: 0 }).length).toBeGreaterThan(0);
  });
});

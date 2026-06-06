import type { DimensionNo } from '../enums';
import { diagnose } from './diagnose';

function rates(
  v: Partial<Record<DimensionNo, number | null>>,
): Record<DimensionNo, number | null> {
  return { 1: null, 2: null, 3: null, 4: null, 5: null, ...v };
}

describe('diagnose', () => {
  it('识别最强/最弱维度', () => {
    const d = diagnose(rates({ 1: 0.95, 2: 0.8, 3: 0.72, 4: 0.85, 5: 0.78 }));
    expect(d.strongest?.dim).toBe(1);
    expect(d.weakest?.dim).toBe(3);
    expect(d.belowThreshold).toEqual([]);
  });

  it('列出低于 70% 否决线的维度并给建议', () => {
    const d = diagnose(rates({ 1: 0.9, 2: 0.65, 3: 0.68, 4: 0.8, 5: 0.9 }));
    expect(d.belowThreshold.map((p) => p.dim)).toEqual([2, 3]); // 升序
    expect(d.summary).toContain('否决线');
    expect(d.suggestions.length).toBe(2);
  });

  it('全部数据缺失 → 友好提示', () => {
    const d = diagnose(rates({}));
    expect(d.strongest).toBeNull();
    expect(d.summary).toContain('暂无足够数据');
  });

  it('无薄弱维度时建议针对最弱项', () => {
    const d = diagnose(rates({ 1: 0.9, 2: 0.92, 3: 0.88, 4: 0.95, 5: 0.85 }));
    expect(d.belowThreshold).toEqual([]);
    expect(d.suggestions.length).toBe(1); // 针对最弱(维度5)
  });
});

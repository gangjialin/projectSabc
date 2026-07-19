import { DEFAULT_CONFIG, type EvalConfig } from '../config';
import {
  compositeScore,
  normalizeInterview,
  studentScore,
  supervisorScore,
} from './composite';

describe('supervisorScore (U-SCORE-01)', () => {
  it('听课×60% + 材料×40%', () => {
    expect(supervisorScore(90, 80)).toBeCloseTo(86, 10); // 54 + 32
  });
  it('任一子项缺失 → null', () => {
    expect(supervisorScore(null, 80)).toBeNull();
    expect(supervisorScore(90, null)).toBeNull();
  });
});

describe('normalizeInterview / studentScore (U-SCORE-02)', () => {
  it('访谈 20 分制归一化到 100', () => {
    expect(normalizeInterview(16)).toBe(80);
    expect(normalizeInterview(20)).toBe(100);
  });
  it('学生分 = 问卷×80% + 访谈归一化×20%', () => {
    // 问卷 90，访谈 16(→80)：90*0.8 + 80*0.2 = 72 + 16 = 88
    expect(studentScore(90, 16)).toBeCloseTo(88, 10);
  });
  it('访谈缺失 → 问卷分占满', () => {
    expect(studentScore(90, null)).toBe(90);
  });
  it('问卷缺失 → null', () => {
    expect(studentScore(null, 16)).toBeNull();
  });
});

describe('compositeScore (U-SCORE-03)', () => {
  it('上级×40% + 同行×30% + 学生×30%', () => {
    // 86*0.4 + 90*0.3 + 88*0.3 = 34.4 + 27 + 26.4 = 87.8
    expect(compositeScore(86, 90, 88)).toBeCloseTo(87.8, 10);
  });
  it('任一缺失 → null', () => {
    expect(compositeScore(null, 90, 88)).toBeNull();
    expect(compositeScore(86, null, 88)).toBeNull();
    expect(compositeScore(86, 90, null)).toBeNull();
  });
});

describe('U-SCORE-04 权重可配置', () => {
  it('改 SystemConfig 权重后结果随之变化', () => {
    const cfg: EvalConfig = {
      ...DEFAULT_CONFIG,
      weights: { supervisor: 0.5, peer: 0.25, student: 0.25 },
    };
    // 80*0.5 + 80*0.25 + 80*0.25 = 80（同分时不变）
    expect(compositeScore(80, 80, 80, cfg)).toBeCloseTo(80, 10);
    // 100*0.5 + 0*0.25 + 0*0.25 = 50
    expect(compositeScore(100, 0, 0, cfg)).toBeCloseTo(50, 10);
  });

  it('权重为 0 的来源不计入且不要求有分（2025-2026 执行口径：同行60%+上级40%）', () => {
    const cfg: EvalConfig = {
      ...DEFAULT_CONFIG,
      weights: { supervisor: 0.4, peer: 0.6, student: 0 },
    };
    // 86*0.4 + 90*0.6 = 34.4 + 54 = 88.4；学生 null 不阻断
    expect(compositeScore(86, 90, null, cfg)).toBeCloseTo(88.4, 10);
    // 学生有分也不计入
    expect(compositeScore(86, 90, 100, cfg)).toBeCloseTo(88.4, 10);
    // 权重>0 的来源缺分仍 → null
    expect(compositeScore(null, 90, null, cfg)).toBeNull();
  });
});

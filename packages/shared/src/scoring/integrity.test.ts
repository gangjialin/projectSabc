import { DEFAULT_CONFIG } from '../config';
import { checkDataCompleteness, type EvaluatorCounts } from './integrity';

function counts(overrides: Partial<EvaluatorCounts> = {}): EvaluatorCounts {
  return {
    lecture: 2,
    material: 1,
    peer: 3,
    studentSurvey: 10,
    interview: 2,
    ...overrides,
  };
}

describe('checkDataCompleteness', () => {
  it('U-INTEG 全部达标 → 完整、无警告', () => {
    const r = checkDataCompleteness(counts());
    expect(r.isComplete).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('U-INTEG-01 听课<2 → 阻断、不完整', () => {
    const r = checkDataCompleteness(counts({ lecture: 1 }));
    expect(r.isComplete).toBe(false);
    expect(r.warnings.find((w) => w.item === 'lecture')?.blocking).toBe(true);
  });

  it('材料<1 → 阻断', () => {
    const r = checkDataCompleteness(counts({ material: 0 }));
    expect(r.isComplete).toBe(false);
  });

  it('U-INTEG-02 学生问卷<10 → 阻断', () => {
    const r = checkDataCompleteness(counts({ studentSurvey: 9 }));
    expect(r.isComplete).toBe(false);
    expect(r.warnings.find((w) => w.item === 'studentSurvey')?.blocking).toBe(
      true,
    );
  });

  it('同行<3（有人打分）→ 仅提示，不阻断', () => {
    const r = checkDataCompleteness(counts({ peer: 2 }));
    expect(r.isComplete).toBe(true);
    const w = r.warnings.find((x) => x.item === 'peer');
    expect(w?.blocking).toBe(false);
  });

  it('U-INTEG-03 访谈已安排但委员<2 → 提示；未安排(0)不提示', () => {
    expect(
      checkDataCompleteness(counts({ interview: 1 })).warnings.find(
        (w) => w.item === 'interview',
      )?.blocking,
    ).toBe(false);
    expect(
      checkDataCompleteness(counts({ interview: 0 })).warnings.find(
        (w) => w.item === 'interview',
      ),
    ).toBeUndefined();
  });

  it('阈值随 config 变化', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      minEvaluatorCount: {
        ...DEFAULT_CONFIG.minEvaluatorCount,
        studentSurvey: 5,
      },
    };
    expect(checkDataCompleteness(counts({ studentSurvey: 6 }), cfg).isComplete).toBe(
      true,
    );
  });
});

import { DEFAULT_CONFIG } from '../config';
import {
  answerScore,
  calcSubmissionScores,
  mean,
  trimmedMean,
} from './dimension';
import type { AnswerInput, QuestionDef } from './types';
import type { DimensionNo } from '../enums';

/**
 * 构造一套"标准评分表"：每个维度按其满分均分到题目上。
 * dim1=20(2题×10), dim2=25(5题×5), dim3=20(4题×5), dim4=20(2题×10), dim5=15(3题×5)
 */
function standardQuestions(): QuestionDef[] {
  const qs: QuestionDef[] = [];
  const spec: Record<DimensionNo, number[]> = {
    1: [10, 10],
    2: [5, 5, 5, 5, 5],
    3: [5, 5, 5, 5],
    4: [10, 10],
    5: [5, 5, 5],
  };
  for (const n of [1, 2, 3, 4, 5] as DimensionNo[]) {
    spec[n].forEach((maxScore, i) => {
      qs.push({ id: `d${n}q${i}`, dimensionNo: n, maxScore });
    });
  }
  return qs;
}

function answersAll(likert: number, qs: QuestionDef[]): AnswerInput[] {
  return qs.map((q) => ({ questionId: q.id, likertScore: likert }));
}

describe('answerScore (U-CALC-03)', () => {
  it('单题得分 = 分值 × likert/5', () => {
    expect(answerScore(10, 5)).toBe(10);
    expect(answerScore(10, 3)).toBe(6);
    expect(answerScore(5, 4)).toBe(4);
  });

  it('非法 likert 抛错', () => {
    expect(() => answerScore(10, 0)).toThrow();
    expect(() => answerScore(10, 6)).toThrow();
    expect(() => answerScore(10, 2.5)).toThrow();
  });
});

describe('calcSubmissionScores', () => {
  const qs = standardQuestions();

  it('U-CALC-01 全选完全符合(5) → 各维度满分、得分率 1.0', () => {
    const r = calcSubmissionScores(answersAll(5, qs), qs);
    expect(r.totalScore).toBe(100);
    for (const n of [1, 2, 3, 4, 5] as DimensionNo[]) {
      expect(r.dims[n].rate).toBe(1);
      expect(r.dims[n].score).toBe(DEFAULT_CONFIG.dimensionMaxScores[n]);
    }
  });

  it('U-CALC-02 全选基本符合(3) → 得分率 0.60', () => {
    const r = calcSubmissionScores(answersAll(3, qs), qs);
    expect(r.totalScore).toBe(60);
    for (const n of [1, 2, 3, 4, 5] as DimensionNo[]) {
      expect(r.dims[n].rate).toBeCloseTo(0.6, 10);
    }
  });

  it('U-CALC-04 满分求和 = 100', () => {
    const totalMax = qs.reduce((a, q) => a + q.maxScore, 0);
    expect(totalMax).toBe(100);
  });

  it('U-CALC-06 混合作答无精度漂移', () => {
    // dim2 五题分别 5,4,3,2,1 档
    const answers: AnswerInput[] = [
      { questionId: 'd2q0', likertScore: 5 },
      { questionId: 'd2q1', likertScore: 4 },
      { questionId: 'd2q2', likertScore: 3 },
      { questionId: 'd2q3', likertScore: 2 },
      { questionId: 'd2q4', likertScore: 1 },
    ];
    const r = calcSubmissionScores(answers, qs);
    // 每题分值 5：5*(5+4+3+2+1)/5 = 15
    expect(r.dims[2].score).toBe(15);
    expect(r.dims[2].rate).toBeCloseTo(15 / 25, 10);
  });

  it('U-CALC-05 引用不存在题目 / 重复作答 → 抛错', () => {
    expect(() =>
      calcSubmissionScores([{ questionId: 'ghost', likertScore: 5 }], qs),
    ).toThrow();
    expect(() =>
      calcSubmissionScores(
        [
          { questionId: 'd1q0', likertScore: 5 },
          { questionId: 'd1q0', likertScore: 4 },
        ],
        qs,
      ),
    ).toThrow();
  });
});

describe('mean / trimmedMean (U-AGG)', () => {
  it('U-AGG-02 同行 <3 人取算术平均', () => {
    expect(trimmedMean([0.8, 0.6], 3)).toBeCloseTo(0.7, 10);
  });

  it('U-AGG-01 同行 ≥3 人去极值', () => {
    // [0.5, 0.8, 0.9, 1.0] 去掉 0.5 和 1.0 → mean(0.8,0.9)=0.85
    expect(trimmedMean([0.5, 0.8, 0.9, 1.0], 3)).toBeCloseTo(0.85, 10);
  });

  it('U-AGG-03 恰好 3 人去极值后剩中位 1 人', () => {
    expect(trimmedMean([0.6, 0.8, 1.0], 3)).toBeCloseTo(0.8, 10);
  });

  it('U-AGG-05 并列极值只各去其一', () => {
    // [0.6,0.6,0.9,0.9] 去掉一个0.6一个0.9 → mean(0.6,0.9)=0.75
    expect(trimmedMean([0.6, 0.6, 0.9, 0.9], 3)).toBeCloseTo(0.75, 10);
  });

  it('空数组返回 null', () => {
    expect(mean([])).toBeNull();
    expect(trimmedMean([], 3)).toBeNull();
  });
});

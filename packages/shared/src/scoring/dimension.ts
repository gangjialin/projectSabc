import { DIMENSION_NOS, type DimensionNo } from '../enums';
import type {
  AnswerInput,
  DimensionScores,
  QuestionDef,
  SubmissionResult,
} from './types';

/**
 * 单题得分 = 题目分值 × (李克特分数 / 5)。
 * 需求 §5.2。
 */
export function answerScore(questionMaxScore: number, likertScore: number): number {
  if (likertScore < 1 || likertScore > 5 || !Number.isInteger(likertScore)) {
    throw new Error(`非法李克特分值: ${likertScore}（必须为 1-5 的整数）`);
  }
  return (questionMaxScore * likertScore) / 5;
}

function emptyDims(): DimensionScores {
  return {
    1: { score: 0, max: 0, rate: 0 },
    2: { score: 0, max: 0, rate: 0 },
    3: { score: 0, max: 0, rate: 0 },
    4: { score: 0, max: 0, rate: 0 },
    5: { score: 0, max: 0, rate: 0 },
  };
}

/**
 * 计算单次评分提交的 5 维度得分与得分率（design.md §4.1 / 伪代码 calcSubmissionScores）。
 * @param answers 评分人提交的全部作答
 * @param questions 该评分表（对应版本）的题目定义
 */
export function calcSubmissionScores(
  answers: AnswerInput[],
  questions: QuestionDef[],
): SubmissionResult {
  const qMap = new Map(questions.map((q) => [q.id, q]));
  const dims = emptyDims();

  // 先累计每个维度的满分（按题目定义，与作答无关）
  for (const q of questions) {
    dims[q.dimensionNo].max += q.maxScore;
  }

  // 校验每题作答唯一且题目存在
  const seen = new Set<string>();
  for (const a of answers) {
    const q = qMap.get(a.questionId);
    if (!q) {
      throw new Error(`作答引用了不存在的题目: ${a.questionId}`);
    }
    if (seen.has(a.questionId)) {
      throw new Error(`题目重复作答: ${a.questionId}`);
    }
    seen.add(a.questionId);
    dims[q.dimensionNo].score += answerScore(q.maxScore, a.likertScore);
  }

  let total = 0;
  for (const n of DIMENSION_NOS) {
    const d = dims[n];
    d.rate = d.max > 0 ? d.score / d.max : 0;
    total += d.score;
  }

  return { totalScore: round2(total), dims };
}

/** 算术平均；空数组返回 null */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * 去极值平均（掐头去尾）：当人数 >= minForTrim 时，去掉一个最大、一个最小后取均值；
 * 否则取算术平均。用于同行评价（design.md §4.2 aggregateDimensionRate）。
 *
 * 注意：并列极值只各去其一（test_plan U-AGG-05）。
 */
export function trimmedMean(values: number[], minForTrim = 3): number | null {
  if (values.length === 0) return null;
  if (values.length < minForTrim) return mean(values);
  const sorted = [...values].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return mean(trimmed);
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function round4(v: number): number {
  return Math.round((v + Number.EPSILON) * 10000) / 10000;
}

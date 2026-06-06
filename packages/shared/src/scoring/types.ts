import type { DimensionNo, FormType } from '../enums';

/** 一道题的定义（来自题目模板） */
export interface QuestionDef {
  id: string;
  dimensionNo: DimensionNo;
  /** 该题分值（同维度题分值之和 = 维度满分） */
  maxScore: number;
}

/** 一次评分提交里的单题作答 */
export interface AnswerInput {
  questionId: string;
  /** 李克特选项 1-5 */
  likertScore: number;
}

/** 每个维度的得分快照 */
export type DimensionScores = Record<
  DimensionNo,
  { score: number; max: number; rate: number }
>;

/** 单次评分提交的计算结果（写入 EvalSubmission 缓存） */
export interface SubmissionResult {
  totalScore: number; // 0-100
  dims: DimensionScores;
}

/** 跨评分人聚合后的一份"评分集合"（同一 formType、同一教师、同一维度的得分率列表） */
export interface RateList {
  formType: FormType;
  /** 各评分人在该维度的得分率（0-1） */
  rates: number[];
}

/** 教师某维度三维得分率 */
export interface DimensionRateTriple {
  supervisor: number | null;
  peer: number | null;
  student: number | null;
  weighted: number | null;
}

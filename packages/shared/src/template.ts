import { DIMENSION_NOS } from './enums';

export interface QuestionShape {
  maxScore: number;
}

export interface DimensionShape {
  dimensionNo: number;
  maxScore: number;
  questions: QuestionShape[];
}

export interface TemplateError {
  dimensionNo?: number;
  message: string;
}

const EPS = 1e-9;

/**
 * 题目模板合规校验（需求 §5.1 / §11）：
 *  1. 恰好 5 个维度，编号 1-5 齐全且不重复；
 *  2. 每个维度下题目分值之和 == 该维度满分；
 *  3. 5 维度满分合计 == 100。
 *
 * 注：各维度满分**不再写死** 20/25/20/20/15 —— 不同评价表（听课/材料/同行/学生）
 * 的维度分布不同（如听课 20/40/15/15/10、材料 20/20/30/15/15），只要合计 100 即可。
 * 维度否决用的是"得分率(得分/该维度满分)"，与各维度具体满分无关。
 *
 * 返回错误清单，空数组表示合规。模板保存前必须通过本校验。
 */
export function validateTemplate(
  dimensions: DimensionShape[],
): TemplateError[] {
  const errors: TemplateError[] = [];

  // 1. 维度齐全
  const nos = dimensions.map((d) => d.dimensionNo).sort((a, b) => a - b);
  const expected = [...DIMENSION_NOS];
  if (nos.length !== 5 || expected.some((n, i) => n !== nos[i])) {
    errors.push({ message: `必须包含且仅包含 5 个维度（编号 1-5），当前为 [${nos.join(',')}]` });
    return errors; // 维度结构不对，后续校验无意义
  }

  let totalMax = 0;
  for (const d of dimensions) {
    // 2. 题目分值之和 == 维度满分
    const qSum = d.questions.reduce((a, q) => a + q.maxScore, 0);
    if (Math.abs(qSum - d.maxScore) > EPS) {
      errors.push({
        dimensionNo: d.dimensionNo,
        message: `维度 ${d.dimensionNo} 题目分值之和为 ${qSum}，应等于维度满分 ${d.maxScore}`,
      });
    }
    if (d.questions.length === 0) {
      errors.push({ dimensionNo: d.dimensionNo, message: `维度 ${d.dimensionNo} 至少需要 1 道题` });
    }
    totalMax += d.maxScore;
  }

  // 4. 合计 100
  if (Math.abs(totalMax - 100) > EPS) {
    errors.push({ message: `5 维度满分合计应为 100，当前为 ${totalMax}` });
  }

  return errors;
}

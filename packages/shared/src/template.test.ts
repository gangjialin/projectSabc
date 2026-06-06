import { validateTemplate, type DimensionShape } from './template';

/** 构造合规模板：维度满分 20/25/20/20/15，题目均分凑满 */
function validTemplate(): DimensionShape[] {
  const maxes = [20, 25, 20, 20, 15];
  return maxes.map((max, i) => ({
    dimensionNo: i + 1,
    maxScore: max,
    questions: [{ maxScore: max / 2 }, { maxScore: max / 2 }],
  }));
}

describe('validateTemplate', () => {
  it('合规模板无错误', () => {
    expect(validateTemplate(validTemplate())).toEqual([]);
  });

  it('U-CALC-05 题目分值之和 ≠ 维度满分 → 报错', () => {
    const t = validTemplate();
    t[2]!.questions = [{ maxScore: 10 }, { maxScore: 5 }]; // 维度3 和=15 ≠ 20
    const errs = validateTemplate(t);
    expect(errs.some((e) => e.dimensionNo === 3 && e.message.includes('题目分值之和'))).toBe(true);
  });

  it('维度满分被改 → 报错', () => {
    const t = validTemplate();
    t[1]!.maxScore = 20; // 维度2 应为 25
    t[1]!.questions = [{ maxScore: 10 }, { maxScore: 10 }];
    const errs = validateTemplate(t);
    expect(errs.some((e) => e.dimensionNo === 2 && e.message.includes('满分应为 25'))).toBe(true);
  });

  it('缺维度 → 结构错误', () => {
    const t = validTemplate().slice(0, 4);
    const errs = validateTemplate(t);
    expect(errs[0]!.message).toContain('5 个维度');
  });

  it('维度无题目 → 报错', () => {
    const t = validTemplate();
    t[0]!.questions = [];
    const errs = validateTemplate(t);
    expect(errs.some((e) => e.dimensionNo === 1 && e.message.includes('至少需要'))).toBe(true);
  });

  it('合计非 100 → 报错（配置一致但人为构造）', () => {
    const t = validTemplate();
    // 把维度5 改成 10 分且题目和也 10，制造合计=95 但维度5满分与配置(15)不符
    t[4]!.maxScore = 10;
    t[4]!.questions = [{ maxScore: 10 }];
    const errs = validateTemplate(t);
    expect(errs.some((e) => e.message.includes('合计应为 100'))).toBe(true);
  });
});

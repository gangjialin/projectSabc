import { Grade, GradeRestriction } from '../enums';
import { assignGrades, type GradeCandidate } from './grade';

function cand(
  teacherId: string,
  compositeScore: number | null,
  overrides: Partial<GradeCandidate> = {},
): GradeCandidate {
  return {
    teacherId,
    compositeScore,
    isMgmtRole: false,
    isSConfirmed: false,
    restrictions: [],
    ...overrides,
  };
}

/** 生成 N 个综合分递减的普通候选 */
function ladder(n: number): GradeCandidate[] {
  return Array.from({ length: n }, (_, i) => cand(`t${i}`, 100 - i));
}

function gradeOf(res: ReturnType<typeof assignGrades>, id: string): Grade | null {
  return res.find((r) => r.teacherId === id)!.suggestedGrade;
}

function countByGrade(res: ReturnType<typeof assignGrades>) {
  const c: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, null: 0 };
  for (const r of res) {
    const k = r.suggestedGrade ?? 'null';
    c[k] = (c[k] ?? 0) + 1;
  }
  return c;
}

describe('assignGrades', () => {
  it('U-GRADE-01 按比例划定 S+A≈40%, B≈30%, C≈30%', () => {
    const res = assignGrades(ladder(10));
    const c = countByGrade(res);
    // N=10: aQuota=4, bQuota=3, cQuota=3
    expect(c.A).toBe(4);
    expect(c.B).toBe(3);
    expect(c.C).toBe(3);
    expect(c.D).toBe(0);
    // 最高分得 A，最低分得 C
    expect(gradeOf(res, 't0')).toBe(Grade.A);
    expect(gradeOf(res, 't9')).toBe(Grade.C);
  });

  it('U-GRADE-02 维度否决教师即使分最高也不得 A，落入 B', () => {
    const list = ladder(10);
    // 把分最高的 t0 标记维度否决
    list[0] = cand('t0', 100, {
      restrictions: [GradeRestriction.NO_A_OR_ABOVE],
    });
    const res = assignGrades(list);
    expect(gradeOf(res, 't0')).toBe(Grade.B);
    const r0 = res.find((r) => r.teacherId === 't0')!;
    expect(r0.reason).toContain('不得 A');
  });

  it('U-GRADE-03 中层干部不占配额、标记人工', () => {
    const list = [...ladder(10), cand('mgmt', 99, { isMgmtRole: true })];
    const res = assignGrades(list);
    const m = res.find((r) => r.teacherId === 'mgmt')!;
    expect(m.suggestedGrade).toBeNull();
    expect(m.needsManualReview).toBe(true);
    // 普通池仍按 N=10 划定
    const c = countByGrade(res);
    expect(c.A).toBe(4);
  });

  it('U-GRADE-04 已认定 S 级直接 S，并占用 A 配额一名', () => {
    const list = ladder(10);
    list[0] = cand('t0', 100, { isSConfirmed: true });
    const res = assignGrades(list);
    expect(gradeOf(res, 't0')).toBe(Grade.S);
    const c = countByGrade(res);
    // S=1, aQuota = floor(10*0.4)-1 = 3
    expect(c.S).toBe(1);
    expect(c.A).toBe(3);
    expect(c.B).toBe(3);
    expect(c.C).toBe(3);
  });

  it('前置限定 FORCE_D → 直接 D，不参与配额', () => {
    const list = ladder(10);
    list[0] = cand('t0', 100, { restrictions: [GradeRestriction.FORCE_D] });
    const res = assignGrades(list);
    expect(gradeOf(res, 't0')).toBe(Grade.D);
  });

  it('U-GRADE-06 NO_B_OR_ABOVE → 最高只能 C', () => {
    const list = ladder(10);
    list[0] = cand('t0', 100, {
      restrictions: [GradeRestriction.NO_B_OR_ABOVE],
    });
    const res = assignGrades(list);
    expect(gradeOf(res, 't0')).toBe(Grade.C);
  });

  it('U-GRADE-08 综合分缺失 → 标记人工、不给等级', () => {
    const list = [...ladder(5), cand('incomplete', null)];
    const res = assignGrades(list);
    const r = res.find((x) => x.teacherId === 'incomplete')!;
    expect(r.suggestedGrade).toBeNull();
    expect(r.needsManualReview).toBe(true);
  });

  it('S 认定但带 NO_S 限制 → 冲突标记人工', () => {
    const list = ladder(5);
    list[0] = cand('t0', 100, {
      isSConfirmed: true,
      restrictions: [GradeRestriction.NO_S],
    });
    const res = assignGrades(list);
    const r = res.find((x) => x.teacherId === 't0')!;
    expect(r.needsManualReview).toBe(true);
  });

  it('返回顺序与输入一致', () => {
    const list = ladder(4);
    const res = assignGrades(list);
    expect(res.map((r) => r.teacherId)).toEqual(['t0', 't1', 't2', 't3']);
  });
});

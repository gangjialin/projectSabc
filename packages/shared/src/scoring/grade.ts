import { DEFAULT_CONFIG, type EvalConfig } from '../config';
import { Grade, GradeRestriction } from '../enums';

/** 单个教师的等级划定输入 */
export interface GradeCandidate {
  teacherId: string;
  /** 综合评价分；null 表示数据不完整，需人工处理 */
  compositeScore: number | null;
  /** 是否中层管理职务（不占 S/A 配额，独立评价） */
  isMgmtRole: boolean;
  /** 是否已通过 S 级评审认定 */
  isSConfirmed: boolean;
  /** 来自 PreConditionFlag 的等级限制（可多个） */
  restrictions: GradeRestriction[];
}

export interface GradeAssignment {
  teacherId: string;
  suggestedGrade: Grade | null;
  reason: string;
  /** 是否需评价组人工商议（边界/数据不全/中层干部） */
  needsManualReview: boolean;
}

function precludesA(rs: GradeRestriction[]): boolean {
  return (
    rs.includes(GradeRestriction.NO_A_OR_ABOVE) ||
    rs.includes(GradeRestriction.NO_B_OR_ABOVE) ||
    rs.includes(GradeRestriction.FORCE_D)
  );
}

function precludesB(rs: GradeRestriction[]): boolean {
  return (
    rs.includes(GradeRestriction.NO_B_OR_ABOVE) ||
    rs.includes(GradeRestriction.FORCE_D)
  );
}

/**
 * 等级划定（design.md §4.2 assignGrades / 需求 §7.3）。
 *
 * 步骤：
 *  1. FORCE_D → 直接 D。
 *  2. 中层管理职务 → 不在此划定（独立评价，标记人工处理）。
 *  3. 已认定 S → S（若带 NO_S 限制则标记冲突待人工）。
 *  4. 其余按综合分降序，依配额填充 A→B→C→D，期间遵守各教师的等级限制。
 *
 * 配额基数 N = 非中层、参与本轮评价的教师数。
 *  A 名额 = floor(N × S+A合计比例) − 已认定S人数（≥0）
 *  B 名额 = floor(N × B比例)；C 名额 = floor(N × C比例)；其余为 D。
 *
 * 维度否决（NO_A_OR_ABOVE）教师即使分高也跳过 A，落入 B 及以下（test_plan U-GRADE-02）。
 */
export function assignGrades(
  candidates: GradeCandidate[],
  config: EvalConfig = DEFAULT_CONFIG,
): GradeAssignment[] {
  const out = new Map<string, GradeAssignment>();

  // --- 1. 中层干部：独立评价，不参与配额 ---
  const mgmt = candidates.filter((c) => c.isMgmtRole);
  for (const c of mgmt) {
    out.set(c.teacherId, {
      teacherId: c.teacherId,
      suggestedGrade: null,
      reason: '中层管理职务教师，独立评价、不占 S/A 配额',
      needsManualReview: true,
    });
  }

  const pool = candidates.filter((c) => !c.isMgmtRole);
  const N = pool.length;

  // --- 2. FORCE_D ---
  const forcedD = new Set<string>();
  for (const c of pool) {
    if (c.restrictions.includes(GradeRestriction.FORCE_D)) {
      forcedD.add(c.teacherId);
      out.set(c.teacherId, {
        teacherId: c.teacherId,
        suggestedGrade: Grade.D,
        reason: '前置限定：直接评定 D 级',
        needsManualReview: false,
      });
    }
  }

  // --- 3. 已认定 S ---
  const sConfirmed = pool.filter(
    (c) => c.isSConfirmed && !forcedD.has(c.teacherId),
  );
  for (const c of sConfirmed) {
    const conflict = c.restrictions.includes(GradeRestriction.NO_S);
    out.set(c.teacherId, {
      teacherId: c.teacherId,
      suggestedGrade: Grade.S,
      reason: conflict
        ? '已认定 S 级，但存在"不得 S"限制，需人工裁定'
        : '已认定 S 级',
      needsManualReview: conflict,
    });
  }
  const sCount = sConfirmed.length;

  // --- 4. 配额计算 ---
  const aQuota = Math.max(0, Math.floor(N * config.gradeQuota.saTotal) - sCount);
  const bQuota = Math.floor(N * config.gradeQuota.b);
  const cQuota = Math.floor(N * config.gradeQuota.c);

  // 待划定候选：非中层、非 FORCE_D、非已认定 S
  const toAssign = pool.filter(
    (c) => !forcedD.has(c.teacherId) && !c.isSConfirmed,
  );

  // 数据不完整（compositeScore=null）排到最后并标记人工
  const ranked = [...toAssign].sort((a, b) => {
    if (a.compositeScore === null && b.compositeScore === null) return 0;
    if (a.compositeScore === null) return 1;
    if (b.compositeScore === null) return -1;
    return b.compositeScore - a.compositeScore;
  });

  let assignedA = 0;
  let assignedB = 0;
  let assignedC = 0;

  for (const c of ranked) {
    if (c.compositeScore === null) {
      out.set(c.teacherId, {
        teacherId: c.teacherId,
        suggestedGrade: null,
        reason: '综合分数据不完整，需人工处理',
        needsManualReview: true,
      });
      continue;
    }
    if (!precludesA(c.restrictions) && assignedA < aQuota) {
      assignedA++;
      out.set(c.teacherId, mk(c, Grade.A, '按综合分排序，落入 A 级配额'));
    } else if (!precludesB(c.restrictions) && assignedB < bQuota) {
      assignedB++;
      const reason = precludesA(c.restrictions)
        ? '受等级限制（维度否决/前置限定）不得 A，落入 B 级'
        : '按综合分排序，落入 B 级配额';
      out.set(c.teacherId, mk(c, Grade.B, reason));
    } else if (assignedC < cQuota) {
      assignedC++;
      out.set(c.teacherId, mk(c, Grade.C, '按综合分排序，落入 C 级配额'));
    } else {
      out.set(c.teacherId, mk(c, Grade.D, '配额已满，落入 D 级'));
    }
  }

  // 按原始顺序返回
  return candidates.map((c) => out.get(c.teacherId)!);
}

function mk(
  c: GradeCandidate,
  grade: Grade,
  reason: string,
): GradeAssignment {
  return {
    teacherId: c.teacherId,
    suggestedGrade: grade,
    reason,
    needsManualReview: false,
  };
}

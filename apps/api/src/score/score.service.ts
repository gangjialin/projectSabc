import { Injectable } from '@nestjs/common';
import {
  assignGrades,
  checkDataCompleteness,
  compositeScore,
  DEFAULT_CONFIG,
  detectDimensionVeto,
  DIMENSION_NOS,
  ExemptionStatus,
  FlagType,
  FormType,
  GradeRestriction,
  studentScore,
  supervisorScore,
  trimmedMean,
  mean,
  validateConfig,
  type DimensionNo,
  type EvalConfig,
  type GradeCandidate,
} from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScoreService {
  constructor(private prisma: PrismaService) {}

  /** 从 SystemConfig 读取并覆盖默认配置（需求 §十 可维护性：权重/阈值可配） */
  async loadConfig(): Promise<EvalConfig> {
    const rows = await this.prisma.systemConfig.findMany();
    const cfg: EvalConfig = structuredClone(DEFAULT_CONFIG);
    for (const row of rows) {
      // 已知 key 才覆盖，避免脏配置污染
      if (row.key in cfg) {
        (cfg as unknown as Record<string, unknown>)[row.key] = row.value;
      }
    }
    const errors = validateConfig(cfg);
    if (errors.length > 0) {
      throw new Error(`系统配置非法: ${errors.join('; ')}`);
    }
    return cfg;
  }

  /**
   * 聚合某教师某来源（上级合并听课+材料 / 同行 / 学生）在各维度的得分率。
   * 同行 ≥3 人去极值（design §4.2）。
   */
  private async aggregateRates(
    teacherId: string,
    academicYear: string,
    formTypes: FormType[],
    peerTrim: boolean,
    config: EvalConfig,
    excludeIds: string[] = [],
  ): Promise<Record<DimensionNo, number | null>> {
    const subs = await this.prisma.evalSubmission.findMany({
      where: {
        evaluateeTeacherId: teacherId,
        academicYear,
        formType: { in: formTypes },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: {
        dim1Rate: true,
        dim2Rate: true,
        dim3Rate: true,
        dim4Rate: true,
        dim5Rate: true,
      },
    });

    const result = {} as Record<DimensionNo, number | null>;
    for (const n of DIMENSION_NOS) {
      const key = `dim${n}Rate` as keyof (typeof subs)[number];
      const rates = subs
        .map((s) => s[key] as number | null)
        .filter((v): v is number => v !== null);
      result[n] = peerTrim
        ? trimmedMean(rates, config.minEvaluatorCount.peer)
        : mean(rates);
    }
    return result;
  }

  /**
   * 已通过免计入申请、应从学生评价中剔除的匿名提交 id（T-605）。
   * 经 StudentEvalAudit.submissionId 链接，剔除特定学生那条记录而不破坏匿名。
   */
  private async exemptedSubmissionIds(
    teacherId: string,
    academicYear: string,
  ): Promise<string[]> {
    const approved = await this.prisma.studentEvalExemption.findMany({
      where: { teacherId, academicYear, finalStatus: ExemptionStatus.APPROVED },
      select: { studentId: true, courseId: true },
    });
    if (approved.length === 0) return [];

    const accounts = [...new Set(approved.map((a) => a.studentId))];
    const users = await this.prisma.user.findMany({
      where: { loginAccount: { in: accounts } },
      select: { id: true, loginAccount: true },
    });
    const idByAccount = new Map(users.map((u) => [u.loginAccount, u.id]));
    const approvedPairs = new Set(
      approved.map((a) => `${idByAccount.get(a.studentId) ?? ''}:${a.courseId}`),
    );

    const audits = await this.prisma.studentEvalAudit.findMany({
      where: { teacherId, academicYear },
      select: { studentId: true, courseId: true, submissionId: true },
    });
    return audits
      .filter(
        (a) =>
          a.submissionId && approvedPairs.has(`${a.studentId}:${a.courseId}`),
      )
      .map((a) => a.submissionId as string);
  }

  /**
   * 计算某教师 5 维度三维得分率 + 维度否决判定，落库 DimensionResult，
   * 并在触发否决时自动创建 PreConditionFlag(DIM_VETO)（design §4.1 / §7.3）。
   */
  async computeDimensionVeto(teacherId: string, academicYear: string) {
    const config = await this.loadConfig();
    const exempted = await this.exemptedSubmissionIds(teacherId, academicYear);

    const supervisor = await this.aggregateRates(
      teacherId,
      academicYear,
      [FormType.LECTURE, FormType.MATERIAL],
      false,
      config,
    );
    const peer = await this.aggregateRates(
      teacherId,
      academicYear,
      [FormType.PEER],
      true,
      config,
    );
    const student = await this.aggregateRates(
      teacherId,
      academicYear,
      [FormType.STUDENT],
      false,
      config,
      exempted,
    );

    const rates = {} as Parameters<typeof detectDimensionVeto>[0];
    for (const n of DIMENSION_NOS) {
      rates[n] = {
        supervisor: supervisor[n],
        peer: peer[n],
        student: student[n],
      };
    }

    const veto = detectDimensionVeto(rates, config);

    // 落库 DimensionResult
    const data = this.flattenDimensionResult(teacherId, academicYear, veto);
    await this.prisma.dimensionResult.upsert({
      where: { teacherId_academicYear: { teacherId, academicYear } },
      create: data,
      update: data,
    });

    // 自动落标/撤标（系统生成、不可手改；条件消失时自动撤销，避免重算后残留）
    await this.syncAutoFlag(
      teacherId,
      academicYear,
      FlagType.DIM_VETO,
      GradeRestriction.NO_A_OR_ABOVE,
      veto.hasDimVeto,
      `维度 ${veto.vetoDimensions.join(',')} 加权得分率低于 ${config.dimensionVetoThreshold}`,
      veto.vetoDimensions[0],
    );

    return veto;
  }

  private flattenDimensionResult(
    teacherId: string,
    academicYear: string,
    veto: ReturnType<typeof detectDimensionVeto>,
  ) {
    const flat: Record<string, unknown> = {
      teacherId,
      academicYear,
      hasDimVeto: veto.hasDimVeto,
      vetoDimensions: veto.vetoDimensions,
    };
    for (const n of DIMENSION_NOS) {
      const d = veto.dimensions[n];
      flat[`dim${n}SupervisorRate`] = d.supervisor;
      flat[`dim${n}PeerRate`] = d.peer;
      flat[`dim${n}StudentRate`] = d.student;
      flat[`dim${n}WeightedRate`] = d.weighted;
    }
    return flat as never;
  }

  /**
   * 计算并落库某教师的 FinalResult（T-409）：
   *  上级(听课×60%+材料×40%) / 同行(去极值) / 学生(问卷×80%+访谈归一化×20%) → 综合分；
   *  数据完整性检查（T-408）；并触发维度否决（须在等级划定前完成）。
   */
  async computeFinalResult(
    teacherId: string,
    academicYear: string,
    config?: EvalConfig,
  ) {
    const cfg = config ?? (await this.loadConfig());
    const teacher = await this.prisma.user.findUniqueOrThrow({
      where: { id: teacherId },
      select: { isAdminRole: true },
    });

    // 免计入：已通过申请的学生匿名记录需从学生评价中剔除（T-605）
    const exemptedIds = new Set(
      await this.exemptedSubmissionIds(teacherId, academicYear),
    );

    // 各来源评分总分（100 分制）
    const subs = await this.prisma.evalSubmission.findMany({
      where: { evaluateeTeacherId: teacherId, academicYear },
      select: { id: true, formType: true, totalScore: true },
    });
    const totals = (ft: FormType) =>
      subs
        .filter(
          (s) =>
            s.formType === ft &&
            s.totalScore !== null &&
            !(ft === FormType.STUDENT && exemptedIds.has(s.id)),
        )
        .map((s) => s.totalScore as number);

    const lecture = totals(FormType.LECTURE);
    const material = totals(FormType.MATERIAL);
    const peer = totals(FormType.PEER);
    const survey = totals(FormType.STUDENT);

    const lectureAvg = mean(lecture);
    const materialAvg = mean(material);
    const supervisorFinal = supervisorScore(lectureAvg, materialAvg, cfg);
    const peerFinal = trimmedMean(peer, cfg.minEvaluatorCount.peer);

    // 访谈（每委员 0-20 分：能力 8 + 方法 6 + 考核 6）
    const interviews = await this.prisma.interview.findMany({
      where: { teacherId, academicYear },
      include: { scores: true },
    });
    const interviewTotals = interviews.flatMap((iv) =>
      iv.scores.map(
        (s) => s.capabilityScore + s.methodScore + s.assessmentScore,
      ),
    );
    const interviewAvg = mean(interviewTotals);

    // 免计入：实际从计算中剔除的匿名记录数（经审计表精确剔除，T-605）
    const exemptedCount = exemptedIds.size;
    const surveyAvg = mean(survey);
    const studentFinal = studentScore(surveyAvg, interviewAvg, cfg);

    const composite = compositeScore(
      supervisorFinal,
      peerFinal,
      studentFinal,
      cfg,
    );

    const integrity = checkDataCompleteness(
      {
        lecture: lecture.length,
        material: material.length,
        peer: peer.length,
        studentSurvey: survey.length,
        interview: interviewTotals.length,
      },
      cfg,
    );

    const data = {
      teacherId,
      academicYear,
      supervisorLectureAvg: lectureAvg,
      supervisorMaterialAvg: materialAvg,
      supervisorFinal,
      peerFinal,
      peerValidCount: peer.length,
      studentSurveyAvg: surveyAvg,
      studentSurveyCount: survey.length,
      studentExemptedCount: exemptedCount,
      studentInterviewAvg: interviewAvg,
      studentFinal,
      compositeScore: composite,
      isDataComplete: integrity.isComplete,
      isMgmtRole: teacher.isAdminRole,
      calculatedAt: new Date(),
    };

    await this.prisma.finalResult.upsert({
      where: { teacherId_academicYear: { teacherId, academicYear } },
      create: data,
      update: data,
    });

    // 学生评价成绩 < 90 → 不得评 S（校发〔2026〕79号 5.4.1，系统自动落标/撤标）
    await this.syncAutoFlag(
      teacherId,
      academicYear,
      FlagType.STUDENT_SCORE_LOW,
      GradeRestriction.NO_S,
      surveyAvg !== null && surveyAvg < cfg.studentScoreNoSThreshold,
      `学生评价平均分 ${surveyAvg ?? '-'} 低于 ${cfg.studentScoreNoSThreshold}`,
    );

    // 维度否决须在等级划定前产生标记
    await this.computeDimensionVeto(teacherId, academicYear);

    return { ...data, integrity };
  }

  /**
   * 同步系统自动生成的前置限定标记：条件成立则落标（已存在则更新证据），
   * 条件不成立则撤销**自动生成**的同类标记（人工录入的不动）。
   * 避免数据修正重算后残留过期否决（DIM_VETO 同理复用）。
   */
  private async syncAutoFlag(
    teacherId: string,
    academicYear: string,
    flagType: FlagType,
    restriction: GradeRestriction,
    active: boolean,
    evidence: string,
    dimViolation?: number,
  ) {
    const existing = await this.prisma.preConditionFlag.findFirst({
      where: { teacherId, academicYear, flagType, isAutoGenerated: true },
    });
    if (active) {
      if (existing) {
        await this.prisma.preConditionFlag.update({
          where: { id: existing.id },
          data: { evidence, gradeRestriction: restriction, dimViolation },
        });
      } else {
        await this.prisma.preConditionFlag.create({
          data: {
            teacherId,
            academicYear,
            flagType,
            dimViolation,
            gradeRestriction: restriction,
            confirmedById: 'SYSTEM',
            isAutoGenerated: true,
            evidence,
          },
        });
      }
    } else if (existing) {
      await this.prisma.preConditionFlag.delete({ where: { id: existing.id } });
    }
  }

  /**
   * 取某教师的完整评价结果（成绩单用，T-802）：FinalResult + 维度明细 + 前置限定标记。
   * gated=true（教师本人查询）时，仅当结果已发布(PUBLISHED)才返回明细，否则隐藏（T-804 门禁）。
   */
  async getTeacherResult(
    teacherId: string,
    academicYear: string,
    gated = false,
  ) {
    const [final, dimension, flags, teacher] = await Promise.all([
      this.prisma.finalResult.findUnique({
        where: { teacherId_academicYear: { teacherId, academicYear } },
      }),
      this.prisma.dimensionResult.findUnique({
        where: { teacherId_academicYear: { teacherId, academicYear } },
      }),
      this.prisma.preConditionFlag.findMany({
        where: { teacherId, academicYear },
      }),
      this.prisma.user.findUnique({
        where: { id: teacherId },
        select: { name: true, loginAccount: true, department: true },
      }),
    ]);

    const published = final?.status === 'PUBLISHED';
    if (gated && !published) {
      // 未发布：隐藏成绩明细，仅告知状态
      return { teacher, published: false, final: null, dimension: null, flags: [] };
    }
    return { teacher, published, final, dimension, flags };
  }

  /**
   * 全院重算编排（T-407 的同步实现）：参评教师 = 该学年有评分记录的被评教师。
   * 逐人 computeFinalResult → 全院等级划定。BullMQ 异步化见 T-407（后续）。
   */
  async recalculateYear(academicYear: string) {
    const config = await this.loadConfig();
    const distinctTeachers = await this.prisma.evalSubmission.findMany({
      where: { academicYear },
      select: { evaluateeTeacherId: true },
      distinct: ['evaluateeTeacherId'],
    });
    const teacherIds = distinctTeachers.map((t) => t.evaluateeTeacherId);

    for (const id of teacherIds) {
      await this.computeFinalResult(id, academicYear, config);
    }
    const assignments = await this.assignGradesForYear(academicYear);
    return { teachers: teacherIds.length, assignments };
  }

  /**
   * 全院等级划定：汇总 FinalResult + 前置限定标记，调用引擎 assignGrades，回写 suggestedGrade + rank。
   */
  async assignGradesForYear(academicYear: string) {
    const config = await this.loadConfig();
    const results = await this.prisma.finalResult.findMany({
      where: { academicYear },
      include: { teacher: true },
    });
    const flags = await this.prisma.preConditionFlag.findMany({
      where: { academicYear },
    });
    const flagsByTeacher = new Map<string, GradeRestriction[]>();
    for (const f of flags) {
      const arr = flagsByTeacher.get(f.teacherId) ?? [];
      arr.push(f.gradeRestriction as GradeRestriction);
      flagsByTeacher.set(f.teacherId, arr);
    }

    const candidates: GradeCandidate[] = results.map((r) => ({
      teacherId: r.teacherId,
      compositeScore: r.compositeScore,
      isMgmtRole: r.isMgmtRole,
      isSConfirmed: r.isSCandidate && r.sApplicationStatus === 'APPROVED',
      restrictions: flagsByTeacher.get(r.teacherId) ?? [],
    }));

    const assignments = assignGrades(candidates, config);

    // 排名：非中层、综合分非空，按综合分降序
    const rankMap = new Map<string, number>();
    results
      .filter((r) => !r.isMgmtRole && r.compositeScore !== null)
      .sort((a, b) => (b.compositeScore as number) - (a.compositeScore as number))
      .forEach((r, i) => rankMap.set(r.teacherId, i + 1));

    await this.prisma.$transaction(
      assignments.map((a) =>
        this.prisma.finalResult.update({
          where: { teacherId_academicYear: { teacherId: a.teacherId, academicYear } },
          data: {
            suggestedGrade: a.suggestedGrade,
            rank: rankMap.get(a.teacherId) ?? null,
          },
        }),
      ),
    );

    return assignments;
  }
}

'use client';

import { useState } from 'react';
import { DIMENSION_NAMES, type DimensionNo } from '@app/shared';
import { api, type TeacherResult } from '@/lib/api';
import { RadarChart, type RadarAxis } from '@/components/RadarChart';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const DIM_NOS: DimensionNo[] = [1, 2, 3, 4, 5];
const GRADE_LABEL: Record<string, string> = {
  S: 'S 示范级',
  A: 'A 发展级 II',
  B: 'B 发展级 I',
  C: 'C 关注级',
  D: 'D 不合格',
};

function scoreRow(label: string, value: number | null, sub?: string) {
  return (
    <div className="flex items-baseline justify-between border-b py-2">
      <span className="text-sm text-slate-600">
        {label}
        {sub && <span className="ml-1 text-xs text-slate-400">{sub}</span>}
      </span>
      <span className="font-medium">{value === null ? '—' : value.toFixed(2)}</span>
    </div>
  );
}

export default function MyResultPage() {
  const [year, setYear] = useState('2025-2026');
  const [data, setData] = useState<TeacherResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.myResult(year, getToken());
      setData(res);
      if (!res.final) setMessage('暂无该学年的评价结果');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    } finally {
      setBusy(false);
    }
  }

  const dim = data?.dimension;
  const axes: RadarAxis[] = dim
    ? DIM_NOS.map((n) => ({
        label: DIMENSION_NAMES[n],
        value:
          (dim[`dim${n}WeightedRate` as keyof typeof dim] as number | null) ?? 0,
      }))
    : [];

  const final = data?.final;
  const grade = final?.finalGrade ?? final?.suggestedGrade ?? null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">我的评价成绩单</h1>

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>学年</span>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? '查询中…' : '查询'}
        </button>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {final && (
        <>
          {/* 维度否决告警 */}
          {dim?.hasDimVeto && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              <strong>维度否决提示：</strong>
              维度
              {dim.vetoDimensions
                .map((n) => `「${DIMENSION_NAMES[n as DimensionNo]}」`)
                .join('、')}
              加权得分率低于 70%，根据学校规定，本次评价最高只能评 B 级。
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* 综合与等级 */}
            <section className="space-y-1 rounded-lg border p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-500">综合评价分</span>
                <span className="text-3xl font-bold">
                  {final.compositeScore?.toFixed(2) ?? '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-sm text-slate-500">建议等级</span>
                <span className="text-xl font-semibold">
                  {grade ? (GRADE_LABEL[grade] ?? grade) : '待定'}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-sm text-slate-500">全院排名</span>
                <span>{final.rank ?? '—'}</span>
              </div>
              {!final.isDataComplete && (
                <p className="pt-2 text-xs text-amber-600">⚠ 数据不完整，结果待管理员复核</p>
              )}
            </section>

            {/* 三维子项 */}
            <section className="rounded-lg border p-4">
              {scoreRow('上级评价（40%）', final.supervisorFinal)}
              <div className="pl-3 text-xs text-slate-400">
                {scoreRow('· 听课（60%）', final.supervisorLectureAvg)}
                {scoreRow('· 材料审查（40%）', final.supervisorMaterialAvg)}
              </div>
              {scoreRow('同行评价（30%）', final.peerFinal, `${final.peerValidCount} 人`)}
              {scoreRow('学生评价（30%）', final.studentFinal)}
              <div className="pl-3 text-xs text-slate-400">
                {scoreRow('· 问卷（80%）', final.studentSurveyAvg, `${final.studentSurveyCount} 份`)}
                {scoreRow('· 访谈（20%）', final.studentInterviewAvg)}
              </div>
            </section>
          </div>

          {/* 5 维度雷达 */}
          {dim && (
            <section className="flex flex-col items-center rounded-lg border p-4">
              <h2 className="mb-2 self-start text-sm font-medium text-slate-600">
                5 维度加权得分率（虚线为 70% 否决线）
              </h2>
              <RadarChart axes={axes} threshold={0.7} />
            </section>
          )}
        </>
      )}
    </main>
  );
}

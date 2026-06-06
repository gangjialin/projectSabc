'use client';

import { useState } from 'react';
import { api, type FinalResultRow } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') ?? '';
}

const GRADES = ['S', 'A', 'B', 'C', 'D'] as const;
const GRADE_COLOR: Record<string, string> = {
  S: 'bg-purple-100 text-purple-700',
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const [year, setYear] = useState('2025-2026');
  const [results, setResults] = useState<FinalResultRow[]>([]);
  const [vetoCount, setVetoCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setMessage(null);
    try {
      const [res, veto] = await Promise.all([
        api.listResults(year, getToken()),
        api.vetoList(year, getToken()),
      ]);
      setResults(res);
      setVetoCount(veto.length);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }

  async function recalc() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.recalcSync(year, getToken());
      setMessage(`重算完成：${r.teachers} 名教师已计算`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '重算失败');
    } finally {
      setBusy(false);
    }
  }

  const dist = GRADES.map(
    (g) =>
      results.filter((r) => (r.finalGrade ?? r.suggestedGrade) === g).length,
  );
  const incomplete = results.filter((r) => !r.isDataComplete).length;
  const mgmt = results.filter((r) => r.isMgmtRole).length;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">管理员仪表盘</h1>

      <div className="flex flex-wrap items-end gap-3">
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
          className="rounded-md border px-4 py-2 text-sm hover:bg-slate-100"
        >
          查询
        </button>
        <button
          onClick={() => void recalc()}
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? '重算中…' : '全院重算'}
        </button>
        <button
          onClick={() => void api.downloadRanking(year, getToken())}
          disabled={results.length === 0}
          className="rounded-md border px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
          导出排名 Excel
        </button>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {/* 概览卡片 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="参评教师" value={results.length} />
        <Card label="维度否决" value={vetoCount} warn={vetoCount > 0} />
        <Card label="数据不完整" value={incomplete} warn={incomplete > 0} />
        <Card label="中层干部" value={mgmt} />
      </section>

      {/* 等级分布 */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-600">等级分布</h2>
        <div className="flex gap-3">
          {GRADES.map((g, i) => (
            <div
              key={g}
              className={`flex-1 rounded-lg p-3 text-center ${GRADE_COLOR[g]}`}
            >
              <div className="text-2xl font-bold">{dist[i]}</div>
              <div className="text-xs">{g} 级</div>
            </div>
          ))}
        </div>
      </section>

      {/* 排名表 */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-600">
          全院排名（{results.length}）
        </h2>
        {results.length === 0 ? (
          <p className="text-sm text-slate-500">暂无数据，请先全院重算。</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">排名</th>
                <th className="p-2">教师</th>
                <th className="p-2">综合分</th>
                <th className="p-2">上级</th>
                <th className="p-2">同行</th>
                <th className="p-2">学生</th>
                <th className="p-2">建议等级</th>
                <th className="p-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const grade = r.finalGrade ?? r.suggestedGrade;
                return (
                  <tr key={r.teacherId} className="border-b">
                    <td className="p-2">{r.rank ?? '—'}</td>
                    <td className="p-2">
                      {r.teacher?.name ?? r.teacherId}
                      {r.isMgmtRole && (
                        <span className="ml-1 text-xs text-slate-400">中层</span>
                      )}
                    </td>
                    <td className="p-2 font-medium">
                      {r.compositeScore?.toFixed(2) ?? '—'}
                    </td>
                    <td className="p-2">{r.supervisorFinal?.toFixed(1) ?? '—'}</td>
                    <td className="p-2">{r.peerFinal?.toFixed(1) ?? '—'}</td>
                    <td className="p-2">{r.studentFinal?.toFixed(1) ?? '—'}</td>
                    <td className="p-2">
                      {grade && (
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${GRADE_COLOR[grade] ?? ''}`}
                        >
                          {grade}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {!r.isDataComplete && (
                        <span className="text-xs text-amber-600">数据不完整</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Card({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className={`text-3xl font-bold ${warn ? 'text-red-600' : ''}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

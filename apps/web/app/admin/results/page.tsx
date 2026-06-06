'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type ApprovalRequestRow,
  type FinalResultRow,
} from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const GRADES = ['S', 'A', 'B', 'C', 'D'];
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '会签中',
  PUBLISHED: '已发布',
  APPEAL: '申诉中',
  CONFIRMED: '已确认',
};

export default function ResultsAdminPage() {
  const [year, setYear] = useState('2025-2026');
  const [results, setResults] = useState<FinalResultRow[]>([]);
  const [history, setHistory] = useState<ApprovalRequestRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 改等级会签表单
  const [gcTeacher, setGcTeacher] = useState('');
  const [gcGrade, setGcGrade] = useState('A');
  const [gcReason, setGcReason] = useState('');

  const load = useCallback(async (y: string) => {
    setMessage(null);
    try {
      const [r, h] = await Promise.all([
        api.listResults(y, getToken()),
        api.approvalList(y, getToken()),
      ]);
      setResults(r);
      setHistory(h);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initiatePublish() {
    setBusy(true);
    setMessage(null);
    try {
      await api.initiatePublish(year, getToken());
      setMessage('已发起发布会签，等待审核委员会全员同意。');
      await load(year);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '发起失败');
    } finally {
      setBusy(false);
    }
  }

  async function initiateGradeChange() {
    if (!gcTeacher || !gcReason.trim()) {
      setMessage('请选择教师并填写修改理由');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.initiateGradeChange(
        { teacherId: gcTeacher, academicYear: year, newGrade: gcGrade, reason: gcReason.trim() },
        getToken(),
      );
      setMessage('已发起"修改最终等级"会签，需委员会全员同意后生效。');
      setGcReason('');
      await load(year);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '发起失败');
    } finally {
      setBusy(false);
    }
  }

  const published = results.some((r) => r.finalGrade);
  const reviewing = results.some((r) => !r.finalGrade);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">成绩管理 / 发布</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>学年</span>
          <input value={year} onChange={(e) => setYear(e.target.value)}
            className="rounded-md border px-3 py-2" />
        </label>
        <button onClick={() => void load(year)}
          className="rounded-md border px-4 py-2 text-sm hover:bg-slate-100">查询</button>
        <button onClick={() => void initiatePublish()} disabled={busy || results.length === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
          发起发布会签
        </button>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      <p className="text-sm text-slate-500">
        发布与改等级均需 <b>审核委员会全员会签同意</b>；系统不提供直接改等级入口。
      </p>

      {/* 结果列表 */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-600">
          全院结果（{results.length}）
        </h2>
        {results.length === 0 ? (
          <p className="text-sm text-slate-500">暂无数据，请先在仪表盘"全院重算"。</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">排名</th>
                <th className="p-2">教师</th>
                <th className="p-2">综合分</th>
                <th className="p-2">建议等级</th>
                <th className="p-2">最终等级</th>
                <th className="p-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.teacherId} className="border-b">
                  <td className="p-2">{r.rank ?? '—'}</td>
                  <td className="p-2">{r.teacher?.name ?? r.teacherId}</td>
                  <td className="p-2">{r.compositeScore?.toFixed(2) ?? '—'}</td>
                  <td className="p-2">{r.suggestedGrade ?? '—'}</td>
                  <td className="p-2 font-medium">{r.finalGrade ?? '—'}</td>
                  <td className="p-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 发起改等级会签 */}
      {results.length > 0 && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium text-slate-600">发起"修改最终等级"会签</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>教师</span>
              <select value={gcTeacher} onChange={(e) => setGcTeacher(e.target.value)}
                className="min-w-48 rounded-md border px-3 py-2">
                <option value="">选择教师</option>
                {results.map((r) => (
                  <option key={r.teacherId} value={r.teacherId}>
                    {r.teacher?.name ?? r.teacherId}（现 {r.finalGrade ?? r.suggestedGrade ?? '—'}）
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>改为</span>
              <select value={gcGrade} onChange={(e) => setGcGrade(e.target.value)}
                className="rounded-md border px-3 py-2">
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <input value={gcReason} onChange={(e) => setGcReason(e.target.value)}
              placeholder="修改理由" className="min-w-64 flex-1 rounded-md border px-3 py-2 text-sm" />
            <button onClick={() => void initiateGradeChange()} disabled={busy}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white disabled:opacity-50">
              发起会签
            </button>
          </div>
        </section>
      )}

      {/* 审签记录 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-600">会签记录（{history.length}）</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">暂无会签记录。</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">
                  {h.type === 'PUBLISH' ? '发布成绩' : '修改最终等级'}
                  {h.type === 'GRADE_CHANGE' && h.payload
                    ? `（改为 ${h.payload.newGrade}）`
                    : ''}
                </span>
                <span className={
                  h.status === 'APPROVED' ? 'text-green-700'
                    : h.status === 'REJECTED' ? 'text-red-600' : 'text-amber-600'
                }>
                  {h.status === 'APPROVED' ? '已通过' : h.status === 'REJECTED' ? '已驳回' : '会签中'}
                </span>
              </div>
              <ul className="mt-1 space-y-0.5 text-slate-600">
                {h.votes.map((v, i) => (
                  <li key={i}>
                    {v.memberName}：{v.decision === 'AGREE' ? '✓ 同意' : '✗ 驳回'}
                    {v.opinion ? `（${v.opinion}）` : ''}
                  </li>
                ))}
                {h.votes.length === 0 && <li className="text-slate-400">尚无投票</li>}
              </ul>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

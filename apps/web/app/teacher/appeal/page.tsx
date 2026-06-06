'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type AppealRow } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: '待处理',
  PROCESSING: '处理中',
  ACCEPTED: '已受理',
  REJECTED: '已驳回',
  CLOSED: '已结案',
};

export default function TeacherAppealPage() {
  const [year, setYear] = useState('2025-2026');
  const [reason, setReason] = useState('');
  const [list, setList] = useState<AppealRow[]>([]);
  const [escalateReason, setEscalateReason] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api.myAppeals(getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (reason.trim().length < 10) {
      setMessage('申诉理由需不少于 10 字');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.createAppeal({ academicYear: year, reason: reason.trim() }, getToken());
      setMessage('院级申诉已提交，学院将在 3 个工作日内复核。');
      setReason('');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  async function escalate(id: string) {
    const r = escalateReason[id] ?? '';
    if (r.trim().length < 10) {
      setMessage('校级复核理由需不少于 10 字');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.escalateAppeal(id, r.trim(), getToken());
      setMessage('已提交校级复核。');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">成绩申诉</h1>
        <p className="mt-1 text-sm text-slate-500">
          对已发布成绩有异议，可在公示期内提起院级申诉；若不服院级复核结果，可再申请校级复核。
        </p>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium text-slate-600">发起院级申诉</h2>
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>学年</span>
            <input value={year} onChange={(e) => setYear(e.target.value)}
              className="rounded-md border px-3 py-2" />
          </label>
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          placeholder="请说明申诉理由（不少于 10 字）"
          className="w-full rounded-md border px-3 py-2 text-sm" />
        <button onClick={() => void submit()} disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
          提交申诉
        </button>
      </section>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-600">我的申诉（{list.length}）</h2>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">暂无申诉。</p>
        ) : (
          list.map((a) => (
            <div key={a.id} className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">
                  {a.academicYear} · {a.appealLevel === 'COLLEGE' ? '院级' : '校级'}申诉
                </span>
                <span>{STATUS_LABEL[a.status] ?? a.status}</span>
              </div>
              <div className="text-slate-600">理由：{a.reason}</div>
              {a.collegeProcess && (
                <div className="text-slate-500">
                  院级复核：{a.collegeProcess.result === 'ACCEPTED' ? '受理' : '驳回'}
                  {a.collegeProcess.opinion ? `（${a.collegeProcess.opinion}）` : ''}
                </div>
              )}
              {a.universityProcess && (
                <div className="text-slate-500">
                  校级复核：{a.universityProcess.result === 'ACCEPTED' ? '受理' : '驳回'}
                  {a.universityProcess.opinion ? `（${a.universityProcess.opinion}）` : ''}
                </div>
              )}
              {/* 院级被驳回 → 可申请校级复核 */}
              {a.appealLevel === 'COLLEGE' && a.status === 'REJECTED' && (
                <div className="space-y-2 border-t pt-2">
                  <input
                    value={escalateReason[a.id] ?? ''}
                    onChange={(e) =>
                      setEscalateReason((p) => ({ ...p, [a.id]: e.target.value }))
                    }
                    placeholder="校级复核理由（不少于 10 字）"
                    className="w-full rounded-md border px-3 py-2"
                  />
                  <button onClick={() => void escalate(a.id)} disabled={busy}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100">
                    申请校级复核
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </main>
  );
}

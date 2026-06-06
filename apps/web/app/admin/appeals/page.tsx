'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type AppealLevel, type AppealRow } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const LEVELS: { value: AppealLevel; label: string }[] = [
  { value: 'COLLEGE', label: '院级复核（学院秘书组）' },
  { value: 'UNIVERSITY', label: '校级复核（质保部）' },
];

export default function AdminAppealsPage() {
  const [level, setLevel] = useState<AppealLevel>('COLLEGE');
  const [list, setList] = useState<AppealRow[]>([]);
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (lv: AppealLevel) => {
    setMessage(null);
    try {
      setList(await api.appealPending(lv, getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(level);
  }, [level, load]);

  async function process(id: string, accept: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      await api.appealProcess(id, level, accept, opinions[id] ?? '', getToken());
      setMessage(accept ? '已受理。' : '已驳回。');
      await load(level);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '处理失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">申诉处理</h1>
        <p className="mt-1 text-sm text-slate-500">
          院级先复核；教师不服可升校级。请在 3 个工作日内答复。
        </p>
      </div>

      <div className="flex gap-2">
        {LEVELS.map((l) => (
          <button key={l.value} onClick={() => setLevel(l.value)}
            className={`rounded-md px-3 py-2 text-sm ${
              level === l.value ? 'bg-slate-900 text-white' : 'border hover:bg-slate-100'
            }`}>
            {l.label}
          </button>
        ))}
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">当前级别暂无待处理申诉。</p>
      ) : (
        <ul className="space-y-4">
          {list.map((a) => (
            <li key={a.id} className="space-y-3 rounded-lg border p-4 text-sm">
              <div>
                <div>
                  教师：<b>{a.teacherName}</b> · {a.academicYear}
                </div>
                <div className="mt-2 rounded bg-slate-50 p-2 text-slate-700">
                  申诉理由：{a.reason}
                </div>
                {level === 'UNIVERSITY' && a.collegeProcess && (
                  <div className="mt-1 text-xs text-slate-500">
                    院级结论：{a.collegeProcess.result === 'ACCEPTED' ? '受理' : '驳回'}
                    {a.collegeProcess.opinion ? `（${a.collegeProcess.opinion}）` : ''}
                  </div>
                )}
              </div>
              <input
                value={opinions[a.id] ?? ''}
                onChange={(e) => setOpinions((p) => ({ ...p, [a.id]: e.target.value }))}
                placeholder="复核意见（选填）"
                className="w-full rounded-md border px-3 py-2"
              />
              <div className="flex gap-2">
                <button onClick={() => void process(a.id, true)} disabled={busy}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">
                  受理
                </button>
                <button onClick={() => void process(a.id, false)} disabled={busy}
                  className="rounded-md bg-red-600 px-4 py-2 text-white disabled:opacity-50">
                  驳回
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

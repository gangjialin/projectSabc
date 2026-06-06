'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ExemptionLevel, type ExemptionRow } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const LEVELS: { value: ExemptionLevel; label: string }[] = [
  { value: 'DEPT', label: '系部主任审核' },
  { value: 'COLLEGE', label: '学院秘书组审核' },
  { value: 'UNIVERSITY', label: '学校质保部审核' },
];

export default function AdminExemptionPage() {
  const [level, setLevel] = useState<ExemptionLevel>('DEPT');
  const [list, setList] = useState<ExemptionRow[]>([]);
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (lv: ExemptionLevel) => {
    setMessage(null);
    try {
      setList(await api.exemptionPending(lv, getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(level);
  }, [level, load]);

  async function review(id: string, agree: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      await api.exemptionReview(id, level, agree, opinions[id] ?? '', getToken());
      setMessage(agree ? '已同意，转下一级（或完成）。' : '已驳回，流程终止。');
      await load(level);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">免计入申请审核</h1>
        <p className="mt-1 text-sm text-slate-500">
          三级顺序审核：系部主任 → 学院秘书组 → 学校质保部。任一级驳回则流程终止。
        </p>
      </div>

      <div className="flex gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            onClick={() => setLevel(l.value)}
            className={`rounded-md px-3 py-2 text-sm ${
              level === l.value
                ? 'bg-slate-900 text-white'
                : 'border hover:bg-slate-100'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">当前级别暂无待审申请。</p>
      ) : (
        <ul className="space-y-4">
          {list.map((e) => (
            <li key={e.id} className="space-y-3 rounded-lg border p-4">
              <div className="text-sm">
                <div>
                  学生：<b>{e.studentName}</b>（{e.studentId}）· 班级 {e.className}
                </div>
                <div className="text-slate-500">
                  学期 {e.semester} · {e.academicYear}
                </div>
                <div className="mt-2 rounded bg-slate-50 p-2 text-slate-700">
                  申请理由：{e.reason}
                </div>
                {level !== 'DEPT' && e.deptChiefReview && (
                  <div className="mt-1 text-xs text-slate-500">
                    系部意见：{e.deptChiefReview.opinion || '（无）'}
                  </div>
                )}
                {level === 'UNIVERSITY' && e.collegeReview && (
                  <div className="text-xs text-slate-500">
                    学院意见：{e.collegeReview.opinion || '（无）'}
                  </div>
                )}
              </div>
              <input
                value={opinions[e.id] ?? ''}
                onChange={(ev) =>
                  setOpinions((p) => ({ ...p, [e.id]: ev.target.value }))
                }
                placeholder="审核意见（选填）"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void review(e.id, true)}
                  disabled={busy}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  同意
                </button>
                <button
                  onClick={() => void review(e.id, false)}
                  disabled={busy}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
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

'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ReviewerCandidate } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

export function PickTargets({
  kind,
  title,
  desc,
}: {
  kind: 'LECTURE' | 'MATERIAL';
  title: string;
  desc: string;
}) {
  const [cands, setCands] = useState<ReviewerCandidate[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      setCands(await api.reviewerCandidates(kind, getToken()));
      setPicked(new Set());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function submit() {
    if (picked.size === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.assignReviewTargets(kind, [...picked], getToken());
      setMessage(
        `已生成 ${res.created} 项评价任务` +
          (res.failed.length ? `，${res.failed.length} 项跳过（多为未选参评课程）` : '') +
          '。可到「我的评分任务」打分。',
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  const selectable = cands.filter((c) => c.hasTargetCourse && !c.assigned);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          可选 {selectable.length} 人 · 已勾选 {picked.size}
        </span>
        <button
          onClick={() => void submit()}
          disabled={busy || picked.size === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          生成评价任务
        </button>
      </div>

      {cands.length === 0 ? (
        <p className="text-sm text-slate-500">暂无可选教师。</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {cands.map((c) => {
            const disabled = !c.hasTargetCourse || c.assigned;
            return (
              <li key={c.teacherId} className="flex items-center justify-between p-3">
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {c.account} · {c.department}
                  </span>
                  <div className="text-sm text-slate-500">
                    {c.hasTargetCourse
                      ? `参评课程：${c.courseName}`
                      : '该教师未选参评课程'}
                  </div>
                </div>
                {c.assigned ? (
                  <span className="text-sm text-green-700">✓ 已安排</span>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={picked.has(c.teacherId)}
                      onChange={() => toggle(c.teacherId)}
                    />
                    {disabled ? '不可选' : '选择'}
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

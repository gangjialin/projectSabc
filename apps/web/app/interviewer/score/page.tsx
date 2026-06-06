'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type InterviewRow } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

interface Form {
  capabilityScore: string;
  methodScore: string;
  assessmentScore: string;
  comment: string;
}
const EMPTY: Form = { capabilityScore: '', methodScore: '', assessmentScore: '', comment: '' };

export default function InterviewerScorePage() {
  const [list, setList] = useState<InterviewRow[]>([]);
  const [active, setActive] = useState<InterviewRow | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api.interviewsAssigned(getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!active) return;
    const cap = Number(form.capabilityScore);
    const method = Number(form.methodScore);
    const assess = Number(form.assessmentScore);
    if (cap > 8 || method > 6 || assess > 6 || [cap, method, assess].some((n) => Number.isNaN(n) || n < 0)) {
      setMessage('分值范围：能力 0-8、方法 0-6、考核 0-6');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.scoreInterview(
        active.id,
        { capabilityScore: cap, methodScore: method, assessmentScore: assess, comment: form.comment },
        getToken(),
      );
      setMessage(`已提交对「${active.teacherName}」的访谈评分（合计 ${cap + method + assess}/20）。`);
      setActive(null);
      setForm(EMPTY);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  if (active) {
    const total =
      (Number(form.capabilityScore) || 0) +
      (Number(form.methodScore) || 0) +
      (Number(form.assessmentScore) || 0);
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">访谈评分：{active.teacherName}</h1>
            <p className="text-sm text-slate-500">{active.courseName}</p>
          </div>
          <button onClick={() => { setActive(null); setForm(EMPTY); }}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100">返回</button>
        </div>

        <div className="space-y-4 rounded-lg border p-5">
          <Num label="能力培养感知（0-8）" max={8} value={form.capabilityScore}
            onChange={(v) => setForm((f) => ({ ...f, capabilityScore: v }))} />
          <Num label="教学方法接受度（0-6）" max={6} value={form.methodScore}
            onChange={(v) => setForm((f) => ({ ...f, methodScore: v }))} />
          <Num label="考核认可度（0-6）" max={6} value={form.assessmentScore}
            onChange={(v) => setForm((f) => ({ ...f, assessmentScore: v }))} />
          <label className="flex flex-col gap-1 text-sm">
            <span>访谈记录/意见（选填）</span>
            <textarea value={form.comment} rows={3}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              className="rounded-md border px-3 py-2" />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">合计 <b>{total}</b> / 20</span>
            <button onClick={() => void submit()} disabled={busy}
              className="rounded-md bg-slate-900 px-5 py-2 text-sm text-white disabled:opacity-50">
              {busy ? '提交中…' : '提交评分'}
            </button>
          </div>
        </div>
        {message && <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">我的访谈评分</h1>
        <p className="mt-1 text-sm text-slate-500">
          访谈委员对被抽取学生进行访谈后打分（能力 8 + 方法 6 + 考核 6 = 20 分）。
        </p>
      </div>
      {message && <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>}
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">暂无可评访谈。</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {list.map((i) => (
            <li key={i.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">{i.teacherName}</div>
                <div className="text-sm text-slate-500">
                  {i.courseName} · 抽取 {i.selectedStudentIds.length} 名学生
                </div>
              </div>
              {i.myScored ? (
                <span className="text-sm text-green-700">✓ 已评分</span>
              ) : (
                <button onClick={() => setActive(i)}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">去评分</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Num({
  label,
  max,
  value,
  onChange,
}: {
  label: string;
  max: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-md border px-3 py-2"
      />
    </label>
  );
}

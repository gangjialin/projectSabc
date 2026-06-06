'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type AdminFlagRow, type FinalResultRow } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const FLAG_TYPES: { value: string; label: string; effect: string }[] = [
  { value: 'ETHICS_ISSUE', label: '严重师德师风问题', effect: '直接 D 级' },
  { value: 'MATERIAL_FRAUD', label: '考核材料伪造', effect: '直接 D 级' },
  { value: 'STUDENT_SCORE_LOW', label: '学生评分低于 90', effect: '不得 S 级' },
  { value: 'RESPONSIBILITY_ACCIDENT', label: '责任事故', effect: '不得 B 及以上' },
  { value: 'TEACHING_ERROR', label: '一般教学差错', effect: '不得 A 及以上' },
];
const TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(FLAG_TYPES.map((t) => [t.value, t.label])),
  DIM_VETO: '维度否决（系统自动）',
};
const RESTRICTION_LABEL: Record<string, string> = {
  FORCE_D: '直接 D',
  NO_S: '不得 S',
  NO_B_OR_ABOVE: '不得 B 及以上',
  NO_A_OR_ABOVE: '不得 A 及以上',
};

export default function FlagsPage() {
  const [year, setYear] = useState('2025-2026');
  const [results, setResults] = useState<FinalResultRow[]>([]);
  const [flags, setFlags] = useState<AdminFlagRow[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [flagType, setFlagType] = useState('ETHICS_ISSUE');
  const [evidence, setEvidence] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (y: string) => {
    setMessage(null);
    try {
      const [r, f] = await Promise.all([
        api.listResults(y, getToken()),
        api.listFlags(y, getToken()),
      ]);
      setResults(r);
      setFlags(f);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!teacherId) {
      setMessage('请选择教师');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.createFlag(
        { teacherId, academicYear: year, flagType, evidence: evidence.trim() || undefined },
        getToken(),
      );
      setMessage('已录入。重算后将影响该教师等级认定。');
      setEvidence('');
      await load(year);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '录入失败');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await api.deleteFlag(id, getToken());
      await load(year);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  const teacherName = (id: string) =>
    results.find((r) => r.teacherId === id)?.teacher?.name ?? id;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">前置限定标记</h1>
        <p className="mt-1 text-sm text-slate-500">
          录入经核实的师德/造假/事故/差错等情形，系统按规定自动施加等级限制；
          维度否决由系统自动产生、不可手工录入或删除。录入后需"全院重算"生效。
        </p>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium text-slate-600">录入标记</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>学年</span>
            <input value={year} onChange={(e) => setYear(e.target.value)}
              className="rounded-md border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>教师</span>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}
              className="min-w-48 rounded-md border px-3 py-2">
              <option value="">选择教师</option>
              {results.map((r) => (
                <option key={r.teacherId} value={r.teacherId}>
                  {r.teacher?.name ?? r.teacherId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>情形</span>
            <select value={flagType} onChange={(e) => setFlagType(e.target.value)}
              className="rounded-md border px-3 py-2">
              {FLAG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} → {t.effect}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input value={evidence} onChange={(e) => setEvidence(e.target.value)}
          placeholder="依据/说明（选填）" className="w-full rounded-md border px-3 py-2 text-sm" />
        <button onClick={() => void create()} disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
          录入标记
        </button>
        <p className="text-xs text-slate-400">
          ⚠ 如选择 {results.length === 0 ? '' : ''}"师德/造假"将使该教师直接评 D，请审慎并核实。
        </p>
      </section>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-600">已有标记（{flags.length}）</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-slate-500">暂无标记。</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">教师</th>
                <th className="p-2">情形</th>
                <th className="p-2">等级限制</th>
                <th className="p-2">依据</th>
                <th className="p-2">来源</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id} className="border-b">
                  <td className="p-2">{f.teacherName || teacherName(f.teacherId)}</td>
                  <td className="p-2">{TYPE_LABEL[f.flagType] ?? f.flagType}</td>
                  <td className="p-2">{RESTRICTION_LABEL[f.gradeRestriction] ?? f.gradeRestriction}</td>
                  <td className="p-2 text-slate-500">{f.evidence ?? '—'}</td>
                  <td className="p-2">{f.isAutoGenerated ? '系统自动' : '手工'}</td>
                  <td className="p-2">
                    {!f.isAutoGenerated && (
                      <button onClick={() => void remove(f.id)} disabled={busy}
                        className="text-slate-400 hover:text-red-600">删除</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

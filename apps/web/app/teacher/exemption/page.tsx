'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ExemptionRow } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: '审核中',
  APPROVED: '已通过（免计入）',
  REJECTED: '已驳回',
};

function reviewText(
  stamp: { status: string; opinion?: string; reviewerName: string } | null,
): string {
  if (!stamp) return '待审';
  return `${stamp.status === 'AGREE' ? '同意' : '驳回'}${stamp.opinion ? `（${stamp.opinion}）` : ''}`;
}

export default function TeacherExemptionPage() {
  const [year] = useState('2025-2026');
  const [courseId, setCourseId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [reason, setReason] = useState('');
  const [list, setList] = useState<ExemptionRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setList(await api.myExemptions(getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void loadList();
    // 取教师本学年填报课程作为申请对象
    api
      .getMyCourseReport(year, getToken())
      .then((c) => {
        if (c) {
          setCourseId(c.id);
          setCourseName(`${c.courseCode} ${c.name}`);
        }
      })
      .catch(() => undefined);
  }, [loadList, year]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!courseId) {
      setMessage('请先在「参评课程填报」填报本学年课程');
      return;
    }
    if (reason.trim().length < 30) {
      setMessage('申请理由需不少于 30 字');
      return;
    }
    setBusy(true);
    try {
      await api.createExemption(
        { studentId: studentId.trim(), courseId, reason: reason.trim() },
        getToken(),
      );
      setMessage('✅ 申请已提交，进入系部主任审核。');
      setStudentId('');
      setReason('');
      await loadList();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">学生评价免计入申请</h1>
        <p className="mt-1 text-sm text-slate-500">
          针对个别异常学生评价，可申请免计入。需经 系部主任 → 学院秘书组 → 学校质保部
          三级审核，全部同意后该学生评价不计入成绩。每学期至多 5 条。
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-lg border p-5">
        <div className="text-sm">
          申请课程：
          <b>{courseName || '（尚未填报参评课程）'}</b>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>学生学号 <span className="text-red-500">*</span></span>
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            申请理由 <span className="text-red-500">*</span>
            <span className="ml-1 text-xs text-slate-400">
              （{reason.trim().length}/30 字）
            </span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            required
            className="rounded-md border px-3 py-2"
            placeholder="请具体说明该学生评价异常的客观情况（不少于 30 字）"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? '提交中…' : '提交申请'}
        </button>
      </form>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-600">
          我的申请（{list.length}）
        </h2>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">暂无申请。</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">学生</th>
                <th className="p-2">系部</th>
                <th className="p-2">学院</th>
                <th className="p-2">学校</th>
                <th className="p-2">结果</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-2">
                    {e.studentName}（{e.studentId}）
                  </td>
                  <td className="p-2">{reviewText(e.deptChiefReview)}</td>
                  <td className="p-2">{reviewText(e.collegeReview)}</td>
                  <td className="p-2">{reviewText(e.universityReview)}</td>
                  <td className="p-2">
                    {STATUS_LABEL[e.finalStatus] ?? e.finalStatus}
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

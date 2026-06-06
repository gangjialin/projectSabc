'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type CourseBrief, type InterviewRow } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

export default function AdminInterviewPage() {
  const [year, setYear] = useState('2025-2026');
  const [courses, setCourses] = useState<CourseBrief[]>([]);
  const [list, setList] = useState<InterviewRow[]>([]);
  const [courseId, setCourseId] = useState('');
  const [students, setStudents] = useState('');
  const [date, setDate] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async (y: string) => {
    try {
      setList(await api.listInterviews(y, getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    api
      .listCourses(getToken())
      .then(setCourses)
      .catch(() => undefined);
    void loadList(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setMessage(null);
    const ids = students
      .split(/[;；,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!courseId || ids.length === 0) {
      setMessage('请选择课程并填写被抽取学生学号');
      return;
    }
    setBusy(true);
    try {
      await api.createInterview(
        { courseId, academicYear: year, selectedStudentIds: ids, interviewDate: date || undefined },
        getToken(),
      );
      setMessage('访谈已创建。');
      setStudents('');
      await loadList(year);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">个别访谈管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          配置访谈：选课程（推出被评教师）、抽取 3-5 名学生、约定时间。访谈委员（≥2 名非任课教师）据此打分。
        </p>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium text-slate-600">新建访谈</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>学年</span>
            <input value={year} onChange={(e) => setYear(e.target.value)}
              className="rounded-md border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>课程</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
              className="min-w-56 rounded-md border px-3 py-2">
              <option value="">选择课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} {c.name}
                  {c.teacher ? `（${c.teacher.name}）` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>访谈日期</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="rounded-md border px-3 py-2" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>被抽取学生学号（多个用逗号分隔，3-5 名）</span>
          <input value={students} onChange={(e) => setStudents(e.target.value)}
            placeholder="如：2021001，2021002，2021003"
            className="rounded-md border px-3 py-2" />
        </label>
        <button onClick={() => void create()} disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
          创建访谈
        </button>
      </section>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-600">访谈列表（{list.length}）</h2>
          <button onClick={() => void loadList(year)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100">刷新</button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">暂无访谈。</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">教师</th>
                <th className="p-2">课程</th>
                <th className="p-2">抽取学生</th>
                <th className="p-2">已打分委员</th>
                <th className="p-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="p-2">{i.teacherName}</td>
                  <td className="p-2">{i.courseName}</td>
                  <td className="p-2">{i.selectedStudentIds.length} 名</td>
                  <td className={i.scoreCount < 2 ? 'p-2 text-amber-600' : 'p-2'}>
                    {i.scoreCount}{i.scoreCount < 2 ? '（不足2名）' : ''}
                  </td>
                  <td className="p-2">{i.status === 'COMPLETED' ? '已完成' : '进行中'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

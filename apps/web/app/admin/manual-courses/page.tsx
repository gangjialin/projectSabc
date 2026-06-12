'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { api, type ManualCourse, type RosterEntry } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const TYPE_LABEL: Record<string, string> = {
  THEORY: '理论课',
  PRACTICE: '实践课',
  PROJECT: '项目课',
  THESIS: '毕业设计',
};

export default function ManualCoursesPage() {
  const [year, setYear] = useState('2025-2026');
  const [courses, setCourses] = useState<ManualCourse[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);

  const load = useCallback(async (y: string) => {
    setMessage(null);
    try {
      const list = await api.listManualCourses(getToken(), y);
      setCourses(list);
      if (list.length === 0) setMessage('暂无教师手工录入的课程。');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    try {
      setRoster(await api.getRoster(id, getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载名单失败');
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">手工课程核查</h1>
        <p className="mt-1 text-sm text-slate-500">
          教师手工录入的课程及其选课名单（只读核查）。选修课通常无授课班级，靠名单匹配学生评教。
        </p>
      </div>

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>学年</span>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <button
          onClick={() => void load(year)}
          className="rounded-md border px-3 py-2 text-sm hover:bg-slate-100"
        >
          查询
        </button>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left">
            <th className="p-2">课程</th>
            <th className="p-2">教师</th>
            <th className="p-2">类型/性质</th>
            <th className="p-2">授课班级</th>
            <th className="p-2">名单人数</th>
            <th className="p-2">参评</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <Fragment key={c.id}>
              <tr className="border-b">
                <td className="p-2">
                  {c.name}
                  <span className="ml-2 text-xs text-slate-400">{c.courseCode}</span>
                </td>
                <td className="p-2">
                  {c.teacherName}
                  <span className="ml-1 text-xs text-slate-400">
                    ({c.teacherAccount})
                  </span>
                </td>
                <td className="p-2">
                  {TYPE_LABEL[c.type] ?? c.type}
                  {c.isElective && (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-700">
                      选修
                    </span>
                  )}
                </td>
                <td className="p-2 text-slate-500">
                  {c.classNames.length ? c.classNames.join('、') : '—'}
                </td>
                <td className="p-2">{c.enrolledCount}</td>
                <td className="p-2">
                  {c.isTargetCourse ? (
                    <span className="text-green-700">是</span>
                  ) : (
                    <span className="text-slate-400">否</span>
                  )}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => void toggle(c.id)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    {openId === c.id ? '收起' : '查看名单'}
                  </button>
                </td>
              </tr>
              {openId === c.id && (
                <tr className="border-b bg-slate-50">
                  <td colSpan={7} className="p-3">
                    {roster.length === 0 ? (
                      <span className="text-slate-500">该课暂无选课名单。</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {roster.map((r) => (
                          <span
                            key={r.enrollmentId}
                            className="rounded bg-white px-2 py-1 text-xs"
                          >
                            {r.studentNo} {r.studentName}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </main>
  );
}

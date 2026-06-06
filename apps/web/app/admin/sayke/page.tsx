'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type CourseBrief,
  type SaykeLive,
  type SaykeSession,
  type UserBrief,
} from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

interface TeacherRow {
  teacherId: string;
  courseId: string;
}

export default function SaykeAdminPage() {
  const [teachers, setTeachers] = useState<UserBrief[]>([]);
  const [courses, setCourses] = useState<CourseBrief[]>([]);

  // 创建表单
  const [name, setName] = useState('期末说课评价');
  const [scheduledDate, setScheduledDate] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [rows, setRows] = useState<TeacherRow[]>([{ teacherId: '', courseId: '' }]);

  // 控制中的场次
  const [session, setSession] = useState<SaykeSession | null>(null);
  const [live, setLive] = useState<SaykeLive | null>(null);
  const [loadId, setLoadId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = getToken();
    Promise.all([api.listUsers(token, 'TEACHER'), api.listCourses(token)])
      .then(([u, c]) => {
        setTeachers(u);
        setCourses(c);
      })
      .catch((e) =>
        setMessage(e instanceof Error ? e.message : '加载教师/课程失败'),
      );
  }, []);

  const refresh = useCallback(async (id: string) => {
    try {
      const { session: s, live: l } = await api.saykeGet(id, getToken());
      setSession(s);
      setLive(l);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '刷新失败');
    }
  }, []);

  // 控制中的场次每 3 秒轮询实时数据
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => void refresh(session.id), 3000);
    return () => clearInterval(t);
  }, [session, refresh]);

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const valid = rows.filter((r) => r.teacherId && r.courseId);
      if (valid.length === 0) throw new Error('请至少添加一位说课教师');
      const s = await api.saykeCreate(
        { name, scheduledDate: scheduledDate || new Date().toISOString(), academicYear, teachers: valid },
        getToken(),
      );
      await refresh(s.id);
      setMessage(`场次已创建：${s.name}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  }

  async function setCurrent(sessionTeacherId: string) {
    if (!session) return;
    await api.saykeSetCurrent(session.id, sessionTeacherId, getToken());
    await refresh(session.id);
  }

  async function lock() {
    if (!session) return;
    await api.saykeLock(session.id, getToken());
    await refresh(session.id);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">现场说课控制台</h1>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {/* 创建场次 */}
      {!session && (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-sm font-medium text-slate-600">创建说课场次</h2>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>场次名称</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="rounded-md border px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>日期</span>
              <input type="date" value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-md border px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>学年</span>
              <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}
                className="rounded-md border px-3 py-2" />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-slate-500">说课教师顺序</span>
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-slate-400">{i + 1}</span>
                <select value={r.teacherId}
                  onChange={(e) => setRows((prev) => prev.map((x, j) => j === i ? { ...x, teacherId: e.target.value } : x))}
                  className="min-w-48 rounded-md border px-3 py-2 text-sm">
                  <option value="">选择教师</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}（{t.loginAccount}）</option>
                  ))}
                </select>
                <select value={r.courseId}
                  onChange={(e) => setRows((prev) => prev.map((x, j) => j === i ? { ...x, courseId: e.target.value } : x))}
                  className="min-w-56 rounded-md border px-3 py-2 text-sm">
                  <option value="">选择课程</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.courseCode} {c.name}</option>
                  ))}
                </select>
                {rows.length > 1 && (
                  <button onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-red-600">移除</button>
                )}
              </div>
            ))}
            <button onClick={() => setRows((prev) => [...prev, { teacherId: '', courseId: '' }])}
              className="text-sm text-slate-600 hover:text-slate-900">+ 添加教师</button>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => void create()} disabled={busy}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
              {busy ? '创建中…' : '创建场次'}
            </button>
            <span className="text-slate-300">或</span>
            <input value={loadId} onChange={(e) => setLoadId(e.target.value)}
              placeholder="输入场次ID加载" className="rounded-md border px-3 py-2 text-sm" />
            <button onClick={() => loadId && void refresh(loadId)}
              className="rounded-md border px-3 py-2 text-sm hover:bg-slate-100">加载</button>
          </div>
        </section>
      )}

      {/* 控制面板 */}
      {session && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div>
              <div className="text-lg font-semibold">{session.name}</div>
              <div className="text-sm text-slate-500">
                场次ID：<code className="rounded bg-slate-100 px-1">{session.id}</code>
              </div>
            </div>
            <div className="flex gap-2 text-sm">
              <a href={`/display/session/${session.id}`} target="_blank"
                className="rounded-md border px-3 py-2 hover:bg-slate-100">打开大屏 ↗</a>
              <button onClick={() => { setSession(null); setLive(null); }}
                className="rounded-md border px-3 py-2 hover:bg-slate-100">返回</button>
            </div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            同行扫码/访问入口：
            <code className="ml-1 rounded bg-white px-2 py-1">
              {origin}/peer/session/{session.id}
            </code>
            <span className="ml-3 text-slate-500">
              实时：已提交 <b>{live?.count ?? 0}</b> · 去极值均分{' '}
              <b>{live?.avgTotal != null ? live.avgTotal.toFixed(1) : '—'}</b>
            </span>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">顺序</th>
                <th className="p-2">教师</th>
                <th className="p-2">课程</th>
                <th className="p-2">状态</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {session.teachers.map((t) => {
                const isCurrent = t.teacherId === session.currentTeacherId;
                return (
                  <tr key={t.id} className={`border-b ${isCurrent ? 'bg-emerald-50' : ''}`}>
                    <td className="p-2">{t.orderNo}</td>
                    <td className="p-2 font-medium">{t.teacherName}</td>
                    <td className="p-2">{t.courseName}</td>
                    <td className="p-2">
                      {t.status === 'ACTIVE' ? '进行中' : t.status === 'LOCKED' ? '已锁定' : '等待'}
                    </td>
                    <td className="p-2">
                      {!isCurrent && t.status !== 'LOCKED' && (
                        <button onClick={() => void setCurrent(t.id)}
                          className="rounded border px-2 py-1 hover:bg-slate-100">设为当前</button>
                      )}
                      {isCurrent && (
                        <button onClick={() => void lock()}
                          className="rounded bg-amber-500 px-2 py-1 text-white hover:bg-amber-600">锁定打分</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

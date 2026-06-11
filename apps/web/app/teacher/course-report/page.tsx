'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type CourseMine } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const COURSE_TYPES: Record<string, string> = {
  THEORY: '理论课',
  PRACTICE: '实践课',
  PROJECT: '项目课',
  THESIS: '毕业设计',
};
const TYPE_OPTIONS = Object.entries(COURSE_TYPES).map(([value, label]) => ({
  value,
  label,
}));

export default function MyCoursesPage() {
  const [year, setYear] = useState('2025-2026');
  const [courses, setCourses] = useState<CourseMine[]>([]);
  const [typeOverride, setTypeOverride] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (y: string) => {
    setMessage(null);
    try {
      const list = await api.myCourses(y, getToken());
      setCourses(list);
      if (list.length === 0) {
        setMessage('未找到你本学年的课程（请确认管理员已导入课表，且课表中的教师账号与你的工号一致）。');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function select(c: CourseMine) {
    setBusy(true);
    setMessage(null);
    try {
      await api.selectTargetCourse(
        c.id,
        { type: typeOverride[c.id] ?? c.type, isCourseOwner: owner[c.id] ?? false },
        getToken(),
      );
      setMessage(`✅ 已将「${c.name}」设为本学年参评课程。`);
      await load(year);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '设置失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">我的参评课程</h1>
        <p className="mt-1 text-sm text-slate-500">
          从你本学年的课程中**选一门**作为参评课程（课程来自学校课表）。每学年限一门；选定后可重新选择以更改。
        </p>
      </div>

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>学年</span>
          <input value={year} onChange={(e) => setYear(e.target.value)}
            className="rounded-md border px-3 py-2" />
        </label>
        <button onClick={() => void load(year)}
          className="rounded-md border px-3 py-2 text-sm hover:bg-slate-100">查询</button>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      {courses.length > 0 && (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li
              key={c.id}
              className={`space-y-3 rounded-lg border p-4 ${
                c.isTargetCourse ? 'border-emerald-400 bg-emerald-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">
                    {c.name}
                    <span className="ml-2 text-xs text-slate-400">{c.courseCode}</span>
                    {c.isTargetCourse && (
                      <span className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">
                        当前参评
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    授课班级：{c.classNames.length ? c.classNames.join('、') : '（课表未提供班级，学生评教将无法匹配）'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span>课程类型</span>
                  <select
                    value={typeOverride[c.id] ?? c.type}
                    onChange={(e) =>
                      setTypeOverride((p) => ({ ...p, [c.id]: e.target.value }))
                    }
                    className="rounded-md border px-2 py-1"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={owner[c.id] ?? false}
                    onChange={(e) =>
                      setOwner((p) => ({ ...p, [c.id]: e.target.checked }))
                    }
                  />
                  我是本课程负责人
                </label>
                <button
                  onClick={() => void select(c)}
                  disabled={busy}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {c.isTargetCourse ? '重新确认为参评' : '设为参评课程'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

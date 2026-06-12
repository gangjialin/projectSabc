'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type CourseMine,
  type RosterEntry,
  type RosterImportResult,
} from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const COURSE_TYPES: { value: string; label: string }[] = [
  { value: 'THEORY', label: '理论课' },
  { value: 'PRACTICE', label: '实践课' },
  { value: 'PROJECT', label: '项目课' },
  { value: 'THESIS', label: '毕业设计' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  COURSE_TYPES.map((t) => [t.value, t.label]),
);

export default function TeacherCoursesPage() {
  const [year, setYear] = useState('2025-2026');
  const [courses, setCourses] = useState<CourseMine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 录入课程表单
  const [form, setForm] = useState({
    courseCode: '',
    name: '',
    type: 'THEORY',
    isElective: true,
    classNames: '',
  });

  // 名单：展开的课程 + 其名单 + 导入报告
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [importReport, setImportReport] =
    useState<RosterImportResult | null>(null);

  const load = useCallback(async (y: string) => {
    setMessage(null);
    try {
      setCourses(await api.myCourses(y, getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCourse() {
    if (!form.courseCode.trim() || !form.name.trim()) {
      setMessage('请填写课程代码与课程名称');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const classNames = form.classNames
        .split(/[;；,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.createManualCourse(
        {
          courseCode: form.courseCode.trim(),
          name: form.name.trim(),
          type: form.type,
          isElective: form.isElective,
          academicYear: year,
          classNames,
        },
        getToken(),
      );
      setMessage(
        res.existed
          ? `课程「${res.course.name}」已存在，可直接在下方导入选课名单。`
          : `✅ 已录入课程「${res.course.name}」，可在下方导入选课名单。`,
      );
      setForm({ courseCode: '', name: '', type: 'THEORY', isElective: true, classNames: '' });
      await load(year);
      setOpenCourseId(res.course.id);
      await loadRoster(res.course.id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '录入失败');
    } finally {
      setBusy(false);
    }
  }

  async function loadRoster(courseId: string) {
    try {
      setRoster(await api.getRoster(courseId, getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载名单失败');
    }
  }

  async function toggleRoster(courseId: string) {
    setImportReport(null);
    if (openCourseId === courseId) {
      setOpenCourseId(null);
      return;
    }
    setOpenCourseId(courseId);
    await loadRoster(courseId);
  }

  async function onImport(courseId: string, file: File) {
    setBusy(true);
    setMessage(null);
    setImportReport(null);
    try {
      const res = await api.importRoster(courseId, file, getToken());
      setImportReport(res);
      await loadRoster(courseId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(courseId: string, studentId: string) {
    setBusy(true);
    try {
      await api.removeEnrollment(courseId, studentId, getToken());
      await loadRoster(courseId);
    } finally {
      setBusy(false);
    }
  }

  async function clearAll(courseId: string) {
    if (!window.confirm('确定清空该课程全部选课名单？')) return;
    setBusy(true);
    try {
      await api.clearRoster(courseId, getToken());
      await loadRoster(courseId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">录入课程 / 选课名单</h1>
        <p className="mt-1 text-sm text-slate-500">
          课表里没有、或选修课无固定教学班（无授课班级）时，在此手工录入课程并导入选课名单。
          名单内学生即可在「学生评教」看到这门课。
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

      {/* 录入课程 */}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">录入新课程</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>课程代码 *</span>
            <input
              value={form.courseCode}
              onChange={(e) => setForm((f) => ({ ...f, courseCode: e.target.value }))}
              className="rounded-md border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>课程名称 *</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-md border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>课程类型 *</span>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="rounded-md border px-3 py-2"
            >
              {COURSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>课程性质 *</span>
            <select
              value={form.isElective ? '1' : '0'}
              onChange={(e) =>
                setForm((f) => ({ ...f, isElective: e.target.value === '1' }))
              }
              className="rounded-md border px-3 py-2"
            >
              <option value="1">选修课</option>
              <option value="0">必修课</option>
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span>上课班级（选填，多个用逗号/空格分隔；选修课通常留空，靠名单匹配）</span>
            <input
              value={form.classNames}
              onChange={(e) => setForm((f) => ({ ...f, classNames: e.target.value }))}
              placeholder="如：数媒2301，数媒2302"
              className="rounded-md border px-3 py-2"
            />
          </label>
        </div>
        <button
          onClick={() => void createCourse()}
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          录入课程
        </button>
      </section>

      {/* 我的课程 + 名单管理 */}
      <section className="space-y-3">
        <h2 className="font-medium">我的课程（{courses.length}）</h2>
        <ul className="space-y-3">
          {courses.map((c) => (
            <li key={c.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">
                    {c.name}
                    <span className="ml-2 text-xs text-slate-400">{c.courseCode}</span>
                    <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {TYPE_LABEL[c.type] ?? c.type}
                    </span>
                    {c.isElective && (
                      <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        选修
                      </span>
                    )}
                    {c.isManual && (
                      <span className="ml-1 rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                        手工录入
                      </span>
                    )}
                    {c.isTargetCourse && (
                      <span className="ml-1 rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">
                        当前参评
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    授课班级：
                    {c.classNames.length
                      ? c.classNames.join('、')
                      : '（无班级，靠选课名单匹配学生）'}
                  </div>
                </div>
                <button
                  onClick={() => void toggleRoster(c.id)}
                  className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100"
                >
                  {openCourseId === c.id ? '收起名单' : '管理选课名单'}
                </button>
              </div>

              {openCourseId === c.id && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-slate-100">
                      导入名单 Excel（列：学号、姓名）
                      <input
                        type="file"
                        accept=".xlsx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void onImport(c.id, file);
                        }}
                      />
                    </label>
                    {roster.length > 0 && (
                      <button
                        onClick={() => void clearAll(c.id)}
                        disabled={busy}
                        className="rounded-md border px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        清空名单
                      </button>
                    )}
                    <span className="text-sm text-slate-500">
                      当前名单 {roster.length} 人
                    </span>
                  </div>

                  {importReport && (
                    <div className="rounded-md bg-slate-50 p-3 text-sm">
                      <p>
                        已加入 <b>{importReport.added}</b> 人，已在名单中{' '}
                        {importReport.alreadyIn} 人。
                      </p>
                      {importReport.unmatched.length > 0 && (
                        <p className="mt-1 text-red-600">
                          未匹配（系统中查无此学号，请先让管理员导入这些学生）共{' '}
                          {importReport.unmatched.length} 个：
                          {importReport.unmatched.join('、')}
                        </p>
                      )}
                    </div>
                  )}

                  {roster.length > 0 && (
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="p-2">学号</th>
                          <th className="p-2">姓名</th>
                          <th className="p-2">原班级</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((r) => (
                          <tr key={r.enrollmentId} className="border-b">
                            <td className="p-2">{r.studentNo}</td>
                            <td className="p-2">{r.studentName}</td>
                            <td className="p-2 text-slate-500">
                              {r.className ?? '—'}
                            </td>
                            <td className="p-2">
                              <button
                                onClick={() => void removeOne(c.id, r.studentId)}
                                disabled={busy}
                                className="text-slate-400 hover:text-red-600"
                              >
                                移出
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

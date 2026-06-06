'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ReportCourseInput } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const COURSE_TYPES = [
  { value: 'THEORY', label: '理论课' },
  { value: 'PRACTICE', label: '实践课' },
  { value: 'PROJECT', label: '项目课' },
  { value: 'THESIS', label: '毕业设计' },
];
const COURSE_LEVELS = [
  { value: 'CORE', label: '专业核心课' },
  { value: 'PROJECT_L1', label: '一级项目课' },
  { value: 'PROJECT_L2', label: '二级项目课' },
  { value: 'REGULAR', label: '一般课' },
];

export default function CourseReportPage() {
  const [year, setYear] = useState('2025-2026');
  const [courseCode, setCourseCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('THEORY');
  const [level, setLevel] = useState('REGULAR');
  const [classNames, setClassNames] = useState('');
  const [semester, setSemester] = useState('');
  const [isReformCourse, setIsReformCourse] = useState(false);
  const [isCourseOwner, setIsCourseOwner] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasReport, setHasReport] = useState(false);

  const load = useCallback(async (y: string) => {
    setMessage(null);
    try {
      const r = await api.getMyCourseReport(y, getToken());
      if (r) {
        setCourseCode(r.courseCode);
        setName(r.name);
        setType(r.type);
        setLevel(r.level);
        setClassNames(r.classNames.join('，'));
        setSemester(r.semester);
        setIsReformCourse(r.isReformCourse);
        setHasReport(true);
        setMessage('已载入你本学年填报的课程，可修改后重新提交。');
      } else {
        setHasReport(false);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const classes = classNames
        .split(/[;；,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (classes.length === 0) throw new Error('请至少填写一个上课班级');

      const input: ReportCourseInput = {
        courseCode: courseCode.trim(),
        name: name.trim(),
        type,
        level,
        classNames: classes,
        academicYear: year,
        semester: semester.trim(),
        isReformCourse,
        isCourseOwner,
      };
      await api.reportCourse(input, getToken());
      setHasReport(true);
      setMessage('✅ 填报成功！这是你本学年的参评课程，如需更改可直接修改后再次提交。');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">参评课程填报</h1>
        <p className="mt-1 text-sm text-slate-500">
          每位教师每学年填报 <b>一门</b> 参评课程。若教多门课，请选择最具代表性的一门。
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
          加载该学年填报
        </button>
        {hasReport && (
          <span className="pb-2 text-sm text-green-700">● 本学年已填报</span>
        )}
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="课程编号" required>
            <input
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="课程名称" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="课程类型" required>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {COURSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="课程级别" required>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {COURSE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="学期" required>
            <input
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="如：第一学期"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="上课班级（多个用逗号分隔）" required>
            <input
              value={classNames}
              onChange={(e) => setClassNames(e.target.value)}
              placeholder="如：数媒2201，数媒2202"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isCourseOwner}
              onChange={(e) => setIsCourseOwner(e.target.checked)}
            />
            我是本课程负责人
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isReformCourse}
              onChange={(e) => setIsReformCourse(e.target.checked)}
            />
            本课程为教改加难度课程
          </label>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? '提交中…' : hasReport ? '更新填报' : '提交填报'}
        </button>
      </form>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type EvalTemplate, type StudentTeacher } from '@/lib/api';
import { EvaluationForm } from '@/components/EvaluationForm';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

export default function StudentSurveyPage() {
  const [year, setYear] = useState('2025-2026');
  const [teachers, setTeachers] = useState<StudentTeacher[]>([]);
  const [active, setActive] = useState<StudentTeacher | null>(null);
  const [template, setTemplate] = useState<EvalTemplate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (y: string) => {
    setMessage(null);
    setActive(null);
    setTemplate(null);
    try {
      setTeachers(await api.studentMyTeachers(y, getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEval(t: StudentTeacher) {
    setBusy(true);
    setMessage(null);
    try {
      const tpl = await api.getTemplate('STUDENT', getToken(), t.courseType);
      setTemplate(tpl);
      setActive(t);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载问卷失败');
    } finally {
      setBusy(false);
    }
  }

  async function submit(
    answers: { questionId: string; likertScore: number }[],
    comment: string,
  ) {
    if (!active) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.submitStudentSurvey(
        { teacherId: active.teacherId, courseId: active.courseId, comment, answers },
        getToken(),
      );
      setMessage(`✅ 已提交对「${active.teacherName}」的评价，感谢参与！`);
      setActive(null);
      setTemplate(null);
      await load(year);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  // 评价表单视图
  if (active && template) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              评价：{active.teacherName}
            </h1>
            <p className="text-sm text-slate-500">{active.courseName}</p>
          </div>
          <button
            onClick={() => {
              setActive(null);
              setTemplate(null);
            }}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            返回列表
          </button>
        </div>
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          🔒 本评价完全匿名，教师只能看到汇总结果，看不到是谁评的，请放心如实填写。
        </p>
        <EvaluationForm template={template} submitting={busy} onSubmit={submit} />
      </main>
    );
  }

  // 教师列表视图
  const pending = teachers.filter((t) => !t.submitted);
  const done = teachers.filter((t) => t.submitted);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">学生评教</h1>
        <p className="mt-1 text-sm text-slate-500">
          以下是本学期给你上课的老师，请逐位完成匿名评价。
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

      {teachers.length === 0 ? (
        <p className="text-sm text-slate-500">
          暂无可评价的老师（可能老师还没填报参评课程，或你的班级未匹配到课程）。
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-600">
              待评价（{pending.length}）
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-green-700">已全部完成，感谢！</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {pending.map((t) => (
                  <li
                    key={`${t.teacherId}:${t.courseId}`}
                    className="flex items-center justify-between p-3"
                  >
                    <div>
                      <div className="font-medium">{t.teacherName}</div>
                      <div className="text-sm text-slate-500">{t.courseName}</div>
                    </div>
                    <button
                      onClick={() => void startEval(t)}
                      disabled={busy}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      去评价
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-slate-600">
                已完成（{done.length}）
              </h2>
              <ul className="divide-y rounded-lg border">
                {done.map((t) => (
                  <li
                    key={`${t.teacherId}:${t.courseId}`}
                    className="flex items-center justify-between p-3 text-slate-500"
                  >
                    <div>
                      <div>{t.teacherName}</div>
                      <div className="text-sm">{t.courseName}</div>
                    </div>
                    <span className="text-sm text-green-700">✓ 已评价</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

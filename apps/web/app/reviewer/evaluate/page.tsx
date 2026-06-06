'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, type EvalTemplate } from '@/lib/api';
import { EvaluationForm } from '@/components/EvaluationForm';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') ?? '';
}

function EvaluatePageInner() {
  const params = useSearchParams();
  const formType = params.get('formType') ?? 'LECTURE';
  const teacherId = params.get('teacherId') ?? '';
  const courseId = params.get('courseId') ?? '';
  const courseType = params.get('courseType') ?? undefined;
  const semester = params.get('semester') ?? '第一学期';
  const academicYear = params.get('year') ?? '2025-2026';

  const [template, setTemplate] = useState<EvalTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    api
      .getTemplate(formType, getToken(), courseType)
      .then(setTemplate)
      .catch((e) => setError(e instanceof Error ? e.message : '加载题目失败'));
  }, [formType, courseType]);

  async function handleSubmit(
    answers: { questionId: string; likertScore: number }[],
    comment: string,
  ) {
    if (!teacherId || !courseId) {
      setError('缺少被评教师或课程信息（应从评价任务进入）');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitEvaluation(
        { formType, evaluateeTeacherId: teacherId, courseId, semester, academicYear, comment, answers },
        getToken(),
      );
      setDone(res.totalScore);
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (done !== null) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border bg-green-50 p-6 text-center">
          <p className="text-lg font-medium text-green-800">评分已提交并锁定</p>
          <p className="mt-1 text-sm text-slate-500">提交后不可修改，如需更正请联系管理员解锁。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">教学质量评分</h1>
        <p className="text-sm text-slate-500">
          表单类型：{formType}　学年：{academicYear}
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {template ? (
        <EvaluationForm template={template} submitting={submitting} onSubmit={handleSubmit} />
      ) : (
        !error && <p className="text-sm text-slate-500">加载题目中…</p>
      )}
    </main>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">加载中…</p>}>
      <EvaluatePageInner />
    </Suspense>
  );
}

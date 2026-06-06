'use client';

import { useMemo, useState } from 'react';
import type { EvalTemplate } from '@/lib/api';

/**
 * 李克特 5 级选项（只显文字，不显分值/百分比 —— 防锚定，需求 §5.2 红线）。
 * 与后端映射一致：完全符合=5 … 完全不符合=1。
 */
const LIKERT_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: '完全符合 / 表现突出' },
  { value: 4, label: '比较符合 / 表现较好' },
  { value: 3, label: '基本符合 / 一般达成' },
  { value: 2, label: '不太符合 / 存在明显不足' },
  { value: 1, label: '完全不符合 / 严重不足' },
];

export interface EvaluationFormProps {
  template: EvalTemplate;
  submitting?: boolean;
  onSubmit: (answers: { questionId: string; likertScore: number }[], comment: string) => void;
}

export function EvaluationForm({ template, submitting, onSubmit }: EvaluationFormProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');

  const allQuestionIds = useMemo(
    () => template.dimensions.flatMap((d) => d.questions.map((q) => q.id)),
    [template],
  );
  const answeredCount = allQuestionIds.filter((id) => answers[id]).length;
  const complete = answeredCount === allQuestionIds.length;

  function setAnswer(qid: string, value: number) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) return;
    onSubmit(
      allQuestionIds.map((id) => ({ questionId: id, likertScore: answers[id] })),
      comment,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {template.dimensions.map((dim) => (
        <section key={dim.id} className="space-y-4 rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-800">
            维度{dim.dimensionNo}　{dim.name}
          </h2>
          {dim.questions.map((q) => (
            <fieldset key={q.id} className="space-y-2 border-b pb-4 last:border-0">
              <legend className="text-sm font-medium text-slate-700">
                {q.serialNo}. {q.indicator}
              </legend>
              <div className="flex flex-wrap gap-2">
                {LIKERT_OPTIONS.map((opt) => {
                  const selected = answers[q.id] === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.value}
                        checked={selected}
                        onChange={() => setAnswer(q.id, opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </section>
      ))}

      <div className="space-y-2">
        <label htmlFor="comment" className="text-sm font-medium">
          文字反馈（选填）
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="sticky bottom-0 flex items-center justify-between border-t bg-white/90 py-3 backdrop-blur">
        <span className="text-sm text-slate-500">
          已完成 {answeredCount} / {allQuestionIds.length} 题
        </span>
        <button
          type="submit"
          disabled={!complete || submitting}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? '提交中…' : '提交评分'}
        </button>
      </div>
    </form>
  );
}

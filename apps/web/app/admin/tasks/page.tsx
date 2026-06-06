'use client';

import { useEffect, useState } from 'react';
import {
  api,
  type AssignTaskInput,
  type BatchAssignResult,
  type CourseBrief,
  type ReviewTaskRow,
  type TaskType,
  type UserBrief,
} from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') ?? '';
}

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'LECTURE', label: '定向听课' },
  { value: 'MATERIAL', label: '材料审查' },
];

/** 草稿条目：在 AssignTaskInput 基础上带展示名，便于清单显示 */
interface DraftItem extends AssignTaskInput {
  courseLabel: string;
  reviewerLabel: string;
}

export default function TasksPage() {
  const [courses, setCourses] = useState<CourseBrief[]>([]);
  const [reviewers, setReviewers] = useState<UserBrief[]>([]);
  const [tasks, setTasks] = useState<ReviewTaskRow[]>([]);

  const [courseId, setCourseId] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('LECTURE');
  const [plannedDate, setPlannedDate] = useState('');

  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [result, setResult] = useState<BatchAssignResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadBase() {
    const token = getToken();
    try {
      const [c, r] = await Promise.all([
        api.listCourses(token),
        api.listUsers(token, 'TEACHER'),
      ]);
      setCourses(c);
      setReviewers(r);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载基础数据失败');
    }
  }

  async function loadTasks() {
    try {
      setTasks(await api.listTasks(getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载任务失败');
    }
  }

  useEffect(() => {
    void loadBase();
    void loadTasks();
  }, []);

  const selectedCourse = courses.find((c) => c.id === courseId);
  // 客户端软提示：委员不得评自己课程（后端为权威校验）
  const selfWarning =
    selectedCourse && reviewerId && selectedCourse.teacherId === reviewerId;

  function addToDraft() {
    if (!courseId || !reviewerId) return;
    const course = courses.find((c) => c.id === courseId);
    const reviewer = reviewers.find((r) => r.id === reviewerId);
    if (!course || !reviewer) return;

    // 草稿内去重
    const dup = draft.some(
      (d) =>
        d.courseId === courseId &&
        d.reviewerId === reviewerId &&
        d.taskType === taskType,
    );
    if (dup) {
      setMessage('该条目已在待分配清单中');
      return;
    }
    setDraft((prev) => [
      ...prev,
      {
        courseId,
        reviewerId,
        taskType,
        plannedDate: plannedDate || undefined,
        courseLabel: `${course.courseCode} ${course.name}`,
        reviewerLabel: `${reviewer.name}（${reviewer.loginAccount}）`,
      },
    ]);
    setMessage(null);
    setResult(null);
  }

  function removeDraft(i: number) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (draft.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const items: AssignTaskInput[] = draft.map((d) => ({
        courseId: d.courseId,
        reviewerId: d.reviewerId,
        taskType: d.taskType,
        plannedDate: d.plannedDate,
      }));
      const res = await api.assignTaskBatch(items, getToken());
      setResult(res);
      // 保留失败条目在草稿中供修正，移除已成功条目
      const failedIdx = new Set(res.failed.map((f) => f.index));
      setDraft((prev) => prev.filter((_, idx) => failedIdx.has(idx)));
      setMessage(
        `分配完成：成功 ${res.created} 条` +
          (res.failed.length ? `，失败 ${res.failed.length} 条（见下）` : ''),
      );
      await loadTasks();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '分配失败');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    try {
      await api.cancelTask(id, getToken());
      await loadTasks();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '取消失败');
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">评价任务分配</h1>

      {/* 构建分配条目 */}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium text-slate-600">新增分配</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>课程</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="min-w-56 rounded-md border px-3 py-2"
            >
              <option value="">请选择课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} {c.name}
                  {c.teacher ? `（${c.teacher.name}）` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>委员</span>
            <select
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="min-w-48 rounded-md border px-3 py-2"
            >
              <option value="">请选择委员</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}（{r.loginAccount}）
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>任务类型</span>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              className="rounded-md border px-3 py-2"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>计划日期（可选）</span>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="rounded-md border px-3 py-2"
            />
          </label>

          <button
            onClick={addToDraft}
            disabled={!courseId || !reviewerId}
            className="rounded-md bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            加入清单
          </button>
        </div>

        {selfWarning && (
          <p className="text-sm text-amber-600">
            ⚠ 该委员是此课程的主讲教师，委员不得评价自己主讲的课程，提交时会被拒绝。
          </p>
        )}
      </section>

      {/* 待分配清单（批量） */}
      {draft.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-600">
            待分配清单（{draft.length} 条）
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">课程</th>
                <th className="p-2">委员</th>
                <th className="p-2">类型</th>
                <th className="p-2">计划日期</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {draft.map((d, i) => {
                const failed = result?.failed.find((f) => f.index === i);
                return (
                  <tr key={i} className="border-b">
                    <td className="p-2">{d.courseLabel}</td>
                    <td className="p-2">{d.reviewerLabel}</td>
                    <td className="p-2">
                      {TASK_TYPES.find((t) => t.value === d.taskType)?.label}
                    </td>
                    <td className="p-2">{d.plannedDate ?? '—'}</td>
                    <td className="p-2">
                      {failed ? (
                        <span className="text-red-600">{failed.message}</span>
                      ) : (
                        <button
                          onClick={() => removeDraft(i)}
                          className="text-slate-500 hover:text-red-600"
                        >
                          移除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? '提交中…' : `提交分配（${draft.length} 条）`}
          </button>
        </section>
      )}

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {/* 现有任务 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-600">
            已分配任务（{tasks.length}）
          </h2>
          <button
            onClick={() => void loadTasks()}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            刷新
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">暂无任务。</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">课程</th>
                <th className="p-2">委员</th>
                <th className="p-2">类型</th>
                <th className="p-2">状态</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="p-2">
                    {t.course.courseCode} {t.course.name}
                  </td>
                  <td className="p-2">
                    {t.reviewer.name}（{t.reviewer.loginAccount}）
                  </td>
                  <td className="p-2">
                    {TASK_TYPES.find((x) => x.value === t.taskType)?.label}
                  </td>
                  <td className="p-2">
                    {t.status === 'PENDING'
                      ? '待完成'
                      : t.status === 'COMPLETED'
                        ? '已完成'
                        : '已取消'}
                  </td>
                  <td className="p-2">
                    {t.status === 'PENDING' && (
                      <button
                        onClick={() => void cancel(t.id)}
                        className="text-slate-500 hover:text-red-600"
                      >
                        取消
                      </button>
                    )}
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

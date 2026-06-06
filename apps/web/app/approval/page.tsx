'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type PendingApproval } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const GRADE_LABEL: Record<string, string> = {
  S: 'S 示范级',
  A: 'A 发展级II',
  B: 'B 发展级I',
  C: 'C 关注级',
  D: 'D 不合格',
};

export default function ApprovalPage() {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      setItems(await api.approvalPending(getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function vote(id: string, decision: 'AGREE' | 'REJECT') {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.approvalVote(id, decision, opinions[id] ?? '', getToken());
      const txt =
        res.status === 'APPROVED'
          ? '全员通过，已执行（发布/生效）'
          : res.status === 'REJECTED'
            ? '已驳回，本轮会签作废'
            : '已记录您的意见，等待其他成员';
      setMessage(txt);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">成绩会签</h1>
        <p className="mt-1 text-sm text-slate-500">
          需全体审核委员会成员一致同意才能发布/生效；任一成员驳回则本轮作废。
        </p>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">当前没有待您会签的事项。</p>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {it.type === 'PUBLISH'
                      ? `发布 ${it.academicYear} 学年成绩`
                      : `修改最终等级`}
                  </div>
                  {it.type === 'GRADE_CHANGE' && it.payload && (
                    <div className="mt-1 text-sm text-slate-600">
                      拟改为：
                      <b>{GRADE_LABEL[it.payload.newGrade ?? ''] ?? it.payload.newGrade}</b>
                      ｜理由：{it.payload.reason}
                    </div>
                  )}
                </div>
                <span className="text-sm text-slate-500">
                  已同意 {it.agreed}/{it.total}
                </span>
              </div>

              {it.myVote ? (
                <p className="text-sm text-slate-500">
                  您已投票：{it.myVote === 'AGREE' ? '同意' : '驳回'}
                </p>
              ) : (
                <>
                  <input
                    value={opinions[it.id] ?? ''}
                    onChange={(e) =>
                      setOpinions((p) => ({ ...p, [it.id]: e.target.value }))
                    }
                    placeholder="意见（选填）"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => void vote(it.id, 'AGREE')}
                      disabled={busy}
                      className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      同意
                    </button>
                    <button
                      onClick={() => void vote(it.id, 'REJECT')}
                      disabled={busy}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      驳回
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

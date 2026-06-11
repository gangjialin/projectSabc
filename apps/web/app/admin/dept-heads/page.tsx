'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type UserBrief } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

export default function DeptHeadsPage() {
  const [teachers, setTeachers] = useState<UserBrief[]>([]);
  const [q, setQ] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      setTeachers(await api.listUsers(getToken(), 'TEACHER'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(t: UserBrief) {
    setBusy(true);
    setMessage(null);
    try {
      await api.setDeptHead(t.id, !t.isDeptHead, getToken());
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  const filtered = teachers.filter(
    (t) =>
      !q ||
      t.name.includes(q) ||
      t.loginAccount.includes(q) ||
      (t.department ?? '').includes(q),
  );
  const heads = teachers.filter((t) => t.isDeptHead);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">系主任设置</h1>
        <p className="mt-1 text-sm text-slate-500">
          勾选教师为系主任（授予 DEAN 角色），其管辖范围为本人「所属系部」。系主任负责任命本系的质量委员/材料评阅人。
        </p>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="text-sm text-slate-500">
        当前系主任 {heads.length} 人{heads.length ? '：' + heads.map((h) => `${h.name}(${h.department ?? '—'})`).join('、') : ''}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索姓名/工号/系部"
        className="w-full rounded-md border px-3 py-2 text-sm"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">无教师数据。</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {filtered.map((t) => (
            <li key={t.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {t.loginAccount} · {t.department ?? '未设系部'}
                </span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!t.isDeptHead}
                  disabled={busy}
                  onChange={() => void toggle(t)}
                />
                {t.isDeptHead ? '系主任' : '设为系主任'}
              </label>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

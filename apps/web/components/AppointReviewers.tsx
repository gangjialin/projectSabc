'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type DeptTeacher } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

export function AppointReviewers({
  kind,
  title,
  desc,
}: {
  kind: 'LECTURE' | 'MATERIAL';
  title: string;
  desc: string;
}) {
  const [teachers, setTeachers] = useState<DeptTeacher[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      setTeachers(await api.deptTeachers(getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isOn = (t: DeptTeacher) =>
    kind === 'LECTURE' ? t.isLectureReviewer : t.isMaterialReviewer;

  async function toggle(t: DeptTeacher) {
    setBusy(true);
    setMessage(null);
    try {
      await api.setReviewer(t.id, kind, !isOn(t), getToken());
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  const appointed = teachers.filter(isOn);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="text-sm text-slate-500">
        已任命 {appointed.length} 人{appointed.length ? '：' + appointed.map((t) => t.name).join('、') : ''}
      </div>

      {teachers.length === 0 ? (
        <p className="text-sm text-slate-500">
          本系暂无教师（请确认你的"所属系部"已设置且本系教师已导入）。
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {teachers.map((t) => (
            <li key={t.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-xs text-slate-400">{t.loginAccount}</span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isOn(t)}
                  disabled={busy}
                  onChange={() => void toggle(t)}
                />
                {isOn(t) ? '已任命' : '任命'}
              </label>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

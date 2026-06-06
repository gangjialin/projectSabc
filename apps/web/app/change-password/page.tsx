'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    if (newPassword !== confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const body = (await res.json()) as { code?: number; message?: string };
      if (!res.ok || body.code !== 0) {
        throw new Error(body.message || `修改失败 (${res.status})`);
      }
      // 改密成功，跳转到管理后台
      router.push('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-8 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">首次登录请修改密码</h1>
          <p className="text-sm text-slate-500">为保障安全，请设置新密码</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="old" className="text-sm font-medium">
            当前密码
          </label>
          <input
            id="old"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="new" className="text-sm font-medium">
            新密码（至少 8 位）
          </label>
          <input
            id="new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm" className="text-sm font-medium">
            确认新密码
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? '提交中…' : '修改并进入系统'}
        </button>
      </form>
    </main>
  );
}

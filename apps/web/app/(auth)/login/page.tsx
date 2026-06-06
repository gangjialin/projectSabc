'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(account, password);
      // 演示：实际应存入安全存储 + 全局状态（Zustand）
      localStorage.setItem('token', res.accessToken);
      localStorage.setItem('user', JSON.stringify(res.user));
      router.push(res.mustChangePwd ? '/change-password' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
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
          <h1 className="text-xl font-semibold">教师教学质量评分系统</h1>
          <p className="text-sm text-slate-500">数字艺术与设计学院</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="account" className="text-sm font-medium">
            工号 / 学号
          </label>
          <input
            id="account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
    </main>
  );
}

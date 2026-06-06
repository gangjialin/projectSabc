'use client';

import { useState } from 'react';
import { api, type ImportKind, type PreviewResult } from '@/lib/api';

const KINDS: { value: ImportKind; label: string }[] = [
  { value: 'teacher', label: '教师名单' },
  { value: 'student', label: '学生名单' },
  { value: 'course', label: '课程名单' },
];

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') ?? '';
}

export default function ImportPage() {
  const [kind, setKind] = useState<ImportKind>('teacher');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setPreview(null);
    setMessage(null);
  }

  async function onPreview() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      setPreview(await api.importPreview(kind, file, getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '预览失败');
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.importCommit(kind, file, getToken());
      setMessage(`导入成功：新增 ${res.created} 条`);
      setPreview(null);
      setFile(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(false);
    }
  }

  const canCommit = preview && preview.errors.length === 0 && preview.summary.total > 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">数据导入</h1>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as ImportKind);
            setFile(null);
            reset();
          }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => void api.downloadTemplate(kind, getToken())}
          className="rounded-md border px-3 py-2 text-sm hover:bg-slate-100"
        >
          下载模板
        </button>

        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            reset();
          }}
          className="text-sm"
        />

        <button
          onClick={() => void onPreview()}
          disabled={!file || busy}
          className="rounded-md bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          预览校验
        </button>

        <button
          onClick={() => void onCommit()}
          disabled={!canCommit || busy}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          确认导入
        </button>
      </div>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {preview && (
        <section className="space-y-3">
          <div className="flex gap-4 text-sm">
            <span>共 {preview.summary.total} 行</span>
            <span className="text-green-700">有效 {preview.summary.valid}</span>
            <span className="text-red-600">错误行 {preview.summary.errorRows}</span>
            <span className="text-amber-600">库内冲突 {preview.summary.dbConflicts}</span>
          </div>

          {preview.errors.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-2">行</th>
                  <th className="p-2">字段</th>
                  <th className="p-2">问题</th>
                </tr>
              </thead>
              <tbody>
                {preview.errors.map((e, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{e.row}</td>
                    <td className="p-2">{e.header}</td>
                    <td className="p-2 text-red-600">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-green-700">
              校验通过，可确认导入。
            </p>
          )}
        </section>
      )}
    </main>
  );
}

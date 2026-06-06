'use client';

import { useState } from 'react';
import { api, type CommitResult, type PreviewResult } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

/**
 * 院级质量监控组名单导入（§4.4）。
 * 表格列：工号 | 角色(院长/系主任/质量委员) | 负责听课课程编号 | 负责材料审查课程编号
 * 导入后：授予对应角色 + 按课程生成听课/材料任务（自动校验 ≤2次/不评自己/查重）。
 */
export default function CommitteePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPreview() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      setPreview(await api.importPreview('committee', file, getToken()));
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
      const res = await api.importCommit('committee', file, getToken());
      setResult(res);
      setPreview(null);
      setFile(null);
      setMessage(
        `导入完成：生成评价任务 ${res.created} 条` +
          (res.skipped ? `，跳过 ${res.skipped} 条（见下方原因）` : ''),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(false);
    }
  }

  const canCommit = preview && preview.errors.length === 0 && preview.summary.total > 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">院级质量监控组名单导入</h1>
        <p className="mt-1 text-sm text-slate-500">
          导入"委员 + 负责听课/材料课程"，系统自动授予角色并生成评价任务。
          <b>前提</b>：相关教师已导入、且其参评课程已填报。
        </p>
      </div>

      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
        表格列：<b>工号</b> ｜ <b>角色</b>(院长/系主任/质量委员) ｜
        <b>负责听课课程编号</b>(多个用分号) ｜ <b>负责材料审查课程编号</b>(多个用分号)
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={async () => {
            setMessage(null);
            try {
              await api.downloadTemplate('committee', getToken());
            } catch (e) {
              setMessage(e instanceof Error ? e.message : '模板下载失败');
            }
          }}
          className="rounded-md border px-3 py-2 text-sm hover:bg-slate-100"
        >
          下载模板
        </button>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setResult(null);
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
            <p className="text-sm text-green-700">校验通过，可确认导入。</p>
          )}
        </section>
      )}

      {result && result.errors.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-amber-700">
            跳过的任务分配（{result.errors.length}）
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">行</th>
                <th className="p-2">原因</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((e, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{e.row}</td>
                  <td className="p-2 text-amber-700">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

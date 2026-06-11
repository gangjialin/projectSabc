'use client';

import { useState } from 'react';
import { api, type ScheduleImportResult } from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const TYPES = [
  { value: 'THEORY', label: '理论课' },
  { value: 'PRACTICE', label: '实践课' },
  { value: 'PROJECT', label: '项目课' },
  { value: 'THESIS', label: '毕业设计' },
];

export default function SchedulePage() {
  const [year, setYear] = useState('2025-2026');
  const [type, setType] = useState('THEORY');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ScheduleImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doImport() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const r = await api.importSchedule(file, year, type, getToken());
      setResult(r);
      setMessage(
        `导入完成：开课 ${r.courses} 门，教师匹配 ${r.teachersMatched} 人、新建 ${r.teachersCreated} 人` +
          (r.parseErrors.length ? `，${r.parseErrors.length} 行解析失败（见下）` : ''),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">课表导入</h1>
        <p className="mt-1 text-sm text-slate-500">
          上传学校课表 xlsx，系统按「课程代码+教师」去重建课、按拼音账号关联教师（缺则自动新建）。
          分学期上传两次（理论课文件选"理论课"，实践课文件选"实践课"）。
        </p>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>评价学年</span>
            <input value={year} onChange={(e) => setYear(e.target.value)}
              className="rounded-md border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>本文件课程类型</span>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="rounded-md border px-3 py-2">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <input type="file" accept=".xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
            className="text-sm" />
          <button onClick={() => void doImport()} disabled={!file || busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy ? '导入中…' : '导入课表'}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          提示：会读取课表的「课程」「教师」「上课班级构成」三列；同代码+同教师的多行会合并、班级取并集；重复导入按开课更新。
        </p>
      </section>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      {result && (
        <section className="grid grid-cols-3 gap-3 text-center">
          <Card label="开课门数" value={result.courses} />
          <Card label="匹配教师" value={result.teachersMatched} />
          <Card label="新建教师" value={result.teachersCreated} warn={result.teachersCreated > 0} />
        </section>
      )}

      {result && result.parseErrors.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-sm font-medium text-amber-700">
            解析失败行（{result.parseErrors.length}）
          </h2>
          <ul className="max-h-60 space-y-0.5 overflow-auto rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            {result.parseErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}

function Card({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className={`text-3xl font-bold ${warn ? 'text-amber-600' : ''}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

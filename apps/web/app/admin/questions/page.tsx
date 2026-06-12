'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CONFIG,
  DIMENSION_NAMES,
  validateTemplate,
  type DimensionNo,
  type DimensionShape,
} from '@app/shared';
import {
  api,
  type AdminDimension,
  type AdminTemplate,
  type SaveTemplateInput,
} from '@/lib/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const FORM_TYPES: { value: string; label: string }[] = [
  { value: 'LECTURE', label: '定向听课' },
  { value: 'MATERIAL', label: '材料审查' },
  { value: 'PEER', label: '同行说课' },
  { value: 'STUDENT', label: '学生问卷' },
];

const COURSE_TYPES: { value: string; label: string }[] = [
  { value: '', label: '通用（不分课程类型）' },
  { value: 'THEORY', label: '理论课' },
  { value: 'PRACTICE', label: '实践课' },
  { value: 'PROJECT', label: '项目课' },
  { value: 'THESIS', label: '毕业设计' },
];

const DIM_NOS: DimensionNo[] = [1, 2, 3, 4, 5];

/** 按标准 5 维度构建空白编辑器（每维度 1 道占满分值的题） */
function buildBlank(): AdminDimension[] {
  return DIM_NOS.map((no) => {
    const max = DEFAULT_CONFIG.dimensionMaxScores[no];
    return {
      dimensionNo: no,
      name: DIMENSION_NAMES[no],
      maxScore: max,
      questions: [{ indicator: '', scoreCriteria: '', maxScore: max }],
    };
  });
}

export default function QuestionsAdminPage() {
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [formType, setFormType] = useState('LECTURE');
  const [courseType, setCourseType] = useState('');
  const [dims, setDims] = useState<AdminDimension[]>(buildBlank());
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadList() {
    try {
      setTemplates(await api.listTemplates(getToken()));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载模板列表失败');
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  /** 以当前生效模板为起点载入编辑器（便于在现有题目上改） */
  async function loadCurrent() {
    setMessage(null);
    try {
      const tpl = await api.getTemplateAdmin(
        formType,
        getToken(),
        courseType || undefined,
      );
      setDims(
        DIM_NOS.map((no) => {
          const d = tpl.dimensions.find((x) => x.dimensionNo === no);
          // 用模板**真实**的维度名/满分（各评价表分布不同：听课 20/40/15/15/10、
          // 材料 20/20/30/15/15 等），不再写死 20/25/20/20/15。
          return {
            dimensionNo: no,
            name: d?.name ?? DIMENSION_NAMES[no],
            maxScore: d?.maxScore ?? DEFAULT_CONFIG.dimensionMaxScores[no],
            questions:
              d?.questions.map((q) => ({
                indicator: q.indicator,
                scoreCriteria: q.scoreCriteria,
                maxScore: q.maxScore,
              })) ?? [],
          };
        }),
      );
      setDescription(`基于 ${formType} v${tpl.version} 修订`);
      setMessage(`已载入生效模板 v${tpl.version}，编辑后保存将生成新版本`);
    } catch {
      setDims(buildBlank());
      setMessage('未找到生效模板，已载入空白模板');
    }
  }

  function updateDim(di: number, patch: Partial<AdminDimension>) {
    setDims((prev) => prev.map((d, i) => (i === di ? { ...d, ...patch } : d)));
  }

  function updateQuestion(
    di: number,
    qi: number,
    patch: Partial<AdminDimension['questions'][number]>,
  ) {
    setDims((prev) =>
      prev.map((d, i) =>
        i !== di
          ? d
          : {
              ...d,
              questions: d.questions.map((q, j) =>
                j === qi ? { ...q, ...patch } : q,
              ),
            },
      ),
    );
  }

  function addQuestion(di: number) {
    setDims((prev) =>
      prev.map((d, i) =>
        i !== di
          ? d
          : {
              ...d,
              questions: [
                ...d.questions,
                { indicator: '', scoreCriteria: '', maxScore: 0 },
              ],
            },
      ),
    );
  }

  function removeQuestion(di: number, qi: number) {
    setDims((prev) =>
      prev.map((d, i) =>
        i !== di
          ? d
          : { ...d, questions: d.questions.filter((_, j) => j !== qi) },
      ),
    );
  }

  // 实时复用后端同一套合规校验（packages/shared validateTemplate）
  const errors = useMemo(() => {
    const shape: DimensionShape[] = dims.map((d) => ({
      dimensionNo: d.dimensionNo,
      maxScore: d.maxScore,
      questions: d.questions.map((q) => ({ maxScore: q.maxScore })),
    }));
    return validateTemplate(shape);
  }, [dims]);

  const dimSum = (d: AdminDimension) =>
    d.questions.reduce((a, q) => a + (Number(q.maxScore) || 0), 0);

  const indicatorsFilled = dims.every((d) =>
    d.questions.every((q) => q.indicator.trim() !== ''),
  );
  const canSave = errors.length === 0 && indicatorsFilled && !busy;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const input: SaveTemplateInput = {
        formType,
        courseType: courseType || undefined,
        description: description || undefined,
        dimensions: dims.map((d) => ({
          dimensionNo: d.dimensionNo,
          name: d.name,
          maxScore: d.maxScore,
          questions: d.questions.map((q) => ({
            indicator: q.indicator.trim(),
            scoreCriteria: q.scoreCriteria.trim() || q.indicator.trim(),
            maxScore: Number(q.maxScore),
          })),
        })),
      };
      const saved = await api.saveTemplate(input, getToken());
      setMessage(`保存成功：${formType} v${saved.version} 已生效（旧版本自动停用）`);
      await loadList();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">题目模板管理</h1>

      {/* 现有模板概览 */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-600">
          现有模板（{templates.length}）
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-2">评分表</th>
              <th className="p-2">课程类型</th>
              <th className="p-2">版本</th>
              <th className="p-2">状态</th>
              <th className="p-2">维度数</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="p-2">
                  {FORM_TYPES.find((f) => f.value === t.formType)?.label ??
                    t.formType}
                </td>
                <td className="p-2">
                  {COURSE_TYPES.find((c) => c.value === (t.courseType ?? ''))
                    ?.label ?? t.courseType}
                </td>
                <td className="p-2">v{t.version}</td>
                <td className="p-2">
                  {t.isActive ? (
                    <span className="text-green-700">生效</span>
                  ) : (
                    <span className="text-slate-400">已停用</span>
                  )}
                </td>
                <td className="p-2">{t.dimensions.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 编辑器 */}
      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>评分表</span>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="rounded-md border px-3 py-2"
            >
              {FORM_TYPES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>课程类型</span>
            <select
              value={courseType}
              onChange={(e) => setCourseType(e.target.value)}
              className="rounded-md border px-3 py-2"
            >
              {COURSE_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void loadCurrent()}
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-100"
          >
            载入生效模板
          </button>
          <button
            onClick={() => {
              setDims(buildBlank());
              setMessage('已重置为空白模板');
            }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-100"
          >
            空白模板
          </button>

          <span className="mx-1 text-slate-300">|</span>

          <button
            onClick={async () => {
              setMessage(null);
              try {
                await api.exportQuestions(
                  formType,
                  getToken(),
                  courseType || undefined,
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : '导出失败');
              }
            }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-100"
          >
            下载题目 Excel
          </button>

          <label className="cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-slate-100">
            上传题目 Excel
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = ''; // 允许重复选同一文件
                if (!file) return;
                setMessage(null);
                setBusy(true);
                try {
                  const saved = await api.importQuestions(
                    formType,
                    file,
                    getToken(),
                    courseType || undefined,
                  );
                  setMessage(
                    `Excel 导入成功：${formType} v${saved.version} 已生效（旧版自动停用）`,
                  );
                  await loadList();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : '导入失败');
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </div>

        {/* 合计校验提示 */}
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">合计满分：</span>
          <span
            className={
              errors.some((e) => e.message.includes('合计'))
                ? 'text-red-600'
                : 'text-green-700'
            }
          >
            {dims.reduce((a, d) => a + dimSum(d), 0)} / 100
          </span>
        </div>

        {dims.map((d, di) => {
          const sum = dimSum(d);
          const ok = Math.abs(sum - d.maxScore) < 1e-9;
          return (
            <div key={d.dimensionNo} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-medium">
                  维度 {d.dimensionNo}：{d.name}
                  <span className="ml-2 flex items-center gap-1 text-xs text-slate-500">
                    满分
                    <input
                      type="number"
                      step="1"
                      min={0}
                      value={d.maxScore}
                      onChange={(e) =>
                        updateDim(di, { maxScore: Number(e.target.value) })
                      }
                      className="w-16 rounded border px-2 py-0.5 text-right"
                    />
                  </span>
                </h3>
                <span className={ok ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
                  题目分值之和 {sum} / {d.maxScore}
                  {ok ? ' ✓' : ' ✗'}
                </span>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="p-1 w-10">#</th>
                    <th className="p-1">评价指标</th>
                    <th className="p-1">评分要点</th>
                    <th className="p-1 w-20">分值</th>
                    <th className="p-1 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {d.questions.map((q, qi) => (
                    <tr key={qi} className="border-b align-top">
                      <td className="p-1 pt-2 text-slate-400">{qi + 1}</td>
                      <td className="p-1">
                        <input
                          value={q.indicator}
                          onChange={(e) =>
                            updateQuestion(di, qi, { indicator: e.target.value })
                          }
                          placeholder="如：本节课目标清晰"
                          className="w-full rounded border px-2 py-1"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          value={q.scoreCriteria}
                          onChange={(e) =>
                            updateQuestion(di, qi, {
                              scoreCriteria: e.target.value,
                            })
                          }
                          placeholder="评分要点（可选填，默认同指标）"
                          className="w-full rounded border px-2 py-1"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          value={q.maxScore}
                          onChange={(e) =>
                            updateQuestion(di, qi, {
                              maxScore: Number(e.target.value),
                            })
                          }
                          className="w-full rounded border px-2 py-1"
                        />
                      </td>
                      <td className="p-1 pt-2">
                        {d.questions.length > 1 && (
                          <button
                            onClick={() => removeQuestion(di, qi)}
                            className="text-slate-400 hover:text-red-600"
                          >
                            删
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => addQuestion(di)}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                + 添加题目
              </button>
            </div>
          );
        })}

        {/* 校验错误清单 */}
        {(errors.length > 0 || !indicatorsFilled) && (
          <div className="space-y-1 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {errors.map((e, i) => (
              <p key={i}>• {e.message}</p>
            ))}
            {!indicatorsFilled && <p>• 存在未填写"评价指标"的题目</p>}
          </div>
        )}

        <button
          onClick={() => void save()}
          disabled={!canSave}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? '保存中…' : '保存为新版本'}
        </button>
      </section>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}
    </main>
  );
}

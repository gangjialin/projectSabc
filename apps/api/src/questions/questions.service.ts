import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CourseType,
  DIMENSION_NAMES,
  FormType,
  validateTemplate,
  type DimensionNo,
  type DimensionShape,
} from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DIMENSION_META } from './form-definitions';

/** Excel 单元格取值 → 字符串 */
function cellStr(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim();
  return String(v).trim();
}
function cellNum(v: ExcelJS.CellValue): number {
  const s = cellStr(v);
  return s === '' ? NaN : Number(s);
}

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 取生效的题目模板：优先匹配指定课程类型，无则回退到通用模板(courseType=null)，取最高激活版本。
   * 评分表渲染与提交计算都依赖此方法（题目按课程类型版本化，需求 §5.4）。
   */
  async getActiveTemplate(formType: FormType, courseType?: CourseType) {
    const candidates = await this.prisma.questionTemplate.findMany({
      where: {
        formType,
        isActive: true,
        OR: [{ courseType: courseType ?? null }, { courseType: null }],
      },
      include: {
        dimensions: {
          orderBy: { dimensionNo: 'asc' },
          include: { questions: { orderBy: { serialNo: 'asc' } } },
        },
      },
      orderBy: { version: 'desc' },
    });
    // 优先精确课程类型匹配
    const exact = candidates.find((c) => c.courseType === (courseType ?? null) && c.courseType !== null);
    const generic = candidates.find((c) => c.courseType === null);
    const tpl = exact ?? generic ?? candidates[0];
    if (!tpl) {
      throw new NotFoundException(`未找到 ${formType} 的生效题目模板`);
    }
    return tpl;
  }

  list() {
    return this.prisma.questionTemplate.findMany({
      include: { dimensions: { include: { questions: true } } },
      orderBy: [{ formType: 'asc' }, { version: 'desc' }],
    });
  }

  /**
   * 保存模板（新建版本）。落库前必须通过 validateTemplate 合规校验
   * （5 维度齐全、各维度满分一致、题目分值之和=维度满分、合计 100）。
   */
  async saveTemplate(input: {
    formType: FormType;
    courseType?: CourseType | null;
    description?: string;
    dimensions: {
      dimensionNo: number;
      name: string;
      maxScore: number;
      questions: { indicator: string; scoreCriteria: string; maxScore: number }[];
    }[];
  }) {
    const shape: DimensionShape[] = input.dimensions.map((d) => ({
      dimensionNo: d.dimensionNo,
      maxScore: d.maxScore,
      questions: d.questions.map((q) => ({ maxScore: q.maxScore })),
    }));
    const errors = validateTemplate(shape);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: '题目模板不合规',
        errors: errors.map((e) => e.message),
      });
    }

    // 新建版本：同 (formType, courseType) 现有最大版本 +1，并停用旧版本
    const courseType = input.courseType ?? null;
    const latest = await this.prisma.questionTemplate.findFirst({
      where: { formType: input.formType, courseType },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      if (latest) {
        await tx.questionTemplate.updateMany({
          where: { formType: input.formType, courseType },
          data: { isActive: false },
        });
      }
      return tx.questionTemplate.create({
        data: {
          formType: input.formType,
          courseType,
          version,
          isActive: true,
          description: input.description,
          dimensions: {
            create: input.dimensions.map((d) => ({
              dimensionNo: d.dimensionNo,
              name: d.name,
              maxScore: d.maxScore,
              questions: {
                create: d.questions.map((q, i) => ({
                  serialNo: i + 1,
                  indicator: q.indicator,
                  scoreCriteria: q.scoreCriteria,
                  maxScore: q.maxScore,
                })),
              },
            })),
          },
        },
        include: { dimensions: { include: { questions: true } } },
      });
    });
  }

  /**
   * 导出题目为 Excel（T-304 批量）：有生效模板则导出其全部题目，
   * 否则导出标准 5 维度空白骨架，供管理员填写后回传。
   */
  async exportTemplateExcel(
    formType: FormType,
    courseType?: CourseType,
  ): Promise<Buffer> {
    const tpl = await this.getActiveTemplate(formType, courseType).catch(
      () => null,
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('题目');
    ws.columns = [
      { header: '维度编号', key: 'dimNo', width: 10 },
      { header: '维度名称', key: 'dimName', width: 16 },
      { header: '维度满分', key: 'dimMax', width: 10 },
      { header: '评价指标', key: 'indicator', width: 44 },
      { header: '评分要点', key: 'criteria', width: 44 },
      { header: '题目分值', key: 'score', width: 10 },
    ];
    ws.getRow(1).font = { bold: true };

    if (tpl) {
      for (const d of tpl.dimensions) {
        for (const q of d.questions) {
          ws.addRow({
            dimNo: d.dimensionNo,
            dimName: d.name,
            dimMax: d.maxScore,
            indicator: q.indicator,
            criteria: q.scoreCriteria,
            score: q.maxScore,
          });
        }
      }
    } else {
      for (const dim of DIMENSION_META) {
        ws.addRow({
          dimNo: dim.no,
          dimName: dim.name,
          dimMax: dim.max,
          indicator: '（在此填写评价指标）',
          criteria: '',
          score: dim.max,
        });
      }
    }

    // 填表说明
    const note = wb.addWorksheet('填写说明');
    note.addRow(['填写规则']);
    note.addRow(['1. 每行一道题；同一维度可多行，维度编号/名称/满分填一致即可']);
    note.addRow(['2. 同一维度下所有题目的「题目分值」之和必须等于该维度满分']);
    note.addRow(['3. 5 个维度满分合计须为 100；各维度满分可不同（如听课 20/40/15/15/10、材料 20/20/30/15/15）']);
    note.addRow(['4. 评分要点可留空，留空时默认与评价指标相同']);
    note.addRow(['5. 上传后系统会校验，不合规会拒绝并提示原因']);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * 从 Excel 导入题目（T-304 批量）：解析 → 按维度分组 → 复用 saveTemplate
   * （含合规校验与自动升版本）。
   */
  async importTemplateExcel(
    formType: FormType,
    courseType: CourseType | undefined,
    buffer: Buffer,
  ) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('文件为空或格式不正确');

    const byDim = new Map<
      number,
      {
        name: string;
        max: number;
        questions: { indicator: string; scoreCriteria: string; maxScore: number }[];
      }
    >();

    ws.eachRow((row, idx) => {
      if (idx === 1) return; // 表头
      const dimNo = cellNum(row.getCell(1).value);
      const indicator = cellStr(row.getCell(4).value);
      if (!dimNo || !indicator) return; // 跳过空行/占位说明行
      const dimName = cellStr(row.getCell(2).value);
      const dimMax = cellNum(row.getCell(3).value);
      const criteria = cellStr(row.getCell(5).value) || indicator;
      const score = cellNum(row.getCell(6).value);

      if (!byDim.has(dimNo)) {
        byDim.set(dimNo, {
          name: dimName || DIMENSION_NAMES[dimNo as DimensionNo] || `维度${dimNo}`,
          max: dimMax,
          questions: [],
        });
      }
      byDim.get(dimNo)!.questions.push({
        indicator,
        scoreCriteria: criteria,
        maxScore: score,
      });
    });

    if (byDim.size === 0) {
      throw new BadRequestException('未解析到任何题目，请检查表格内容');
    }

    const dimensions = [...byDim.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([no, d]) => ({
        dimensionNo: no,
        name: d.name,
        maxScore: d.max,
        questions: d.questions,
      }));

    return this.saveTemplate({
      formType,
      courseType: courseType ?? null,
      description: 'Excel 批量导入',
      dimensions,
    });
  }
}

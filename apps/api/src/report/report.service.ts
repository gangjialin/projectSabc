import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DIMENSION_NAMES, type DimensionNo } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';

const DIM_NOS: DimensionNo[] = [1, 2, 3, 4, 5];
const GRADE_CN: Record<string, string> = {
  S: 'S 示范级',
  A: 'A 发展级II',
  B: 'B 发展级I',
  C: 'C 关注级',
  D: 'D 不合格',
};

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * 全院综合评价排名导出（T-803）：含三维子项、综合分、维度加权得分率、等级。
   * 返回 xlsx Buffer。学校上报数据包格式可在此扩展为多 sheet。
   */
  async rankingWorkbook(academicYear: string): Promise<Buffer> {
    const results = await this.prisma.finalResult.findMany({
      where: { academicYear },
      include: { teacher: { select: { name: true, loginAccount: true, department: true } } },
      orderBy: [{ rank: 'asc' }],
    });
    const dims = await this.prisma.dimensionResult.findMany({
      where: { academicYear },
    });
    const dimByTeacher = new Map(dims.map((d) => [d.teacherId, d]));

    const wb = new ExcelJS.Workbook();
    wb.creator = '教师教学质量评分系统';

    // Sheet 1：综合排名
    const ws = wb.addWorksheet('综合排名');
    ws.columns = [
      { header: '排名', key: 'rank', width: 6 },
      { header: '工号', key: 'account', width: 14 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '系部', key: 'department', width: 16 },
      { header: '上级评价', key: 'sup', width: 10 },
      { header: '同行评价', key: 'peer', width: 10 },
      { header: '学生评价', key: 'stu', width: 10 },
      { header: '综合分', key: 'composite', width: 10 },
      { header: '建议等级', key: 'grade', width: 12 },
      { header: '维度否决', key: 'veto', width: 16 },
      { header: '数据完整', key: 'complete', width: 10 },
      { header: '中层干部', key: 'mgmt', width: 10 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const r of results) {
      const dim = dimByTeacher.get(r.teacherId);
      const grade = r.finalGrade ?? r.suggestedGrade;
      ws.addRow({
        rank: r.rank ?? '',
        account: r.teacher?.loginAccount ?? '',
        name: r.teacher?.name ?? '',
        department: r.teacher?.department ?? '',
        sup: r.supervisorFinal ?? '',
        peer: r.peerFinal ?? '',
        stu: r.studentFinal ?? '',
        composite: r.compositeScore ?? '',
        grade: grade ? (GRADE_CN[grade] ?? grade) : '',
        veto:
          dim && dim.hasDimVeto
            ? dim.vetoDimensions
                .map((n) => DIMENSION_NAMES[n as DimensionNo])
                .join('、')
            : '',
        complete: r.isDataComplete ? '是' : '否',
        mgmt: r.isMgmtRole ? '是' : '',
      });
    }

    // Sheet 2：5 维度加权得分率明细
    const ws2 = wb.addWorksheet('维度得分率');
    ws2.columns = [
      { header: '姓名', key: 'name', width: 12 },
      ...DIM_NOS.map((n) => ({
        header: `${n}.${DIMENSION_NAMES[n]}`,
        key: `dim${n}`,
        width: 14,
      })),
    ];
    ws2.getRow(1).font = { bold: true };
    for (const r of results) {
      const dim = dimByTeacher.get(r.teacherId);
      const row: Record<string, string | number> = {
        name: r.teacher?.name ?? '',
      };
      for (const n of DIM_NOS) {
        const rate = dim
          ? (dim[`dim${n}WeightedRate` as keyof typeof dim] as number | null)
          : null;
        row[`dim${n}`] = rate === null || rate === undefined ? '' : `${(rate * 100).toFixed(1)}%`;
      }
      ws2.addRow(row);
    }

    // exceljs 类型使用旧版 Buffer 定义，与 Node 20+ 泛型 Buffer 不兼容，显式转换
    const buf = await wb.xlsx.writeBuffer();
    return buf as unknown as Buffer;
  }
}

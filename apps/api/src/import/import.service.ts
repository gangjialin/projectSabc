import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';
import { RoleCode, TaskType, UserType } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { COLUMNS_BY_TYPE, ImportType } from './import.constants';
import { parseRows, type ParsedRow, type ParseResult, type RowError } from './validators';

/** 初始密码（首登强制改密）。生产可经环境变量覆盖。 */
const INIT_PASSWORD = process.env.INIT_PASSWORD ?? '123456';

export interface PreviewResult extends ParseResult {
  summary: { total: number; valid: number; errorRows: number; dbConflicts: number };
}

export interface CommitResult {
  created: number;
  skipped: number;
  errors: RowError[];
}

@Injectable()
export class ImportService {
  constructor(
    private prisma: PrismaService,
    private tasks: TasksService,
  ) {}

  /** 生成空白导入模板（仅表头行） */
  async generateTemplate(type: ImportType): Promise<Buffer> {
    const columns = COLUMNS_BY_TYPE[type];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type);
    ws.columns = columns.map((c) => ({
      header: c.header + (c.required ? ' *' : ''),
      key: c.field,
      width: 18,
    }));
    ws.getRow(1).font = { bold: true };

    // 示例行：演示各列的填写格式（导入前请删除本行）
    const example: Record<string, string> = {};
    for (const c of columns) {
      if (c.type === 'enum' && c.enumMap) {
        example[c.field] = Object.keys(c.enumMap)[0] ?? '';
      } else if (c.type === 'bool') {
        example[c.field] = '是';
      } else if (c.type === 'list') {
        example[c.field] = '班级A;班级B';
      } else if (c.field === 'loginAccount' || c.field === 'courseCode') {
        example[c.field] = '示例编号(导入前删除本行)';
      } else {
        example[c.field] = '示例';
      }
    }
    ws.addRow(example);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /** 读取 xlsx → 以表头为键的原始行 */
  private async readRows(
    type: ImportType,
    buffer: Buffer,
  ): Promise<Record<string, unknown>[]> {
    const columns = COLUMNS_BY_TYPE[type];
    const wb = new ExcelJS.Workbook();
    // exceljs 类型使用旧版 Buffer 定义，与 Node 20+ 泛型 Buffer 不兼容，显式转换
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('文件为空或格式不正确');

    // 表头：去掉模板的 " *" 标记后匹配
    const headerCells = ws.getRow(1).values as unknown[];
    const headerByCol = new Map<number, string>();
    headerCells.forEach((h, colIdx) => {
      if (typeof h === 'string') {
        headerByCol.set(colIdx, h.replace(/\s*\*$/, '').trim());
      }
    });

    const validHeaders = new Set(columns.map((c) => c.header));
    const rows: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      const rec: Record<string, unknown> = {};
      let hasAny = false;
      (row.values as unknown[]).forEach((val, colIdx) => {
        const header = headerByCol.get(colIdx);
        if (header && validHeaders.has(header)) {
          rec[header] = val;
          if (val !== null && val !== undefined && String(val).trim() !== '') {
            hasAny = true;
          }
        }
      });
      if (hasAny) rows.push(rec); // 跳过全空行
    });
    return rows;
  }

  /** 预览：解析 + 行级校验 + 库内冲突检测（不写库） */
  async preview(type: ImportType, buffer: Buffer): Promise<PreviewResult> {
    const columns = COLUMNS_BY_TYPE[type];
    const raw = await this.readRows(type, buffer);
    const { records, errors } = parseRows(raw, columns);

    const dbConflicts = await this.detectDbConflicts(type, records, errors);

    const errorRowSet = new Set(errors.map((e) => e.row));
    return {
      records,
      errors,
      summary: {
        total: records.length,
        valid: records.length - errorRowSet.size,
        errorRows: errorRowSet.size,
        dbConflicts,
      },
    };
  }

  /** 检测库内唯一冲突 / 外键缺失，追加到 errors，返回冲突计数 */
  private async detectDbConflicts(
    type: ImportType,
    records: ParsedRow[],
    errors: RowError[],
  ): Promise<number> {
    let conflicts = 0;

    if (type === ImportType.TEACHER || type === ImportType.STUDENT) {
      const accounts = records
        .map((r) => r.loginAccount as string)
        .filter(Boolean);
      const existing = await this.prisma.user.findMany({
        where: { loginAccount: { in: accounts } },
        select: { loginAccount: true },
      });
      const existSet = new Set(existing.map((u) => u.loginAccount));
      records.forEach((r, idx) => {
        if (existSet.has(r.loginAccount as string)) {
          conflicts++;
          errors.push({
            row: idx + 1,
            field: 'loginAccount',
            header: type === ImportType.TEACHER ? '工号' : '学号',
            message: `账号已存在于系统：${r.loginAccount}`,
          });
        }
      });
    }


    if (type === ImportType.COMMITTEE) {
      const accounts = records
        .map((r) => r.loginAccount as string)
        .filter(Boolean);
      const users = await this.prisma.user.findMany({
        where: { loginAccount: { in: accounts } },
        select: { loginAccount: true },
      });
      const userSet = new Set(users.map((u) => u.loginAccount));

      const allCodes = records.flatMap((r) => [
        ...((r.lectureCourses as string[]) ?? []),
        ...((r.materialCourses as string[]) ?? []),
      ]);
      const courses = await this.prisma.course.findMany({
        where: { courseCode: { in: allCodes } },
        select: { courseCode: true },
      });
      const courseSet = new Set(courses.map((c) => c.courseCode));

      records.forEach((r, idx) => {
        if (!userSet.has(r.loginAccount as string)) {
          conflicts++;
          errors.push({
            row: idx + 1,
            field: 'loginAccount',
            header: '工号',
            message: `工号不存在：${r.loginAccount}（请先导入教师名单）`,
          });
        }
        const codes = [
          ...((r.lectureCourses as string[]) ?? []),
          ...((r.materialCourses as string[]) ?? []),
        ];
        for (const code of codes) {
          if (!courseSet.has(code)) {
            conflicts++;
            errors.push({
              row: idx + 1,
              field: 'courses',
              header: '课程编号',
              message: `课程编号不存在：${code}（教师需先填报该课程）`,
            });
          }
        }
      });
    }

    return conflicts;
  }

  /** 提交：存在任何阻断错误则整体拒绝；否则事务批量插入 */
  async commit(type: ImportType, buffer: Buffer): Promise<CommitResult> {
    const { records, errors } = await this.preview(type, buffer);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: `存在 ${errors.length} 处错误，已取消导入`,
        errors,
      });
    }

    const passwordHash = await bcrypt.hash(INIT_PASSWORD, 10);

    if (type === ImportType.TEACHER) {
      return this.commitUsers(records, UserType.TEACHER, RoleCode.TEACHER, passwordHash);
    }
    if (type === ImportType.STUDENT) {
      return this.commitUsers(records, UserType.STUDENT, RoleCode.STUDENT, passwordHash);
    }
    if (type === ImportType.COMMITTEE) {
      return this.commitCommittee(records);
    }
    throw new BadRequestException(`不支持的导入类型：${type}`);
  }

  /**
   * 导入院级质量监控组名单（§4.4）：给已存在用户授角色（质量委员=REVIEWER，院长/系主任=DEAN）+
   * 按"负责听课/材料课程"生成评价任务（复用 TasksService.assign 的校验：≤2次/不评自己/查重）。
   * 任务分配若违规则跳过并在 errors 中记原因（非阻断，便于管理员知晓）。
   */
  private async commitCommittee(records: ParsedRow[]): Promise<CommitResult> {
    let created = 0;
    let skipped = 0;
    const errors: RowError[] = [];

    for (let idx = 0; idx < records.length; idx++) {
      const r = records[idx]!;
      const account = r.loginAccount as string;
      const roleCode = r.role as string; // enumMap 已映射为 'DEAN' / 'REVIEWER'

      const user = await this.prisma.user.findUnique({
        where: { loginAccount: account },
        select: { id: true },
      });
      if (!user) {
        skipped++;
        continue;
      }

      const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
      if (role) {
        await this.prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          create: { userId: user.id, roleId: role.id },
          update: {},
        });
      }

      const groups: [string[], TaskType][] = [
        [(r.lectureCourses as string[]) ?? [], TaskType.LECTURE],
        [(r.materialCourses as string[]) ?? [], TaskType.MATERIAL],
      ];
      for (const [codes, taskType] of groups) {
        for (const code of codes) {
          const course = await this.prisma.course.findFirst({
            where: { courseCode: code },
            select: { id: true },
          });
          if (!course) {
            skipped++;
            continue;
          }
          try {
            await this.tasks.assign({
              courseId: course.id,
              reviewerId: user.id,
              taskType,
            });
            created++;
          } catch (e) {
            skipped++;
            errors.push({
              row: idx + 1,
              field: 'courses',
              header: '课程编号',
              message: `${code}：${e instanceof Error ? e.message : '分配失败'}`,
            });
          }
        }
      }
    }

    return { created, skipped, errors };
  }

  private async commitUsers(
    records: ParsedRow[],
    userType: UserType,
    roleCode: RoleCode,
    passwordHash: string,
  ): Promise<CommitResult> {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const r of records) {
        const user = await tx.user.create({
          data: {
            loginAccount: r.loginAccount as string,
            passwordHash,
            mustChangePwd: true,
            name: r.name as string,
            userType,
            department: (r.department as string) ?? null,
            className: (r.className as string) ?? null,
            major: (r.major as string) ?? null,
            grade: (r.grade as string) ?? null,
            title: (r.title as string) ?? null,
            email: (r.email as string) ?? null,
            isAdminRole: (r.isAdminRole as boolean) ?? false,
            isCourseOwner: (r.isCourseOwner as boolean) ?? false,
            isApprover: (r.isApprover as boolean) ?? false,
            roles: { create: { roleId: role.id } },
          },
        });
        if (user) created++;
      }
    });
    return { created, skipped: 0, errors: [] };
  }

}

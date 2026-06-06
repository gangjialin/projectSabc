import { ColumnSpec, LIST_SEPARATOR } from './import.constants';

export interface RowError {
  /** 数据行号（从 1 开始，对应 Excel 去表头后的第几条） */
  row: number;
  field: string;
  header: string;
  message: string;
}

export type ParsedValue = string | boolean | string[];
export type ParsedRow = Record<string, ParsedValue>;

export interface ParseResult {
  records: ParsedRow[];
  errors: RowError[];
}

/** 布尔归一化：是/y/yes/true/1 → true；否/空 → false；其它 → null（非法） */
export function normalizeBool(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return false;
  const v = String(raw).trim().toLowerCase();
  if (['是', 'y', 'yes', 'true', '1'].includes(v)) return true;
  if (['否', 'n', 'no', 'false', '0'].includes(v)) return false;
  return null;
}

function cellToString(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

/**
 * 行级校验（纯函数，不触库）：必填、枚举映射、布尔、多值拆分、文件内唯一性。
 * 库内唯一/外键存在性由 service 层在落库前再校验。
 */
export function parseRows(
  rawRows: Record<string, unknown>[],
  columns: ColumnSpec[],
): ParseResult {
  const records: ParsedRow[] = [];
  const errors: RowError[] = [];
  // 文件内唯一性追踪：field -> Set(已见值)
  const seen = new Map<string, Set<string>>();

  rawRows.forEach((raw, idx) => {
    const rowNo = idx + 1;
    const record: ParsedRow = {};

    for (const col of columns) {
      const cell = raw[col.header];
      const str = cellToString(cell);

      // 必填校验
      if (col.required && str === '') {
        errors.push({
          row: rowNo,
          field: col.field,
          header: col.header,
          message: `「${col.header}」为必填项`,
        });
        continue;
      }
      if (str === '' && !col.required && col.type !== 'bool') {
        continue; // 选填留空，跳过
      }

      switch (col.type) {
        case 'string':
          record[col.field] = str;
          break;
        case 'bool': {
          const b = normalizeBool(cell);
          if (b === null) {
            errors.push({
              row: rowNo,
              field: col.field,
              header: col.header,
              message: `「${col.header}」只能填 是/否`,
            });
          } else {
            record[col.field] = b;
          }
          break;
        }
        case 'enum': {
          const code = col.enumMap?.[str];
          if (!code) {
            errors.push({
              row: rowNo,
              field: col.field,
              header: col.header,
              message: `「${col.header}」取值非法：${str}（应为 ${Object.keys(col.enumMap ?? {}).join('/')}）`,
            });
          } else {
            record[col.field] = code;
          }
          break;
        }
        case 'list': {
          const items = str
            .split(LIST_SEPARATOR)
            .map((s) => s.trim())
            .filter((s) => s !== '');
          if (col.required && items.length === 0) {
            errors.push({
              row: rowNo,
              field: col.field,
              header: col.header,
              message: `「${col.header}」至少填写一项`,
            });
          } else {
            record[col.field] = items;
          }
          break;
        }
      }

      // 文件内唯一性
      if (col.unique && typeof record[col.field] === 'string' && record[col.field] !== '') {
        const set = seen.get(col.field) ?? new Set<string>();
        const val = record[col.field] as string;
        if (set.has(val)) {
          errors.push({
            row: rowNo,
            field: col.field,
            header: col.header,
            message: `「${col.header}」在文件内重复：${val}`,
          });
        }
        set.add(val);
        seen.set(col.field, set);
      }
    }

    records.push(record);
  });

  return { records, errors };
}

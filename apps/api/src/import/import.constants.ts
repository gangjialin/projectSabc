/** 导入类型（课程→课表导入；监控组→系主任任命；此处仅师生名单） */
export enum ImportType {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export type CellType = 'string' | 'enum' | 'bool' | 'list';

export interface ColumnSpec {
  /** Excel 表头（简体中文） */
  header: string;
  /** 内部字段名 */
  field: string;
  required: boolean;
  type: CellType;
  /** enum 类型：中文标签 → 枚举码 */
  enumMap?: Record<string, string>;
  /** 是否在文件内（及与库内）唯一 */
  unique?: boolean;
}

/** 教师名单（需求 §4.1） */
export const TEACHER_COLUMNS: ColumnSpec[] = [
  { header: '工号', field: 'loginAccount', required: true, type: 'string', unique: true },
  { header: '姓名', field: 'name', required: true, type: 'string' },
  { header: '所属系部', field: 'department', required: true, type: 'string' },
  { header: '职称', field: 'title', required: false, type: 'string' },
  { header: '是否担任中层管理职务', field: 'isAdminRole', required: true, type: 'bool' },
  { header: '是否课程负责人', field: 'isCourseOwner', required: false, type: 'bool' },
  { header: '是否审核委员会成员', field: 'isApprover', required: false, type: 'bool' },
];

/** 学生名单（需求 §4.2） */
export const STUDENT_COLUMNS: ColumnSpec[] = [
  { header: '学号', field: 'loginAccount', required: true, type: 'string', unique: true },
  { header: '姓名', field: 'name', required: true, type: 'string' },
  { header: '班级', field: 'className', required: true, type: 'string' },
  { header: '所属专业', field: 'major', required: true, type: 'string' },
  { header: '年级', field: 'grade', required: true, type: 'string' },
];

export const COLUMNS_BY_TYPE: Record<ImportType, ColumnSpec[]> = {
  [ImportType.TEACHER]: TEACHER_COLUMNS,
  [ImportType.STUDENT]: STUDENT_COLUMNS,
};

/** 多值字段分隔符：中英文逗号/分号 */
export const LIST_SEPARATOR = /[;；,，]/;

import { CourseLevel, CourseType } from '@app/shared';

/** 导入类型 */
export enum ImportType {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  COURSE = 'COURSE',
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
  { header: '邮箱', field: 'email', required: false, type: 'string' },
];

/** 学生名单（需求 §4.2） */
export const STUDENT_COLUMNS: ColumnSpec[] = [
  { header: '学号', field: 'loginAccount', required: true, type: 'string', unique: true },
  { header: '姓名', field: 'name', required: true, type: 'string' },
  { header: '班级', field: 'className', required: true, type: 'string' },
  { header: '所属专业', field: 'major', required: true, type: 'string' },
];

const COURSE_TYPE_MAP: Record<string, string> = {
  理论课: CourseType.THEORY,
  实践课: CourseType.PRACTICE,
  项目课: CourseType.PROJECT,
  毕业设计: CourseType.THESIS,
};

const COURSE_LEVEL_MAP: Record<string, string> = {
  专业核心课: CourseLevel.CORE,
  一级项目课: CourseLevel.PROJECT_L1,
  二级项目课: CourseLevel.PROJECT_L2,
  一般课: CourseLevel.REGULAR,
};

/** 课程名单（需求 §4.3） */
export const COURSE_COLUMNS: ColumnSpec[] = [
  { header: '课程编号', field: 'courseCode', required: true, type: 'string', unique: true },
  { header: '课程名称', field: 'name', required: true, type: 'string' },
  { header: '课程类型', field: 'type', required: true, type: 'enum', enumMap: COURSE_TYPE_MAP },
  { header: '课程级别', field: 'level', required: true, type: 'enum', enumMap: COURSE_LEVEL_MAP },
  { header: '上课班级', field: 'classNames', required: true, type: 'list' },
  { header: '授课教师工号', field: 'teacherAccount', required: true, type: 'string' },
  { header: '学年', field: 'academicYear', required: true, type: 'string' },
  { header: '学期', field: 'semester', required: true, type: 'string' },
  { header: '是否参评课程', field: 'isTargetCourse', required: true, type: 'bool' },
  { header: '是否教改加难度课程', field: 'isReformCourse', required: false, type: 'bool' },
];

export const COLUMNS_BY_TYPE: Record<ImportType, ColumnSpec[]> = {
  [ImportType.TEACHER]: TEACHER_COLUMNS,
  [ImportType.STUDENT]: STUDENT_COLUMNS,
  [ImportType.COURSE]: COURSE_COLUMNS,
};

/** 多值字段分隔符：中英文逗号/分号 */
export const LIST_SEPARATOR = /[;；,，]/;

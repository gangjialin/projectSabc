import { STUDENT_COLUMNS, TEACHER_COLUMNS } from './import.constants';
import { normalizeBool, parseRows } from './validators';

describe('normalizeBool', () => {
  it('是/否/空 归一化', () => {
    expect(normalizeBool('是')).toBe(true);
    expect(normalizeBool('否')).toBe(false);
    expect(normalizeBool('')).toBe(false);
    expect(normalizeBool(undefined)).toBe(false);
    expect(normalizeBool('1')).toBe(true);
  });
  it('非法值 → null', () => {
    expect(normalizeBool('也许')).toBeNull();
  });
});

describe('parseRows - 教师', () => {
  it('合法行解析正确', () => {
    const { records, errors } = parseRows(
      [
        {
          工号: 'T001',
          姓名: '张三',
          所属系部: '数字媒体系',
          职称: '副教授',
          是否担任中层管理职务: '否',
          是否课程负责人: '是',
          邮箱: 'z@x.edu',
        },
      ],
      TEACHER_COLUMNS,
    );
    expect(errors).toEqual([]);
    expect(records[0]).toMatchObject({
      loginAccount: 'T001',
      name: '张三',
      department: '数字媒体系',
      isAdminRole: false,
      isCourseOwner: true,
    });
  });

  it('缺必填 → 报错且定位行/字段', () => {
    const { errors } = parseRows(
      [{ 工号: '', 姓名: '李四', 所属系部: '', 是否担任中层管理职务: '否' }],
      TEACHER_COLUMNS,
    );
    const fields = errors.map((e) => e.field);
    expect(fields).toContain('loginAccount');
    expect(fields).toContain('department');
    expect(errors[0].row).toBe(1);
  });

  it('布尔列非法值 → 报错', () => {
    const { errors } = parseRows(
      [{ 工号: 'T1', 姓名: '王五', 所属系部: '系', 是否担任中层管理职务: '大概' }],
      TEACHER_COLUMNS,
    );
    expect(errors.some((e) => e.field === 'isAdminRole')).toBe(true);
  });

  it('工号文件内重复 → 报错', () => {
    const row = { 工号: 'T1', 姓名: '甲', 所属系部: '系', 是否担任中层管理职务: '否' };
    const { errors } = parseRows([row, { ...row, 姓名: '乙' }], TEACHER_COLUMNS);
    expect(errors.some((e) => e.message.includes('重复'))).toBe(true);
  });
});


describe('parseRows - 学生', () => {
  it('合法学生行', () => {
    const { records, errors } = parseRows(
      [{ 学号: '20210001', 姓名: '小明', 班级: '数媒2101', 所属专业: '数字媒体技术', 年级: '2023级' }],
      STUDENT_COLUMNS,
    );
    expect(errors).toEqual([]);
    expect(records[0].loginAccount).toBe('20210001');
  });
});

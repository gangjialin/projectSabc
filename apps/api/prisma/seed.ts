import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_CONFIG, FormType, RoleCode } from '@app/shared';
import {
  DIMENSION_META,
  FORM_INDICATORS,
  distributeScores,
} from '../src/questions/form-definitions';

const prisma = new PrismaClient();

/** 种入 4 套通用评分表（formType × courseType=null × version1） */
async function seedForms() {
  let count = 0;
  for (const formType of Object.values(FormType)) {
    const exists = await prisma.questionTemplate.findFirst({
      where: { formType, courseType: null },
    });
    if (exists) continue;

    await prisma.questionTemplate.create({
      data: {
        formType,
        courseType: null,
        version: 1,
        isActive: true,
        description: `${formType} 通用评分表（5 维度，seed）`,
        dimensions: {
          create: DIMENSION_META.map((dim) => {
            const indicators = FORM_INDICATORS[formType][dim.no];
            const scores = distributeScores(dim.max, indicators.length);
            return {
              dimensionNo: dim.no,
              name: dim.name,
              maxScore: dim.max,
              questions: {
                create: indicators.map((indicator, i) => ({
                  serialNo: i + 1,
                  indicator,
                  scoreCriteria: indicator,
                  maxScore: scores[i],
                })),
              },
            };
          }),
        },
      },
    });
    count++;
  }
  return count;
}

const ROLES: { code: RoleCode; name: string }[] = [
  { code: RoleCode.ADMIN, name: '系统管理员（秘书组）' },
  { code: RoleCode.DEAN, name: '院长/系主任' },
  { code: RoleCode.REVIEWER, name: '听课/材料审查委员' },
  { code: RoleCode.INTERVIEWER, name: '访谈委员' },
  { code: RoleCode.PEER, name: '同行教师' },
  { code: RoleCode.STUDENT, name: '学生' },
  { code: RoleCode.TEACHER, name: '被评教师' },
  { code: RoleCode.QUALITY_DEPT, name: '教学质量保障部' },
];

async function main() {
  // 1. 内置角色
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      create: r,
      update: { name: r.name },
    });
  }

  // 2. 系统配置（权重/比例/阈值，需求 §十 可维护性）
  const configEntries: { key: string; value: unknown; description: string }[] = [
    { key: 'weights', value: DEFAULT_CONFIG.weights, description: '三维评价权重' },
    { key: 'supervisorSub', value: DEFAULT_CONFIG.supervisorSub, description: '上级评价内部权重' },
    { key: 'studentSub', value: DEFAULT_CONFIG.studentSub, description: '学生评价内部权重' },
    { key: 'dimensionMaxScores', value: DEFAULT_CONFIG.dimensionMaxScores, description: '5 维度满分' },
    { key: 'dimensionVetoThreshold', value: DEFAULT_CONFIG.dimensionVetoThreshold, description: '维度否决阈值' },
    { key: 'gradeQuota', value: DEFAULT_CONFIG.gradeQuota, description: '等级配额比例' },
    { key: 'minEvaluatorCount', value: DEFAULT_CONFIG.minEvaluatorCount, description: '最低评分人数' },
    { key: 'appealWindowDays', value: DEFAULT_CONFIG.appealWindowDays, description: '申诉窗口（工作日）' },
  ];
  for (const c of configEntries) {
    await prisma.systemConfig.upsert({
      where: { key: c.key },
      create: c as never,
      update: { value: c.value as never, description: c.description },
    });
  }

  // 3. 初始管理员
  const account = process.env.SEED_ADMIN_ACCOUNT ?? 'admin';
  const pwd = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const passwordHash = await bcrypt.hash(pwd, 10);
  const admin = await prisma.user.upsert({
    where: { loginAccount: account },
    create: {
      loginAccount: account,
      passwordHash,
      name: '系统管理员',
      userType: 'ADMIN',
      mustChangePwd: true,
    },
    update: {},
  });
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.ADMIN },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    create: { userId: admin.id, roleId: adminRole.id },
    update: {},
  });

  // 4. 4 套评分表
  const forms = await seedForms();

  // eslint-disable-next-line no-console
  console.log(
    `Seed 完成：${ROLES.length} 角色、${configEntries.length} 配置项、${forms} 套评分表、管理员账号 "${account}"`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

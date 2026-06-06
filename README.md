# 教师课程教学质量评分系统

数字艺术与设计学院 · 依据学校《评价办法》V7.0 与学院《实施方案》v2.0。

> 文档：[需求](Docs/requirements.md) · [设计](Docs/design.md) · [任务](Docs/tasks.md) · [测试方案](Docs/test_plan.md)

## 技术栈与选型

采用"**半采用**"策略：脚手架借力成熟方案，**核心业务（5 维度计分 / 维度否决 / 等级配额 / 实时打分）全自研**。

- 前端：Next.js 14 (App Router) + TypeScript + Tailwind + TanStack Query + Zustand
- 后端：NestJS 10 + Prisma 5 + PostgreSQL 15 + Redis 7 + Socket.IO + BullMQ + JWT/bcrypt + MinIO
- monorepo：pnpm workspace + Turborepo

## 目录结构

```
.
├─ apps/
│  ├─ api/                 NestJS 后端
│  │  ├─ prisma/schema.prisma   完整数据模型（design §3.2）
│  │  ├─ prisma/seed.ts         角色 + 系统配置 + 初始管理员
│  │  └─ src/
│  │     ├─ auth/          JWT 登录 + RBAC（RolesGuard，后端强制鉴权）
│  │     ├─ prisma/        PrismaService
│  │     ├─ score/         ⭐ 计分编排：接入 @app/shared 引擎、维度否决、等级划定
│  │     └─ common/        统一响应 {code,message,data}
│  └─ web/                 Next.js 前端（登录页 + 仪表盘壳 + 类型化 API 客户端）
├─ packages/
│  └─ shared/              ⭐ 共享枚举 + 系统配置 + 计分引擎（纯函数 + 41 单测）
│     └─ src/scoring/      dimension / composite / veto / grade
├─ docker-compose.yml      PostgreSQL + Redis + MinIO
└─ .env.example
```

## 核心引擎（已实现并测试通过）

`packages/shared/src/scoring/` —— 不依赖任何框架的纯函数，41 个单测全绿：

| 文件 | 职责 | 对应测试 |
|---|---|---|
| `dimension.ts` | 单次评分维度算分、去极值聚合 | U-CALC / U-AGG |
| `composite.ts` | 上级/学生/综合三维加权 | U-SCORE |
| `veto.ts` | **维度否决判定**（任一维度<70% 不得 A） | U-VETO |
| `grade.ts` | **等级配额划定**（S/A/B/C/D，中层不占比） | U-GRADE |

## 本地开发

前置：Node ≥ 20、pnpm 10、Docker（运行依赖服务）。

```bash
# 1. 安装依赖
pnpm install

# 2. 复制环境变量
cp .env.example .env

# 3. 启动依赖服务（PostgreSQL / Redis / MinIO）
docker compose up -d

# 4. 初始化数据库
pnpm --filter @app/api prisma migrate dev
pnpm --filter @app/api prisma generate
pnpm --filter @app/api seed     # 角色 + 系统配置 + 管理员(admin/Admin@123)

# 5. 启动
pnpm --filter @app/api dev      # 后端 http://localhost:4000/api/v1
pnpm --filter @app/web dev      # 前端 http://localhost:3000
```

## 验证命令

```bash
pnpm -r typecheck               # 全仓库类型检查（已通过）
pnpm --filter @app/shared test  # 计分引擎单测（41 passing）
```

## 当前进度

详见 [Docs/tasks.md](Docs/tasks.md)。已落地（全仓库 typecheck 通过，70 单测全绿）：
- ✅ **M1** monorepo + Docker Compose + 完整 Prisma 模型 + JWT/RBAC
- ✅ **M2** Excel 导入（模板/预览/行级校验/库内冲突/事务落库）+ 课程模块 + 导入前端
- ✅ **M3** 题目库版本化 + 模板合规校验 + 题目管理 UI + 4 套评分表 seed + 评分提交 + 5 维度李克特评分表 UI（只显文字防锚定）+ 任务分配（后端校验+批量前端）
- ✅ **M4** 计分引擎 + 维度否决 + 等级配额 + 数据完整性 + **综合分完整落库管线** + 排名 + BullMQ 异步重算（⚠ 运行需 Redis，待服务器验证）
- 🟡 **M8** 管理员仪表盘（等级分布/排名/重算）+ 教师成绩单（SVG 5维度雷达+否决告警）+ 排名 Excel 导出（PDF/上报包待补）

下一步：M5 现场说课（WebSocket 实时打分+大屏）→ M6 学生匿名问卷+免计入三级审核。

> ⚠ 需在带 Redis 的环境验证 BullMQ 异步重算与全链路 DB 流程，见下方"服务器部署"。

# AI Collaboration Log

## Project Information

| Item | Value |
|---|---|
| Project | 数字艺术与设计学院教师课程教学质量评分系统 |
| Tech Stack | Next.js 14 + NestJS 10 + PostgreSQL 15 + Redis 7 + Socket.IO + Prisma + TypeScript |
| AI Tools | Claude (Anthropic) |
| Start Date | 2026-05-22 |
| Current Phase | 方案评审阶段（开发前）|

---

## AI Usage Records

| Date | Task | AI Tool | AI Contribution | Human Review | Notes |
|---|---|---|---|---|---|
| 2026-05-22 | 阅读学院 5 份政策文档（实施方案+4张评分表） | Claude | 全文阅读、关键条款提取、合规性分析 | 待评审 | 涉及 .docx 文档解析 |
| 2026-05-22 | 生成需求文档 v1.0 | Claude | 文档结构、内容生成 | 待评审 | 基于学院方案初稿 |
| 2026-05-22 | 生成设计文档 v1.0 | Claude | 技术栈选型、数据模型、API 设计 | 待评审 | Next.js+NestJS+PG+Redis 全栈方案 |
| 2026-05-22 | 阅读学校上位法《评价办法》V7.0 | Claude | 全文阅读、5维度框架提取 | 待评审 | 关键发现：附件2 标准框架 |
| 2026-05-22 | 合规性诊断（学院方案 vs 学校上位法） | Claude | 14 项差异识别、分级评估 | 待评审 | 发现 3 项严重不合规 |
| 2026-05-22 | 生成学院实施方案 v2.0 | Claude | 18 章完整方案、12 项修订摘要 | **本次评审重点** | 对齐学校 5 维度框架 |
| 2026-05-22 | 需求文档升级到 v3.0 | Claude | 5 维度评分体系、维度否决、新增 5 个实体 | 待评审 | 联动学院方案 v2.0 |
| 2026-05-22 | 设计文档升级到 v2.0 | Claude | DimensionResult、Exemption、Tracking 数据模型；维度否决算法；开发周期 16→25 周 | 待评审 | 联动学院方案 v2.0 |
| 2026-05-22 | 生成 Word 版方案及 4 套评分表 | Claude | docx 文件生成、专业排版 | 待评审 | 验证全部通过 |

---

## Generated Systems

| System | AI Generated Ratio | Human Modified Ratio | Notes |
|---|---|---|---|
| 政策文档分析 | 100% | 0%（待评审） | 学院方案 v2.0、需求 v3.0、设计 v2.0 |
| Frontend UI | 0% | 0% | 未开始 |
| API Layer | 0%（仅设计） | 0% | 仅 Prisma Schema 草案 |
| Database Schema | 100%（草案） | 0% | 13 张表 Prisma Schema |
| Tests | 0% | 0% | 未开始 |

---

## Major AI-Assisted Decisions

| Decision | Reason |
|---|---|
| 评价体系对齐学校 5 维度框架（20+25+20+20+15） | 学校上位法《评价办法》V7.0 附件 2 强制要求；学院方案原 4 套表分值不一致属严重不合规 |
| 任一维度<70% 不得 A 及以上的否决规则 | 学校附件 2 备注的硬性规定；原学院方案缺失 |
| 课程覆盖比例改为 70%/100%/全覆盖 | 学校《评价办法》5.1 规定；原方案 50%/80% 低于要求 |
| 技术栈选型：Next.js + NestJS + PostgreSQL + Redis + Socket.IO | 同语言全栈降低维护成本；说课现场实时打分需 WebSocket；强一致性数据库 |
| 说课现场实时打分使用 Socket.IO + Redis 聚合 | 100 人并发延迟≤3 秒；Redis 防重复 + 实时去极值聚合 |
| 学生匿名通过双表设计（StudentEvalAudit + EvalSubmission） | 公开记录无 evaluatorId；审计记录单独存储；硬保障匿名 |
| 题目模板按课程类型版本化（理论/实践/项目/毕设） | 学校规定分类评价；旧数据须用旧版本计算保证一致性 |
| 新增三级审核的"学生评价记录免计入申请" | 学校《评价办法》5.2.1 及附件 1 要求 |
| 新增"持续改进跟踪单"模块 | 学校《评价办法》附件 3 要求；C 级帮扶机制 |
| 申诉期限从 5 改为 3 工作日 | 学校《评价办法》5.4.2 硬性规定 |

---

## Risks Identified

| Risk | Mitigation |
|---|---|
| 过度依赖 AI | 关键决策必须经院级课程建设委员会评审 |
| 学校上位法修订 | 配置化设计（权重/比例/维度阈值/课程覆盖均在 SystemConfig） |
| 5 维度题目调整影响历史数据 | QuestionTemplate 严格版本控制 |
| 维度否决判定误触发 | 计算前预览界面；管理员可申诉触发审计；2 人审核解锁 |
| 学生匿名性破坏 | 双表分离设计；DBA 权限严控；审计日志 |
| 现场说课网络不稳定 | 本地缓存 + 自动重连 + 管理员补录通道 |
| 评分人员对 5 维度不熟悉 | 培训手册 + 评分表的 S 级标准明示 + UI 操作引导 |
| 中层干部"单位质量贡献"评议主观 | 系统提供数据看板与指标口径 |

---

## Human Review Notes

### Reviewer
- 院级课程建设委员会（待评审）
- 院级质量监控组（待评审）

### Findings
- 待评审会议形成

### Required Revisions
- 待评审会议形成

---

## Educational Reflection

### What AI Helped With
- 快速完成大量政策文档的精读与对照分析（5 份学院文档 + 1 份学校上位法）
- 识别学院方案与学校上位法的 14 项差异并分级评估
- 系统化生成需求文档、设计文档、实施方案，保持三者强联动
- 完成专业的 Word 文档排版，含表格、章节、页码、修订摘要

### What Humans Still Needed To Solve
- 评价办法的政策解读与组织协调
- 学院实际人员配置与角色分工（监控组成员名单、秘书组）
- 等级比例的最终确定（S+A 是否严格 40%）
- 教改加难度课程的阈值调整审定标准
- 学校层面接口对接的具体协议

### Lessons Learned
- 上位法（学校办法）必须先读，否则下位实施方案的合规性无从评估
- 评分框架的"维度+分值"是评价体系的骨架，所有题目必须按此组织
- 否决规则（任一维度<70%）这种隐藏在备注里的硬性规定容易遗漏，需要逐字精读
- 文档间联动要明确版本号引用关系（学院方案 v2.0 → 需求 v3.0 → 设计 v2.0）

---

## Document Version History

| Document | Version | Date | Key Changes |
|---|---|---|---|
| 学院实施方案 | v1.0 | 学院原稿 | 原方案 |
| 学院实施方案 | **v2.0** | **2026-05-22** | **合规性修订，对齐学校 V7.0** |
| requirements.md | v1.0 | 2026-05-22 | 初稿，基于学院 v1.0 |
| requirements.md | v2.0 | 2026-05-22 | 修正 4 维度→3 维度 |
| requirements.md | **v3.0** | **2026-05-22** | **5 维度体系，新增维度否决等** |
| design.md | v1.0 | 2026-05-22 | 初稿，技术栈选型 |
| design.md | **v2.0** | **2026-05-22** | **5 维度数据模型，新增 5 实体** |

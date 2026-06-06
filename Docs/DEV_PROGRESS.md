# 开发进度与接续指南

**最近更新**：2026-06-06
**当前阶段**：核心功能开发完成，待端到端验证
**仓库**：Gitee `DaGangLaoShi/project-sabc`（主）+ GitHub `gangjialin/projectSabc`（备份）

> 下次开工先读这份 + `Docs/e2e_checklist.md`。

---

## 一句话状态
教师教学质量评分系统**核心全链路已完成并可一键 docker 部署**，服务器（`172.17.23.37`）通过 Gitee + cron 每 2 分钟自动同步。下一步是**端到端验证**（照 `Docs/e2e_checklist.md` 点一遍），然后修 bug。

## 部署与同步机制（已就绪，无需重配）
- 服务器 `/opt/ProjectSABC`，5 容器（web:3000 / api:4000 / postgres / redis / minio）docker compose 运行。
- **我 push 到 Gitee → 服务器 cron（`scripts/auto-deploy.sh`，每 2 分钟）自动 `git pull` + 重建**。零操作同步。
- schema 变更靠 api 容器 entrypoint 的 `prisma db push` 自动应用。
- 前端令牌存 localStorage、401 自动跳登录；登录后按角色显示左侧导航。
- 账号：admin（初始 `Admin@123`）；导入的教师工号/学生学号初始密码 `123456`，首登强制改密。

## 已完成（核心主线全通）
- **M1** monorepo + docker + Prisma 全模型 + JWT/RBAC + 角色导航
- **M2** Excel 导入（教师/学生/课程）
- **M3** 题目库版本化 + 题目管理 UI + 4 套评分表 + 任务分配（后端校验+批量前端）
- **M4** 计分引擎（5维度/去极值/三维加权/**维度否决**/等级配额/数据完整性）+ 综合分落库 + 排名 + BullMQ
- **M5** 现场说课实时打分（控制台 + 同行端 + 大屏雷达，WebSocket）
- **M6** 学生匿名问卷（班级匹配）+ 免计入三级审核（匿名精确剔除）
- **M7** 个别访谈评分、申诉（院级+校级）
- **M8** **会签发布闭环**（全员审核同意才发布/改等级）+ 成绩单门禁 + 强弱诊断 + 排名 Excel
- 额外：教师自助填报课程、§4.4 监控组名单导入、前置限定人工录入（T-405）、健康检查
- 测试：shared 58 单测 + api 16 单测全绿；全仓 typecheck 通过

## 未完成（已与项目方确认：不急 / 属验证阶段）
- **暂缓**：S级双通道申报(T-702/703)、C级持续改进跟踪单(T-704/705)
- **扩展**：M9 中层干部独立定级/单位质量贡献(T-901~903)（引擎已排除其占 S/A 比例）
- **支撑**：T-106 统一审计日志、T-803 报表 PDF/学校上报包、T-107 UI 打磨
- **验证阶段**：T-505 压测、T-1001~1007 测试/部署/培训、T-D02/03 Word 模板、T-D05 对接文档

## 明天怎么继续
1. 服务器 `cd /opt/ProjectSABC && git pull && docker compose up -d --build`（或等 cron 自动）
2. 照 `Docs/e2e_checklist.md` 从导入到出成绩点一遍
3. 哪步不符预期 → 把"步骤号 + 操作 + 报错"发我 → 我改 → push Gitee → 2 分钟后重试
4. 验证通过后，再决定做 S级申报 / C级跟踪单 / 中层干部评价 等扩展

## 关键文档
- 需求：`Docs/requirements.md`（v3.0 + 附录"工作流程对齐补充"6 条）
- 设计：`Docs/design.md` v2.0
- 任务进度：`Docs/tasks.md`（勾选状态）
- 测试方案：`Docs/test_plan.md`
- 端到端清单：`Docs/e2e_checklist.md`

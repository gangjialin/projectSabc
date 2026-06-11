# 安全审查报告

**日期**：2026-06-06　**范围**：apps/api、apps/web、docker-compose、配置
**结论**：代码层基础良好；**部署配置有 2 个高危项需立即处理**（JWT 弱密钥、数据库/Redis/MinIO 端口暴露）。

---

## 🔴 高危（尽快处理）

### H1. JWT 使用默认弱密钥
- 现象：`JWT_SECRET` 默认 `change-me-in-production`；服务器 `.env` 未设置该项 → **当前线上正用公开默认值**。
- 风险：任何人知道默认值即可**伪造任意用户（含 admin）的 token**，绕过全部鉴权。API 端口 4000 已对外开放，风险实时存在。
- 处理：在服务器 `.env` 设强随机值并重建：
  ```bash
  cd /opt/ProjectSABC
  echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
  echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)" >> .env
  docker compose up -d --build api
  ```
  （改密钥后旧 token 失效，需重新登录——正常。）
- 代码侧加固（可选）：生产缺失密钥时直接启动失败，避免静默用默认值。

### H2. PostgreSQL / Redis / MinIO 端口对外发布且弱/无口令
- 现象：compose 把 `5432`(PG, 口令 `eval_pwd`)、`6379`(Redis, **无口令**)、`9000/9001`(MinIO, `minioadmin/minioadmin`) 发布到宿主机 `0.0.0.0`。
- 风险：若这些端口在服务器上可达（防火墙/云安全组未严格限制），可被**直连脱库 / 接管 Redis（无认证）/ 读取 MinIO**。Redis 无认证尤其严重。
- 处理（任一）：
  - **推荐**：这些服务只需容器内网访问，**不发布端口**——删掉 compose 里 postgres/redis/minio 的 `ports:` 段（api 通过服务名 `postgres/redis/minio` 内网直连，不受影响）。
  - 或绑定本机：`ports: ["127.0.0.1:5432:5432"]` 等。
  - 并设强口令（PG 改密、Redis 加 `--requirepass`、MinIO 改 root 凭据）。
  - 确认云安全组/防火墙**只放行 3000/4000**，不放 5432/6379/9000。

---

## 🟡 中危

- **M1 登录无限流**：`/auth/login` 可暴力破解（叠加默认密码 123456）。建议接 `@nestjs/throttler` 限速。
- **M2 CORS `origin: true`**：反射任意来源。用 Bearer token，CSRF 风险低，但生产建议限定前端域名。
- **M3 上传无大小/类型硬限制**：`FileInterceptor` 未设 `limits`，超大文件可致 DoS；仅前端 `accept=.xlsx`。建议后端设 `fileSize` 上限并校验 MIME/扩展名。
- **M4 缺安全响应头**：未用 helmet（或在 Nginx 层加 HSTS/CSP/X-Frame-Options）。

## 🟢 低危

- **L1 WebSocket 打分无角色限制**：`/sayke` 的 `score` 仅校验已登录，未限角色；理论上任意登录用户可提交同行打分（evaluation 仍拦"不得评自己"）。建议 gateway 内校验 PEER/TEACHER/DEAN。
- **L2 默认初始密码**：123456 / Admin@123，有 `mustChangePwd` 强制改密兜底；建议加密码复杂度校验。
- **L3 凭据硬编码于 compose**：与 H2 同源，建议改用 env/secret。

---

## ✅ 做得对的（无需改）
- 全程 Prisma Client，**无原生 SQL → 无 SQL 注入面**
- 全局 `ValidationPipe` whitelist + forbidNonWhitelisted → 防多余字段/批量赋值
- 密码 **bcrypt** 哈希；登录响应不含 passwordHash
- JWT 后端校验 + RolesGuard，前端权限仅用于显隐
- 学生匿名：`StudentEvalAudit` 与匿名 `EvalSubmission` 分离，教师端只见聚合
- WebSocket 握手校验 JWT
- **会签发布**需全员同意、改等级须会签 → 防单点篡改成绩
- 维度否决/系统自动标记不可手改
- `.env`/密钥不入库（`.gitignore`）

---

## 建议处理顺序
1. **立即**：H1（设 JWT 密钥）、H2（收口 DB/Redis/MinIO 端口 + 确认防火墙）
2. 本周：M1 限流、M3 上传限制、L1 ws 角色
3. 上线前：M2 CORS 域名、M4 helmet、L2 密码策略

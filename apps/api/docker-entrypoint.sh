#!/bin/sh
set -e
cd /app

echo "[entrypoint] 同步数据库 schema (prisma db push)…"
pnpm --filter @app/api exec prisma db push --skip-generate --accept-data-loss

echo "[entrypoint] 初始化基础数据 (seed)…"
pnpm --filter @app/api seed || echo "[entrypoint] seed 跳过（可能已初始化）"

echo "[entrypoint] 启动 API…"
exec node apps/api/dist/main.js

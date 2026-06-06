#!/bin/sh
# 轮询自动部署：检测 Gitee 远程是否有新提交，有则 pull + 重新构建。
# 适合放进 cron / 1Panel 计划任务，每隔几分钟跑一次。
#
# 用法： sh /opt/ProjectSABC/scripts/auto-deploy.sh
# 日志： /opt/projectsabc-deploy.log

# 项目目录 = 脚本所在目录的上一级（可移植，不写死路径）
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCKDIR=/tmp/projectsabc-deploy.lock
LOG=/opt/projectsabc-deploy.log

# 原子锁：防止上一次构建没跑完又被触发（mkdir 是原子操作）
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT

cd "$PROJECT_DIR" || exit 1

# 拉取远程信息（失败说明网络抖动，下次再试）
if ! git fetch origin main --quiet 2>>"$LOG"; then
  echo "[$(date '+%F %T')] git fetch 失败，跳过本次" >>"$LOG"
  exit 0
fi

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

# 没有更新就直接退出（绝大多数轮询都走这里，几乎零开销）
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "[$(date '+%F %T')] 检测到更新 ${LOCAL} -> ${REMOTE}，开始部署" >>"$LOG"

if ! git pull --ff-only origin main >>"$LOG" 2>&1; then
  echo "[$(date '+%F %T')] git pull 失败（可能本地有改动导致无法快进），请人工处理" >>"$LOG"
  exit 1
fi

# 重新构建并启动（只重建有变化的层，Docker 自动用缓存）
if docker compose up -d --build >>"$LOG" 2>&1; then
  echo "[$(date '+%F %T')] 部署完成，当前版本 $(git rev-parse --short HEAD)" >>"$LOG"
else
  echo "[$(date '+%F %T')] docker compose 构建/启动失败，请查看日志" >>"$LOG"
  exit 1
fi

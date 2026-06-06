# 全栈构建镜像（api + web 共用）。上下文 = 仓库根目录。
FROM node:20-slim AS build

# prisma 需 openssl；bcrypt 原生编译需 python3/make/g++
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# 前端 NEXT_PUBLIC_* 在构建期注入；必须是“浏览器能访问到”的 API 地址
# （即服务器公网/局域网 IP，而非容器内 hostname）
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @app/shared build \
  && pnpm --filter @app/api prisma generate \
  && pnpm --filter @app/api build \
  && pnpm --filter @app/web build

EXPOSE 3000 4000
# 具体启动命令由 docker-compose 的 command 指定（api / web 各跑各的）
CMD ["node", "apps/api/dist/main.js"]

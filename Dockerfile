# 阶段一：构建 Vue 前端
FROM node:23-alpine AS web
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 阶段二：后端运行时
FROM node:23-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
COPY --from=web /build/dist ./frontend/dist
# 内置城市库单独留一份，数据卷为空时由入口脚本播种
COPY data/cities.json /app/docker-seed/cities.json
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

VOLUME ["/app/data"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]

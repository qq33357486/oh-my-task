# 构建上下文是仓库根，不是 app/：页面要用 ?raw 读 app/ 之外的框架文件（.omt/、.agents/skills/）。
#   docker build -f app/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /repo
COPY app/package.json app/package-lock.json ./app/
RUN cd app && npm ci
COPY . .
RUN cd app && npm run build

FROM nginx:alpine
COPY --from=build /repo/app/dist /usr/share/nginx/html
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 7330

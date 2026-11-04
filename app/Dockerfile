# T0004/A4：多阶段构建——node 编译 dist，nginx 托管（容器内端口 7330）。
# context=./app（CI 与 docker build -f app/Dockerfile app 均适用）。
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# 覆盖默认站点：监听 7330，前端路由回退 index.html。
# 缓存策略：index.html no-cache（每次协商，发版即生效，杜绝老访客滞留旧版）；
# /assets/ 文件名带内容 hash，immutable 长缓存。
RUN printf 'server {\n\
    listen 7330;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location /assets/ {\n\
        add_header Cache-Control "public, max-age=31536000, immutable";\n\
        try_files $uri =404;\n\
    }\n\
    location / {\n\
        add_header Cache-Control "no-cache";\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 7330

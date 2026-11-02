#!/usr/bin/env bash
# T0003/A4 工程可构建可启动（检查员锁定，实现员不得改本脚本）
# 断言三件：
#   1. cd app && npm run build  exit 0
#   2. app/dist/index.html 存在
#   3. npm run dev 起后 curl http://localhost:5173/ 返回 HTML（vite 默认端口 5173）
# 全过输出 GREEN exit 0；任一失败输出 RED:<原因> exit 1。
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/app"
DIST="$APP/dist/index.html"
URL="http://localhost:5173/"

fail() { echo "RED: $1"; exit 1; }

[ -d "$APP" ] || fail "app/ 目录不存在"

# 1) 构建
cd "$APP" || fail "无法进入 $APP"
npm run build || fail "npm run build 失败（exit $?）"

# 2) 构建产物
[ -f "$DIST" ] || fail "dist/index.html 不存在"

# 3) dev server 返回 HTML
npm run dev >/tmp/oht-dev.log 2>&1 &
DEV_PID=$!
trap 'kill "$DEV_PID" 2>/dev/null; taskkill //PID "$DEV_PID" //T //F >/dev/null 2>&1' EXIT
ok=""
for _ in $(seq 1 30); do
  body="$(curl -sf "$URL")" && { ok="$body"; break; }
  sleep 1
done
[ -n "$ok" ] || { cat /tmp/oht-dev.log; fail "dev server 30 秒内未在 $URL 返回内容"; }
echo "$ok" | grep -qi "<html" || fail "dev server 返回的不是 HTML"

echo "GREEN: build 与 dev server 均通过"

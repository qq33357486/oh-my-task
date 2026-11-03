#!/usr/bin/env bash
# T0022/A1 类型检查清零（检查员锁定，实现员不得改本脚本）
# 验收：cd app && npx tsc --noEmit 退出码 0 且无任何输出。
# tests 阶段现状：5 处错（scanTasks.ts(28)、scanTopics.ts(22)、
# kanban.test.tsx(12)、cardTitle.test.tsx(27)、visual.test.tsx(36)）→ 本脚本 RED。
# 实现完成后应输出 GREEN exit 0。
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP="$ROOT/app"

[ -d "$APP" ] || { echo "RED: app/ 目录不存在"; exit 1; }
cd "$APP" || { echo "RED: 无法进入 $APP"; exit 1; }

OUT="$(npx tsc --noEmit 2>&1)"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  echo "RED: tsc --noEmit 退出码 $STATUS（预期 0），报错如下："
  echo "$OUT"
  exit 1
fi
if [ -n "$OUT" ]; then
  echo "RED: tsc --noEmit 退出码 0 但有输出（预期零输出）："
  echo "$OUT"
  exit 1
fi
echo "GREEN: tsc --noEmit 零报错零输出"

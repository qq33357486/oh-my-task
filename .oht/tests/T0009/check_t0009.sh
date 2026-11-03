#!/usr/bin/env bash
# T0009 验收测试入口（检查员锁定，实现员不得改）。
#
# 覆盖（A1~A7 均为 auto；A8 是 human 条目不在此跑）：
#   A1/A2/A3/A6-picker  app/src/lib/__tests__/entryFlow.test.tsx
#   A5/A6-残缺卡        app/src/lib/__tests__/boardFlow.test.tsx
#   A4 幂等拒绝          app/src/lib/__tests__/initFlow.test.ts
#   A7 scanTasks         app/src/lib/__tests__/scanTasks.test.ts
#   A7 initFs            app/src/fs/__tests__/initFs.test.ts
#
# tests 阶段现状：A1~A6 红（现双入口设计不满足单入口契约）、
# A7 绿（锁定现实现行为）。实现完成后本脚本应全绿（退出码 0）。
# 用法：bash .oht/tests/T0009/check_t0009.sh
set -e
cd "$(dirname "$0")/../../../app"
exec npx vitest run \
  src/lib/__tests__/entryFlow.test.tsx \
  src/lib/__tests__/boardFlow.test.tsx \
  src/lib/__tests__/initFlow.test.ts \
  src/lib/__tests__/scanTasks.test.ts \
  src/fs/__tests__/initFs.test.ts

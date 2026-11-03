#!/usr/bin/env bash
# T0015/A3 看板主显 title 验收测试入口（检查员锁定，实现员不得改）。
#
# 覆盖：A3（看板主显 title）→ app/src/lib/__tests__/cardTitle.test.tsx
# A1/A2（.oht 卡层校验与存量合规）见同目录 check_t0015.py。
#
# tests 阶段现状：A3 红（卡面主显 id + 原话首行，无 title）。
# 实现完成后本脚本与 check_t0015.py 应全绿（退出码 0）。
# 用法：bash .oht/tests/T0015/check_t0015_board.sh
set -e
cd "$(dirname "$0")/../../../app"
exec npx vitest run src/lib/__tests__/cardTitle.test.tsx

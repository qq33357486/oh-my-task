#!/usr/bin/env bash
# T0024 复跑脚本（检查员写定，review 阶段逐条判定用）。
# 用法：bash .oht/tests/T0024/run.sh
# 顺序：A4 既有锁定五件套 → 本卡三文件 → A5 全量回归（vitest/tsc/build_check）。
set -e
cd "$(dirname "$0")/../../../app"

echo "== A4：既有锁定五件套（零改动通过）=="
npx vitest run \
  src/components/__tests__/flowView.test.tsx \
  src/lib/__tests__/flowMap.test.ts \
  src/lib/__tests__/topicTag.test.ts \
  src/lib/__tests__/entryFlow.test.tsx \
  src/components/__tests__/kanban.test.tsx

echo "== 本卡：A1/A2/A3 锁定三文件 =="
npx vitest run \
  src/lib/__tests__/entryCard.test.tsx \
  src/lib/__tests__/entryCardStyle.test.ts \
  src/lib/__tests__/flowCanvasStyle.test.ts

echo "== A5：全量回归 =="
npx vitest run
npx tsc --noEmit

cd ..
bash .oht/tests/T0003/build_check.sh
echo "T0024 run.sh：全部通过"

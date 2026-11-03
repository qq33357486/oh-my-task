#!/usr/bin/env bash
# T0022/A4 构建回归（检查员锁定，实现员不得改本脚本）
# 验收（卡面口径）：bash .oht/tests/T0003/build_check.sh 输出 GREEN。
# 本卡不改渲染与依赖，构建须保持绿——"当前即绿"回归锚，按 T0015 先例一并锁定。
# 本脚本只做薄代理（透传退出码），逻辑真身在 T0003 锁定脚本，未复制未改动。
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
T0003="$ROOT/.oht/tests/T0003/build_check.sh"

[ -f "$T0003" ] || { echo "RED: T0003/build_check.sh 不存在"; exit 1; }

bash "$T0003"

#!/usr/bin/env bash
# T0022/A3 typecheck 脚本与异步迭代声明（检查员锁定，实现员不得改本脚本）
# 验收（卡面口径）：
#   1. app/package.json 断言 scripts.typecheck === "tsc --noEmit"
#      （tests 阶段现状：无 typecheck 脚本 → RED）
#   2. app/tsconfig.json 的 lib 含 "DOM.AsyncIterable" 或 app/src/global.d.ts
#      含 values( 声明，二者其一即可
#      （tests 阶段现状：两者皆无 → RED）
# 全过输出 GREEN exit 0；任一违反输出 RED:<原因> exit 1。
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PKG="$ROOT/app/package.json"
TSCONFIG="$ROOT/app/tsconfig.json"
GLOBAL_DTS="$ROOT/app/src/global.d.ts"

bad=0

[ -f "$PKG" ] || { echo "RED: $PKG 不存在"; exit 1; }
[ -f "$TSCONFIG" ] || { echo "RED: $TSCONFIG 不存在"; exit 1; }

typecheck="$(python -I - "$PKG" <<'EOF'
import json, sys
print(json.load(open(sys.argv[1], encoding="utf-8"))["scripts"].get("typecheck", ""))
EOF
)"
if [ "$typecheck" = "tsc --noEmit" ]; then
  : # 过
else
  echo "RED: package.json scripts.typecheck 为 '${typecheck}'，预期 \"tsc --noEmit\""
  bad=1
fi

if grep -q '"DOM.AsyncIterable"' "$TSCONFIG"; then
  : # lib 路过
elif [ -f "$GLOBAL_DTS" ] && grep -q 'values(' "$GLOBAL_DTS"; then
  : # global.d.ts 路过
else
  echo "RED: tsconfig.json lib 无 \"DOM.AsyncIterable\" 且 src/global.d.ts 无 values( 声明（二者须其一）"
  bad=1
fi

if [ "$bad" -ne 0 ]; then
  exit 1
fi
echo "GREEN: typecheck 脚本存在且异步迭代声明已补（lib 或 global.d.ts 其一）"

#!/usr/bin/env bash
# T0022/A2 测试输出无噪声且不丢用例（检查员锁定，实现员不得改本脚本）
# 验收（卡面 A2 字面口径，仅此三条）：
#   1. "not configured to support act" 出现 0 次（tests 阶段实测 166 → RED）
#   2. "Not implemented: window.getComputedStyle" 出现 0 次（tests 阶段实测 4 → RED）
#   3. "Tests" 行通过数 >= 60 且无 failed（tests 阶段 60 passed，本条当前即绿）
# 捕获方式（检查员定的口径）：shell 层 2>&1 合并后整日志计数——act 警告与 jsdom
# not-implemented 错误均经 console.error/stderr 落到 vitest 输出，不动 app 配置即可
# 统计；匹配前剥离 ANSI 颜色码，避免转义序列干扰。
# 有意不断言 vitest 退出码与 Test Files 行：并行卡（T0021/T0023/T0024）的红测试
# 文件瞬态不连累本卡判定，本卡只对 act/jsdom/用例数三条负责。
# 全过输出 GREEN exit 0；任一违反输出 RED:<原因含实测数> exit 1。
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP="$ROOT/app"

[ -d "$APP" ] || { echo "RED: app/ 目录不存在"; exit 1; }
cd "$APP" || { echo "RED: 无法进入 $APP"; exit 1; }

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT
npx vitest run > "$LOG" 2>&1

# 剥离 ANSI 颜色码（GNU sed，Git Bash 自带）
CLEAN="$(sed -e 's/\x1b\[[0-9;]*m//g' "$LOG")"

act_count="$(printf '%s\n' "$CLEAN" | grep -c "not configured to support act" || true)"
ni_count="$(printf '%s\n' "$CLEAN" | grep -c "Not implemented: window.getComputedStyle" || true)"

tests_line="$(printf '%s\n' "$CLEAN" | grep -E '^[[:space:]]*Tests[[:space:]]' || true)"

bad=0
if [ "$act_count" -ne 0 ]; then
  echo "RED: act 警告出现 $act_count 次（预期 0）"
  bad=1
fi
if [ "$ni_count" -ne 0 ]; then
  echo "RED: jsdom Not implemented 错误出现 $ni_count 次（预期 0）"
  bad=1
fi

# passed 数提取兼容两种 vitest 格式：
#   全过：  "Tests  60 passed (60)"
#   有失败："Tests  3 failed | 62 passed (65)"  （取行内末个 "<n> passed"）
passed="$(printf '%s\n' "$tests_line" | sed -n -E 's/.*[[:space:]]([0-9]+) passed[[:space:]].*/\1/p' | head -n 1)"
if [ -z "$passed" ]; then
  echo "RED: 输出中未找到 Tests 通过数行"
  bad=1
elif [ "$passed" -lt 60 ]; then
  echo "RED: Tests 通过数 $passed < 60（锁定用例数不得回退）"
  bad=1
fi

if printf '%s\n' "$tests_line" | grep -q "failed"; then
  echo "RED: Tests 行含 failed：$(printf '%s\n' "$tests_line" | head -n 1)"
  bad=1
fi

if [ "$bad" -ne 0 ]; then
  exit 1
fi
echo "GREEN: vitest 输出零 act 警告、零 jsdom Not implemented、Tests ${passed} passed 且无 failed"

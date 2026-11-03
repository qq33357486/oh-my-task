#!/usr/bin/env bash
# dispatch-worker.sh：派发与唤醒唯一入口（T0033）。
# 用法：bash .oht/scripts/dispatch-worker.sh <角色> [卡号]
#   角色：consultant|implementer|checker（卡角色，必须带卡号 ^T[0-9]+$）
#         | dispatcher（不带卡号，无卡号调用即唤醒调度员）
# 行为：定位 zcode CLI（ZCODE_BIN 优先，否则 command -v zcode）→ 组装单
# 参数提示词（含角色、roles 路径、卡路径，指引先读 .oht/AGENTS.md）→
# mkdir -p .oht/local 后同步写 .oht/local/w-<卡号>.log（dispatcher 为
# w-dispatcher.log）头部行 → 代理后台拉起（nohup &）、输出续写同一日志
# → 脚本不等待、即返 0（调度员「派发后核验日志已生成」依赖此同步写）。
set -u

usage() {
  echo "用法: bash .oht/scripts/dispatch-worker.sh <角色> [卡号]" >&2
  echo "  角色: consultant|implementer|checker（须带卡号 T+数字）| dispatcher（不带卡号）" >&2
  echo "  示例: bash .oht/scripts/dispatch-worker.sh implementer T0033" >&2
  echo "        bash .oht/scripts/dispatch-worker.sh dispatcher   # 唤醒调度员" >&2
}

# 仓库根：脚本住 .oht/scripts/，根 = 脚本目录上上级
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

ROLE="${1:-}"
CARD="${2:-}"

# 1) 参数校验（先于 CLI 定位：参数不合法即刻拒绝，不依赖环境）
case "$ROLE" in
  consultant|implementer|checker)
    if ! printf '%s' "$CARD" | grep -Eq '^T[0-9]+$'; then
      usage
      exit 1
    fi
    ;;
  dispatcher)
    if [ -n "$CARD" ]; then
      usage
      exit 1
    fi
    ;;
  *)
    usage
    exit 1
    ;;
esac

# 2) CLI 定位：ZCODE_BIN 优先，否则 PATH 上的 zcode；都找不到非零退出
if [ -n "${ZCODE_BIN:-}" ]; then
  CLI="$ZCODE_BIN"
else
  CLI="$(command -v zcode 2>/dev/null || true)"
fi
if [ -z "$CLI" ]; then
  echo "找不到 zcode CLI：设环境变量 ZCODE_BIN 或将 zcode 加入 PATH" >&2
  exit 1
fi

# 3) 日志：同步写头部行（含卡号/dispatcher 与时间戳），后台输出续写同日志
mkdir -p "$ROOT/.oht/local"
if [ -n "$CARD" ]; then
  LOG="$ROOT/.oht/local/w-$CARD.log"
  TAG="$CARD"
else
  LOG="$ROOT/.oht/local/w-dispatcher.log"
  TAG="dispatcher"
fi
echo "[$TAG] 派发 $(date '+%Y-%m-%d %H:%M:%S')（后台拉起，输出续写本日志）" >> "$LOG"

# 4) 提示词组装：单参数，含角色名、roles 路径、（卡角色）卡路径，
#    指引先读 .oht/AGENTS.md
if [ -n "$CARD" ]; then
  PROMPT="你是循环工程框架的【${ROLE}】，工作目录 ${ROOT}。先读 ${ROOT}/.oht/AGENTS.md 并遵循，再读 ${ROOT}/.oht/roles/${ROLE}.md，然后严格按该角色步骤处理任务卡 ${ROOT}/.oht/tasks/${CARD}.md。自治执行，卡住才 need_human。"
else
  PROMPT="你是循环工程框架的【调度员】，工作目录 ${ROOT}。先读 ${ROOT}/.oht/AGENTS.md 并遵循，再读 ${ROOT}/.oht/roles/dispatcher.md，按其盘点台账与任务卡并按需派发。自治执行，无任务即结束。"
fi

# 5) 后台拉起即返回：不等待代理完成（会话即工人，可生灭可替换）
nohup "$CLI" "$PROMPT" >> "$LOG" 2>&1 &
exit 0

#!/usr/bin/env bash
# T0004/A4 容器构建走 GitHub CI（检查员锁定，实现员不得改本脚本）
# 被测物：.github/workflows/docker-publish.yml（T0004 实现物，本脚本只测不写）。
# 断言：
#   1) 工作流文件存在
#   2) push 触发且分支含 master
#   3) 四步齐：actions/checkout、docker/setup-buildx-action、
#      docker/login-action（registry=ghcr.io）、docker/build-push-action
#   4) build-push 的 context 为 app；tags 含 ghcr.io、latest、sha
#   5) YAML 语法：本机 python 有 PyYAML 则 safe_load 解析 + 深度结构校验；
#      无则自动退化为上述 grep 结构断言。
# 全过输出 GREEN exit 0；任一失败输出 RED:<原因> exit 1。
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WF="$ROOT/.github/workflows/docker-publish.yml"

fail() { echo "RED: $1"; exit 1; }

# 1) 文件存在
[ -f "$WF" ] || fail "工作流文件不存在: .github/workflows/docker-publish.yml"

# 2) push 触发且分支含 master
grep -Eq '^[[:space:]]*push:' "$WF" || fail "缺 push 触发"
grep -A2 -E '^[[:space:]]*branches:' "$WF" | grep -q 'master' \
  || grep -Eq 'branches:.*master' "$WF" \
  || fail "push 分支未含 master"

# 3) 四步齐
grep -Eq 'actions/checkout' "$WF" || fail "缺 actions/checkout"
grep -Eq 'docker/setup-buildx-action' "$WF" || fail "缺 docker/setup-buildx-action"
grep -Eq 'docker/login-action' "$WF" || fail "缺 docker/login-action"
grep -Eq 'registry:[[:space:]]*ghcr\.io' "$WF" || fail "login 的 registry 应为 ghcr.io"
grep -Eq 'docker/build-push-action' "$WF" || fail "缺 docker/build-push-action"

# 4) context 与 tags
grep -Eq 'context:[[:space:]]*\.?/?app[[:space:]]*$' "$WF" || fail "context 应为 app"
TAGS="$(grep -A4 -E '^[[:space:]]*tags:' "$WF")"
[ -n "$TAGS" ] || fail "缺 tags 配置"
echo "$TAGS" | grep -q 'ghcr\.io' || fail "tags 应含 ghcr.io"
echo "$TAGS" | grep -q 'latest' || fail "tags 应含 latest"
echo "$TAGS" | grep -q 'sha' || fail "tags 应含 sha"

# 5) YAML 语法与深度结构（有 PyYAML 才做，无则上面的 grep 断言已覆盖）
if command -v python >/dev/null 2>&1; then
  cd "$ROOT" || fail "无法进入仓库根"
  python - <<'PYEOF' || fail "YAML 语法/深度结构校验失败"
import sys
try:
    import yaml
except ImportError:
    print("SKIP: 本机无 PyYAML，YAML 语法校验退化为结构 grep 断言")
    sys.exit(0)
doc = yaml.safe_load(open(".github/workflows/docker-publish.yml", encoding="utf-8"))
on = doc.get("on", doc.get(True))
assert isinstance(on, dict), "缺 on: 触发配置"
branches = ((on.get("push") or {}).get("branches")) or []
assert "master" in branches, "push 分支未含 master"
steps = [s for j in (doc.get("jobs") or {}).values() for s in (j.get("steps") or [])]
def use(prefix):
    return [s for s in steps if str(s.get("uses", "")).startswith(prefix)]
assert use("actions/checkout"), "缺 actions/checkout"
assert use("docker/setup-buildx-action"), "缺 docker/setup-buildx-action"
login = use("docker/login-action")
assert login, "缺 docker/login-action"
assert "ghcr.io" in str((login[0].get("with") or {}).get("registry", "")), "login registry 应为 ghcr.io"
bp = use("docker/build-push-action")
assert bp, "缺 docker/build-push-action"
w = bp[0].get("with") or {}
assert str(w.get("context", "")).lstrip("./") == "app", "context 应为 app"
tags = str(w.get("tags", ""))
for need in ("ghcr.io", "latest", "sha"):
    assert need in tags, "tags 缺 " + need
print("GREEN: YAML 解析与深度结构校验通过")
PYEOF
else
  echo "SKIP: 无 python，YAML 语法校验退化为结构 grep 断言"
fi

echo "GREEN: 工作流结构校验全部通过"

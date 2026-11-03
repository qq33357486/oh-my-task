#!/usr/bin/env bash
# T0029 红测试驱动（A1~A8）。检查员写定即锁定，实现员不得改或删（只能新增）。
# A9 为 human 条目（人看 README），不在本驱动内。
#
# 用法：bash .oht/tests/T0029/run.sh   （cwd 任意；win32 用 Git Bash 跑，python 为仓库惯例的 Windows Python）
#
# 设计（为什么这么写）：
#   1) 不 import 被测物：pack.py / install.py 一律以 `python -I -X utf8` 子进程黑盒驱动，
#      判定只看退出码 + 合并输出 + 文件系统状态。A3 只读真实仓库文件。
#   2) 临时夹具自建自清：全部夹具住 mktemp 的 TMP_ROOT 下，trap EXIT 统一删除；
#      所有判定都在各 case 函数内、夹具存活期内当场完成（T0021 teeth 教训：
#      先例曾把判定挪到夹具销毁后导致悬空误判，此处禁止该形态）。
#   3) 框架区只读：除 A2 直跑真实仓库 pack.py（对仓库只读）外，A1/A4~A8 的
#      源仓/被测仓一律是"镜像仓"——用 build_mirror 从真实仓库拷贝卡片定义的
#      框架全集（AGENTS.md、PROTOCOL.md、VERSION、roles/*.md、scripts/*、
#      两份 _template）到临时目录，行为等价（清单内嵌在 pack.py 里，pack 扫的是
#      其所在仓库根），避免向真实 .oht/roles/ 塞探针文件留下残骸。A1 查列的
#      "在 .oht/roles/ 放未登记临时 md，删掉重跑"在镜像仓同布局执行。
#   4) win32 路径：bash 夹具用 POSIX 路径，传给 python 子进程前经 cygpath -m
#      转成 Windows 混合路径（py() 内统一处理）。
#   5) export PYTHONDONTWRITEBYTECODE=1：测试自身不产生 __pycache__ 污染仓库
#      （框架范围内未登记文件会让 pack 按设计报错，测试不得自造这种噪声）。
#
# 给实现员的接口契约（全部来自卡面需求 2/3 的用法，未加戏）：
#   pack.py：    python -I pack.py --out <产物目录>
#                清单校验失败 → 非零退出，输出逐个指出未登记/缺失文件名；通过 → 复制清单文件保持相对路径
#   install.py： python -I install.py --to <目标项目根> [--check]
#                --from 缺省 = 脚本所在仓库根（镜像仓跑镜像里的 install.py，源即镜像）
#                降级 → 非零退出，输出含「禁止降级」与源/目标两个版本号，目标不动
#                --check → 逐文件比对目标框架文件与 .manifest 哈希，被改 → 非零退出并指出文件
#   双标记：     .oht/VERSION 内容 = 语义版本；根 AGENTS.md 首行 = <!-- OHT-VERSION: <同版本> -->
#
# tests 阶段现状：pack.py / install.py / .oht/VERSION 尚不存在 → 全红是预期（红=设计态）。

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/t0029.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT
export PYTHONDONTWRITEBYTECODE=1

w() { cygpath -m "$1"; }        # POSIX 路径 → Windows 混合路径，供 python 子进程

py() {                          # py <脚本posix路径> [参数...]：合并 stdout+stderr 输出
  local s; s="$(w "$1")"; shift
  python -I -X utf8 "$s" "$@" 2>&1
}

trim() { tr -d ' \t\r\n'; }     # stdin 去空白（读 VERSION 用）

snip() { printf '%s' "$1" | tr '\n' '|' | cut -c 1-240; }   # 证据收窄成单行

RED=0; TOTAL=0
report() {                      # report <用例名> <0绿|1红> <原因>
  TOTAL=$((TOTAL+1))
  if [ "$2" -eq 0 ]; then
    echo "GREEN $1"
  else
    RED=$((RED+1))
    echo "RED   $1"
    [ -n "$3" ] && printf '      %s\n' "$3"
  fi
  return 0
}

# build_mirror <dest>：从真实仓库拷贝卡片定义的框架全集 → 临时镜像仓（VERSION 缺失时跳过该文件）
build_mirror() {
  local d="$1" f b
  mkdir -p "$d/.oht/roles" "$d/.oht/scripts" "$d/.oht/tasks" "$d/.oht/knowledge/topics" || return 1
  cp "$ROOT/AGENTS.md" "$d/AGENTS.md" || return 1
  cp "$ROOT/.oht/AGENTS.md" "$d/.oht/AGENTS.md" || return 1
  cp "$ROOT/.oht/PROTOCOL.md" "$d/.oht/PROTOCOL.md" || return 1
  [ -f "$ROOT/.oht/VERSION" ] && cp "$ROOT/.oht/VERSION" "$d/.oht/VERSION"
  for f in "$ROOT"/.oht/roles/*.md; do b="$(basename "$f")"; cp "$f" "$d/.oht/roles/$b" || return 1; done
  for f in "$ROOT"/.oht/scripts/*; do b="$(basename "$f")"; cp "$f" "$d/.oht/scripts/$b" || return 1; done
  cp "$ROOT/.oht/tasks/_template.md" "$d/.oht/tasks/_template.md" || return 1
  cp "$ROOT/.oht/knowledge/topics/_template.md" "$d/.oht/knowledge/topics/_template.md" || return 1
  return 0
}

src_ver() { if [ -f "$1/.oht/VERSION" ]; then trim < "$1/.oht/VERSION"; fi; }

# A1 清单校验抓未登记文件：镜像仓 roles/ 放探针 → pack 应非零且逐个点名；删探针 → 恢复零退出
a1() {
  local msg="" m="$TMP_ROOT/a1_src" out="$TMP_ROOT/a1_out" probe out_s rc
  rm -rf "$m" "$out"
  build_mirror "$m" || { report "A1 清单校验抓未登记文件" 1 "镜像仓构建失败"; return 0; }
  probe="$m/.oht/roles/_t0029_unregistered.md"
  printf 'T0029 探针：框架范围内未登记文件\n' > "$probe"
  out_s="$(py "$m/.oht/scripts/pack.py" --out "$(w "$out")")"; rc=$?
  [ $rc -ne 0 ] || msg="探针在位时 pack 应非零退出，实得 0 "
  case "$out_s" in
    *_t0029_unregistered.md*) : ;;
    *) msg="${msg}错误输出未逐个指出未登记文件名(_t0029_unregistered.md) " ;;
  esac
  rm -f "$probe"
  out_s="$(py "$m/.oht/scripts/pack.py" --out "$(w "$out")")"; rc=$?
  [ $rc -eq 0 ] || msg="${msg}删除探针后 pack 应零退出，实得 $rc：$(snip "$out_s") "
  if [ -z "$msg" ]; then report "A1 清单校验抓未登记文件" 0
  else report "A1 清单校验抓未登记文件" 1 "$(snip "$msg")"; fi
}

# A2 打包产物集合断言：直跑真实仓库 pack.py --out 临时目录，断言框架全集在、业务数据全无
a2() {
  local msg="" out="$TMP_ROOT/a2_out" out_s rc f b extras
  rm -rf "$out"
  out_s="$(py "$ROOT/.oht/scripts/pack.py" --out "$(w "$out")")"; rc=$?
  if [ $rc -ne 0 ]; then
    report "A2 打包产物集合断言" 1 "pack.py 非零退出($rc)：$(snip "$out_s")"; return 0
  fi
  for f in AGENTS.md .oht/AGENTS.md .oht/PROTOCOL.md .oht/VERSION .oht/tasks/_template.md .oht/knowledge/topics/_template.md; do
    [ -f "$out/$f" ] || msg="${msg}产物缺 $f "
  done
  for f in "$ROOT"/.oht/roles/*.md; do b="$(basename "$f")"; [ -f "$out/.oht/roles/$b" ] || msg="${msg}产物缺 .oht/roles/$b "; done
  for f in "$ROOT"/.oht/scripts/*.py; do b="$(basename "$f")"; [ -f "$out/.oht/scripts/$b" ] || msg="${msg}产物缺 .oht/scripts/$b "; done
  cmp -s "$ROOT/.oht/PROTOCOL.md" "$out/.oht/PROTOCOL.md" || msg="${msg}产物 .oht/PROTOCOL.md 与源不一致(应原样复制) "
  if diff <(ls "$ROOT/.oht/roles") <(ls "$out/.oht/roles" 2>/dev/null) >/dev/null 2>&1; then : \
  else msg="${msg}产物 roles/ 集合与源不一致 "; fi
  if diff <(ls "$ROOT/.oht/scripts") <(ls "$out/.oht/scripts" 2>/dev/null) >/dev/null 2>&1; then : \
  else msg="${msg}产物 scripts/ 集合与源不一致 "; fi
  extras="$(find "$out/.oht/knowledge" -type f ! -path '*/topics/_template.md' 2>/dev/null)"
  [ -n "$extras" ] && msg="${msg}产物 knowledge/ 混入非模板业务文件：$(printf '%s' "$extras" | tr '\n' ' ') "
  [ -n "$(find "$out/.oht/tasks" -name 'T[0-9]*.md' -print -quit 2>/dev/null)" ] && msg="${msg}产物混入任务卡 tasks/T*.md "
  [ -e "$out/.oht/tests" ] && msg="${msg}产物混入 tests/ "
  [ -e "$out/.oht/local" ] && msg="${msg}产物混入 local/ "
  [ -e "$out/app" ] && msg="${msg}产物混入 app/ "
  if [ -z "$msg" ]; then report "A2 打包产物集合断言" 0
  else report "A2 打包产物集合断言" 1 "$(snip "$msg")"; fi
}

# A3 版本双标记一致：.oht/VERSION 与根 AGENTS.md 首行标记，均为合法 x.y.z 且相等
a3() {
  local msg="" vf="$ROOT/.oht/VERSION" ver line1 marker
  if [ ! -f "$vf" ]; then
    report "A3 版本双标记一致" 1 ".oht/VERSION 不存在（实现员补 VERSION 与根 AGENTS.md 首行标记后转绿）"; return 0
  fi
  ver="$(trim < "$vf")"
  printf '%s' "$ver" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || msg="VERSION 不是合法 x.y.z：[$ver] "
  line1="$(head -n 1 "$ROOT/AGENTS.md" | tr -d '\r')"
  if ! printf '%s' "$line1" | grep -q 'OHT-VERSION'; then
    msg="${msg}根 AGENTS.md 首行缺 OHT-VERSION 标记（现首行：[$line1]） "
  else
    marker="<!-- OHT-VERSION: $ver -->"
    [ "$(printf '%s' "$line1" | tr -d '[:space:]')" = "$(printf '%s' "$marker" | tr -d '[:space:]')" ] \
      || msg="${msg}根 AGENTS.md 首行标记[$line1]与 VERSION[$ver]不一致 "
  fi
  if [ -z "$msg" ]; then report "A3 版本双标记一致" 0
  else report "A3 版本双标记一致" 1 "$(snip "$msg")"; fi
}

# A4 空目录初始化端到端：镜像源 install --to 空目录 → 框架全集 + 业务骨架 + 生成根 AGENTS.md + --check 过
a4() {
  local msg="" m="$TMP_ROOT/a4_src" t="$TMP_ROOT/a4_target" out_s rc sv v
  rm -rf "$m" "$t"; mkdir -p "$t"
  build_mirror "$m" || { report "A4 空目录初始化端到端" 1 "镜像仓构建失败"; return 0; }
  sv="$(src_ver "$m")"
  out_s="$(py "$m/.oht/scripts/install.py" --to "$(w "$t")")"; rc=$?
  [ $rc -eq 0 ] || msg="install 应零退出，实得 $rc：$(snip "$out_s") "
  for f in .oht/AGENTS.md .oht/PROTOCOL.md .oht/VERSION .oht/tasks/_template.md .oht/knowledge/topics/_template.md; do
    [ -f "$t/$f" ] || msg="${msg}目标缺 $f "
  done
  for f in "$m"/.oht/roles/*.md; do b="$(basename "$f")"; [ -f "$t/.oht/roles/$b" ] || msg="${msg}目标缺 roles/$b "; done
  for f in "$m"/.oht/scripts/*.py; do b="$(basename "$f")"; [ -f "$t/.oht/scripts/$b" ] || msg="${msg}目标缺 scripts/$b "; done
  if [ -n "$sv" ]; then
    v="$(src_ver "$t")"
    [ "$v" = "$sv" ] || msg="${msg}目标 VERSION[$v]应等于源版本[$sv] "
    [ -f "$t/AGENTS.md" ] || msg="${msg}根 AGENTS.md 未生成 "
    if [ -f "$t/AGENTS.md" ]; then
      head -n 1 "$t/AGENTS.md" | tr -d '\r' | grep -q "OHT-VERSION: $sv" || msg="${msg}生成根 AGENTS.md 首行缺版本标记(OHT-VERSION: $sv) "
      grep -q '\.oht' "$t/AGENTS.md" || msg="${msg}生成根 AGENTS.md 缺 .oht 一行引用 "
    fi
  fi
  [ -d "$t/.oht/tasks" ] || msg="${msg}缺业务骨架 .oht/tasks/ "
  [ -d "$t/.oht/knowledge/log" ] || msg="${msg}缺业务骨架 .oht/knowledge/log/ "
  [ -d "$t/.oht/knowledge/topics" ] || msg="${msg}缺业务骨架 .oht/knowledge/topics/ "
  [ -d "$t/.oht/local/roles" ] || msg="${msg}缺业务骨架 .oht/local/roles/ "
  [ -f "$t/.oht/knowledge/log/.gitkeep" ] || msg="${msg}缺 .oht/knowledge/log/.gitkeep "
  [ -f "$t/.oht/knowledge/topics/.gitkeep" ] || msg="${msg}缺 .oht/knowledge/topics/.gitkeep "
  out_s="$(py "$m/.oht/scripts/install.py" --to "$(w "$t")" --check)"; rc=$?
  [ $rc -eq 0 ] || msg="${msg}安装后 --check 应通过，实得 $rc：$(snip "$out_s") "
  if [ -z "$msg" ]; then report "A4 空目录初始化端到端" 0
  else report "A4 空目录初始化端到端" 1 "$(snip "$msg")"; fi
}

# A5 升级保留业务数据：装 0.1.0 镜像 → 预放业务文件 → 0.2.0 镜像重装 → 业务逐字未变、框架更新、有 .bak、VERSION=0.2.0
a5() {
  local msg="" s1="$TMP_ROOT/a5_src1" s2="$TMP_ROOT/a5_src2" t="$TMP_ROOT/a5_target" bz="$TMP_ROOT/a5_biz" out_s rc v
  rm -rf "$s1" "$s2" "$t" "$bz"; mkdir -p "$t" "$bz"
  build_mirror "$s1" || { report "A5 升级保留业务数据" 1 "镜像仓构建失败"; return 0; }
  cp -r "$s1" "$s2"
  out_s="$(py "$s1/.oht/scripts/install.py" --to "$(w "$t")")"; rc=$?
  [ $rc -eq 0 ] || msg="首次安装应零退出，实得 $rc：$(snip "$out_s") "
  mkdir -p "$t/.oht/tasks" "$t/.oht/knowledge/log" "$t/.oht/knowledge/topics" "$t/.oht/local/roles" "$t/.oht/tests/T9001"
  printf 'T0029-A5 业务卡片骨架\n' > "$t/.oht/tasks/T9001.md"
  printf 'T0029-A5 业务日志\n' > "$t/.oht/knowledge/log/x.md"
  printf 'T0029-A5 自定义主题\n' > "$t/.oht/knowledge/topics/自定义.md"
  printf '# 本地角色补充\n' > "$t/.oht/local/roles/checker.md"
  printf '#!/usr/bin/env bash\necho t9001\n' > "$t/.oht/tests/T9001/run.sh"
  cp "$t/.oht/tasks/T9001.md" "$bz/T9001.md"
  cp "$t/.oht/knowledge/log/x.md" "$bz/log_x.md"
  cp "$t/.oht/knowledge/topics/自定义.md" "$bz/自定义.md"
  cp "$t/.oht/local/roles/checker.md" "$bz/local_checker.md"
  cp "$t/.oht/tests/T9001/run.sh" "$bz/run.sh"
  # 模拟源版本升 0.2.0：VERSION、根标记、两个框架文件加升级标记（让"更新"有牙）
  printf '0.2.0\n' > "$s2/.oht/VERSION"
  sed -i '1s/[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*/0.2.0/' "$s2/AGENTS.md"
  printf '\nT0029-A5-SRC2 升级标记\n' >> "$s2/.oht/PROTOCOL.md"
  printf '\nT0029-A5-SRC2 升级标记\n' >> "$s2/.oht/roles/checker.md"
  out_s="$(py "$s2/.oht/scripts/install.py" --to "$(w "$t")")"; rc=$?
  [ $rc -eq 0 ] || msg="${msg}升级重装应零退出，实得 $rc：$(snip "$out_s") "
  v="$(src_ver "$t")"
  [ "$v" = "0.2.0" ] || msg="${msg}升级后目标 VERSION[$v]应为 0.2.0 "
  grep -q 'T0029-A5-SRC2' "$t/.oht/PROTOCOL.md" 2>/dev/null || msg="${msg}框架文件未更新为新版（PROTOCOL.md 缺升级标记） "
  grep -q 'T0029-A5-SRC2' "$t/.oht/roles/checker.md" 2>/dev/null || msg="${msg}框架文件未更新为新版（roles/checker.md 缺升级标记） "
  cmp -s "$bz/T9001.md" "$t/.oht/tasks/T9001.md" || msg="${msg}业务卡 tasks/T9001.md 被动过 "
  cmp -s "$bz/log_x.md" "$t/.oht/knowledge/log/x.md" || msg="${msg}业务经验 knowledge/log/x.md 被动过 "
  cmp -s "$bz/自定义.md" "$t/.oht/knowledge/topics/自定义.md" || msg="${msg}业务主题 knowledge/topics/自定义.md 被动过 "
  cmp -s "$bz/local_checker.md" "$t/.oht/local/roles/checker.md" || msg="${msg}local/roles/checker.md 被动过 "
  cmp -s "$bz/run.sh" "$t/.oht/tests/T9001/run.sh" || msg="${msg}tests/T9001/run.sh 被动过（业务 tests 不得删改） "
  [ -f "$t/.oht/PROTOCOL.md.bak" ] || msg="${msg}被覆盖框架文件缺 .bak（PROTOCOL.md.bak） "
  [ -f "$t/.oht/roles/checker.md.bak" ] || msg="${msg}被覆盖框架文件缺 .bak（roles/checker.md.bak） "
  if [ -f "$t/.oht/PROTOCOL.md.bak" ] && grep -q 'T0029-A5-SRC2' "$t/.oht/PROTOCOL.md.bak"; then
    msg="${msg}PROTOCOL.md.bak 备的是新内容不是旧版 "
  fi
  if [ -z "$msg" ]; then report "A5 升级保留业务数据" 0
  else report "A5 升级保留业务数据" 1 "$(snip "$msg")"; fi
}

# A6 防降级：目标 VERSION 写 9.9.9（高于源）→ 非零退出、报「禁止降级」带两版本号、目标一字不动
a6() {
  local msg="" m="$TMP_ROOT/a6_src" t="$TMP_ROOT/a6_target" out_s rc sv
  rm -rf "$m" "$t"; mkdir -p "$t/.oht"
  build_mirror "$m" || { report "A6 防降级" 1 "镜像仓构建失败"; return 0; }
  sv="$(src_ver "$m")"
  printf '9.9.9\n' > "$t/.oht/VERSION"; cp "$t/.oht/VERSION" "$TMP_ROOT/a6_sent_v"
  printf 'T0029-A6-SENTINEL 目标文件不许动\n' > "$t/.oht/PROTOCOL.md"; cp "$t/.oht/PROTOCOL.md" "$TMP_ROOT/a6_sent_p"
  out_s="$(py "$m/.oht/scripts/install.py" --to "$(w "$t")")"; rc=$?
  [ $rc -ne 0 ] || msg="目标版本高于源应非零退出，实得 0 "
  case "$out_s" in *禁止降级*) : ;; *) msg="${msg}错误输出缺「禁止降级」 " ;; esac
  if [ -n "$sv" ]; then
    case "$out_s" in *9.9.9*) : ;; *) msg="${msg}错误输出缺目标版本号 9.9.9 " ;; esac
    case "$out_s" in *"$sv"*) : ;; *) msg="${msg}错误输出缺源版本号 $sv " ;; esac
  fi
  cmp -s "$TMP_ROOT/a6_sent_v" "$t/.oht/VERSION" || msg="${msg}拒绝降级后目标 VERSION 被改动 "
  cmp -s "$TMP_ROOT/a6_sent_p" "$t/.oht/PROTOCOL.md" || msg="${msg}拒绝降级后目标框架文件被改动 "
  [ ! -e "$t/.oht/PROTOCOL.md.bak" ] || msg="${msg}拒绝降级不应产生 .bak "
  if [ -z "$msg" ]; then report "A6 防降级" 0
  else report "A6 防降级" 1 "$(snip "$msg")"; fi
}

# A7 已有根 AGENTS.md 不覆盖：预放用户自己的根 AGENTS.md → 逐字未变，其余框架照常安装
a7() {
  local msg="" m="$TMP_ROOT/a7_src" t="$TMP_ROOT/a7_target" ua="$TMP_ROOT/a7_user_AGENTS.md" out_s rc sv
  rm -rf "$m" "$t"; mkdir -p "$t"
  build_mirror "$m" || { report "A7 已有根AGENTS.md不覆盖" 1 "镜像仓构建失败"; return 0; }
  sv="$(src_ver "$m")"
  printf '# 我的项目\n\n这个项目自己的说明，框架升级不许动我。T0029-A7-USER\n' > "$t/AGENTS.md"
  cp "$t/AGENTS.md" "$ua"
  out_s="$(py "$m/.oht/scripts/install.py" --to "$(w "$t")")"; rc=$?
  [ $rc -eq 0 ] || msg="install 应零退出，实得 $rc：$(snip "$out_s") "
  cmp -s "$ua" "$t/AGENTS.md" || msg="${msg}用户根 AGENTS.md 被覆盖（应原样保留） "
  [ -f "$t/.oht/PROTOCOL.md" ] || msg="${msg}其余框架未照常安装（缺 PROTOCOL.md） "
  cmp -s "$m/.oht/PROTOCOL.md" "$t/.oht/PROTOCOL.md" || msg="${msg}安装的 PROTOCOL.md 与源不一致 "
  if [ -n "$sv" ]; then
    [ "$(src_ver "$t")" = "$sv" ] || msg="${msg}目标 VERSION 应为源版本 $sv "
  fi
  if [ -z "$msg" ]; then report "A7 已有根AGENTS.md不覆盖" 0
  else report "A7 已有根AGENTS.md不覆盖" 1 "$(snip "$msg")"; fi
}

# A8 篡改检测：装好后改目标 roles/checker.md 一个字符 → --check 非零退出并指出该文件
a8() {
  local msg="" m="$TMP_ROOT/a8_src" t="$TMP_ROOT/a8_target" out_s rc
  rm -rf "$m" "$t"; mkdir -p "$t"
  build_mirror "$m" || { report "A8 篡改检测" 1 "镜像仓构建失败"; return 0; }
  out_s="$(py "$m/.oht/scripts/install.py" --to "$(w "$t")")"; rc=$?
  [ $rc -eq 0 ] || msg="安装应零退出，实得 $rc：$(snip "$out_s") "
  out_s="$(py "$m/.oht/scripts/install.py" --to "$(w "$t")" --check)"; rc=$?
  if [ $rc -ne 0 ]; then
    report "A8 篡改检测" 1 "篡改前 --check 即红($rc)，红因非篡改：$(snip "$out_s")"; return 0
  fi
  python -I -X utf8 -c 'import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s2 = s.replace("检查员", "检查元", 1)
if s2 == s:
    s2 = s + "x"
open(p, "w", encoding="utf-8").write(s2)' "$(w "$t/.oht/roles/checker.md")" || {
    report "A8 篡改检测" 1 "篡改步骤自身失败（目标 roles/checker.md 不在？）"; return 0; }
  out_s="$(py "$m/.oht/scripts/install.py" --to "$(w "$t")" --check)"; rc=$?
  [ $rc -ne 0 ] || msg="篡改后 --check 应非零退出，实得 0 "
  case "$out_s" in *checker.md*) : ;; *) msg="${msg}错误输出未指出被改文件 checker.md " ;; esac
  if [ -z "$msg" ]; then report "A8 篡改检测" 0
  else report "A8 篡改检测" 1 "$(snip "$msg")"; fi
}

echo "== T0029 run.sh（A1~A8）｜ 仓库根: $ROOT ｜ 夹具: $TMP_ROOT =="
a1
a2
a3
a4
a5
a6
a7
a8
echo "红 $RED / $TOTAL"
[ "$RED" -eq 0 ] && exit 0 || exit 1

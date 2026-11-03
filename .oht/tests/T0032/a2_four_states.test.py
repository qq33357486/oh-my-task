"""T0032 A2 红测试：四态机落档（检查员锁定，实现员不得改）。

出处 T0032 需求 2/5（tests 状态删除：生命周期表四态 new→ready→review→done
（+need_human）；TDD 节改写「测试即验收条目：咨询员 authored，实现员做绿，
检查员复核」；check-card.py 状态枚举去 tests）。断言为语义匹配不锁措辞
（先例 T0020 候选正则组、T0031/a3 节内状态行扫描）。

覆盖：
  A2-1 PROTOCOL.md「一张卡的一生」表四态：new/ready/review/done 状态行齐备
       （need_human 行在），且表内无 tests/recorded 状态行
  A2-2 PROTOCOL.md TDD 节三态分工：咨询员 authored（语义等价：咨询员写测试）
       /实现员做绿/检查员复核；并反向断言 TDD 节无「检查员写测试」旧分工
  A2-3 check-card.py 对 status:tests 坏卡判错（夹具证伪：临时目录造两卡，
       对照卡 status:ready 须 exit 0 证夹具本身干净，坏卡须非零退出证枚举已收；
       check-card 支持单卡参数——用法见脚本 docstring「卡片文件路径」，故走
       单卡模式而非整仓夹具）

"无 tests/recorded" 按卡面锚定生命周期表内（.oht/tests/<id>/ 是测试目录
非状态，全文件断言会误伤，不作断言面）。A2-2 中「实现员做绿」「检查员复核」
现状已由旧顺序行承载（实现员做到绿/检查员复跑）为绿锚如实记；红口在
「咨询员 authored」未落与「检查员写测试」旧分工未删。
tests 阶段现状（2026-11-03 探针证实）：生命周期表含 tests/recorded 行；
TDD 节顺序为"咨询员写条目→检查员先写测试并确认红"；check-card 对
status:tests 判合法 → A2-1/A2-2/A2-3 红。
用法：python -I .oht/tests/T0032/a2_four_states.test.py   （cwd 任意）
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PROTOCOL = os.path.join(ROOT, ".oht", "PROTOCOL.md")
CHECK_CARD = os.path.join(ROOT, ".oht", "scripts", "check-card.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FOUR_STATES = ["new", "ready", "review", "done"]
BAN_ROWS = ["tests", "recorded"]

# TDD 节三态分工（每组至少一行命中）。
AUTHORED = [  # 咨询员 authored / 咨询员写测试（现「咨询员写条目」不算）
    r"咨询员\s*authored",
    r"咨询员写[^→\n]{0,4}测试",
    r"测试即验收条目",
]
IMPL_GREEN = [  # 实现员做绿
    r"实现员[^→\n]{0,8}(做绿|做到绿|变绿)",
]
CHECKER_RERUN = [  # 检查员复核
    r"检查员[^→\n]{0,8}(复核|复跑)",
]
OLD_DIVISION = [  # 反向断言：检查员写测试旧分工（出现即红）
    r"检查员[^→\n]{0,8}写(测试|用例)",
]

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def section_lines(lines, keyword):
    out, on = [], False
    for ln in lines:
        if ln.startswith("## "):
            on = keyword in ln
            continue
        if on:
            out.append(ln)
    return out


def first_hit(lines, pats):
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                return ln.strip()
    return ""


def check_lifecycle(proto_lines):
    sec = section_lines(proto_lines, "一张卡的一生")
    if not sec:
        fail("[生命周期表四态] 未找到「一张卡的一生」节")
        return
    for st in FOUR_STATES:
        row = [l for l in sec if re.match(r"^\|\s*%s\s*\|" % st, l.strip())]
        if row:
            ok("[生命周期表四态] 状态行在: %s" % row[0].strip()[:60])
        else:
            fail("[生命周期表四态] 缺状态行: %s" % st)
    if [l for l in sec if re.match(r"^\|\s*need_human\s*\|", l.strip())]:
        ok("[生命周期表四态] need_human 行在（四态+人工态）")
    else:
        fail("[生命周期表四态] 缺 need_human 行")
    for st in BAN_ROWS:
        row = [l for l in sec if re.match(r"^\|\s*%s\s*\|" % st, l.strip())]
        if row:
            fail("[生命周期表无%s] 残留状态行: %s" % (st, row[0].strip()[:60]))
        else:
            ok("[生命周期表无%s] 表内无该状态行" % st)


def check_tdd(proto_lines):
    sec = section_lines(proto_lines, "TDD")
    if not sec:
        fail("[TDD节三态分工] 未找到 TDD 节")
        return
    for name, pats in (("咨询员authored", AUTHORED),
                       ("实现员做绿", IMPL_GREEN),
                       ("检查员复核", CHECKER_RERUN)):
        h = first_hit(sec, pats)
        if h:
            ok("[TDD节|含%s] %s" % (name, h.strip()[:60]))
        else:
            fail("[TDD节|含%s] 未命中语义行" % name)
    old = first_hit(sec, OLD_DIVISION)
    if old:
        fail("[TDD节|无检查员写测试旧分工] 旧分工行: %s" % old.strip()[:60])
    else:
        ok("[TDD节|无检查员写测试旧分工] 无残留")


FIX_TMPL = """---
id: %s
title: 四态枚举校验夹具
status: %s
round: 0
parent: ""
origin: ""
knowledge: []
system: ""
lane: ""
touches: []
batch: ""
stopped_at: ""
resume_to: ""
stop_reason: ""
question: ""
replied: false
---

## 原话
T0032 A2 夹具：验证 check-card.py 状态枚举收口。

## 需求
无实际需求，仅为 check-card.py 单卡校验夹具。

## 复述卡
夹具卡：除 status 外全部字段合规。

## 验收条目

### A1 夹具条目
- 类型：auto
- 查：夹具占位
- 预期：status 枚举校验按预期判
- 状态：红

## 系统文档改动

## 进度

## 失败原因

## 候选教训

## 人的回复
"""


def check_enum_fixture():
    tmp = tempfile.mkdtemp(prefix="t0032_fix_")
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    try:
        tasks = os.path.join(tmp, "tasks")
        os.makedirs(tasks)
        cards = {"T9901": "ready", "T9902": "tests"}
        rcs = {}
        outs = {}
        for cid, st in cards.items():
            path = os.path.join(tasks, cid + ".md")
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(FIX_TMPL % (cid, st))
            p = subprocess.run([sys.executable, "-I", "-X", "utf8",
                                CHECK_CARD, path], cwd=ROOT,
                               capture_output=True, text=True,
                               encoding="utf-8", errors="replace",
                               timeout=60, env=env)
            rcs[st] = p.returncode
            outs[st] = ((p.stdout or "") + (p.stderr or "")).strip()
        if rcs["ready"] != 0:
            fail("[check-card坏卡判错] 对照卡(status:ready)误报 exit=%d，夹具失控\n%s"
                 % (rcs["ready"], outs["ready"][:300]))
            return
        ok("[check-card坏卡判错] 对照卡(status:ready) exit 0（夹具本身干净）")
        if rcs["tests"] != 0:
            ok("[check-card坏卡判错] 坏卡(status:tests) exit=%d 判错（枚举已收）"
               % rcs["tests"])
        else:
            fail("[check-card坏卡判错] 坏卡(status:tests) exit 0 未判错（枚举未收）")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    global FAILED
    print("== T0032 A2 四态机落档 ==")
    if not os.path.isfile(PROTOCOL):
        fail("[生命周期表四态] 文件缺失 %s" % PROTOCOL)
        fail("[TDD节三态分工] 文件缺失 %s" % PROTOCOL)
    else:
        proto_lines = open(PROTOCOL, encoding="utf-8").read().splitlines()
        check_lifecycle(proto_lines)
        check_tdd(proto_lines)
    check_enum_fixture()

    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""T0032 A3 红测试：检查员收拢 review 与派发表改写落档（检查员锁定，实现员不得改）。

出处 T0032 需求 3/4（检查员职责收拢至 review：删 tests 阶段写测试职责，
增防篡改核对（指纹/git diff）；派发表 new→consultant（含写测试）、
ready→implementer、review→checker、done 即终态无派）。
断言为语义匹配不锁措辞（先例 T0020 候选正则组、T0031/a3 反向断言）。

覆盖：
  A3-1 roles/checker.md 无 tests 阶段写测试职责语义（反向断言：status=tests
       节/先写测试/为 auto 条目写测试/tests→ 流转残留，出现即红）
  A3-2 roles/checker.md 含「防篡改核对（指纹/git diff）」语义行
       （现"自该提交后是否被改"是提交号比对旧机制，不含指纹/git diff 词根，
       不计入本断言面——目标机制按需求 3 为哈希指纹或 git diff 核查）
  A3-3 roles/dispatcher.md 派发表三行语义：new→consultant / ready→implementer /
       review→checker 各至少一行；反向断言无 tests 态派发（tests、review→checker
       /tests/review→checker）与 done→recorder 派发（done 即终态无派）

tests 阶段现状（2026-11-03 探针证实）→ A3-1/A3-2 红：
checker.md 有「## status=tests：先写测试」节与「为 auto 条目写测试，放 tests/」，
无防篡改/指纹/git diff 语义；dispatcher.md 有「对应：tests、review→checker」
「done→recorder」「tests/review→checker」。
new→consultant / ready→implementer / review→checker 三行现状已在
dispatcher.md（12/47 行）承载 → 绿锚如实记，红口在两反向断言与防篡改行。
用法：python -I .oht/tests/T0032/a3_review_only.test.py   （cwd 任意）
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CHECKER = os.path.join(ROOT, ".oht", "roles", "checker.md")
DISPATCHER = os.path.join(ROOT, ".oht", "roles", "dispatcher.md")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 反向断言：tests 阶段写测试职责语义（出现即红）。
CHECKER_OLD = [
    r"status\s*=\s*tests",
    r"先写测试",
    r"为\s*auto\s*条目写测试",
    r"写测试.{0,6}放\s*tests",
    r"tests\s*→",
]
# 正向断言：防篡改核对（指纹/git diff）语义组。
TAMPER_CHECK = [
    r"防篡改",
    r"指纹",
    r"git\s*diff",
    r"哈希",
]
# 派发表三行（每组至少一行命中）。
DISPATCH_ROWS = [
    ("new→consultant", [r"new\s*→\s*consultant"]),
    ("ready→implementer", [r"ready\s*→\s*implementer"]),
    ("review→checker", [r"review\s*→\s*checker"]),
]
# 反向断言：tests 态派发与 done→recorder 派发（出现即红）。
DISPATCH_OLD = [
    r"tests.{0,8}→",
    r"tests\s*[/、,，]\s*review",
    r"done\s*→\s*(recorder|记录员)",
]

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def first_hit(lines, pats):
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                return ln.strip()
    return ""


def all_hits(lines, pats):
    out = []
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                out.append(ln.strip())
                break
    return out


def check_checker():
    if not os.path.isfile(CHECKER):
        fail("[roles/checker.md|无tests写测试职责] 文件缺失 %s" % CHECKER)
        fail("[roles/checker.md|含防篡改核对] 文件缺失 %s" % CHECKER)
        return
    lines = open(CHECKER, encoding="utf-8").read().splitlines()
    old = all_hits(lines, CHECKER_OLD)
    if old:
        for o in old[:4]:
            fail("[roles/checker.md|无tests写测试职责] 残留行: %s" % o[:60])
    else:
        ok("[roles/checker.md|无tests写测试职责] 无残留（职责收拢 review）")
    h = first_hit(lines, TAMPER_CHECK)
    if h:
        ok("[roles/checker.md|含防篡改核对] %s" % h[:60])
    else:
        fail("[roles/checker.md|含防篡改核对] 未命中语义行（指纹/git diff）")
        clue = [l.strip() for l in lines if re.search(r"改|提交|复跑|核对", l)]
        for c in clue[:5]:
            print("       现有相关行: %s" % c[:60])


def check_dispatcher():
    if not os.path.isfile(DISPATCHER):
        for name, _ in DISPATCH_ROWS:
            fail("[roles/dispatcher.md|%s] 文件缺失 %s" % (name, DISPATCHER))
        fail("[roles/dispatcher.md|无旧派发] 文件缺失 %s" % DISPATCHER)
        return
    lines = open(DISPATCHER, encoding="utf-8").read().splitlines()
    for name, pats in DISPATCH_ROWS:
        h = first_hit(lines, pats)
        if h:
            ok("[roles/dispatcher.md|%s] %s" % (name, h[:60]))
        else:
            fail("[roles/dispatcher.md|%s] 未命中语义行" % name)
    old = all_hits(lines, DISPATCH_OLD)
    if old:
        for o in old[:4]:
            fail("[roles/dispatcher.md|无tests派发与done→recorder] 旧派发行: %s" % o[:60])
    else:
        ok("[roles/dispatcher.md|无tests派发与done→recorder] 无残留（done 即终态无派）")


def main():
    global FAILED
    print("== T0032 A3 检查员与派发表落档 ==")
    check_checker()
    check_dispatcher()

    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

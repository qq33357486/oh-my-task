"""T0020 A1 红测试：测试执行纪律三禁落档（检查员锁定，实现员不得改）。

三禁语义（出处 T0020 原话，人两条纠正 2026-11-03）：
  禁① 测试与干活由在途工作者自跑用例——不新起 zcode 实例、不做沙盒唤醒
  禁② 派人权属调度员，工作者禁嵌套派人
  禁③ 模型一律会话默认，禁指定外部模型

覆盖：
  A1-1 PROTOCOL.md 含三禁语义行（三条各至少一行命中语义）
  A1-2 roles/checker.md 含三禁语义行（当值跑测试角色，双落点下限）
  A1-3 roles/implementer.md 含三禁语义行（当值跑测试+被派工作者）
  A1-4 roles/dispatcher.md 含禁②派人权属语义行（唯一派人者）
  A1-5 check-size.py 无参零超限（纪律行须过剃刀，roles/*.md 在扫描范围）

断言为语义匹配不锁措辞（落点措辞实现按剃刀压缩，卡面需求 1）；
匹配失败时打印目标文件现有相关行辅助定位。
tests 阶段现状：PROTOCOL 与全部角色文件均无三禁语义行（探针 grep 证实）
→ A1-1~A1-4 红；A1-5 当前即绿（回归锚点，一并锁定）。
用法：python -I .oht/tests/T0020/a1_discipline.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PROTOCOL = os.path.join(ROOT, ".oht", "PROTOCOL.md")
ROLES = os.path.join(ROOT, ".oht", "roles")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 每禁一组候选正则（行内命中任一即算该禁语义行落档）。
BAN1 = [  # 禁① 自跑用例 / 不新起 zcode / 不沙盒唤醒
    r"自跑",
    r"zcode.*(新起|再起|新开|单独调用|实例)|(新起|再起|新开|单独调用|实例).*zcode",
    r"沙盒唤醒",
]
BAN2 = [  # 禁② 嵌套派人 / 派人权属调度员
    r"嵌套.*(派|子代理|代理)|(派|子代理|代理).*嵌套",
    r"权属.*调度|调度.*权属",
]
BAN3 = [  # 禁③ 外部模型 / 指定模型 / 模型会话默认
    r"外部模型",
    r"(指定|更换|绑定)模型|模型.*(指定|更换|绑定)",
    r"会话默认",
]

CASES = [
    ("PROTOCOL.md", os.path.join(ROOT, ".oht", "PROTOCOL.md"),
     [("禁1自跑用例", BAN1), ("禁2嵌套派人", BAN2), ("禁3外部模型", BAN3)]),
    ("roles/checker.md", os.path.join(ROLES, "checker.md"),
     [("禁1自跑用例", BAN1), ("禁2嵌套派人", BAN2), ("禁3外部模型", BAN3)]),
    ("roles/implementer.md", os.path.join(ROLES, "implementer.md"),
     [("禁1自跑用例", BAN1), ("禁2嵌套派人", BAN2), ("禁3外部模型", BAN3)]),
    ("roles/dispatcher.md", os.path.join(ROLES, "dispatcher.md"),
     [("禁2嵌套派人", BAN2)]),
]

FAILED = 0


def hit(lines, pats):
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                return ln.strip()
    return ""


def check_semantics(rel, path, wants):
    global FAILED
    lines = open(path, encoding="utf-8").read().splitlines()
    for name, pats in wants:
        h = hit(lines, pats)
        if h:
            print("  绿 [%s|%s] %s" % (rel, name, h[:60]))
        else:
            FAILED += 1
            print("  红 [%s|%s] 未命中语义行" % (rel, name))
            clue = [l.strip() for l in lines
                    if re.search(r"自跑|zcode|嵌套|派人|模型|沙盒|权属", l, re.I)]
            for c in clue[:5]:
                print("       现有相关行: %s" % c[:60])


def main():
    global FAILED
    print("== T0020 A1 三禁纪律行落档 ==")
    for rel, path, wants in CASES:
        if not os.path.isfile(path):
            FAILED += 1
            print("  红 [%s] 文件缺失 %s" % (rel, path))
            continue
        check_semantics(rel, path, wants)

    # A1-5 check-size 无参零超限（纪律行落 roles/*.md 须过剃刀 <=40 字）
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, "-I", CHECK_SIZE], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=60, env=env)
    if p.returncode == 0:
        print("  绿 [check-size零超限] %s" % (p.stdout or "").strip().splitlines()[-1:])
    else:
        FAILED += 1
        print("  红 [check-size零超限] exit=%d\n%s%s" % (p.returncode, p.stdout, p.stderr))

    if FAILED:
        print("== 结果：红（%d 处未落档，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

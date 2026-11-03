"""T0028 A1 红测试：new 卡自治条款落档（检查员锁定，实现员不得改）。

出处 T0028 需求 1/2（人质疑循环停点 + 两条 doctrine 批复，2026-11-03）：
  落① PROTOCOL.md 不再含「咨询员仅人在场 / 自动化唤醒只派 tests」阻塞语义
  落② roles/dispatcher.md 不再含「new 卡只在人在场时处理 / 遇 new 只入报告」阻塞语义
  落③ PROTOCOL.md 含「唤醒派咨询员自治定稿」语义行（new 卡自治进循环）
  落④ PROTOCOL.md 含 need_human 三类白名单语义行（方向分叉/round>3/缺资源）
  锚⑤ check-size.py 无参零超限（新条款须过剃刀；回归锚点，当前即绿）

断言为语义匹配不锁措辞：每条语义一组候选正则，命中任一即算落档，
落点措辞实现按剃刀压缩（先例 .oht/tests/T0020/a1_discipline.test.py）。
tests 阶段现状未改：阻塞语义两行在档（探针 grep 证实 PROTOCOL.md:17、
roles/dispatcher.md:13），正语义全无 → 落①~落④ 红；锚⑤ 当前即绿
（一并锁定防回归）。需求落卡自动进循环，人只投放与事后纠正。
用法：python -I .oht/tests/T0028/a1_autonomy.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PROTOCOL = os.path.join(ROOT, ".oht", "PROTOCOL.md")
DISPATCHER = os.path.join(ROOT, ".oht", "roles", "dispatcher.md")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 每落点一组候选正则（命中任一即算该语义行落档）。
BLOCK_NEW = [  # 落①落② 阻塞语义（不得出现）：仅人在场才派 / 遇 new 只入报告
    r"仅人在场",
    r"自动化唤醒只派|唤醒只派",
    r"只在人在场时处理",
    r"只入报告",
]
AUTO_SEM = [  # 落③ 唤醒即派咨询员自治定稿
    r"自治定稿",
    r"唤醒[^。]*派[^。]*咨询员|派[^。]*咨询员[^。]*定稿",
    r"new\s*卡[^。]*派[^。]*咨询员",
]
WHITELIST_SEM = [  # 落④ need_human 三类白名单
    r"白名单",
    r"仅三类|三类[^。]*例外|例外[^。]*三类",
    r"方向分叉[^。]*(round|反复|资源)|(round|反复失败)[^。]*资源",
]

FAILED = 0


def hit(lines, pats):
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                return ln.strip()
    return ""


def check_absent(tag, path, pats, clue_words):
    """阻塞语义：命中任一候选即红。"""
    global FAILED
    if not os.path.isfile(path):
        FAILED += 1
        print("  红 [%s] 文件缺失 %s" % (tag, path))
        return
    lines = open(path, encoding="utf-8").read().splitlines()
    h = hit(lines, pats)
    if h:
        FAILED += 1
        print("  红 [%s] 仍含阻塞语义: %s" % (tag, h[:70]))
    else:
        print("  绿 [%s] 无阻塞语义行" % tag)


def check_present(tag, path, pats, clue_words):
    """正语义：候选组命中任一即绿，全不命中红并打印线索。"""
    global FAILED
    if not os.path.isfile(path):
        FAILED += 1
        print("  红 [%s] 文件缺失 %s" % (tag, path))
        return
    lines = open(path, encoding="utf-8").read().splitlines()
    h = hit(lines, pats)
    if h:
        print("  绿 [%s] %s" % (tag, h[:70]))
    else:
        FAILED += 1
        print("  红 [%s] 未命中语义行" % tag)
        clue = [l.strip() for l in lines
                if re.search(clue_words, l, re.I)]
        for c in clue[:5]:
            print("       现有相关行: %s" % c[:70])


def main():
    global FAILED
    print("== T0028 A1 new 卡自治条款落档 ==")
    check_absent("落1 PROTOCOL无仅人在场阻塞", PROTOCOL, BLOCK_NEW,
                 r"咨询员|唤醒|人在场|need_human|白名单")
    check_absent("落2 dispatcher无遇new只入报告", DISPATCHER, BLOCK_NEW,
                 r"咨询员|唤醒|new|人在场")
    check_present("落3 PROTOCOL唤醒派咨询员自治定稿", PROTOCOL, AUTO_SEM,
                  r"咨询员|唤醒|自治|自主")
    check_present("落4 PROTOCOL三类白名单", PROTOCOL, WHITELIST_SEM,
                  r"need_human|白名单|三类|介入")

    # 锚5 check-size 无参零超限（新条款落 PROTOCOL/roles 须过剃刀 <=40 字）
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, "-I", CHECK_SIZE], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=60, env=env)
    if p.returncode == 0:
        print("  绿 [锚5 check-size零超限] exit 0")
    else:
        FAILED += 1
        print("  红 [锚5 check-size零超限] exit=%d\n%s%s" % (p.returncode, p.stdout, p.stderr))

    if FAILED:
        print("== 结果：红（%d 处未落档，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

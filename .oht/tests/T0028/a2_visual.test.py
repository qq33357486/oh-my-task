"""T0028 A2 红测试：观感验收机器代看落档（检查员锁定，实现员不得改）。

出处 T0028 需求 3（doctrine「观感类验收=机器代看」，2026-11-03）：
  落① PROTOCOL.md TDD 节含「human 条目浏览器截图 + 视觉评审代理判定」语义行
  落② roles/checker.md 含同一语义行（判定流程同步改写）
  落③ PROTOCOL.md TDD 节不再含「human 条目转 need_human 问人选择题」阻塞语义
  落④ roles/checker.md 不再含「human 条目：need_human，问选择题」阻塞语义
  锚⑤ check-size.py 无参零超限（新条款须过剃刀；回归锚点，当前即绿）

断言为语义匹配不锁措辞：每条语义一组候选正则，命中任一即算落档，
落点措辞实现按剃刀压缩（先例 .oht/tests/T0020/a1_discipline.test.py）。
TDD 节限定：PROTOCOL.md「## 验收条目格式（TDD）」至下一「## 」之间。
tests 阶段现状未改：阻塞语义在档（探针 grep 证实 PROTOCOL.md:80、
roles/checker.md:17），截图/视觉评审语义全无 → 落①~落④ 红；锚⑤ 当前即
绿（一并锁定防回归）。人异步抽查，不满意走跟进卡事后纠正。
用法：python -I .oht/tests/T0028/a2_visual.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PROTOCOL = os.path.join(ROOT, ".oht", "PROTOCOL.md")
CHECKER = os.path.join(ROOT, ".oht", "roles", "checker.md")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 每落点一组候选正则（命中任一即算该语义行落档）。
VIS_SEM = [  # 落①落② 截图 + 视觉评审代理判定
    r"视觉评审|机器代看",
    r"截图[^。]*(判定|评审|代看)|(判定|评审|代看)[^。]*截图",
    r"浏览器[^。]*截图|截图[^。]*浏览器",
]
BLOCK_TDD = [  # 落③ TDD 节阻塞语义（不得出现）
    r"由检查员转\s*need_human",
    r"问人一个选择题",
]
BLOCK_CHECKER = [  # 落④ checker.md 阻塞语义（不得出现）
    r"human\s*条目[:：]\s*need_human",
    r"，问选择题",
]

FAILED = 0


def hit(lines, pats):
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                return ln.strip()
    return ""


def tdd_section(lines):
    """取「## 验收条目格式（TDD）」节内容（至下一 ## 一级标题前）。"""
    out, on = [], False
    for ln in lines:
        if re.match(r"^##\s", ln):
            on = bool(re.search(r"验收条目格式", ln))
            continue
        if on:
            out.append(ln)
    return out


def load(path):
    return open(path, encoding="utf-8").read().splitlines()


def check_absent(tag, path, pats, section=False):
    """阻塞语义：命中任一候选即红。"""
    global FAILED
    if not os.path.isfile(path):
        FAILED += 1
        print("  红 [%s] 文件缺失 %s" % (tag, path))
        return
    lines = load(path)
    if section:
        lines = tdd_section(lines)
        if not lines:
            FAILED += 1
            print("  红 [%s] TDD 节定位失败（节头变动）" % tag)
            return
    h = hit(lines, pats)
    if h:
        FAILED += 1
        print("  红 [%s] 仍含阻塞语义: %s" % (tag, h[:70]))
    else:
        print("  绿 [%s] 无阻塞语义行" % tag)


def check_present(tag, path, pats, clue_words, section=False):
    """正语义：候选组命中任一即绿，全不命中红并打印线索。"""
    global FAILED
    if not os.path.isfile(path):
        FAILED += 1
        print("  红 [%s] 文件缺失 %s" % (tag, path))
        return
    lines = load(path)
    if section:
        lines = tdd_section(lines)
        if not lines:
            FAILED += 1
            print("  红 [%s] TDD 节定位失败（节头变动）" % tag)
            return
    h = hit(lines, pats)
    if h:
        print("  绿 [%s] %s" % (tag, h[:70]))
    else:
        FAILED += 1
        print("  红 [%s] 未命中语义行" % tag)
        clue = [l.strip() for l in lines if re.search(clue_words, l, re.I)]
        for c in clue[:5]:
            print("       现有相关行: %s" % c[:70])


def main():
    global FAILED
    print("== T0028 A2 观感验收机器代看落档 ==")
    check_present("落1 PROTOCOL TDD节截图视觉评审判定", PROTOCOL, VIS_SEM,
                  r"human|人看|截图|判定", section=True)
    check_present("落2 checker截图视觉评审判定", CHECKER, VIS_SEM,
                  r"human|截图|判定|need_human")
    check_absent("落3 PROTOCOL TDD节无human转need_human", PROTOCOL, BLOCK_TDD,
                 section=True)
    check_absent("落4 checker无human条目need_human", CHECKER, BLOCK_CHECKER)

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

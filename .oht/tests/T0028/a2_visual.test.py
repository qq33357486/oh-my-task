"""T0028 A2 落档测试：观感验收交人看（人裁决 2026-11-04 改写版）。

doctrine 演进：
  2026-11-03 立「观感类验收=机器代看（视觉评审代理判定）」；
  2026-11-04 人改判「交给人类验收就好了，别在那纠结，可以基于人类的反馈
  去总结经验」——机器代看/视觉评审代理退役，锁定测试随人批准改写
  （先例 T0004/A4：锁定测试改写须人批准）。

现行契约（落①~落⑤）：
  落① PROTOCOL.md TDD 节含「human 条目：截图留证 + need_human 交人验收 +
     反馈记教训」语义行
  落② roles/checker.md 含同一语义（截图留证交人验收步骤 + 反馈记候选教训）
  落③ PROTOCOL.md TDD 节不含旧 doctrine「视觉评审/机器代看」残留
  落④ roles/checker.md 不含旧 doctrine 残留，也不含「问选择题」阻塞语义
  锚⑤ check-size.py 无参零超限（新条款须过剃刀；回归锚点）

断言为语义匹配不锁措辞：每条语义一组候选正则，命中任一即算落档，
落点措辞实现按剃刀压缩（先例 .oht/tests/T0020/a1_discipline.test.py）。
TDD 节限定：PROTOCOL.md「## 验收条目格式（TDD）」至下一「## 」之间。
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
HUMAN_SEM = [  # 落①落② 截图留证 + need_human 交人验收 + 反馈记教训
    r"交人验收",
    r"截图[^。]*留证|留证[^。]*截图",
    r"反馈[^。]*(教训|经验|候选)",
]
BLOCK_OLD = [  # 落③落④ 旧 doctrine 残留（不得出现）
    r"视觉评审|机器代看",
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
    print("== T0028 A2 观感验收交人看落档（人裁决 2026-11-04 版）==")
    check_present("落1 PROTOCOL TDD节截图留证交人验收", PROTOCOL, HUMAN_SEM,
                  r"human|人看|截图|验收", section=True)
    check_present("落2 checker截图留证交人验收+反馈记教训", CHECKER, HUMAN_SEM,
                  r"human|截图|验收|候选")
    check_absent("落3 PROTOCOL TDD节无机器代看残留", PROTOCOL, BLOCK_OLD,
                 section=True)
    check_absent("落4 checker无机器代看残留", CHECKER, BLOCK_OLD)
    check_absent("落4b checker无问选择题阻塞", CHECKER, BLOCK_CHECKER)

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

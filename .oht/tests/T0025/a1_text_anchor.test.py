r"""T0025 A1 红测试：页眉选项卡行高重置文本锚（检查员锁定，实现员不得改）。

病灶 1（T0025 需求）：AntD Layout.Header 默认 line-height: 64px 被
.app-header__views 胶囊与 .app-header__view-btn（height: 28px）继承，
行盒与 28px 内容区错位，文字不垂直居中。

分层依据（T0019 教训，卡面明写）：vitest 不应用 CSS、jsdom 无布局，
计算样式不可测 → auto 锚一律断言 app/src/index.css 文本（沿用
cssTokens.test.ts 的 ruleBlock 文本锚先例，此处以 python 落 .oht/tests/）。

覆盖：
  A1-1 .app-header__views 规则块含 align-items: center 与 line-height: 1
       （切断 64px 继承；flex 使胶囊整体垂直居中于页眉）
  A1-2 .app-header__view-btn 基础规则块（正则 \.app-header__view-btn\s*\{，
       选择器后紧随 {，天然排除 :hover / --active / :focus-visible 后缀）
       含 line-height: 28px 与 white-space: nowrap

候选正则组（不锁措辞顺序，只锁声明存在）；命中失败时打印现有规则块
辅助定位。tests 阶段现状（探针 grep 证实）：两块均无行高声明 → 红。
并行泳道注记：T0030 在改同批 CSS，若跑出绿以实跑结果为准（实现归属以其卡为准）。
用法：python -I .oht/tests/T0025/a1_text_anchor.test.py   （cwd 任意）
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CSS = os.path.join(ROOT, "app", "src", "index.css")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FAILED = 0

# 候选正则组：块内命中任一即算该声明落档（允许空格/分号书写差异）
ALIGN_CENTER = [r"align-items:\s*center"]
LH_1 = [r"line-height:\s*1(?![.\d])"]  # 1 整数，排除 1.7 / 16px 误命中
LH_28 = [r"line-height:\s*28px"]
NOWRAP = [r"white-space:\s*nowrap"]


def rule_blocks(css, selector_re):
    r"""全部匹配 selector_re（须自带 \s*\{ 边界）的规则块文本，花括号配对取块。"""
    blocks = []
    for m in re.finditer(selector_re, css):
        try:
            i = css.index("{", m.end() - 1)
        except ValueError:
            continue
        depth, j = 0, i
        while j < len(css):
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        blocks.append(css[m.start():j + 1])
    return blocks


def block_hit(block, pats):
    for p in pats:
        if re.search(p, block):
            return True
    return False


def check_block(tag, selector_re, wants, what):
    """规则块存在 + 块内各声明组命中；红时打印现有块辅助定位。"""
    global FAILED
    css = open(CSS, encoding="utf-8").read()
    blocks = rule_blocks(css, selector_re)
    if not blocks:
        FAILED += 1
        print("  红 [%s] index.css 无匹配 %s 的规则块" % (tag, selector_re))
        needle = selector_re.split("\\s")[0][1:].replace("\\", "")
        clue = [l.strip() for l in css.splitlines() if needle in l]
        for c in clue[:3]:
            print("       现有相关行: %s" % c[:70])
        return
    block = blocks[0]
    missing = [name for name, pats in wants if not block_hit(block, pats)]
    if not missing:
        print("  绿 [%s] %s" % (tag, what))
    else:
        FAILED += 1
        print("  红 [%s] %s 缺：%s" % (tag, what, "、".join(missing)))
        for ln in block.splitlines():
            print("       现有块行: %s" % ln.strip()[:70])


def main():
    global FAILED
    print("== T0025 A1 页眉选项卡行高重置文本锚 ==")
    if not os.path.isfile(CSS):
        FAILED += 1
        print("  红 [文件] 缺 %s" % CSS)
    else:
        check_block(
            "A1-1 views行高重置", r"\.app-header__views\s*\{",
            [("align-items:center", ALIGN_CENTER), ("line-height:1", LH_1)],
            ".app-header__views 含 align-items:center + line-height:1")
        check_block(
            "A1-2 view-btn行高nowrap", r"\.app-header__view-btn\s*\{",
            [("line-height:28px", LH_28), ("white-space:nowrap", NOWRAP)],
            ".app-header__view-btn 基础块含 line-height:28px + white-space:nowrap")

    if FAILED:
        print("== 结果：红（%d 处，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

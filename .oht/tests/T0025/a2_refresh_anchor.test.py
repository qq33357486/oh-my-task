r"""T0025 A2 红测试：刷新按钮锁宽与 className 文本锚（检查员锁定，实现员不得改）。

病灶 2（T0025 需求）：App.tsx 刷新 <Button loading={loading}> 触发 loading
时插入图标（约 14px + 8px 间距），按钮约 60px→82px 变宽；页眉 flex
space-between 右缘固定，左侧选项卡每 5 秒轮询被挤抖一次。

分层依据（T0019 教训，卡面明写）：jsdom 无布局 → 断言 index.css / App.tsx
文本，不碰计算样式。

覆盖：
  A2-1 index.css 含 .app-header .ant-btn.app-header__refresh 基础规则块
       （正则 \.app-header\s+\.ant-btn\.app-header__refresh\s*\{，须紧随 {，
       不把 :hover 等伪类变体当基础块）且块内含 min-width: 88px
       （88px ≥ loading 态实宽约 82px，两态等宽零位移；不碰既有 ghost
       选择器 .app-header .ant-btn:not(.app-header__view-btn)，本测不断言
       ghost 选择器，只验新规则存在）
  A2-2 App.tsx 存在一个 <Button ...> 开标签同时含 loading={loading} 与
       className="app-header__refresh"（同属刷新 Button 标签；加载态属性
       定位刷新按钮，className 须加在同一标签上）

tests 阶段现状（探针 grep 证实）：CSS 无该规则、App.tsx:207 刷新 Button
无 className → 红。并行泳道注记：T0030 在改同批 CSS，若跑出绿以实跑
结果为准（实现归属以其卡为准）。
用法：python -I .oht/tests/T0025/a2_refresh_anchor.test.py   （cwd 任意）
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CSS = os.path.join(ROOT, "app", "src", "index.css")
TSX = os.path.join(ROOT, "app", "src", "App.tsx")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FAILED = 0

REFRESH_RULE = r"\.app-header\s+\.ant-btn\.app-header__refresh\s*\{"
MIN_WIDTH_88 = [r"min-width:\s*88px"]
# 开标签（[^>] 可跨行匹配 JSX 多行属性）；三要素同标签才算过
BUTTON_TAG = re.compile(r"<Button\b[^>]*>")


def rule_block(css, selector_re):
    """首个匹配 selector_re 的规则块（花括号配对），无则 None。"""
    m = re.search(selector_re, css)
    if not m:
        return None
    i = css.index("{", m.end() - 1)
    depth, j = 0, i
    while j < len(css):
        if css[j] == "{":
            depth += 1
        elif css[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    return css[m.start():j + 1]


def main():
    global FAILED
    print("== T0025 A2 刷新按钮锁宽与 className 文本锚 ==")

    # A2-1 CSS 锁宽规则
    if not os.path.isfile(CSS):
        FAILED += 1
        print("  红 [A2-1 min-width锁宽] 缺 %s" % CSS)
    else:
        css = open(CSS, encoding="utf-8").read()
        block = rule_block(css, REFRESH_RULE)
        if block is None:
            FAILED += 1
            print("  红 [A2-1 min-width锁宽] index.css 无 "
                  ".app-header .ant-btn.app-header__refresh 基础规则块")
            clue = [l.strip() for l in css.splitlines() if "app-header__refresh" in l]
            for c in clue[:3]:
                print("       现有相关行: %s" % c[:70])
        elif not any(re.search(p, block) for p in MIN_WIDTH_88):
            FAILED += 1
            print("  红 [A2-1 min-width锁宽] 规则块缺 min-width: 88px")
            for ln in block.splitlines():
                print("       现有块行: %s" % ln.strip()[:70])
        else:
            print("  绿 [A2-1 min-width锁宽] refresh 规则块含 min-width: 88px")

    # A2-2 App.tsx 刷新 Button 标签 className
    if not os.path.isfile(TSX):
        FAILED += 1
        print("  红 [A2-2 refresh className] 缺 %s" % TSX)
    else:
        tsx = open(TSX, encoding="utf-8").read()
        tags = [m.group(0) for m in BUTTON_TAG.finditer(tsx)]
        hit = [t for t in tags
               if "loading={loading}" in t and 'className="app-header__refresh"' in t]
        if hit:
            print("  绿 [A2-2 refresh className] 刷新 Button 标签含 "
                  'className="app-header__refresh"')
        else:
            FAILED += 1
            print("  红 [A2-2 refresh className] 无 <Button> 开标签同时含 "
                  "loading={loading} 与 className=\"app-header__refresh\"")
            for t in tags:
                if "loading={loading}" in t:
                    print("       现有刷新标签: %s" % " ".join(t.split())[:90])

    if FAILED:
        print("== 结果：红（%d 处，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

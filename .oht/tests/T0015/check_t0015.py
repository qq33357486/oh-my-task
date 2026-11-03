"""T0015 红测试：.oht 卡层（验收条目 A1、A2）。检查员锁定，实现员不得改。

覆盖：
  A1a  缺 title 的卡：check-card 单卡模式须报错（exit 非 0）
  A1b  title 超 24 字的卡：check-card 单卡模式须报错（exit 非 0）
  A1c  tasks/_template.md frontmatter 须含非空 title 字段示例
  A2a  存量卡（tasks/*.md）frontmatter 须含非空、≤24 字、单行的 title
  A2b  无参 check-card 全仓零超限（exit 0；A2 条目字面验收）

tests 阶段现状：check-card 无 title 校验、模板与存量卡均无 title 字段
→ A1a/A1b/A1c/A2a 红（A2b 当前即绿，作为回归锚点一并锁定）。
A3（看板主显 title）为 app 集成测试，入口见同目录 check_t0015_board.sh。
实现完成后两个入口都应全绿（退出码 0）。
用法：python -I .oht/tests/T0015/check_t0015.py   （cwd 任意）
"""
import glob
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))  # 仓库根
CHECK_CARD = os.path.join(ROOT, ".oht", "scripts", "check-card.py")
TEMPLATE = os.path.join(ROOT, ".oht", "tasks", "_template.md")

# 最小合法卡：status=new 无需验收条目；system 留空避免单卡模式下查系统文档。
HEAD = """---
id: T9999A
type: ""
status: new
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
测试

## 需求
测试

## 复述卡
测试

## 验收条目

## 系统文档改动

## 进度

## 失败原因

## 候选教训

## 人的回复
"""

# 26 个汉字，> 24 字上限。
LONG_TITLE = "一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳"


def run_check_card(card_text):
    """写临时卡到嵌套临时目录（保证 check-card 推导出的 ROOT 完全隔离），跑单卡模式。"""
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "cards", "T9999A.md")
        os.makedirs(os.path.dirname(p))
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(card_text)
        env = dict(os.environ)
        # 注意：-I 隐含 -E，会忽略 PYTHONIOENCODING 等环境变量，
        # 故用命令行 -X utf8（不受 -E 影响）保证子进程 stdout 为 UTF-8。
        return subprocess.run(
            [sys.executable, "-I", "-X", "utf8", CHECK_CARD, p],
            capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
        )


def assert_rejected(r, what):
    """断言 check-card 正常执行且拒绝了该卡。

    先查 stdout 含总结行“超限”，防止把“脚本没跑起来”（如路径错、解释器失败）
    误判成校验报错；再查退出码非 0。
    """
    assert "超限" in r.stdout, (
        f"check-card 未正常执行（{what}）：exit={r.returncode}\n{r.stdout}{r.stderr}"
    )
    assert r.returncode != 0, f"{what}未被拒绝：exit=0\n{r.stdout}{r.stderr}"


def a1a_missing_title_rejected():
    """缺 title 的最小合法卡必须被 check-card 拒绝。"""
    r = run_check_card(HEAD)
    assert_rejected(r, "缺 title 的卡")


def a1b_overlong_title_rejected():
    """title 超 24 字的卡必须被 check-card 拒绝。"""
    r = run_check_card(HEAD.replace('status: new\n', f'status: new\ntitle: {LONG_TITLE}\n'))
    assert_rejected(r, f"title 超 24 字（{len(LONG_TITLE)} 字）的卡")


def a1_template_has_title_example():
    """_template.md frontmatter 必须含非空 title 字段示例。"""
    t = open(TEMPLATE, encoding="utf-8").read()
    m = re.match(r"---\n(.*?)\n---\n", t, re.S)
    assert m, "模板缺 frontmatter"
    assert re.search(r"^title:\s*\S", m.group(1), re.M), "模板 frontmatter 缺 title 字段示例"


TASKS_DIR = os.path.join(ROOT, ".oht", "tasks")
TITLE_MAX = 24


def a2_existing_cards_have_valid_title():
    """每张存量卡的 frontmatter 须含非空、≤24 字、单行的 title。"""
    problems = []
    for f in sorted(glob.glob(os.path.join(TASKS_DIR, "*.md"))):
        name = os.path.basename(f)
        if name.startswith("_"):
            continue
        t = open(f, encoding="utf-8").read().replace("\r\n", "\n")
        m = re.match(r"---\n(.*?)\n---\n", t, re.S)
        if not m:
            problems.append(f"{name} 缺 frontmatter")
            continue
        tm = re.search(r'^title:(.*)$', m.group(1), re.M)
        if not tm:
            problems.append(f"{name} 缺 title")
            continue
        v = tm.group(1).strip().strip('"').strip("'")
        if not v:
            problems.append(f"{name} title 为空")
        elif len(v) > TITLE_MAX:
            problems.append(f"{name} title {len(v)} 字 > {TITLE_MAX}")
    assert not problems, "存量卡 title 不合规：\n      " + "\n      ".join(problems)


def a2_full_repo_check_passes():
    """无参 check-card 全仓零超限（A2 条目字面验收）。"""
    env = dict(os.environ)
    r = subprocess.run(
        [sys.executable, "-I", "-X", "utf8", CHECK_CARD],
        capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
    )
    assert "超限" in r.stdout, f"check-card 未正常执行：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert r.returncode == 0, f"全仓检查有超限：exit={r.returncode}\n{r.stdout}{r.stderr}"


def main():
    # Windows 控制台常为 GBK：重配输出避免打印异常信息时崩脚本（cwd/终端任意可跑）。
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    checks = [
        ("A1a 缺title卡被check-card拒绝", a1a_missing_title_rejected),
        ("A1b 超24字title卡被check-card拒绝", a1b_overlong_title_rejected),
        ("A1c 模板含title字段示例", a1_template_has_title_example),
        ("A2a 存量卡含合规title", a2_existing_cards_have_valid_title),
        ("A2b 无参check-card全仓零超限", a2_full_repo_check_passes),
    ]
    bad = 0
    for name, fn in checks:
        try:
            fn()
            print(f"GREEN {name}")
        except AssertionError as e:
            bad += 1
            msg = str(e).replace("\n", "\n      ")
            print(f"RED   {name}\n      {msg}")
        except Exception as e:  # 环境错误也按红计，不让脚本静默通过
            bad += 1
            print(f"ERROR {name}\n      {type(e).__name__}: {e}")
    print(f"红 {bad} / {len(checks)}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

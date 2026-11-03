"""T0033 A4 改写（2026-11-04 人直批直改）：唤醒链路改纯提示词——定时器到点
注入调度令句，入口分流到调度员；不再有脚本唤醒入口。

出处：同 a3（人原话「工具只需要知道如何创建定时器……其他的它自己会去
搞定」）。唤醒 = 一句提示词，宿主定时器原生注入；接待定稿即止，要即时
唤醒就由宿主后台拉起同一句。

锁定契约：
  A4-1 入口分流：.oht/AGENTS.md 含「首条消息带「调度令」」判定、
       指派角色路由行、「定稿即止…调度令」即时唤醒行。
  A4-2 唤醒句定稿：dispatcher.md 与 README.md 均含完整调度令句
       「调度令：读 .oht/AGENTS.md 并照做。」；dispatcher.md 含定时器
       注入语义。
  A4-3 上手指引：README 含三步上手（安装/建定时器/提需求）与频率建议
       （10~30 分钟）。
  A4-4 不回归：PROTOCOL.md 仍含「定时器与人的消息同为触发器」。
  A4-5 无脚本残留：框架文档与 README 无 dispatch-worker 引用。

红因（改前）：唤醒条款全部指向 bash dispatch-worker.sh dispatcher →
A4-1/2/3/5 红；A4-4 旧绿锚保持。
用法：python -I .oht/tests/T0033/a4_wake_chain.test.py   （cwd 任意）
"""
import glob
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
ENTRY_MD = os.path.join(ROOT, ".oht", "AGENTS.md")
DISPATCHER_MD = os.path.join(ROOT, ".oht", "roles", "dispatcher.md")
PROTOCOL_MD = os.path.join(ROOT, ".oht", "PROTOCOL.md")
README = os.path.join(ROOT, "README.md")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

WAKE_SENTENCE = "调度令：读 .oht/AGENTS.md 并照做。"

DOC_FILES = [ENTRY_MD, PROTOCOL_MD, DISPATCHER_MD, README] \
    + sorted(glob.glob(os.path.join(ROOT, ".oht", "roles", "*.md"))) \
    + sorted(glob.glob(os.path.join(ROOT, ".oht", "knowledge", "topics", "*.md")))

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def read(path):
    return open(path, encoding="utf-8", errors="replace").read()


def check_entry():
    txt = read(ENTRY_MD)
    if "首条消息带「调度令」" in txt:
        ok("[入口分流] 调度令判定行在位")
    else:
        fail("[入口分流] 缺「首条消息带「调度令」」判定行")
    if "指派角色的会话按指派走" in txt:
        ok("[入口分流] 指派角色路由行在位")
    else:
        fail("[入口分流] 缺指派角色路由行（派发的工作者会被误路由到咨询员）")
    if re.search(r"定稿即止[^。\n]{0,30}调度令", txt):
        ok("[入口分流] 定稿即止 + 即时唤醒调度令行在位")
    else:
        fail("[入口分流] 缺「定稿即止…调度令」即时唤醒行")


def check_wake_sentence():
    for path, label in ((DISPATCHER_MD, "dispatcher.md"), (README, "README.md")):
        txt = read(path)
        if WAKE_SENTENCE in txt:
            ok("[唤醒句] %s 含完整调度令句" % label)
        else:
            fail("[唤醒句] %s 缺调度令句「%s」" % (label, WAKE_SENTENCE))
    txt = read(DISPATCHER_MD)
    if re.search(r"定时器到点注入", txt):
        ok("[唤醒句] dispatcher.md 含定时器注入语义")
    else:
        fail("[唤醒句] dispatcher.md 缺定时器注入语义")


def check_quickstart():
    txt = read(README)
    if "三步上手" in txt and re.search(r"建定时器[^。\n]{0,60}提示词", txt):
        ok("[上手指引] README 含三步上手（建定时器步骤在位）")
    else:
        fail("[上手指引] README 缺三步上手或建定时器步骤")
    if "10~30 分钟" in txt:
        ok("[上手指引] README 含频率建议")
    else:
        fail("[上手指引] README 缺频率建议")


def check_no_regression():
    txt = read(PROTOCOL_MD)
    if "定时器与人的消息同为触发器" in txt:
        ok("[不回归] PROTOCOL「定时器与人的消息同为触发器」在位")
    else:
        fail("[不回归] PROTOCOL 缺「定时器与人的消息同为触发器」")


def check_no_residue():
    bad = []
    for path in DOC_FILES:
        if os.path.isfile(path) and re.search(r"dispatch-worker", read(path)):
            bad.append(os.path.relpath(path, ROOT))
    if bad:
        fail("[无脚本残留] 仍引用 dispatch-worker：%s" % "、".join(bad))
    else:
        ok("[无脚本残留] 框架文档与 README 无 dispatch-worker 引用")


def main():
    global FAILED
    print("== T0033 A4 唤醒链路（提示词契约）==")
    check_entry()
    check_wake_sentence()
    check_quickstart()
    check_no_regression()
    check_no_residue()
    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

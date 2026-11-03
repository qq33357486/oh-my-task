"""T0033 A4 红测试：调度员唤醒链路落地（咨询员 authored，实现员不得改）。

出处 T0033 需求 ④（人原话：可以单独开会话提需求，提完需求，等调度员那边
被唤醒，就会分派任务——但调度员无唤醒机制，落不了地。修法技术取舍咨询员
定：不新造常驻进程，以 dispatch-worker.sh 的 dispatcher 无卡号调用为唯一
唤醒入口，接待会话建卡后即拉起，定时唤醒走同一入口）。

锁定契约（提示词与脚本规格，见卡「需求」节）：
  A4-1 唤醒调用：bash .oht/scripts/dispatch-worker.sh dispatcher（无卡号，
       ZCODE_BIN 指 stub）→ exit 0；stub 收到的提示词含「dispatcher」与
       .oht/roles/dispatcher.md 路径；日志 .oht/local/w-dispatcher.log 同步生成
  A4-2 接待建卡后唤醒：入口 AGENTS.md 含「定稿后唤醒调度员」条款（批2 迁自 dispatcher-intake）
       （语义匹配：唤醒/拉起调度员 + dispatch-worker 脚本引用）
  A4-3 调度员文档自洽：dispatcher.md 含 dispatcher 唤醒用法（含
       dispatch-worker 与 dispatcher 同现）与定时唤醒同入口条款
       （定时…唤醒…同一脚本/入口语义）；旧参数序
       `dispatch-worker.sh <卡号> <角色>` 应已改写为 `<角色> [卡号]`
       （旧序无法表达无卡号唤醒，不得残留）

红因（修前）：脚本不存在 → A4-1 红；dispatcher-intake.md 无唤醒条款、
dispatcher.md 无 dispatcher 唤醒与定时条款且残留旧参数序 → A4-2/A4-3 红。
用法：python -I .oht/tests/T0033/a4_wake_chain.test.py   （cwd 任意）
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SCRIPT = os.path.join(ROOT, ".oht", "scripts", "dispatch-worker.sh")
INTAKE = os.path.join(ROOT, ".oht", "AGENTS.md")  # 批2：intake 退役，唤醒条款迁入口四分法
DISPATCHER_MD = os.path.join(ROOT, ".oht", "roles", "dispatcher.md")
LOG = os.path.join(ROOT, ".oht", "local", "w-dispatcher.log")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

STUB_SH = "#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" >> \"$T0033_STUB_LOG\"\n"

# A4-2/A4-3 语义匹配正则组（不锁措辞，先例 T0032/a2）
INTAKE_WAKE = [  # 建卡后唤醒调度员（语义）
    r"建卡后[^。\n]{0,30}(唤醒|拉起|后台拉起)",
    r"(唤醒|拉起)调度员",
]
INTAKE_CMD = [  # 唤醒命令落档
    r"dispatch-worker\.sh\s+dispatcher",
    r"dispatch-worker\.sh[^。\n]{0,40}dispatcher",
]
MD_WAKE = [  # dispatcher 唤醒用法
    r"dispatch-worker\.sh\s+dispatcher",
    r"唤醒调度员[^。\n]{0,60}dispatch-worker",
    r"dispatch-worker[^。\n]{0,40}唤醒",
]
MD_TIMER = [  # 定时唤醒同入口
    r"定时[^。\n]{0,40}(dispatch-worker|同一脚本|同一入口|同入口)",
    r"(dispatch-worker|同一脚本|同一入口)[^。\n]{0,40}定时",
]
MD_NEW_USAGE = [  # 新参数序 <角色> [卡号]
    r"dispatch-worker\.sh\s*<?角色>\s*\[?卡号\]?",
    r"dispatch-worker\.sh\s*<角色>",
]
MD_OLD_USAGE = [  # 反向断言：旧参数序残留即红（无法表达无卡号唤醒）
    r"dispatch-worker\.sh\s*<卡号>\s*<角色>",
]

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def first_hit(txt, pats):
    for p in pats:
        m = re.search(p, txt)
        if m:
            return m.group(0)
    return ""


def run_bash(args, env_extra=None, timeout=30):
    env = dict(os.environ)
    if env_extra:
        env.update(env_extra)
    return subprocess.run(["bash"] + args, cwd=ROOT, capture_output=True,
                          text=True, encoding="utf-8", errors="replace",
                          timeout=timeout, env=env)


def check_wake_call():
    tmp = tempfile.mkdtemp(prefix="t0033_wake_")
    stub = os.path.join(tmp, "fake-zcode.sh")
    stub_log = os.path.join(tmp, "calls.log")
    with open(stub, "w", encoding="utf-8", newline="\n") as f:
        f.write(STUB_SH)
    os.chmod(stub, 0o755)
    try:
        if not os.path.isfile(SCRIPT):
            fail("[唤醒调用] dispatch-worker.sh 缺失，dispatcher 无法被唤醒")
            fail("[提示词组装] 脚本缺失，跳过（红随上）")
            fail("[唤醒日志] 脚本缺失，跳过（红随上）")
            return
        r = run_bash([".oht/scripts/dispatch-worker.sh", "dispatcher"],
                     env_extra={"ZCODE_BIN": stub, "T0033_STUB_LOG": stub_log})
        if r.returncode != 0:
            fail("[唤醒调用] dispatcher 无卡号调用 exit=%d 应为 0：%s"
                 % (r.returncode, (r.stderr or "").strip()[:200]))
            return
        ok("[唤醒调用] dispatcher 无卡号调用 exit 0")
        deadline = time.time() + 8
        calls = ""
        while time.time() < deadline and not os.path.isfile(stub_log):
            time.sleep(0.2)
        if os.path.isfile(stub_log):
            calls = open(stub_log, encoding="utf-8", errors="replace").read()
        if "dispatcher" in calls and ".oht/roles/dispatcher.md" in calls:
            ok("[提示词组装] stub 收到调度员提示词（含角色与 roles/dispatcher.md 路径）")
        else:
            fail("[提示词组装] 提示词缺 dispatcher 角色或 roles 路径：%s" % calls.strip()[:200])
        if os.path.isfile(LOG) and "dispatcher" in open(LOG, encoding="utf-8",
                                                        errors="replace").read():
            ok("[唤醒日志] .oht/local/w-dispatcher.log 同步生成")
        else:
            fail("[唤醒日志] .oht/local/w-dispatcher.log 缺失（须同步写头部）")
    finally:
        if os.path.isfile(LOG):
            os.remove(LOG)
        shutil.rmtree(tmp, ignore_errors=True)


def check_prompts():
    for path, label, groups in (
        (INTAKE, "入口 AGENTS.md 建卡后唤醒条款（批2 迁自 dispatcher-intake）",
         [("唤醒语义", INTAKE_WAKE), ("唤醒命令", INTAKE_CMD)]),
        (DISPATCHER_MD, "dispatcher.md 唤醒与定时条款",
         [("dispatcher唤醒用法", MD_WAKE), ("定时唤醒同入口", MD_TIMER),
          ("新参数序<角色>[卡号]", MD_NEW_USAGE)]),
    ):
        if not os.path.isfile(path):
            fail("[%s] 文件缺失 %s" % (label, path))
            continue
        txt = open(path, encoding="utf-8").read()
        for name, pats in groups:
            hit = first_hit(txt, pats)
            if hit:
                ok("[%s|%s] %s" % (label, name, hit[:60]))
            else:
                fail("[%s|%s] 未命中语义行（修前无此条款，应红）" % (label, name))
    if os.path.isfile(DISPATCHER_MD):
        txt = open(DISPATCHER_MD, encoding="utf-8").read()
        old = first_hit(txt, MD_OLD_USAGE)
        if old:
            fail("[dispatcher.md|无旧参数序] 残留旧参数序：%s（无法表达无卡号唤醒）" % old)
        else:
            ok("[dispatcher.md|无旧参数序] 旧参数序 <卡号> <角色> 已改写")


def main():
    global FAILED
    print("== T0033 A4 调度员唤醒链路 ==")
    check_wake_call()
    check_prompts()
    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

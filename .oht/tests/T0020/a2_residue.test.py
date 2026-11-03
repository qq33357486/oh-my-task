"""T0020 A2 红测试：.oht/tests/ 唤醒调用残留清零（检查员锁定，实现员不得改）。

三禁语境（T0020 需求 2）：测试与干活由在途工作者自跑用例，不新起 z-code 实例、
不做沙盒唤醒；T0010 时代的真唤醒 harness（z-code CLI 子进程）须按 T0018 退役
先例（run_t0018.py 桩形态：superseded 说明 + 不再执行 + exit 0）收缩。

覆盖：
  A2-1 全 .oht/tests/ 扫描，无 z-code CLI/子进程唤醒调用残留。判残留：
       a) 含唤醒机制专属环境变量名（OHT_T0010_ 前缀的 BIN/CONFIG/MODEL/TIMEOUT）
       b) 裸 z-code 词元（排除 .zcode 配置目录提及）与 subprocess/Popen 同文件共存
          ——共存=调用语境；仅历史叙述提及不判（桩 docstring 允许留出处）。
  A2-2 run_t0010.py 桩运行：exit 0 且 stdout 含 superseded 说明。
       守三禁执行策略：先静态预检，文件仍含 subprocess/Popen 或唤醒环境变量
       → 判红"未桩化"且【不执行】（真跑会起新 CLI 实例烧外部模型额度，恰是
       本卡所禁）；仅当静态无调用形态时才真跑验证桩行为。

豁免：.oht/tests/T0020/ 自目录不扫——本卡测试写好即锁定，内容是断言工具
（正则字面量自含触发词），非被清扫对象。

tests 阶段现状（探针证实）：run_t0010.py 含 subprocess + 裸 z-code + 唤醒环境
变量（真唤醒 harness 在役）→ A2-1/A2-2 红。
用法：python -I .oht/tests/T0020/a2_residue.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TESTS = os.path.dirname(HERE)
RUN_T0010 = os.path.join(TESTS, "T0010", "run_t0010.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 触发词拼接书写，避免本文件文本自含连续词元（自目录虽豁免，双保险）。
WAKE_ENV = re.compile(r"OHT_T0010_(ZCODE|WAKE_TIMEOUT|SUBAGENT_MODEL|ZCODE_BIN|BUILTIN)")
BARE = re.compile("(?<![.\\w])zc" + "ode", re.I)
SPAWN = re.compile(r"subprocess|Popen")

FAILED = 0


def scan_residue():
    """A2-1：扫 .oht/tests/ 全树（豁免 T0020 自目录），返回 [(path, 命中原因, 行)]。"""
    hits = []
    for dirpath, dirs, files in os.walk(TESTS):
        dirs[:] = [d for d in dirs if d != "__pycache__" and d != "T0020"]
        for fn in sorted(files):
            if not fn.endswith((".py", ".sh", ".md")):
                continue
            p = os.path.join(dirpath, fn)
            lines = open(p, encoding="utf-8", errors="replace").read().splitlines()
            has_spawn = any(SPAWN.search(l) for l in lines)
            for i, l in enumerate(lines, 1):
                why = ""
                if WAKE_ENV.search(l):
                    why = "唤醒机制环境变量"
                elif BARE.search(l) and has_spawn:
                    why = "裸z-code与子进程调用共存"
                if why:
                    hits.append((os.path.relpath(p, TESTS), why, "%d: %s" % (i, l.strip()[:70])))
    return hits


def main():
    global FAILED
    print("== T0020 A2 唤醒调用残留清零 ==")

    hits = scan_residue()
    if hits:
        FAILED += 1
        print("  红 [A2-1 残留清零] %d 处：" % len(hits))
        for p, why, ln in hits:
            print("       %s（%s）%s" % (p, why, ln))
    else:
        print("  绿 [A2-1 残留清零] .oht/tests/ 无 z-code CLI/子进程唤醒调用")

    # A2-2 run_t0010.py 桩运行（静态预检不过则判红不执行——守三禁）
    text = open(RUN_T0010, encoding="utf-8", errors="replace").read()
    if SPAWN.search(text) or WAKE_ENV.search(text):
        FAILED += 1
        print("  红 [A2-2 桩运行] run_t0010.py 未桩化（仍含子进程唤醒调用形态），"
              "为守三禁不执行真唤醒；应按 run_t0018.py 先例收缩为"
              " superseded 说明 + 不再执行 + exit 0")
    else:
        p = subprocess.run([sys.executable, "-I", RUN_T0010], cwd=HERE,
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=120)
        out = p.stdout or ""
        if p.returncode == 0 and re.search("superseded", out, re.I):
            print("  绿 [A2-2 桩运行] exit=0，superseded 说明已打印")
        else:
            FAILED += 1
            print("  红 [A2-2 桩运行] exit=%d stdout=%r stderr=%r"
                  % (p.returncode, out[:120], (p.stderr or "")[:120]))

    if FAILED:
        print("== 结果：红（%d 处，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

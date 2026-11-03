"""T0031 A4 红测试：回归锚（检查员锁定，实现员不得改）。

出处 T0031 需求 6。断言为语义匹配不锁措辞（先例 T0020/a1_discipline.test.py）。

覆盖：
  A4-1 check-card 无参 exit 0（卡面结构回归锚）
  A4-2 check-size 无参 exit 0（剃刀回归锚）
  A4-3 lock_a1/lock_a2 桩运行 exit 0 且输出含 superseded/退役 桩声明
       （T0018 锁快测 12 项按批准变更桩化退役，docstring 注明承接映射：
       互斥→台账、活性→判滞；NOTICE 措辞不锁，认声明词——先例 run_t0010.py）
  【不列入本卡绿门】app vitest 与 tsc：并行泳道 T0030（app capNodeCards）设计红
       在途，本阶段跑之必得与本职无关的红；按卡 A4「受并行泳道设计红影响时按
       归属注记」与本卡 TDD 门禁，实现完成后由检查员 review 阶段全量复核
       （cd app && npx vitest run && npx tsc --noEmit），不在本文件断言。

tests 阶段现状（2026-11-03 实测）：
  A4-1/A4-2 现行即绿（回归锚，如实锁定；并行泳道落盘瞬间可能瞬时红——已实测
  T0032 落盘中 check-card/check-size 一过性红，红归属当刻写入方，以本卡
  review 复跑为准）；
  A4-3 红——lock_a1/lock_a2 现行 exit 0 是活机制绿（T0018 全绿）而非桩绿，
  输出无 superseded/退役 声明；红项归属需求 6 桩化实现项，实现后转绿。
用法：python -I .oht/tests/T0031/a4_regression.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CHECK_CARD = os.path.join(ROOT, ".oht", "scripts", "check-card.py")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")
LOCK_STUBS = [
    os.path.join(ROOT, ".oht", "tests", "T0018", "lock_a1.test.py"),
    os.path.join(ROOT, ".oht", "tests", "T0018", "lock_a2.test.py"),
]

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def run_no_arg(script):
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    return subprocess.run([sys.executable, "-I", "-X", "utf8", script], cwd=ROOT,
                          capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=120, env=env)


def check_script_exit0(label, script):
    p = run_no_arg(script)
    if p.returncode == 0:
        ok("[%s] exit=0 %s" % (label, (p.stdout or "").strip().splitlines()[-1:]))
    else:
        fail("[%s] exit=%d\n%s%s" % (label, p.returncode, p.stdout, p.stderr))


def check_lock_stub(path):
    name = os.path.basename(path)
    if not os.path.isfile(path):
        fail("[lock桩运行 %s] 文件缺失 %s" % (name, path))
        return
    p = run_no_arg(path)
    out = (p.stdout or "") + (p.stderr or "")
    if p.returncode == 0 and re.search(r"superseded|退役|桩化|不再执行", out, re.I):
        ok("[lock桩运行 %s] exit=0，桩声明在" % name)
    elif p.returncode == 0:
        fail("[lock桩运行 %s] exit=0 但为活机制绿（输出无 superseded/退役 声明，"
             "未桩化）" % name)
    else:
        fail("[lock桩运行 %s] exit=%d（预期 0+桩声明）\n%s%s"
             % (name, p.returncode, p.stdout, p.stderr))


def main():
    print("== T0031 A4 回归锚 ==")
    check_script_exit0("check-card无参exit0", CHECK_CARD)
    check_script_exit0("check-size无参exit0", CHECK_SIZE)
    for path in LOCK_STUBS:
        check_lock_stub(path)

    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1；app vitest/tsc 不在本卡绿门，"
              "review 阶段全量复核）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

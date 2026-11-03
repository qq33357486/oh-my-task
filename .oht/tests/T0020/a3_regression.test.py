"""T0020 A3 回归锚点测试（检查员锁定，实现员不得改）。

本条为回归锚点（T0020 需求 3），不针对新实现，tests 阶段即应绿（T0015 先例：
锚点不强行造红，一并锁定防回归）：
  A3-1 check-card.py 无参 exit 0（卡面格式零超限）
  A3-2 check-size.py 无参 exit 0（剃刀零超限）
  A3-3 lock_a1.test.py exit 0（7 项）
  A3-4 lock_a2.test.py exit 0（5 项）
  A3-5 cd app && npx vitest run 全量 exit 0

已知并行事实（2026-11-03 tests 阶段）：T0019 实现员在途改 app/（画布视图），
其自有测试 flowView.test.tsx「T0019/A4」红——属并行 T0019 中间态，不计入本卡
（先例：T0016 检查员处理 T0015 并行红）。本测试照实跑全量不排除；review 复跑
时若 T0019 已 done 应全绿。
用法：python -I .oht/tests/T0020/a3_regression.test.py   （cwd 任意）
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
APP = os.path.join(ROOT, "app")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FAILED = 0


def run(cmd, cwd, timeout):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout)


def check(tag, proc, note=""):
    global FAILED
    if proc.returncode == 0:
        print("  绿 [%s] exit 0 %s" % (tag, note))
    else:
        FAILED += 1
        tail = ((proc.stdout or "") + (proc.stderr or "")).strip().splitlines()
        print("  红 [%s] exit=%d %s" % (tag, proc.returncode, note))
        for l in tail[-8:]:
            print("       " + l.strip()[:90])


def main():
    print("== T0020 A3 回归锚点 ==")
    check("A3-1 check-card", run([sys.executable, "-I", os.path.join(ROOT, ".oht", "scripts", "check-card.py")], ROOT, 120))
    check("A3-2 check-size", run([sys.executable, "-I", os.path.join(ROOT, ".oht", "scripts", "check-size.py")], ROOT, 120))
    check("A3-3 lock_a1(7)", run([sys.executable, "-I", os.path.join(ROOT, ".oht", "tests", "T0018", "lock_a1.test.py")], ROOT, 120))
    check("A3-4 lock_a2(5)", run([sys.executable, "-I", os.path.join(ROOT, ".oht", "tests", "T0018", "lock_a2.test.py")], ROOT, 120))
    # Windows CreateProcess 不解析 PATH 里的 npx（无扩展名），显式定位
    import shutil
    npx = shutil.which("npx") or shutil.which("npx.cmd") or "npx"
    p = run([npx, "vitest", "run"], APP, 300)
    summary = [l for l in (p.stdout or "").splitlines() if "Test Files" in l or "Tests " in l]
    check("A3-5 app vitest", p, "| ".join(s.strip() for s in summary))

    if FAILED:
        print("== 结果：红（%d 处，exit 1；红因见各行，属并行卡中间态的注明归属）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

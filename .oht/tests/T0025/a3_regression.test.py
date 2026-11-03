"""T0025 A3 回归锚点测试（检查员锁定，实现员不得改）。

本条为回归锚点（T0025/A3），不针对新实现，tests 阶段即应绿
（T0015/T0020 先例：锚点不强行造红，一并锁定防回归）：
  A3-1 check-card.py 无参 exit 0（卡面格式零超限）
  A3-2 check-size.py 无参 exit 0（剃刀零超限）
  A3-3 cd app && npx vitest run 全量 exit 0，用例数 ≥100
       （定稿基线 2026-11-03 实测 24 文件 100 用例全绿，只增不减）
  A3-4 cd app && npx tsc --noEmit 退出码 0 且无输出

已知并行事实（2026-11-03 tests 阶段实测）：
  ① T0030 实现员在改 app FlowView/index.css（工作树 src/index.css 已有
    未提交改动）——T0025/A1/A2 同批 CSS 可能被其提前满足；
  ② T0026 检查员已落红测（archiveList.test.ts / flowArchive.test.tsx /
    kanbanRecorded.test.tsx，其卡 status=ready 实现未落地）——全量 vitest
    exit≠0、tsc exit=2（T0026 测试 import 未落地模块）红因 100% 归属
    T0026，属其预期红非本卡回归；本卡基线 100 用例全过、总数 102≥100。
    判定口径：A3 锚看「本卡零回归 + 基线只增不减」，并行卡预期红不计入
    （先例：T0020/A3 记 T0019 并行红归属）；review 复跑时若 T0026 已落地
    应全量绿，若仍 in-flight 按同口径注明归属。
用法：python -I .oht/tests/T0025/a3_regression.test.py   （cwd 任意）
"""
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
APP = os.path.join(ROOT, "app")
BASELINE_TESTS = 100  # 定稿基线（2026-11-03 实测 100），只增不减

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
    return proc.returncode == 0


def main():
    global FAILED
    print("== T0025 A3 回归锚点 ==")
    check("A3-1 check-card", run([sys.executable, "-I", os.path.join(ROOT, ".oht", "scripts", "check-card.py")], ROOT, 120))
    check("A3-2 check-size", run([sys.executable, "-I", os.path.join(ROOT, ".oht", "scripts", "check-size.py")], ROOT, 120))

    # Windows CreateProcess 不解析 PATH 里的 npx（无扩展名），显式定位（T0020 先例）
    npx = shutil.which("npx") or shutil.which("npx.cmd") or "npx"

    # A3-3 vitest 全量 + 基线用例数
    p = run([npx, "vitest", "run"], APP, 600)
    out = (p.stdout or "")
    summary = [l for l in out.splitlines() if "Test Files" in l or "Tests " in l]
    ok = check("A3-3 app vitest", p, "| ".join(s.strip() for s in summary))
    if ok:
        m = re.search(r"Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed", out)
        if not m:
            FAILED += 1
            print("  红 [A3-3 用例数≥%d] 摘要行无 Tests passed 计数，无法核对基线" % BASELINE_TESTS)
        else:
            count = int(m.group(2))
            if count >= BASELINE_TESTS:
                print("  绿 [A3-3 用例数≥%d] 实测 %d" % (BASELINE_TESTS, count))
            else:
                FAILED += 1
                print("  红 [A3-3 用例数≥%d] 实测 %d，低于基线（只增不减被破坏）"
                      % (BASELINE_TESTS, count))

    # A3-4 tsc 零输出零错
    t = run([npx, "tsc", "--noEmit"], APP, 600)
    if t.returncode == 0 and not (t.stdout or "").strip() and not (t.stderr or "").strip():
        print("  绿 [A3-4 tsc --noEmit] exit 0 无输出")
    else:
        FAILED += 1
        print("  红 [A3-4 tsc --noEmit] exit=%d 输出非空" % t.returncode)
        for l in ((t.stdout or "") + (t.stderr or "")).strip().splitlines()[-8:]:
            print("       " + l.strip()[:90])

    if FAILED:
        print("== 结果：红（%d 处，exit 1；红因见各行，属并行卡中间态的注明归属）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""T0032 A4 红测试：回归锚与授权改写核验（检查员锁定，实现员不得改）。

出处 T0032 需求 7/9（回归：check-card/check-size 无参零超限；授权改写：
T0031 a3_no_recorder.test.py「五态」断言改「四态」且运行绿，改前 sha1 记录在案，
先例 T0004/A4）。断言为语义匹配不锁措辞。

覆盖：
  A4-1 check-card.py 无参 exit 0（回归锚，当前即绿如实）
  A4-2 check-size.py 无参 exit 0（回归锚，当前即绿如实）
  A4-3 .oht/tests/T0031/a3_no_recorder.test.py 断言组含「四态」字样
       （现状为五态断言 FIVE_STATES → 红；实现阶段按卡面授权改写并录 sha1）
  A4-4 .oht/tests/T0031/a3_no_recorder.test.py 运行 exit 0
       （现状五态断言对现行 PROTOCOL 判红 → 运行即红；改写后转绿）

app vitest 与 tsc 终态全绿不列本卡绿门：并行泳道 T0029 在途（PROTOCOL 框架节
与 app 改动同期），设计红归属当刻泳道，终态复核由实现员收尾与检查员 review
全量执行（T0031/A4 先例），本测试仅锚框架侧回归与授权改写。
注：A4-1/A4-2/A4-4 无参全仓运行，并行泳道落盘瞬间可能一过性红（T0031/a3
docstring 已实测同类），红归属当刻写入方，以本卡 review 复跑为准。
用法：python -I .oht/tests/T0032/a4_regression.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CHECK_CARD = os.path.join(ROOT, ".oht", "scripts", "check-card.py")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")
T0031_A3 = os.path.join(ROOT, ".oht", "tests", "T0031", "a3_no_recorder.test.py")

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
    # -X utf8：-I 隐含 -E 忽略 PYTHONIOENCODING，须显式 UTF-8 模式防 GBK 乱码
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    return subprocess.run([sys.executable, "-I", "-X", "utf8", script], cwd=ROOT,
                          capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=120, env=env)


def check_no_arg(name, script):
    p = run_no_arg(script)
    if p.returncode == 0:
        ok("[%s无参exit0] %s" % (name, (p.stdout or "").strip().splitlines()[-1:]))
    else:
        fail("[%s无参exit0] exit=%d\n%s%s" % (name, p.returncode, p.stdout, p.stderr))


def check_t0031_a3():
    if not os.path.isfile(T0031_A3):
        fail("[T0031a3含四态字样] 文件缺失 %s" % T0031_A3)
        fail("[T0031a3运行绿] 文件缺失 %s" % T0031_A3)
        return
    text = open(T0031_A3, encoding="utf-8").read()
    if re.search(r"四态", text):
        line = [l.strip() for l in text.splitlines() if re.search(r"四态", l)][0]
        ok("[T0031a3含四态字样] %s" % line[:60])
    else:
        fail("[T0031a3含四态字样] 未含「四态」（现五态断言，待授权改写）")
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, "-I", "-X", "utf8", T0031_A3], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=120, env=env)
    if p.returncode == 0:
        ok("[T0031a3运行绿] exit 0")
    else:
        fail("[T0031a3运行绿] exit=%d（五态断言对现行判红，待授权改写后转绿）\n%s"
             % (p.returncode, ((p.stdout or "") + (p.stderr or "")).strip()[-300:]))


def main():
    global FAILED
    print("== T0032 A4 回归锚与授权改写 ==")
    check_no_arg("check-card", CHECK_CARD)
    check_no_arg("check-size", CHECK_SIZE)
    check_t0031_a3()
    print("  注 [app vitest/tsc] 不列本卡绿门：并行泳道 T0029 在途，"
          "终态复核归实现员收尾+检查员 review 全量（docstring）")

    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

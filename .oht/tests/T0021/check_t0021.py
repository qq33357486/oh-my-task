"""T0021 红测试（A1/A3 条目）：孤儿红归位 + 其他检查不退化。检查员锁定，实现员不得改。

背景：T0020 桩化 run_t0010.py（提交 4e8f20f）触发 T0018 check_t0018.py 的 A4p2
档案守护转红（11 项断言名缺失）。T0018 与 T0020 均已 recorded，孤儿红由本卡
（T0021，followup）收编：按人批先例（T0004/A4、T0007、T0013）属"批准的需求
变更同步改写锁定断言"，不是蒙混。

覆盖：
  A1  孤儿红归位：python -I .oht/tests/T0018/check_t0018.py 复归全绿
      （退出码 0 且输出含"红 0"）。当前红——A4p2 旧契约（11 项断言函数名在位）
      与桩化现实（档案只留 superseded 说明）互为矛盾，实现员按 T0021 需求 1
      同步改写 A4p2（断言对象改为：档案在位 + 头部含 superseded/退役声明 +
      不被活跃脚本调用；11 项函数名子断言整体删除，不留空壳）后转绿。
  A3a check-card 无参全仓零超限（exit 0 且"超限 0 处"）
  A3b check-size 零超限（exit 0 且"超限 0 处"）
  A3c lock_a1.test.py 全绿（exit 0 且"红 0"）
  A3d lock_a2.test.py 全绿（exit 0 且"红 0"）
  A3a~d 当前即绿：回归锚（T0015 A2b 先例，锁定现实现行为防退化；T0021/A3 条目
      状态如实记绿，红绿终判在 review 复跑）。禁改：本卡实现员不得放松 A4a、
      A1、A2、A3 等既有断言（T0021 需求禁止项）。

实现边界注记（给实现员）：新 A4p2 的"不再被活跃脚本引用执行"须容纳两处档案
守护形态引用——check_t0018.py 自身的守护路径常量（本检查的载体）与
.oht/tests/T0020/a2_residue.test.py 的桩运行（A2-2，验证退役行为本身，现行绿，
属 T0020 锁定测试）。二者即卡面"除档案说明外"的守护/退役验证形态；除此之外
的执行形态引用即应判红（有牙标准见 teeth.py）。
用法：python -I .oht/tests/T0021/check_t0021.py   （cwd 任意）
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))  # 仓库根
CHECK_T0018 = os.path.join(ROOT, ".oht", "tests", "T0018", "check_t0018.py")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")
CHECK_CARD = os.path.join(ROOT, ".oht", "scripts", "check-card.py")
LOCK_A1 = os.path.join(ROOT, ".oht", "tests", "T0018", "lock_a1.test.py")
LOCK_A2 = os.path.join(ROOT, ".oht", "tests", "T0018", "lock_a2.test.py")


def run_py(script, timeout=900):
    """python -I -X utf8 <script>（-I 隐含 -E，故用 -X utf8 保证子进程 stdout 编码，同 T0018）。"""
    env = dict(os.environ)
    return subprocess.run(
        [sys.executable, "-I", "-X", "utf8", script],
        capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
        cwd=ROOT, timeout=timeout,
    )


def a1_check_t0018_green():
    """A1 孤儿红归位：check_t0018 全绿（exit 0，"红 0"）。"""
    r = run_py(CHECK_T0018)
    assert "红" in r.stdout, f"check_t0018 未正常执行（无判定输出）：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert r.returncode == 0, f"check_t0018 仍红（孤儿红未归位）：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert "红 0" in r.stdout, f"check_t0018 退出码 0 但无\"红 0\"汇总：\n{r.stdout}{r.stderr}"


def a3a_check_card_zero():
    """A3a：check-card 无参全仓零超限。"""
    r = run_py(CHECK_CARD)
    assert "超限" in r.stdout, f"check-card 未正常执行：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert r.returncode == 0, f"check-card 全仓有超限：exit={r.returncode}\n{r.stdout}{r.stderr}"


def a3b_check_size_zero():
    """A3b：check-size 零超限。"""
    r = run_py(CHECK_SIZE)
    assert "超限" in r.stdout, f"check-size 未正常执行：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert r.returncode == 0, f"check-size 有超限：exit={r.returncode}\n{r.stdout}{r.stderr}"


def _lock_suite_green(path, name):
    r = run_py(path)
    assert "红" in r.stdout, f"{name} 未正常执行（无判定输出）：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert r.returncode == 0, f"{name} 有红：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert "红 0" in r.stdout, f"{name} 退出码 0 但无\"红 0\"汇总：\n{r.stdout}{r.stderr}"


def a3c_lock_a1_green():
    """A3c：lock_a1.test.py 仍全绿（回归门槛不退化）。"""
    _lock_suite_green(LOCK_A1, "lock_a1.test.py")


def a3d_lock_a2_green():
    """A3d：lock_a2.test.py 仍全绿（回归门槛不退化）。"""
    _lock_suite_green(LOCK_A2, "lock_a2.test.py")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    checks = [
        ("A1 check_t0018全绿(孤儿红归位)", a1_check_t0018_green),
        ("A3a check-card无参零超限", a3a_check_card_zero),
        ("A3b check-size零超限", a3b_check_size_zero),
        ("A3c lock_a1全绿", a3c_lock_a1_green),
        ("A3d lock_a2全绿", a3d_lock_a2_green),
    ]
    bad = 0
    ran = 0
    for name, fn in checks:
        try:
            fn()
            ran += 1
            print(f"GREEN {name}")
        except AssertionError as e:
            ran += 1
            bad += 1
            msg = str(e).replace("\n", "\n      ")
            print(f"RED   {name}\n      {msg}")
        except Exception as e:  # 环境错误也按红计，不让脚本静默通过
            ran += 1
            bad += 1
            print(f"ERROR {name}\n      {type(e).__name__}: {e}")
    print(f"红 {bad} / {ran}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

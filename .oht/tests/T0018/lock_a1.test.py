"""T0018 A1 快测（实现员新增，毫秒-秒级文件夹具，无真实唤醒）——驱动锁脚本锁契约。

覆盖 A1 查列三语义点（断言期望逐字硬编码，不 import 被测物防迎合，T0004 教训）：
  A1-1 写锁含三要素：take 后锁文件为 JSON，epoch/owner/claim（卡号+at+目的）逐字可验
  A1-2 heartbeat 使 epoch 单调递增：--at 注入时钟，连续心跳严格递增
  A1-3 锁新鲜→reconcile 判 fresh（退出码 3=秒退），锁原样、无派发计划
附带锁定实现语义（散文约定入代码的回归锚）：
  A1-4 工作者心跳遇认领形态自拒不覆写（跳过照常干活）
  A1-5 hand 转交：认领锁覆写为裸数字当前秒
  A1-6 take 撞他人锁被拒（并发调度员抢注防护，原话背景实证）
  A1-7 take 同属主合并认领（盘点后补登将派卡）
用法：python -I .oht/tests/T0018/lock_a1.test.py   （cwd 任意，夹具在临时目录）
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
LOCK_PY = os.path.join(ROOT, ".oht", "scripts", "lock.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

T0 = 1793690000  # 夹具基准秒（确定性，不依赖真实时钟）


def run_lock(args, cwd=None):
    return subprocess.run(
        [sys.executable, "-I", "-X", "utf8", LOCK_PY] + [str(x) for x in args],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd=cwd or ROOT, timeout=60,
    )


def fixture():
    d = tempfile.TemporaryDirectory()
    lock = os.path.join(d.name, "tasks", ".lock")
    tasks = os.path.join(d.name, "tasks")
    os.makedirs(tasks)
    return d, lock, tasks


def out_json(proc):
    lines = proc.stdout.strip().splitlines()
    assert lines, "脚本应输出一行 JSON，实得 stdout=%r stderr=%r" % (proc.stdout, proc.stderr)
    return json.loads(lines[-1])


def case_a1_three_elements():
    """A1-1 写锁含三要素：epoch/owner/claim 逐字可验。"""
    d, lock, tasks = fixture()
    try:
        p = run_lock(["take", "--lock", lock, "--owner", "disp-a1",
                      "--claim", "T9001=实现锁三要素", "--at", T0])
        assert p.returncode == 0, "take 应成功：%s%s" % (p.stdout, p.stderr)
        raw = open(lock, encoding="utf-8").read()
        obj = json.loads(raw)
        assert obj["epoch"] == T0, "epoch 应为取锁时刻 %d，实得 %r" % (T0, obj.get("epoch"))
        assert obj["owner"] == "disp-a1", "owner 逐字应为 disp-a1，实得 %r" % obj.get("owner")
        entry = obj["claim"]["T9001"]
        assert entry["at"] == T0, "认领时刻应=%d，实得 %r" % (T0, entry.get("at"))
        assert entry["purpose"] == "实现锁三要素", "目的逐字可验，实得 %r" % entry.get("purpose")
    finally:
        d.cleanup()


def case_a1_heartbeat_increases():
    """A1-2 heartbeat 使 epoch 单调递增（严格递增，注入时钟）。"""
    d, lock, tasks = fixture()
    try:
        run_lock(["take", "--lock", lock, "--owner", "disp-a1", "--at", T0])
        run_lock(["hand", "--lock", lock, "--owner", "disp-a1", "--at", T0 + 60])
        seen = []
        for step in (120, 180, 240):
            p = run_lock(["heartbeat", "--lock", lock, "--at", T0 + step])
            assert p.returncode == 0, "heartbeat 应成功：%s%s" % (p.stdout, p.stderr)
            seen.append(int(open(lock, encoding="utf-8").read().strip()))
        assert seen == [T0 + 120, T0 + 180, T0 + 240], \
            "心跳应逐字写入注入时刻且严格递增，实得 %r" % seen
        assert all(b > a for a, b in zip(seen, seen[1:])), "epoch 必须严格递增：%r" % seen
    finally:
        d.cleanup()


def case_a1_fresh_quick_exit():
    """A1-3 锁新鲜→reconcile 判 fresh=秒退：退出码 3、锁原样、无派发计划。"""
    for form in ("claim", "worker"):
        d, lock, tasks = fixture()
        try:
            if form == "claim":
                run_lock(["take", "--lock", lock, "--owner", "disp-a1",
                          "--claim", "T9002=实现", "--at", T0])
            else:
                open(lock, "w", encoding="utf-8", newline="\n").write("%d\n" % (T0 - 60))
            raw_before = open(lock, encoding="utf-8").read()
            p = run_lock(["reconcile", "--lock", lock, "--tasks", tasks,
                          "--owner", "disp-b", "--at", T0 + 60])
            out = out_json(p)
            assert p.returncode == 3, "新鲜锁应退出码 3（秒退），实得 %d：%s" % (p.returncode, p.stdout)
            assert out["action"] == "fresh", "动作应为 fresh，实得 %r" % out.get("action")
            assert "dispatch" not in out, "秒退不得生成派发计划：%r" % out
            assert open(lock, encoding="utf-8").read() == raw_before, "秒退不得动锁"
        finally:
            d.cleanup()


def case_a1_heartbeat_skips_claim_lock():
    """A1-4 工作者心跳遇认领形态自拒不覆写（跳过照常干活）。"""
    d, lock, tasks = fixture()
    try:
        run_lock(["take", "--lock", lock, "--owner", "disp-a1", "--at", T0])
        raw_before = open(lock, encoding="utf-8").read()
        p = run_lock(["heartbeat", "--lock", lock, "--at", T0 + 30])
        out = out_json(p)
        assert p.returncode == 0, "自拒=跳过，退出码应 0：%s%s" % (p.stdout, p.stderr)
        assert out["action"] == "skip", "动作应为 skip，实得 %r" % out.get("action")
        assert open(lock, encoding="utf-8").read() == raw_before, "自拒不得覆写认领锁"
    finally:
        d.cleanup()


def case_a1_hand_over_bare():
    """A1-5 hand 转交：本人认领锁覆写为裸数字当前秒。"""
    d, lock, tasks = fixture()
    try:
        run_lock(["take", "--lock", lock, "--owner", "disp-a1", "--at", T0])
        p = run_lock(["hand", "--lock", lock, "--owner", "disp-a1", "--at", T0 + 90])
        out = out_json(p)
        assert p.returncode == 0, "hand 应成功：%s%s" % (p.stdout, p.stderr)
        assert out["action"] == "handed_over", "动作应为 handed_over，实得 %r" % out.get("action")
        text = open(lock, encoding="utf-8").read().strip()
        assert text == str(T0 + 90), "转交后应为裸数字 %d，实得 %r" % (T0 + 90, text)
    finally:
        d.cleanup()


def case_a1_take_refuses_foreign_lock():
    """A1-6 take 撞他人锁被拒，锁原样（并发调度员抢注防护）。"""
    d, lock, tasks = fixture()
    try:
        run_lock(["take", "--lock", lock, "--owner", "disp-a1", "--at", T0])
        raw_before = open(lock, encoding="utf-8").read()
        p = run_lock(["take", "--lock", lock, "--owner", "disp-b", "--at", T0 + 30])
        out = out_json(p)
        assert p.returncode == 1, "撞他人锁应拒绝（退出码 1），实得 %d" % p.returncode
        assert out["action"] == "refused", "动作应为 refused，实得 %r" % out.get("action")
        assert open(lock, encoding="utf-8").read() == raw_before, "被拒不得动锁"
    finally:
        d.cleanup()


def case_a1_take_amends_claim():
    """A1-7 take 同属主合并认领（盘点后补登将派卡，放锁前 claim 不为空）。"""
    d, lock, tasks = fixture()
    try:
        run_lock(["take", "--lock", lock, "--owner", "disp-a1", "--at", T0])
        p = run_lock(["take", "--lock", lock, "--owner", "disp-a1",
                      "--claim", "T9003=实现", "--claim", "T9004=检查", "--at", T0 + 45])
        out = out_json(p)
        assert p.returncode == 0, "同属主补登应成功：%s%s" % (p.stdout, p.stderr)
        assert out["action"] == "claim_amended", "动作应为 claim_amended，实得 %r" % out.get("action")
        obj = json.loads(open(lock, encoding="utf-8").read())
        assert set(obj["claim"]) == {"T9003", "T9004"}, "认领应含两张补登卡，实得 %r" % obj["claim"]
        assert obj["epoch"] == T0 + 45, "事务内补登应刷 epoch，实得 %r" % obj["epoch"]
    finally:
        d.cleanup()


def main():
    cases = [
        ("A1-1 写锁含三要素", case_a1_three_elements),
        ("A1-2 heartbeat使epoch单调递增", case_a1_heartbeat_increases),
        ("A1-3 新鲜锁秒退不派发(认领+工作者两形态)", case_a1_fresh_quick_exit),
        ("A1-4 心跳遇认领形态自拒", case_a1_heartbeat_skips_claim_lock),
        ("A1-5 hand转交裸数字", case_a1_hand_over_bare),
        ("A1-6 take撞他人锁被拒", case_a1_take_refuses_foreign_lock),
        ("A1-7 take同属主合并认领", case_a1_take_amends_claim),
    ]
    bad = 0
    for name, fn in cases:
        try:
            fn()
            print("GREEN %s" % name)
        except AssertionError as e:
            bad += 1
            print("RED   %s\n      %s" % (name, str(e).replace("\n", "\n      ")))
        except Exception as e:
            bad += 1
            print("ERROR %s\n      %s: %s" % (name, type(e).__name__, e))
    print("红 %d / %d" % (bad, len(cases)))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

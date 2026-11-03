"""T0018 A2 快测（实现员新增，毫秒-秒级文件夹具，无真实唤醒）——驱动 reconcile 两分支。

覆盖 A2 查列（断言期望逐字硬编码，不 import 被测物防迎合，T0004 教训）：
  A2-1 停滞认领锁+认领卡无进展→接管发生：新锁 owner 注明「接管自 <旧owner>，缘由
       心跳停滞」、认领按当前时刻重登记、输出重派计划（卡号+目的）、退出码 0
  A2-2 反向：认领卡有进展→不接管：退出码 3、锁逐字原样（epoch/owner 不动）
附带锁定分支（dispatcher 散文对账规则的代码化回归锚）：
  A2-3 停滞裸数字锁=残留→清除（删除锁文件，可重新取锁）
  A2-4 未知形态停滞→按 mtime 清除
  A2-5 新鲜裸数字锁→fresh 秒退（工作者在途）
用法：python -I .oht/tests/T0018/lock_a2.test.py   （cwd 任意，夹具在临时目录）
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

T0 = 1793690000       # 夹具基准秒
STALE = 1200          # 停滞量：20 分钟 > 15 分钟新鲜窗
FRESH_SECONDS = 900
NOW = T0 + STALE      # reconcile 时刻


def run_lock(args):
    return subprocess.run(
        [sys.executable, "-I", "-X", "utf8", LOCK_PY] + [str(x) for x in args],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd=ROOT, timeout=60,
    )


def out_json(proc):
    lines = proc.stdout.strip().splitlines()
    assert lines, "脚本应输出一行 JSON，实得 stdout=%r stderr=%r" % (proc.stdout, proc.stderr)
    return json.loads(lines[-1])


def stale_claim_lock(lock, owner, card, at):
    payload = {"epoch": at, "owner": owner, "claim": {card: {"at": at, "purpose": "实现"}}}
    with open(lock, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    return payload


def make_card(tasks, name, mtime):
    path = os.path.join(tasks, name if name.endswith(".md") else name + ".md")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("---\nid: %s\n---\n" % name)
    os.utime(path, (mtime, mtime))
    return path


def fixture():
    d = tempfile.TemporaryDirectory()
    tasks = os.path.join(d.name, "tasks")
    os.makedirs(tasks)
    return d, os.path.join(tasks, ".lock"), tasks


def case_a2_takeover_no_progress():
    """A2-1 停滞+无进展→接管：留痕 owner、重登记认领、生成重派计划。"""
    d, lock, tasks = fixture()
    try:
        stale_claim_lock(lock, "zombie-disp-t0018", "T9010", T0)
        make_card(tasks, "T9010", T0 - 600)  # 卡 mtime 早于认领时刻=无进展
        p = run_lock(["reconcile", "--lock", lock, "--tasks", tasks,
                      "--owner", "wakeup-disp", "--fresh-seconds", FRESH_SECONDS,
                      "--at", NOW])
        out = out_json(p)
        assert p.returncode == 0, "接管应退出码 0（可继续派发），实得 %d：%s" % (p.returncode, p.stdout)
        assert out["action"] == "takeover", "动作应为 takeover，实得 %r" % out.get("action")
        assert out["old_owner"] == "zombie-disp-t0018", "留痕须点名旧属主，实得 %r" % out.get("old_owner")
        assert out["dispatch"] == [{"card": "T9010", "purpose": "实现"}], \
            "重派计划应含认领卡与目的，实得 %r" % out.get("dispatch")
        obj = json.loads(open(lock, encoding="utf-8").read())
        assert obj["owner"] == "wakeup-disp（接管自 zombie-disp-t0018，缘由心跳停滞）", \
            "接管锁 owner 须注明接管与缘由，实得 %r" % obj.get("owner")
        assert obj["epoch"] == NOW, "接管锁 epoch 应为当前时刻，实得 %r" % obj.get("epoch")
        assert obj["claim"]["T9010"]["at"] == NOW, "认领应按当前时刻重登记，实得 %r" % obj["claim"]
    finally:
        d.cleanup()


def case_a2_progress_keeps_lock():
    """A2-2 有进展→不接管：退出码 3、锁逐字原样。"""
    d, lock, tasks = fixture()
    try:
        payload = stale_claim_lock(lock, "alive-disp-t0018", "T9011", T0)
        make_card(tasks, "T9011", T0 + 500)  # 卡 mtime 晚于认领时刻=有进展
        raw_before = open(lock, encoding="utf-8").read()
        p = run_lock(["reconcile", "--lock", lock, "--tasks", tasks,
                      "--owner", "wakeup-disp", "--fresh-seconds", FRESH_SECONDS,
                      "--at", NOW])
        out = out_json(p)
        assert p.returncode == 3, "有进展应秒退（退出码 3），实得 %d" % p.returncode
        assert out["action"] == "keep_progress", "动作应为 keep_progress，实得 %r" % out.get("action")
        assert out["cards"] == {"T9011": True}, "应检出认领卡有进展，实得 %r" % out.get("cards")
        assert open(lock, encoding="utf-8").read() == raw_before, \
            "不接管=锁逐字原样（epoch/owner 不动不删）"
        assert payload["owner"] == "alive-disp-t0018"  # 夹具自证，防写错分支
    finally:
        d.cleanup()


def case_a2_stale_worker_lock_cleared():
    """A2-3 停滞裸数字锁=残留→清除，之后可重新取锁。"""
    d, lock, tasks = fixture()
    try:
        with open(lock, "w", encoding="utf-8", newline="\n") as f:
            f.write("%d\n" % T0)
        p = run_lock(["reconcile", "--lock", lock, "--tasks", tasks,
                      "--owner", "wakeup-disp", "--fresh-seconds", FRESH_SECONDS,
                      "--at", NOW])
        out = out_json(p)
        assert p.returncode == 0, "清除应退出码 0，实得 %d" % p.returncode
        assert out["action"] == "clear", "动作应为 clear，实得 %r" % out.get("action")
        assert not os.path.exists(lock), "残留锁应被删除"
        p2 = run_lock(["take", "--lock", lock, "--owner", "wakeup-disp", "--at", NOW])
        assert p2.returncode == 0, "清除后应可重新取锁：%s" % p2.stdout
    finally:
        d.cleanup()


def case_a2_unknown_stale_cleared_by_mtime():
    """A2-4 未知形态停滞→按 mtime 清除。"""
    d, lock, tasks = fixture()
    try:
        with open(lock, "w", encoding="utf-8", newline="\n") as f:
            f.write("dispatcher: automated wakeup\n")
        old = NOW - FRESH_SECONDS - 600
        os.utime(lock, (old, old))
        p = run_lock(["reconcile", "--lock", lock, "--tasks", tasks,
                      "--owner", "wakeup-disp", "--fresh-seconds", FRESH_SECONDS,
                      "--at", NOW])
        out = out_json(p)
        assert p.returncode == 0 and out["action"] == "clear", \
            "未知形态停滞应清除，实得 %d %r" % (p.returncode, out)
        assert not os.path.exists(lock), "未知形态残留应被删除"
    finally:
        d.cleanup()


def case_a2_fresh_worker_lock_quick_exit():
    """A2-5 新鲜裸数字锁=工作者在途→fresh 秒退不动。"""
    d, lock, tasks = fixture()
    try:
        with open(lock, "w", encoding="utf-8", newline="\n") as f:
            f.write("%d\n" % (NOW - 60))
        raw_before = open(lock, encoding="utf-8").read()
        p = run_lock(["reconcile", "--lock", lock, "--tasks", tasks,
                      "--owner", "wakeup-disp", "--fresh-seconds", FRESH_SECONDS,
                      "--at", NOW])
        out = out_json(p)
        assert p.returncode == 3 and out["action"] == "fresh", \
            "新鲜工作者锁应秒退，实得 %d %r" % (p.returncode, out)
        assert open(lock, encoding="utf-8").read() == raw_before, "秒退不动锁"
    finally:
        d.cleanup()


def main():
    cases = [
        ("A2-1 停滞+无进展→接管留痕并生成重派计划", case_a2_takeover_no_progress),
        ("A2-2 停滞+有进展→不接管锁原样", case_a2_progress_keeps_lock),
        ("A2-3 停滞裸数字锁清除", case_a2_stale_worker_lock_cleared),
        ("A2-4 未知形态按mtime清除", case_a2_unknown_stale_cleared_by_mtime),
        ("A2-5 新鲜工作者锁秒退", case_a2_fresh_worker_lock_quick_exit),
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

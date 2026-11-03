"""T0031 A1 红测试：废锁改台账落档（检查员锁定，实现员不得改）。

出处 T0031 需求 1（八项定案：废锁台账）。断言为语义匹配不锁措辞
（先例 .oht/tests/T0020/a1_discipline.test.py 候选正则组）。

覆盖：
  A1-1 PROTOCOL.md「并发与通知」节无旧锁机制语义（五组各一组候选正则，
       任一行命中即红）：lock.py/锁脚本、.lock/锁文件、秒退、对账/接管、心跳
  A1-2 roles/dispatcher.md 全文无旧锁机制语义（同五组；锁节整体改写为台账节）
  A1-3 PROTOCOL.md 并发节含台账新语义行（四组各至少一行命中）：
       派发记账/通知销账/台账空即事实空闲/双源印证
  A1-4 roles/dispatcher.md 含台账新语义行（同四组；台账节须自带操作语义）
  A1-5 lock.py 子进程真跑（无参）：exit 0 且输出含 superseded/退役 桩声明
       （NOTICE 措辞不锁，认声明词；T0010 桩先例 run_t0010.py）
  A1-6 .oht/tests/ 全树扫描（豁免本目录）：无 .lock/lock.py 活引用——
       引用文件须带退役声明（superseded/退役/桩化/不再执行），否则判活引用
  A1-7 check-size 无参零超限（剃刀回归锚，台账纪律行须 ≤40 字）

tests 阶段现状（2026-11-03 探针证实）→ A1-1~A1-6 红：
并发节与 dispatcher 锁节旧词俱全（lock.py/锁文件/秒退/对账/接管/心跳），
台账新语义 0 命中；lock.py 无参 exit 2 无桩声明；lock_a1/lock_a2 为活引用。
A1-7 现行即绿（回归锚点，一并锁定，同 T0015/T0018 先例；并行泳道落盘瞬间
可能瞬时红，红归属当刻写入方，以本卡 review 复跑为准）。
用法：python -I .oht/tests/T0031/a1_lock_abolition.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PROTOCOL = os.path.join(ROOT, ".oht", "PROTOCOL.md")
DISPATCHER = os.path.join(ROOT, ".oht", "roles", "dispatcher.md")
LOCK_PY = os.path.join(ROOT, ".oht", "scripts", "lock.py")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")
TESTS_DIR = os.path.join(ROOT, ".oht", "tests")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 旧锁机制语义组（出现即红；需求 1「锁条文全删」，内存层不留历史）。
OLD_MECH = [
    ("lock.py/锁脚本", [r"(?<![A-Za-z])lock\.py", r"锁脚本"]),
    (".lock/锁文件", [r"\.lock(?![A-Za-z_])", r"锁文件"]),
    ("秒退", [r"秒退"]),
    ("对账/接管", [r"对账", r"接管"]),
    ("心跳", [r"心跳"]),
]

# 台账新语义组（每组至少一行命中才算该语义落档；措辞自由）。
LEDGER = [
    ("派发记账", [r"派发.{0,10}记[账帐录]", r"记[账帐录].{0,10}(派发|代理|卡号)",
                  r"派发即记"]),
    ("通知销账", [r"销[账帐]", r"(完成|结束|通知).{0,14}销[账帐]"]),
    ("台账空即事实空闲", [r"台账.{0,10}空", r"事实空闲",
                          r"(台账|账).{0,8}(空|无).{0,14}(空闲|派)"]),
    ("双源印证", [r"双源", r"两源", r"印证"]),
]

# 桩/退役声明词（判活口径，沿 run_t0010.py / run_t0018.py 桩先例）。
RETIRED = r"superseded|退役|桩化|不再执行|不再运行"


def section_lines(lines, keyword):
    """取「## 标题含 keyword」小节正文（至下一个 ## 止）。"""
    out, on = [], False
    for ln in lines:
        if ln.startswith("## "):
            on = keyword in ln
            continue
        if on:
            out.append(ln)
    return out


def first_hit(lines, pats):
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                return ln.strip()
    return ""


FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def check_absence(rel, lines):
    for name, pats in OLD_MECH:
        h = first_hit(lines, pats)
        if h:
            fail("[%s|无%s] 命中旧语义行: %s" % (rel, name, h[:70]))
        else:
            ok("[%s|无%s] 无旧机制语义" % (rel, name))


def check_presence(rel, lines):
    for name, pats in LEDGER:
        h = first_hit(lines, pats)
        if h:
            ok("[%s|含%s] %s" % (rel, name, h[:60]))
        else:
            fail("[%s|含%s] 未命中台账语义行" % (rel, name))
            clue = [l.strip() for l in lines
                    if re.search(r"台账|记[账帐录]|销|印证|空闲|派发", l)]
            for c in clue[:3]:
                print("       现有相关行: %s" % c[:60])


def check_tree_scan():
    """A1-6 全树扫描：引用 lock.py/.lock 的测试文件须带退役声明，否则活引用。"""
    live = []
    for dirpath, dirnames, filenames in os.walk(TESTS_DIR):
        if os.path.abspath(dirpath) == os.path.abspath(HERE):
            dirnames[:] = []  # 豁免本目录
            continue
        for fn in filenames:
            p = os.path.join(dirpath, fn)
            try:
                text = open(p, encoding="utf-8").read()
            except (OSError, UnicodeDecodeError):
                continue
            if not re.search(r"(?<![A-Za-z])lock\.py|\.lock(?![A-Za-z_])", text):
                continue
            if re.search(RETIRED, text, re.I):
                continue
            live.append(os.path.relpath(p, ROOT))
    if live:
        for p in live:
            fail("[tests全树无lock活引用] 活引用: %s" % p)
    else:
        ok("[tests全树无lock活引用] 引用文件均带退役声明或无引用")


def check_lock_stub():
    """A1-5 lock.py 无参真跑：exit 0 + superseded/退役 桩声明。"""
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, "-I", "-X", "utf8", LOCK_PY], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=60, env=env)
    out = (p.stdout or "") + (p.stderr or "")
    if p.returncode == 0 and re.search(r"superseded|退役|不再执行", out, re.I):
        ok("[lock.py桩运行] exit=0，声明: %s"
           % out.strip().splitlines()[0][:70])
    else:
        fail("[lock.py桩运行] exit=%d（预期 0+桩声明），输出: %s"
             % (p.returncode, out.strip().splitlines()[:2]))


def check_size():
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, "-I", "-X", "utf8", CHECK_SIZE], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=60, env=env)
    if p.returncode == 0:
        ok("[check-size零超限] %s" % (p.stdout or "").strip())
    else:
        fail("[check-size零超限] exit=%d\n%s%s"
             % (p.returncode, p.stdout, p.stderr))


def main():
    proto_lines = open(PROTOCOL, encoding="utf-8").read().splitlines()
    disp_lines = open(DISPATCHER, encoding="utf-8").read().splitlines()
    concur = section_lines(proto_lines, "并发与通知")

    print("== T0031 A1 废锁与台账落档 ==")
    if not concur:
        fail("[PROTOCOL并发节] 未找到「并发与通知」节")
    check_absence("PROTOCOL.md并发节", concur)
    check_absence("roles/dispatcher.md", disp_lines)
    check_presence("PROTOCOL.md并发节", concur)
    check_presence("roles/dispatcher.md", disp_lines)
    check_lock_stub()
    check_tree_scan()
    check_size()

    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

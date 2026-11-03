"""T0033 A3 红测试：dispatch-worker.sh 补齐与 pack 清单登记（咨询员 authored，
实现员不得改）。

出处 T0033 需求 ③（dispatcher.md「后台派发」节引用
`bash .oht/scripts/dispatch-worker.sh` 但该脚本不存在，派发链路实断；
pack 清单亦未登记——人已批准补齐，技术取舍咨询员定）。

锁定契约（脚本规格，见卡「需求」节）：
  用法：bash .oht/scripts/dispatch-worker.sh <角色> [卡号]
  - 角色 ∈ consultant|implementer|checker|dispatcher；
  - 卡角色（前三者）必须带卡号（^T[0-9]+$），dispatcher 不带卡号；
  - 参数不合法非零退出并打印用法；
  - CLI 定位：环境变量 ZCODE_BIN 优先，否则 command -v zcode，找不到
    非零退出；
  - 提示词组装：单参数提示词，含角色名、.oht/roles/<角色>.md 路径，
    卡角色另含 .oht/tasks/<卡号>.md 路径；
  - 日志：mkdir -p .oht/local 后同步写 .oht/local/w-<卡号>.log（dispatcher
    为 w-dispatcher.log）头部行（含卡号/dispatcher 与时间戳），代理后台
    拉起、输出续写同一日志，脚本即返 0（不等待）。

覆盖：
  A3-1 脚本存在且 bash -n 语法通过
  A3-2 参数校验：无参/未知角色/卡角色缺卡号/dispatcher 带卡号 → 非零
  A3-3 ZCODE_BIN 指到 stub 时：exit 0、stub 收到的提示词含卡号路径与
       角色名、日志 .oht/local/w-T9333.log 同步生成且含 T9333
  A3-4 pack 清单登记：python -I .oht/scripts/pack.py --out 临时目录
       exit 0，且产物树含 .oht/scripts/dispatch-worker.sh（清单即代码，
       未登记脚本会使 pack 报「未登记」——T0029/A1 契约）
  A3-5 dispatcher.md 引用一致：文档含 dispatch-worker.sh 调用

红因（修前）：脚本不存在 → A3-1/2/3 红；清单未登记 → A3-4 pack
报「未登记」非零（注：修前 .oht/scripts 下并无多余文件，pack 本身通过、
产物树无 dispatch-worker.sh → 以「产物树缺文件」判红）；A3-5 现绿锚。
用法：python -I .oht/tests/T0033/a3_dispatch_worker.test.py   （cwd 任意）
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
PACK = os.path.join(ROOT, ".oht", "scripts", "pack.py")
DISPATCHER_MD = os.path.join(ROOT, ".oht", "roles", "dispatcher.md")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROLES = ["consultant", "implementer", "checker", "dispatcher"]
CARD = "T9333"
LOG = os.path.join(ROOT, ".oht", "local", "w-%s.log" % CARD)

STUB_SH = "#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" >> \"$T0033_STUB_LOG\"\n"

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def run_bash(args, env_extra=None, timeout=30):
    env = dict(os.environ)
    if env_extra:
        env.update(env_extra)
    return subprocess.run(["bash"] + args, cwd=ROOT, capture_output=True,
                          text=True, encoding="utf-8", errors="replace",
                          timeout=timeout, env=env)


def wait_for(path, needle, seconds=8):
    """轮询等待文件出现且含 needle（后台 stub 异步落盘）。"""
    deadline = time.time() + seconds
    while time.time() < deadline:
        if os.path.isfile(path) and needle in open(path, encoding="utf-8",
                                                   errors="replace").read():
            return True
        time.sleep(0.2)
    return False


def check_syntax():
    if not os.path.isfile(SCRIPT):
        fail("[脚本存在] 缺 %s（dispatcher.md 引用的派发脚本不存在，链路断）" % SCRIPT)
        return False
    ok("[脚本存在] dispatch-worker.sh 在位")
    r = run_bash(["-n", ".oht/scripts/dispatch-worker.sh"])
    if r.returncode != 0:
        fail("[语法] bash -n 非零：%s" % (r.stderr or r.stdout).strip()[:200])
        return False
    ok("[语法] bash -n 通过")
    return True


def check_args():
    cases = [
        ([], "无参"),
        (["writer", "T9333"], "未知角色"),
        (["consultant"], "卡角色缺卡号"),
        (["implementer", "X99"], "卡号格式非法"),
        (["dispatcher", "T9333"], "dispatcher 带卡号"),
    ]
    for args, name in cases:
        r = run_bash([".oht/scripts/dispatch-worker.sh"] + args)
        if r.returncode == 0:
            fail("[参数校验] %s（%s）应非零退出，实为 0" % (name, " ".join(args)))
        elif not os.path.isfile(SCRIPT):
            pass  # 脚本缺失时 bash 非零属同一红因，A3-1 已记
        else:
            ok("[参数校验] %s 非零退出（用法拒绝）" % name)


def check_stub():
    tmp = tempfile.mkdtemp(prefix="t0033_stub_")
    stub = os.path.join(tmp, "fake-zcode.sh")
    stub_log = os.path.join(tmp, "calls.log")
    with open(stub, "w", encoding="utf-8", newline="\n") as f:
        f.write(STUB_SH)
    os.chmod(stub, 0o755)
    try:
        r = run_bash([".oht/scripts/dispatch-worker.sh", "implementer", CARD],
                     env_extra={"ZCODE_BIN": stub, "T0033_STUB_LOG": stub_log})
        if r.returncode != 0:
            fail("[stub调用] exit=%d 应为 0：%s" % (r.returncode, (r.stderr or "").strip()[:200]))
            return
        ok("[stub调用] exit 0（后台拉起即返回）")
        if wait_for(stub_log, CARD):
            calls = open(stub_log, encoding="utf-8", errors="replace").read()
            hit_path = ".oht/tasks/%s.md" % CARD in calls
            hit_role = "implementer" in calls
            if hit_path and hit_role:
                ok("[提示词组装] stub 收到提示词含卡路径与角色名")
            else:
                fail("[提示词组装] 提示词缺卡路径或角色名：%s" % calls.strip()[:200])
        else:
            fail("[提示词组装] stub 未收到调用（ZCODE_BIN 未生效或未后台拉起）")
        if os.path.isfile(LOG) and CARD in open(LOG, encoding="utf-8",
                                               errors="replace").read():
            ok("[日志] .oht/local/w-%s.log 同步生成且含卡号" % CARD)
        else:
            fail("[日志] .oht/local/w-%s.log 缺失或不含卡号（须同步写头部）" % CARD)
    finally:
        for p in (LOG,):
            if os.path.isfile(p):
                os.remove(p)
        shutil.rmtree(tmp, ignore_errors=True)


def check_pack():
    tmp = tempfile.mkdtemp(prefix="t0033_pack_")
    try:
        p = subprocess.run([sys.executable, "-I", "-X", "utf8", PACK,
                            "--out", tmp], cwd=ROOT, capture_output=True,
                           text=True, encoding="utf-8", errors="replace",
                           timeout=120, env=dict(os.environ, PYTHONIOENCODING="utf-8"))
        out = (p.stdout or "") + (p.stderr or "")
        if p.returncode != 0:
            fail("[pack清单] pack 校验失败 exit=%d：%s" % (p.returncode, out.strip()[:300]))
            return
        copied = os.path.join(tmp, ".oht", "scripts", "dispatch-worker.sh")
        if os.path.isfile(copied):
            ok("[pack清单] pack 通过且产物树含 .oht/scripts/dispatch-worker.sh（已登记）")
        else:
            fail("[pack清单] pack 通过但产物树缺 dispatch-worker.sh（清单未登记）")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def check_doc():
    if os.path.isfile(DISPATCHER_MD):
        txt = open(DISPATCHER_MD, encoding="utf-8").read()
        if re.search(r"dispatch-worker\.sh", txt):
            ok("[文档一致] dispatcher.md 含 dispatch-worker.sh 调用（绿锚）")
        else:
            fail("[文档一致] dispatcher.md 未引用 dispatch-worker.sh")
    else:
        fail("[文档一致] dispatcher.md 缺失")


def main():
    global FAILED
    print("== T0033 A3 dispatch-worker.sh 补齐与清单登记 ==")
    syntax_ok = check_syntax()
    check_args()
    if syntax_ok:
        check_stub()
    else:
        fail("[stub调用] 脚本缺失，跳过（红随 A3-1）")
        fail("[日志] 脚本缺失，跳过（红随 A3-1）")
    check_pack()
    check_doc()
    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

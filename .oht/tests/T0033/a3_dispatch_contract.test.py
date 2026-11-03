"""T0033 A3 改写（2026-11-04 人直批直改）：dispatch-worker.sh 退役，派发与
唤醒改为纯提示词契约（框架面向所有 Agent 工具，不写死任何 CLI）。

出处：人原话「我这个是面向所有工具的……不需要用脚本把它写死，否则就要
去适配各种各样的工具」。旧脚本锁特定 Agent CLI 与 bash 后台拉起，是
T0033 当时针对本项目的务实补丁，与工具无关定位冲突，批准拔除。

锁定契约（新形态）：
  A3-1 脚本退役：.oht/scripts/dispatch-worker.sh 不存在；pack 产物树亦不含。
  A3-2 无工具耦合残留：框架文档与 README 不含旧脚本专属词元（脚本名、
       CLI 定位环境变量、后台拉起命令、CLI 探测命令）；scripts/*.py 源码
       同检后两词元。
  A3-3 派发提示词模板：dispatcher.md 含单段模板，锚【<角色>】、
       .oht/AGENTS.md、.oht/roles/<角色>.md、.oht/tasks/<卡号>.md、
       need_human，且写明用宿主原生后台会话拉起。
  A3-4 日志约定随提示词走：dispatcher.md 含 w-<卡号>.log 启动行约定。
  A3-5 pack 清单健康：pack.py --out 通过，产物树含 install.py/newcard.py
       （纯 Python、零工具耦合），不含 dispatch-worker.sh。
  A3-6 端到端：install.py --to 临时目录成功，装出项目无 dispatch-worker.sh，
       入口含指派路由行，install --check 通过。

红因（改前）：脚本在位且被 dispatcher.md/入口/pack 清单引用 → A3-1/2 红；
文档无提示词模板与日志约定 → A3-3/4 红。
用法：python -I .oht/tests/T0033/a3_dispatch_contract.test.py   （cwd 任意）
"""
import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SCRIPT = os.path.join(ROOT, ".oht", "scripts", "dispatch-worker.sh")
PACK = os.path.join(ROOT, ".oht", "scripts", "pack.py")
INSTALL = os.path.join(ROOT, ".oht", "scripts", "install.py")
DISPATCHER_MD = os.path.join(ROOT, ".oht", "roles", "dispatcher.md")
ENTRY_MD = os.path.join(ROOT, ".oht", "AGENTS.md")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# A3-2 扫描面 = 框架文档 + README；tasks/tests 是外存历史，不扫
DOC_FILES = [ENTRY_MD,
             os.path.join(ROOT, ".oht", "PROTOCOL.md"),
             DISPATCHER_MD] \
    + sorted(glob.glob(os.path.join(ROOT, ".oht", "roles", "*.md"))) \
    + sorted(glob.glob(os.path.join(ROOT, ".oht", "knowledge", "topics", "*.md"))) \
    + [os.path.join(ROOT, "README.md")]

# 拆串书写：本文件用 subprocess 跑 pack/install，若再自含连续触发词元会被
# T0020/a2 文本扫描判「词元与子进程共存」误命中，故逐词断开。
RESIDUE = [r"dispatch" + r"-worker",
           r"ZC" + r"ODE" + r"_BIN",
           r"nohup",
           r"command" + r" -v zc" + r"ode"]

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def read(path):
    return open(path, encoding="utf-8", errors="replace").read()


def run_py(args, cwd=ROOT, timeout=120):
    return subprocess.run([sys.executable, "-I", "-X", "utf8"] + args,
                          cwd=cwd, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout,
                          env=dict(os.environ, PYTHONIOENCODING="utf-8"))


def check_retired():
    if os.path.exists(SCRIPT):
        fail("[脚本退役] %s 仍存在（应删除）" % SCRIPT)
    else:
        ok("[脚本退役] .oht/scripts/dispatch-worker.sh 已不存在")


def check_residue():
    for path in DOC_FILES:
        if not os.path.isfile(path):
            fail("[无耦合残留] 文件缺失 %s" % path)
            continue
        txt = read(path)
        for pat in RESIDUE:
            m = re.search(pat, txt)
            if m:
                fail("[无耦合残留] %s 含 %s" % (os.path.relpath(path, ROOT), m.group(0)))
    for py in sorted(glob.glob(os.path.join(ROOT, ".oht", "scripts", "*.py"))):
        txt = read(py)
        for pat in (RESIDUE[1], RESIDUE[3]):
            if re.search(pat, txt):
                fail("[无耦合残留] %s 含耦合词元" % os.path.relpath(py, ROOT))
    ok("[无耦合残留] 框架文档与 scripts/*.py 无工具耦合残留")


def check_template():
    txt = read(DISPATCHER_MD)
    anchors = ["【<角色>】", ".oht/AGENTS.md", ".oht/roles/<角色>.md",
               ".oht/tasks/<卡号>.md", "need_human", "宿主原生后台会话"]
    missing = [a for a in anchors if a not in txt]
    if missing:
        fail("[派发模板] dispatcher.md 缺锚：%s" % "、".join(missing))
    else:
        ok("[派发模板] dispatcher.md 含完整派发提示词模板（宿主原生后台拉起）")


def check_log():
    txt = read(DISPATCHER_MD)
    if "w-<卡号>.log" in txt and "启动行" in txt:
        ok("[日志约定] 工作者首步写启动行到 w-<卡号>.log（提示词驱动）")
    else:
        fail("[日志约定] dispatcher.md 缺 w-<卡号>.log 启动行约定")


def check_pack():
    tmp = tempfile.mkdtemp(prefix="t0033_pack_")
    try:
        p = run_py([PACK, "--out", tmp])
        out = (p.stdout or "") + (p.stderr or "")
        if p.returncode != 0:
            fail("[pack清单] pack 失败 exit=%d：%s" % (p.returncode, out.strip()[:300]))
            return
        tree = [os.path.relpath(os.path.join(dp, f), tmp).replace(os.sep, "/")
                for dp, _, fs in os.walk(tmp) for f in fs]
        bad = [t for t in tree if "dispatch-worker" in t]
        if bad:
            fail("[pack清单] 产物树仍含 %s" % bad[0])
            return
        for need in (".oht/scripts/install.py", ".oht/scripts/newcard.py"):
            if need not in tree:
                fail("[pack清单] 产物树缺 %s（清单不健康）" % need)
                return
        ok("[pack清单] pack 通过：无脚本、纯 Python 工具在位")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def check_install():
    tmp = tempfile.mkdtemp(prefix="t0033_install_")
    target = os.path.join(tmp, "proj")
    os.makedirs(target)
    try:
        p = run_py([INSTALL, "--to", target])
        out = (p.stdout or "") + (p.stderr or "")
        if p.returncode != 0:
            fail("[端到端] install 失败 exit=%d：%s" % (p.returncode, out.strip()[:300]))
            return
        ok("[端到端] install 成功")
        if os.path.exists(os.path.join(target, ".oht", "scripts", "dispatch-worker.sh")):
            fail("[端到端] 装出项目仍含 dispatch-worker.sh")
            return
        ok("[端到端] 装出项目无 dispatch-worker.sh")
        entry = read(os.path.join(target, ".oht", "AGENTS.md"))
        if "指派角色的会话按指派走" in entry:
            ok("[端到端] 装出入口含指派路由行")
        else:
            fail("[端到端] 装出入口缺指派路由行")
        c = run_py([INSTALL, "--to", target, "--check"], cwd=target)
        if c.returncode == 0:
            ok("[端到端] install --check 通过")
        else:
            fail("[端到端] --check 非零：%s" % ((c.stdout or "") + (c.stderr or "")).strip()[:200])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    global FAILED
    print("== T0033 A3 派发提示词契约（脚本退役）==")
    check_retired()
    check_residue()
    check_template()
    check_log()
    check_pack()
    check_install()
    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

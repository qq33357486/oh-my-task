"""T0002 验收测试（A1~A4）。用法：python -I .oht/tests/T0002/test_t0002.py
断言式；每条输出 红/绿；全绿 exit 0，有红 exit 1。"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]  # .oht/tests/T0002/ → 仓库根
ROLE_FILES = [
    "dispatcher.md", "consultant.md", "checker.md", "implementer.md",
    "recorder.md", "patrol.md", "curator.md", "consultant-brief.md",
    "dispatcher-intake.md", "memory.md", "memory-tools.md",
]
# A4 逐对核对：旧路径 -> 新路径
PAIRS = [("PROTOCOL.md", ".oht/PROTOCOL.md")] + [
    (f"roles/{n}", f".oht/roles/{n}") for n in ROLE_FILES
]


def run(argv, cwd=None):
    return subprocess.run(
        argv, cwd=str(cwd or REPO), capture_output=True,
        text=True, encoding="utf-8", errors="replace",
    )


def git(*args):
    """git 子命令，成功返回 stdout，失败返回 None。"""
    r = run(["git", "-C", str(REPO), *args])
    return r.stdout if r.returncode == 0 else None


def rev_parse(rev):
    out = git("rev-parse", "--verify", "--quiet", rev)
    return out.strip() or None if out is not None else None


def hash_object(path):
    r = run(["git", "-C", str(REPO), "hash-object", str(path)])
    return r.stdout.strip() if r.returncode == 0 else None


def check_a1():
    """根目录只留一行引用，循环工程文件全部不在根。"""
    ag = REPO / "AGENTS.md"
    assert ag.is_file(), "根 AGENTS.md 不存在"
    text = ag.read_text(encoding="utf-8")
    assert ".oht/AGENTS.md" in text, "根 AGENTS.md 未引用 .oht/AGENTS.md"
    for p in ["PROTOCOL.md", "roles", "knowledge", "tasks", "scripts"]:
        assert not (REPO / p).exists(), f"根目录仍存在 {p}/"


def check_a2():
    """.oht/ 结构完整：入口、协议、11 个角色、2 个脚本、rules、两张模板。"""
    oht = REPO / ".oht"
    assert oht.is_dir(), ".oht/ 不存在"
    files = [
        "AGENTS.md", "PROTOCOL.md",
        "scripts/check-card.py", "scripts/check-size.py",
        "knowledge/rules.md", "tasks/_template.md",
        "knowledge/topics/_template.md",
    ]
    for p in files:
        assert (oht / p).is_file(), f".oht/{p} 不存在"
    assert (oht / "roles").is_dir(), ".oht/roles/ 不存在"
    for n in ROLE_FILES:
        assert (oht / "roles" / n).is_file(), f".oht/roles/{n} 不存在"


def check_a3():
    """卡片/字数检查脚本自举：迁移后入口路径与内部路径仍工作。"""
    cmds = [
        [sys.executable, "-I", ".oht/scripts/check-card.py", ".oht/tasks/T0002.md"],
        [sys.executable, "-I", ".oht/scripts/check-size.py"],
    ]
    for c in cmds:
        name = " ".join(c[2:])
        r = run(c)
        out = ((r.stdout or "") + (r.stderr or "")).strip()
        assert r.returncode == 0, f"`{name}` exit={r.returncode}\n{out}"
        assert "Traceback" not in out, f"`{name}` 有报错\n{out}"


def check_a4():
    """迁移是纯 rename：内容 diff 为空。git log 有迁移提交则核对该提交；
    否则用 git status --porcelain 看未提交的暂存 rename；两者皆无即迁移未发生。"""
    revs = (git("rev-list", "HEAD", "--", ".oht/PROTOCOL.md") or "").split()
    if revs:
        m = revs[-1]  # 引入 .oht/PROTOCOL.md 的提交（最早一次）
        parent = f"{m}^"
        for old, new in PAIRS:
            b_old = rev_parse(f"{parent}:{old}")
            assert b_old, f"迁移提交 {m[:7]} 之前不存在 {old}，谈不上纯 rename"
            b_new = rev_parse(f"{m}:{new}")
            assert b_new, f"迁移提交 {m[:7]} 中没有 {new}"
            assert b_old == b_new, f"{old} -> {new} 内容有差异，非纯 rename"
            assert rev_parse(f"{m}:{old}") is None, f"{old} 迁移提交后仍留在原路径"
        return
    st = git("status", "--porcelain") or ""
    lines = st.splitlines()
    for old, new in PAIRS:
        b_old = rev_parse(f"HEAD:{old}")
        assert b_old, f"git log 无迁移记录且 HEAD 缺 {old}：迁移未发生"
        renamed = [
            l for l in lines
            if l[:1].upper() == "R" and l[3:].strip() == f"{old} -> {new}"
        ]
        if renamed:
            b_new = rev_parse(f":{new}")
            assert b_new == b_old, f"{old} -> {new} 暂存内容与原内容有差异，非纯 rename"
        else:
            assert (REPO / new).is_file(), f"{old} -> {new}：无暂存 rename，磁盘上也无 {new}：迁移未发生"
            assert not (REPO / old).exists(), f"{old} 仍在根目录"
            assert hash_object(REPO / new) == b_old, f"{old} -> {new} 工作区内容与原内容有差异，非纯 rename"


CHECKS = [("A1", check_a1), ("A2", check_a2), ("A3", check_a3), ("A4", check_a4)]


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    failed = False
    for name, fn in CHECKS:
        try:
            fn()
            print(f"{name}: 绿")
        except AssertionError as e:
            failed = True
            print(f"{name}: 红 —— {str(e).strip() or '断言失败'}")
        except Exception as e:  # 环境类错误也计红
            failed = True
            print(f"{name}: 红 —— {type(e).__name__}: {e}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

"""T0006 验收测试（A1~A4）。用法：python -I .oht/tests/T0006/check_t0006.py（cwd 任意）
断言式；每条输出 红/绿；全绿 exit 0，有红 exit 1。"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]  # .oht/tests/T0006/ → 仓库根
ALLOWED = {"AGENTS.md", "README.md", ".gitignore", ".git", ".zcode", "app", ".oht"}
SCRIPTS = [
    ".oht/tests/T0002/test_t0002.py",
    ".oht/tests/T0003/build_check.sh",
    ".oht/tests/T0004/ci_check.sh",
]


def run(argv):
    return subprocess.run(
        argv, cwd=str(REPO), capture_output=True,
        text=True, encoding="utf-8", errors="replace",
    )


def check_a1():
    """根目录白名单：条目集合 ⊆ ALLOWED，且 tests/ 不在。"""
    entries = {p.name for p in REPO.iterdir()}
    extra = entries - ALLOWED
    assert not extra, f"根目录存在白名单外条目: {sorted(extra)}"
    assert not (REPO / "tests").exists(), "根目录仍存在 tests/"


def check_a2():
    """三个验收脚本就位 .oht/tests/<id>/。"""
    for rel in SCRIPTS:
        assert (REPO / rel).is_file(), f"{rel} 不存在"


def check_a3():
    """迁移后脚本仍可跑：test_t0002 exit 0；ci_check 输出 RED（T0004 未实现，红属正常）；
    build_check 输出 GREEN（前提：T0003 已实现构建，2026-11-03 起 build_check 为 GREEN）。"""
    r = run([sys.executable, "-I", ".oht/tests/T0002/test_t0002.py"])
    out = ((r.stdout or "") + (r.stderr or "")).strip()
    assert r.returncode == 0, f".oht/tests/T0002/test_t0002.py exit={r.returncode}\n{out}"
    for name, rel, want in [
        ("ci_check.sh", ".oht/tests/T0004/ci_check.sh", "RED"),  # T0004 未实现，工作流文件不存在
        ("build_check.sh", ".oht/tests/T0003/build_check.sh", "GREEN"),  # T0003 已实现构建（2026-11-03 起）
    ]:
        r = run(["bash", rel])
        out = ((r.stdout or "") + (r.stderr or "")).strip()
        assert want in out, f"{name} 输出不含 {want}\n{out}"


def check_a4():
    """PROTOCOL 修订落档 + 两个自举脚本无参零超限。"""
    pt = (REPO / ".oht/PROTOCOL.md").read_text(encoding="utf-8")
    assert ".oht/tests/<id>/" in pt, "PROTOCOL.md 未含 .oht/tests/<id>/ 引用"
    assert "临时产物" in pt, "PROTOCOL.md 未含脚本去留规则（临时产物）"
    for rel in [".oht/scripts/check-size.py", ".oht/scripts/check-card.py"]:
        r = run([sys.executable, "-I", rel])
        out = ((r.stdout or "") + (r.stderr or "")).strip()
        assert r.returncode == 0, f"{rel} exit={r.returncode}\n{out}"


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

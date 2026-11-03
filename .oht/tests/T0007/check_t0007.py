"""T0007 验收测试（A1~A2）。用法：python -I .oht/tests/T0007/check_t0007.py（cwd 任意）
断言式；每条输出 红/绿；全绿 exit 0，有红 exit 1。"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]  # .oht/tests/T0007/ → 仓库根
TARGET = ".oht/tests/T0006/check_t0006.py"


def run(argv):
    return subprocess.run(
        argv, cwd=str(REPO), capture_output=True,
        text=True, encoding="utf-8", errors="replace",
    )


def check_a1():
    """check_t0006 全绿：A1~A4 全绿，exit 0（A3 过时断言更新后应达成）。"""
    r = run([sys.executable, "-I", TARGET])
    out = ((r.stdout or "") + (r.stderr or "")).strip()
    assert r.returncode == 0, f"{TARGET} exit={r.returncode}\n{out}"


def check_a2():
    """ci_check 预期未被误改：check_t0006.py 中含 ci_check 的行自身须有带引号 "GREEN"
    （行级锁定，窗口到行尾为止——弃用跨行大窗口，防邻行 build_check 的 "GREEN" 污染；
    要求带引号，排除 docstring 中裸 GREEN 的干扰）。
    前提：T0014 人批准 RED→GREEN——T0004 已落地工作流；守护语义保留，防改回 RED。"""
    text = (REPO / TARGET).read_text(encoding="utf-8")
    ci_lines = [ln for ln in text.splitlines() if "ci_check" in ln]
    assert ci_lines, f"{TARGET} 未提及 ci_check"
    ok = any(('"GREEN"' in ln) or ("'GREEN'" in ln) for ln in ci_lines)
    assert ok, "含 ci_check 的行均无带引号 \"GREEN\"（ci_check 断言疑似被改回 RED）"


CHECKS = [("A1", check_a1), ("A2", check_a2)]


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

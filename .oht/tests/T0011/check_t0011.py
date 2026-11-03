"""T0011 验收测试（A1~A2）。用法：python -I .oht/tests/T0011/check_t0011.py（cwd 任意）
断言式；每条输出 红/绿；全绿 exit 0，有红 exit 1。
A1 锁"修订在档"：四处框架修订各含关键句 + 剃刀检查零超限。
A2 锁"教训入档"：卡候选教训有测试完备性/覆盖实证行；log 有 T0011 对应条目（记录员合并时才写）。
背景：本卡为人在场快速通道——人批准后四处修订先落地、测试随后锁定，故 A1 写测即绿（偏离记卡进度节）。"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]  # .oht/tests/T0011/ → 仓库根

REVISIONS = [
    (".oht/roles/checker.md",
     "复跑与写测前审覆盖：用户链路无集成锚点即退回补条目。"),
    (".oht/roles/consultant.md",
     "验收条目须分层：纯函数、集成链路、端到端，缺层即欠账。"),
    (".oht/PROTOCOL.md",
     "测试分层锚点：纯函数/集成/端到端；系统行为须有系统级用例。"),
    (".oht/knowledge/topics/循环工程框架.md",
     "引擎有系统级测试套件（沙盒+harness）"),  # T0014：原精确句已由 T0010 收官按协议升格为约束条，断言随文档合法演化更新措辞
]


def run(argv):
    return subprocess.run(
        argv, cwd=str(REPO), capture_output=True,
        text=True, encoding="utf-8", errors="replace",
    )


def check_a1():
    """四处修订各含关键句（grep 式，路径相对仓库根）；check-size.py 零超限。"""
    missing = []
    for rel, key in REVISIONS:
        text = (REPO / rel).read_text(encoding="utf-8")
        if key not in text:
            missing.append(f"{rel} 缺「{key}」")
    assert not missing, "；".join(missing)
    r = run([sys.executable, "-I", ".oht/scripts/check-size.py"])
    out = ((r.stdout or "") + (r.stderr or "")).strip()
    assert r.returncode == 0, f"check-size.py exit={r.returncode}\n{out}"


def check_a2():
    """教训入档：卡候选教训节含测试完备性/覆盖实证行；log 含 T0011 对应条目。
    log 条目由记录员合并时写入——合并前此断言为红。"""
    card = (REPO / ".oht/tasks/T0011.md").read_text(encoding="utf-8")
    lesson = [ln for ln in card.splitlines()
              if ln.startswith("- 候选｜") and ("测试完备性" in ln or "覆盖" in ln)]
    assert lesson, "T0011 卡候选教训节缺测试完备性/覆盖实证行"
    log = (REPO / ".oht/knowledge/log/2026-11.md").read_text(encoding="utf-8")
    entries = [ln for ln in log.splitlines()
               if "｜T0011｜" in ln and ("测试完备性" in ln or "覆盖" in ln)]
    assert entries, "log/2026-11.md 缺 T0011 测试完备性/覆盖教训条目（记录员合并时写入）"


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

"""T0005 验收测试（检查员锁定，实现员不得改本测试）：校验脚本零匹配必须报错。

用法：python -I .oht/tests/T0005/check_t0005.py
断言：
  A1 零匹配报错：空临时目录作 ROOT，cwd=仓库根跑
     python -I .oht/scripts/check-card.py <空目录>
     python -I .oht/scripts/check-size.py <空目录>
     各断言 exit 非 0 且输出含"未扫描"。
  A2 正常路径不误伤：cwd=仓库根跑两脚本（均无参），各断言 exit 0。
本测试自身退出码：全绿 0，有红 1。临时目录测试结束必清理。
"""
import os
import shutil
import subprocess
import sys
import tempfile

# Windows 控制台常为 GBK，输出中文/替换符会崩，统一 UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# 本文件位于 <仓库根>/.oht/tests/T0005/，向上四级才是仓库根
# 本文件位于 <仓库根>/.oht/tests/T0005/，向上四级才是仓库根
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if not os.path.isdir(os.path.join(REPO, ".oht")):
    sys.exit("测试自检失败：仓库根定位错误 " + REPO)
SUBJECTS = [
    ("A1(check-card)", ".oht/scripts/check-card.py"),
    ("A1(check-size)", ".oht/scripts/check-size.py"),
]
results = []


def record(item, ok, detail):
    results.append(ok)
    print(f"{item} {'绿' if ok else '红'} {detail}")


def decode(raw):
    """子进程受 -I 隔离，编码回落 locale（Windows 常 GBK），多编码尝试解码。"""
    for enc in ("utf-8", "gbk", "mbcs"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace")


def run(args):
    return subprocess.run(
        [sys.executable, "-I", *args],
        cwd=REPO, capture_output=True,
    )


# A1 零匹配报错（空临时目录作 ROOT）
empty = tempfile.mkdtemp(prefix="oht-t0005-empty-")
try:
    for item, script in SUBJECTS:
        p = run([script, empty])
        out = decode(p.stdout + p.stderr).strip()
        nonzero = p.returncode != 0
        has_msg = "未扫描" in out
        record(
            item,
            nonzero and has_msg,
            f"{script} <空目录>: exit={p.returncode}（应非0={nonzero}），"
            f"输出含未扫描={has_msg}，输出={out[:120]!r}",
        )
finally:
    shutil.rmtree(empty, ignore_errors=True)

# A2 正常路径不误伤（cwd=仓库根，均无参）
for item, script in SUBJECTS:
    p = run([script])
    out = decode(p.stdout + p.stderr).strip()
    record(
        item.replace("A1", "A2"),
        p.returncode == 0,
        f"{script} 无参: exit={p.returncode}（应0），输出={out[:120]!r}",
    )

if all(results):
    print("T0005 测试：全绿")
    sys.exit(0)
print("T0005 测试：有红（tests 阶段预期状态：A1 红 A2 绿）")
sys.exit(1)

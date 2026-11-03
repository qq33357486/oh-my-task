"""框架打包（T0029）：清单即代码，未登记即报错。

用法：python -I .oht/scripts/pack.py --out <产物目录>

- 清单：下方 FRAMEWORK_FILES，代码即清单的唯一权威源；install.py 按路径加载本文件取同一清单，不另立清单文件。
- 校验：扫描 .oht/ 实际文件。业务区（tasks/T*.md 卡片、knowledge 非模板、tests/、local/、.lock、.gitkeep 占位）不在框架范围；范围内出现未登记文件 → 逐个指出并无零退出；清单登记但文件不存在 → 同样报错。校验不过不复制任何文件。
- 校验通过 → 清单内文件按相对路径复制到 --out（产物即仓库同构目录，可作 install.py --from 源）。
"""
import argparse
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # .oht/scripts → .oht → 仓库根

# 框架文件清单（相对仓库根，正斜杠）。唯一权威源：新增框架文件必须登记，否则 pack 按设计报错。
FRAMEWORK_FILES = [
    "AGENTS.md",
    ".oht/AGENTS.md",
    ".oht/PROTOCOL.md",
    ".oht/VERSION",
    ".oht/roles/checker.md",
    ".oht/roles/consultant-brief.md",
    ".oht/roles/consultant.md",
    ".oht/roles/curator.md",
    ".oht/roles/dispatcher.md",
    ".oht/roles/implementer.md",
    ".oht/roles/memory-tools.md",
    ".oht/roles/memory.md",
    ".oht/roles/patrol.md",
    ".oht/scripts/check-card.py",
    ".oht/scripts/check-size.py",
    ".oht/scripts/install.py",
    ".oht/scripts/lock.py",
    ".oht/scripts/newcard.py",
    ".oht/scripts/pack.py",
    ".oht/tasks/_template.md",
    ".oht/knowledge/topics/_template.md",
]


def is_business(rel):
    """框架范围排除（rel 为相对仓库根的 posix 路径）：命中即不要求登记。"""
    parts = rel.split("/")
    name = parts[-1]
    if name == ".gitkeep":  # 目录占位，属业务骨架，install.py 缺则补
        return True
    if name.endswith(".lock"):  # 锁文件（事务锁/心跳）
        return True
    if parts[0] == ".oht" and len(parts) > 1:
        second = parts[1]
        if second in ("tests", "local"):  # 测试产物与项目本地补充
            return True
        if second == "knowledge" and rel != ".oht/knowledge/topics/_template.md":
            return True  # knowledge 除模板外全是业务（rules、log、topics 内容）
        if second == "tasks" and name.startswith("T") and name.endswith(".md"):
            return True  # 任务卡 T*.md
    return False


def validate(root):
    """校验清单与实际文件一致。返回问题列表（未登记 + 登记缺失），空=通过。"""
    problems = []
    registered = set(FRAMEWORK_FILES)
    oht_dir = os.path.join(root, ".oht")
    if os.path.isdir(oht_dir):
        for dirpath, dirnames, filenames in os.walk(oht_dir):
            rel_dir = os.path.relpath(dirpath, root).replace(os.sep, "/")
            for fn in sorted(filenames):
                rel = rel_dir + "/" + fn
                if is_business(rel):
                    continue
                if rel not in registered:
                    problems.append("未登记: " + rel)
    for rel in sorted(registered):
        if not os.path.isfile(os.path.join(root, *rel.split("/"))):
            problems.append("清单登记但文件不存在: " + rel)
    return problems


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="框架打包：清单即代码（T0029）")
    ap.add_argument("--out", required=True, help="产物目录（保持相对路径）")
    a = ap.parse_args(argv)
    problems = validate(ROOT)
    if problems:
        for p in problems:
            print(p, file=sys.stderr)
        print("pack 校验失败：%d 处，产物未生成" % len(problems), file=sys.stderr)
        return 1
    out = os.path.abspath(a.out)
    for rel in sorted(FRAMEWORK_FILES):
        dst = os.path.join(out, *rel.split("/"))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(ROOT, *rel.split("/")), dst)
    print("pack 完成：%d 个框架文件 → %s（版本 %s）" % (
        len(FRAMEWORK_FILES), a.out,
        open(os.path.join(ROOT, ".oht", "VERSION"), encoding="utf-8").read().strip()))
    return 0


if __name__ == "__main__":
    sys.exit(main())

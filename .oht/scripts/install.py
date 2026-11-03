"""框架安装=升级（T0029）：一条命令两用，业务不动，防降级，覆盖留 .bak，manifest 防篡改。

用法：
  python -I .oht/scripts/install.py --to <目标项目根> [--from <源仓库根或 pack 产物目录>]
  python -I .oht/scripts/install.py --to <目标项目根> --check

- --from 缺省 = 脚本所在仓库根（克隆本仓库后一条命令初始化）；也接受 pack 产物目录（同构布局）。
- 防降级：读目标 .oht/VERSION，目标版本高于源 → 非零退出报「禁止降级」，目标一字不动；此检查先于一切写动作。
- 框架文件全量写入；目标已有且内容不同 → 先删同名旧 .bak 再备份为 <原名>.bak 后覆盖。
- 业务不动：tasks/T*.md、knowledge/log、topics 非模板、local/、tests/、项目代码绝不写删；
  只补缺失骨架（tasks/、knowledge/log/、knowledge/topics/、local/roles/ 含 .gitkeep；
  knowledge/rules.md 缺失时生成空骨架，已有则不动——rules.md 属业务文件，升级绝不覆盖）。
- 目标根 AGENTS.md：缺失则生成（版本标记+引用行）；首行是版本标记（框架自管）则只更新该行版本；
  用户自己的（首行无标记）原样保留，不进 manifest。
- 生成 .oht/.manifest（框架文件 sha256 清单）；--check 逐文件比对哈希，被改/被删 → 非零退出并指出文件。
"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_FROM = os.path.dirname(os.path.dirname(HERE))  # .oht/scripts → .oht → 仓库根
SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
MARKER_RE = re.compile(r"^<!--\s*OHT-VERSION:\s*\d+\.\d+\.\d+\s*-->$")


def marker_line(ver):
    return "<!-- OHT-VERSION: %s -->" % ver


def read_bytes(path):
    with open(path, "rb") as f:
        return f.read()


def write_bytes(path, data):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def sha256_hex(data):
    return hashlib.sha256(data).hexdigest()


def load_framework_files():
    """按路径加载同目录 pack.py 取框架清单——清单唯一权威源在 pack.py，两脚本不漂移。"""
    pack_path = os.path.join(HERE, "pack.py")
    if not os.path.isfile(pack_path):
        print("install 中止：同目录缺 pack.py（清单权威源），取不到框架清单", file=sys.stderr)
        sys.exit(1)
    saved = sys.dont_write_bytecode
    sys.dont_write_bytecode = True  # 加载不落 __pycache__，防污染框架区让 pack 报未登记
    try:
        spec = importlib.util.spec_from_file_location("oht_pack", pack_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    finally:
        sys.dont_write_bytecode = saved
    return list(mod.FRAMEWORK_FILES)


def parse_ver(text):
    m = SEMVER_RE.match(text.strip())
    return "%s.%s.%s" % m.groups() if m else None


def read_version(path):
    if not os.path.isfile(path):
        return None
    return parse_ver(read_bytes(path).decode("utf-8", errors="replace"))


def ver_tuple(ver):
    return tuple(int(x) for x in ver.split("."))


def plan_root_agents(dpath, src_data, ver):
    """返回 (动作, 最终字节)。动作 ∈ add/update/same/user_kept。
    生成与标记行更新都从源内容派生：源首行是标记则替换版本行，否则前置标记行。"""
    if not os.path.isfile(dpath):
        lines = src_data.decode("utf-8", errors="replace").split("\n")
        if lines and MARKER_RE.match(lines[0].strip()):
            lines[0] = marker_line(ver)
        else:
            lines.insert(0, marker_line(ver))
        return "add", ("\n".join(lines)).encode("utf-8")
    old = read_bytes(dpath)
    head, sep, rest = old.partition(b"\n")
    try:
        first_text = head.decode("utf-8").strip()
    except UnicodeDecodeError:
        return "user_kept", old
    if not MARKER_RE.match(first_text):
        return "user_kept", old  # 用户自己的根 AGENTS.md，原样保留
    if first_text == marker_line(ver):
        return "same", old
    new_head = marker_line(ver).encode("ascii") + (b"\r" if head.endswith(b"\r") else b"")
    return "update", new_head + sep + rest


def write_framework_file(dpath, data):
    """写入框架文件；已有且内容不同 → 先删同名旧 .bak 再备份。返回 add/update/same。"""
    if os.path.isfile(dpath):
        old = read_bytes(dpath)
        if old == data:
            return "same"
        bak = dpath + ".bak"
        if os.path.exists(bak):
            os.unlink(bak)  # 先删同名旧 bak，再备份本次被覆盖的版本
        write_bytes(bak, old)
        write_bytes(dpath, data)
        return "update"
    write_bytes(dpath, data)
    return "add"


def fail(msg):
    print(msg, file=sys.stderr)
    return 1


# knowledge/rules.md 空骨架（内嵌而非模板文件：rules.md 属业务文件不入框架清单，
# 骨架仅装机铺底，让 consultant 首次「读 rules.md」不落空；已有文件绝不覆盖）
RULES_SKELETON = """# 常驻规则（内存层：最终版，保持很短）

> 装机生成的空骨架：本项目积累的常驻规则写在这里。总量 ≤1500 字，由 scripts/check-size.py 检查。

## 流程
（一行流程指针，详见 PROTOCOL.md）

## 规则
（强制/禁止条目，每条 ≤40 字、可独立阅读；准入：每条须追溯到一次真实错误或人的纠正）

## 经验
（流程相关的少量经验；业务细节放 topics/ 与 log/）
"""


def check(target):
    mpath = os.path.join(target, ".oht", ".manifest")
    if not os.path.isfile(mpath):
        return fail("校验中止：目标缺 .oht/.manifest，先安装生成后再 --check")
    try:
        data = json.loads(read_bytes(mpath).decode("utf-8"))
    except ValueError:
        return fail("校验中止：.oht/.manifest 不是合法 JSON，清单本身可能被改")
    files = data.get("files")
    if not isinstance(files, dict) or not files:
        return fail("校验中止：.oht/.manifest 缺 files 哈希清单")
    bad = []
    for rel in sorted(files):
        p = os.path.join(target, *rel.split("/"))
        if not os.path.isfile(p):
            bad.append("被删/缺失: %s" % rel)
        elif sha256_hex(read_bytes(p)) != files[rel]:
            bad.append("被改动: %s" % rel)
    if bad:
        for b in bad:
            print(b, file=sys.stderr)
        return fail("校验失败：%d 个框架文件与 .manifest 不符" % len(bad))
    print("校验通过：%d 个框架文件与 .manifest 一致（版本 %s）" % (len(files), data.get("version", "?")))
    return 0


def install(target, src):
    files = load_framework_files()
    src_ver = read_version(os.path.join(src, ".oht", "VERSION"))
    if src_ver is None:
        return fail("install 中止：源（%s）缺 .oht/VERSION 或非合法 x.y.z，不是有效框架源" % src)
    # 防降级先于一切写动作：拒绝路径上目标零改动、零 .bak
    tgt_ver_path = os.path.join(target, ".oht", "VERSION")
    tgt_ver = read_version(tgt_ver_path)
    if tgt_ver is not None:
        if ver_tuple(tgt_ver) > ver_tuple(src_ver):
            return fail("禁止降级：目标版本 %s 高于源版本 %s，目标未改动，拒绝安装" % (tgt_ver, src_ver))
    elif os.path.isfile(tgt_ver_path):
        return fail("install 中止：目标 .oht/VERSION 非合法 x.y.z，先修正或删除后再装")

    counts = {"add": 0, "update": 0, "same": 0}
    notes = []
    hashes = {}
    for rel in sorted(files):
        spath = os.path.join(src, *rel.split("/"))
        if not os.path.isfile(spath):
            return fail("install 中止：源缺框架文件 %s" % rel)
        data = read_bytes(spath)
        dpath = os.path.join(target, *rel.split("/"))
        if rel == "AGENTS.md":
            action, final = plan_root_agents(dpath, data, src_ver)
            if action == "user_kept":
                notes.append("目标已有用户根 AGENTS.md，原样保留不覆盖、不入 manifest")
                counts["same"] += 1
                continue
            action = write_framework_file(dpath, final)
        else:
            action = write_framework_file(dpath, data)
        counts[action] += 1
        hashes[rel] = sha256_hex(read_bytes(dpath))

    # 业务骨架缺则补（只建目录与 .gitkeep 占位，绝不碰业务文件）
    for d in (".oht/tasks", ".oht/knowledge/log", ".oht/knowledge/topics", ".oht/local/roles"):
        os.makedirs(os.path.join(target, *d.split("/")), exist_ok=True)
    for g in (".oht/tasks/.gitkeep", ".oht/knowledge/log/.gitkeep",
              ".oht/knowledge/topics/.gitkeep", ".oht/local/roles/.gitkeep"):
        gp = os.path.join(target, *g.split("/"))
        if not os.path.exists(gp):
            write_bytes(gp, b"")
    rules_path = os.path.join(target, ".oht", "knowledge", "rules.md")
    if not os.path.exists(rules_path):
        write_bytes(rules_path, RULES_SKELETON.encode("utf-8"))
        notes.append("已生成空骨架 .oht/knowledge/rules.md（业务文件，已有则不动、升级不覆盖）")

    man = {"version": src_ver, "files": {k: hashes[k] for k in sorted(hashes)}}
    write_bytes(os.path.join(target, ".oht", ".manifest"),
                (json.dumps(man, ensure_ascii=False, sort_keys=True, indent=1) + "\n").encode("utf-8"))
    print("install 完成：源版本 %s → 目标 %s（新增 %d，更新 %d，未变 %d）；业务区未写未删；清单 .oht/.manifest 已生成"
          % (src_ver, target, counts["add"], counts["update"], counts["same"]))
    for n in notes:
        print("  " + n)
    return 0


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="框架安装=升级（T0029）")
    ap.add_argument("--to", required=True, help="目标项目根")
    ap.add_argument("--from", dest="src", default=None,
                    help="源仓库根或 pack 产物目录，缺省=脚本所在仓库根")
    ap.add_argument("--check", action="store_true",
                    help="只校验：目标框架文件逐个比对 .oht/.manifest 哈希")
    a = ap.parse_args(argv)
    target = os.path.abspath(a.to)
    if a.check:
        return check(target)
    return install(target, os.path.abspath(a.src) if a.src else DEFAULT_FROM)


if __name__ == "__main__":
    sys.exit(main())

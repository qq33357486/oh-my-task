"""内置框架副本生成器（T0035/A5）：母本 → app/src/template/bundle.gen.ts。

用法：cd app && npm run gen:template（= python -I scripts/gen-template.py）

- 清单唯一权威源：同仓库 .oht/scripts/pack.py 的 FRAMEWORK_FILES（importlib
  加载，不另立清单）；RULES_SKELETON 取自 .oht/scripts/install.py（同源，
  绝不读母本业务 knowledge/rules.md）。
- 产物：src/template/bundle.gen.ts，含 FRAMEWORK_VERSION（=.oht/VERSION）、
  RULES_SKELETON、FRAMEWORK_FILES: {path, content, sha256}[]（content 与
  母本逐字一致，sha256 为 UTF-8 字节十六进制摘要，供 .manifest 直写）。
- 重跑幂等：输入不变则产物字节不变；产物入库可 diff，禁手改。
- content 用 json.dumps（ensure_ascii）嵌成 TS 字符串字面量，杜绝转义漂移。
"""
import hashlib
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(APP_DIR)  # app/scripts → app → 仓库根
OUT_PATH = os.path.join(APP_DIR, "src", "template", "bundle.gen.ts")

HEADER = """\
/**
 * 【生成产物，禁手改】内置框架副本（T0035/A5 漂移探测器锁定面）。
 * 由 app/scripts/gen-template.py 从仓库母本生成：cd app && npm run gen:template
 * 母本：根 AGENTS.md + .oht/ 全部框架文件（清单唯一权威源 = pack.py 的
 * FRAMEWORK_FILES）；content 与母本逐字一致，sha256 为 UTF-8 字节十六进制
 * 摘要（.manifest 直写依赖）；FRAMEWORK_VERSION 与 .oht/VERSION 同值；
 * RULES_SKELETON 为装机空骨架（install.py 同源，绝非母本业务 rules.md）。
 */

/** 母本单个框架文件（path 相对仓库根，POSIX 正斜杠） */
export interface BundleFile {
  path: string;
  content: string;
  sha256: string;
}

"""


def load_const(script_name, const_name):
    """从 .oht/scripts/<script_name> 加载模块级常量（不执行 main）。"""
    path = os.path.join(REPO_ROOT, ".oht", "scripts", script_name)
    if not os.path.isfile(path):
        sys.exit("gen-template 中止：找不到 %s" % path)
    saved = sys.dont_write_bytecode
    sys.dont_write_bytecode = True  # 不落 __pycache__，防污染框架区
    try:
        spec = importlib.util.spec_from_file_location(script_name[:-3], path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    finally:
        sys.dont_write_bytecode = saved
    return getattr(mod, const_name)


def main():
    files = list(load_const("pack.py", "FRAMEWORK_FILES"))
    rules_skeleton = load_const("install.py", "RULES_SKELETON")

    version_path = os.path.join(REPO_ROOT, ".oht", "VERSION")
    with open(version_path, "rb") as f:
        version = f.read().decode("utf-8").strip()
    if not version:
        sys.exit("gen-template 中止：母本 .oht/VERSION 为空")

    entries = []
    for rel in files:
        fpath = os.path.join(REPO_ROOT, *rel.split("/"))
        if not os.path.isfile(fpath):
            sys.exit("gen-template 中止：母本缺清单文件 %s" % rel)
        with open(fpath, "rb") as f:
            raw = f.read()
        entries.append({
            "path": rel,
            "content": raw.decode("utf-8"),
            "sha256": hashlib.sha256(raw).hexdigest(),
        })

    body = [
        HEADER,
        "export const FRAMEWORK_VERSION = %s;\n" % json.dumps(version),
        "export const RULES_SKELETON = %s;\n" % json.dumps(rules_skeleton),
        "export const FRAMEWORK_FILES: BundleFile[] = %s;\n"
        % json.dumps(entries, ensure_ascii=True, indent=2),
    ]
    out = "\n".join(body)
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)
    print("gen-template 完成：%d 个框架文件，版本 %s → %s"
          % (len(entries), version, os.path.relpath(OUT_PATH, REPO_ROOT)))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()

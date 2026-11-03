"""无锁新卡编号：O_EXCL 原子创建 tasks/T####.md，撞号自动顺延。

用法：python -I .oht/scripts/newcard.py [--tasks 目录] [--title 标题] [--origin 值] [--parent 卡号]
stdout 一行 JSON {"id": "T0022", "path": "..."}。收件不取锁，多人同时建卡不会撞号。
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TASKS = os.path.join(os.path.dirname(HERE), "tasks")
ID_RE = re.compile(r"^T(\d{4,})\.md$")


def max_id(tasks_dir):
    nums = [int(m.group(1)) for n in os.listdir(tasks_dir) if (m := ID_RE.match(n))]
    return max(nums, default=0)


def render(template, card_id, title, origin, parent):
    text = template.replace("T0000", card_id, 1)
    if title:
        text = re.sub(r'^title: ""', 'title: "%s"' % title.replace('"', "'"), text, count=1, flags=re.M)
    if origin:
        text = re.sub(r'^origin: ""', 'origin: "%s"' % origin, text, count=1, flags=re.M)
    if parent:
        text = re.sub(r'^parent: ""', 'parent: "%s"' % parent, text, count=1, flags=re.M)
    return text


def create(tasks_dir, title="", origin="", parent=""):
    with open(os.path.join(tasks_dir, "_template.md"), encoding="utf-8") as f:
        template = f.read()
    n = max_id(tasks_dir) + 1
    while True:
        card_id = "T%04d" % n
        path = os.path.join(tasks_dir, card_id + ".md")
        try:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
        except FileExistsError:
            n += 1
            continue
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(render(template, card_id, title, origin, parent))
        return card_id, path


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--tasks", default=DEFAULT_TASKS)
    ap.add_argument("--title", default="")
    ap.add_argument("--origin", default="")
    ap.add_argument("--parent", default="")
    a = ap.parse_args(argv)
    card_id, path = create(a.tasks, a.title, a.origin, a.parent)
    print(json.dumps({"id": card_id, "path": path}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

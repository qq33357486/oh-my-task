"""任务卡检查：头部、八节、验收条目、状态与条目状态一致、复述卡字数。
用法：python3 -I .oht/scripts/check-card.py [.oht根目录 | 卡片文件路径]
目录模式下扫到 0 张卡时打印"未扫描到任何卡片，请确认 ROOT 路径"并 exit 1；单卡模式无此判定。"""
import re, sys, glob, os

HERE = os.path.dirname(os.path.abspath(__file__))
_arg = sys.argv[1] if len(sys.argv) > 1 else ""
if _arg and os.path.isfile(_arg):  # 传入单张卡片：只校验该卡
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(_arg)))
    ONLY = os.path.abspath(_arg)
else:
    ROOT = _arg or os.path.dirname(HERE)  # 默认 .oht/（脚本所在目录的上一级）
    ONLY = None
STATUS = {"new", "tests", "ready", "review", "done", "recorded", "need_human"}
SECTIONS = ["原话", "需求", "复述卡", "验收条目", "系统文档改动", "进度", "失败原因", "候选教训", "人的回复"]
NEED4 = ["stopped_at", "resume_to", "stop_reason", "question"]
BRIEF_MAX = 200

bad = 0
cards = []


def err(name, msg):
    global bad
    print(f"{name} {msg}")
    bad += 1


n_cards = 0
for f in sorted(glob.glob(os.path.join(ROOT, "tasks/*.md")) if ONLY is None else [ONLY]):
    name = os.path.basename(f)
    if name.startswith("_"):
        continue
    n_cards += 1
    t = open(f, encoding="utf-8").read().replace("\r\n", "\n")
    m = re.match(r"---\n(.*?)\n---\n", t, re.S)
    if not m:
        err(name, "缺头部")
        continue
    h = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        h[k.strip()] = v.split("#")[0].strip().strip('"')
    body = t[m.end():]
    st = h.get("status", "")
    cards.append((name, st, h.get("system", "")))
    if st not in STATUS:
        err(name, f"status 无效：{st}")
    if h.get("id") != name[:-3]:
        err(name, "id 与文件名不一致")
    if st == "need_human":
        for k in NEED4:
            if not h.get(k):
                err(name, f"need_human 缺 {k}")
    if h.get("origin") not in ("", "split", "followup"):
        err(name, "origin 只能是 split 或 followup")
    if h.get("origin") and not h.get("parent"):
        err(name, "有 origin 必须有 parent")
    found = [s.split("（")[0].strip() for s in re.findall(r"^## (.+)$", body, re.M)]
    if found != SECTIONS:
        err(name, f"章节应为 {SECTIONS}")
        continue
    sec = {s: c for s, c in zip(SECTIONS, re.split(r"^## .+$", body, flags=re.M)[1:])}
    brief = re.sub(r"\s", "", sec["复述卡"])
    if len(brief) > BRIEF_MAX:
        err(name, f"复述卡 {len(brief)} 字 > {BRIEF_MAX}")
    if bool(h.get("system")) != bool(sec["系统文档改动"].strip()):
        err(name, "system 与“系统文档改动”须同时填写")
    items = re.split(r"^### (A\d+)", sec["验收条目"], flags=re.M)[1:]
    if st not in ("new",) and not (st == "recorded" and h.get("origin") == "") and not items:
        if not (st == "need_human" and h.get("stopped_at") in ("consultant", "咨询员")):
            err(name, "缺验收条目")
    for i in range(0, len(items), 2):
        aid, blk = items[i], items[i + 1]
        typ = re.search(r"^- 类型：(\S+)", blk, re.M)
        sta = re.search(r"^- 状态：(\S+)", blk, re.M)
        if not typ or typ.group(1) not in ("auto", "human"):
            err(name, f"{aid} 类型须为 auto 或 human")
            continue
        for k in ("查", "预期"):
            mm = re.search(rf"^- {k}：(.*)$", blk, re.M)
            if not mm or not mm.group(1).strip():
                err(name, f"{aid} 缺 {k}")
        if not sta:
            err(name, f"{aid} 缺 状态")
            continue
        s, ty = sta.group(1), typ.group(1)
        if ty == "auto" and s not in ("未写", "红", "绿"):
            err(name, f"{aid} auto 状态无效：{s}")
        if ty == "human" and s not in ("人看", "绿"):
            err(name, f"{aid} human 状态无效：{s}")
        if ty == "auto" and st in ("ready", "review") and s == "未写":
            err(name, f"{aid} {st} 时 auto 不得未写（须红或绿，如实记录）")
        if st in ("done", "recorded") and s != "绿":
            err(name, f"{aid} {st} 时应为绿，实为 {s}")
if ONLY is None and n_cards == 0:
    print("未扫描到任何卡片，请确认 ROOT 路径")
    sys.exit(1)
TOP = os.path.join(ROOT, "knowledge/topics")
for name, st, sysn in cards:
    if sysn and st != "new":
        doc = os.path.join(TOP, sysn + ".md")
        if not os.path.exists(doc):
            err(name, f"系统文档 {sysn}.md 不存在")
        elif st == "recorded" and "状态：草稿" in open(doc, encoding="utf-8").read():
            err(name, f"已 recorded，但 {sysn}.md 仍是草稿")
for f in sorted(glob.glob(os.path.join(TOP, "*.md"))):
    n = os.path.basename(f)
    if n.startswith("_"):
        continue
    t = open(f, encoding="utf-8").read()
    if "状态：草稿" not in t and "状态：定稿" not in t:
        err(n, "系统文档缺“状态：草稿/定稿”")
print(f"超限 {bad} 处")
sys.exit(1 if bad else 0)

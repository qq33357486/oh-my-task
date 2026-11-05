"""任务卡检查：头部、八节、验收条目、状态与条目状态一致、复述卡字数、title 字段。
用法：python3 -I .oht/scripts/check-card.py [.oht根目录 | 卡片文件路径]
目录模式下扫到 0 张卡时打印"未扫描到任何卡片，请确认 ROOT 路径"并 exit 1；单卡模式无此判定。
title（T0015）：非 _ 开头卡 frontmatter 必填，人话单行 ≤24 字（无日期、卡号、
括号注记，给人看的摘要）；缺 title 或超 24 字报错。"""
import re, sys, glob, os

HERE = os.path.dirname(os.path.abspath(__file__))
_arg = sys.argv[1] if len(sys.argv) > 1 else ""
if _arg and os.path.isfile(_arg):  # 传入单张卡片：只校验该卡
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(_arg)))
    ONLY = os.path.abspath(_arg)
else:
    ROOT = _arg or os.path.dirname(HERE)  # 默认 .oht/（脚本所在目录的上一级）
    ONLY = None
STAGE = {"需求", "实现", "检查"}
PROGRESS = {"未执行", "执行中", "执行完毕"}
# 二维状态机（T0037）：stage×progress 取代旧一维 status（new/ready/review/done 已废）。
# 终态=（检查,执行完毕）；need_human 为旁路布尔字段，不再是状态值。
SECTIONS = ["原话", "需求", "复述卡", "验收条目", "系统文档改动", "进度", "失败原因", "候选教训", "人的回复"]
NEED4 = ["stopped_at", "resume_to", "stop_reason", "question"]
BRIEF_MAX = 200
TITLE_MAX = 24

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
    stg = h.get("stage", "")
    prg = h.get("progress", "")
    nh = h.get("need_human", "false").strip().lower() == "true"
    final = stg == "检查" and prg == "执行完毕"
    cards.append((name, stg, prg, nh, h.get("system", "")))
    if stg not in STAGE:
        err(name, f"stage 无效：{stg}（须为 {'/'.join(sorted(STAGE))}）")
    if prg not in PROGRESS:
        err(name, f"progress 无效：{prg}（须为 {'/'.join(sorted(PROGRESS))}）")
    if h.get("need_human", "false").strip().lower() not in ("true", "false"):
        err(name, "need_human 只能是 true 或 false")
    if h.get("id") != name[:-3]:
        err(name, "id 与文件名不一致")
    title = h.get("title", "")
    if not title:
        err(name, "缺 title（frontmatter 必填：人话单行 ≤24 字，给人看的摘要）")
    elif len(title) > TITLE_MAX:
        err(name, f"title {len(title)} 字 > {TITLE_MAX}")
    if nh:
        for k in NEED4:
            if not h.get(k):
                err(name, f"need_human=true 缺 {k}")
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
    # 验收条目存在性：仅建卡初态（需求,未执行/执行中）可无条目；
    # need_human 停在需求阶段（咨询员拷问中卡住）同样放行
    fresh = stg == "需求" and prg in ("未执行", "执行中")
    if not fresh and not items:
        if not (nh and stg == "需求" and prg != "执行完毕"):
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
        # 条目交付后（定稿完毕/已进实现或检查）auto 不得未写；初态（需求,未执行/执行中）可
        # T0046 预留特例：拆卡子卡定稿置（需求,执行完毕）时，接口随实现落定的条目
        # 经咨询员在「查」行显式注记「预留」可暂不写测试；进入实现栏后本豁免失效
        # （实现完毕前必须落红/绿），防放水。
        delivered = not fresh
        chk_line = re.search(r"^- 查：(.*)$", blk, re.M)
        reserved = bool(chk_line) and "预留" in chk_line.group(1)
        if ty == "auto" and delivered and s == "未写" and not (
            stg == "需求" and prg == "执行完毕" and reserved
        ):
            err(name, f"{aid} ({stg},{prg}) 时 auto 不得未写（须红或绿，如实记录）")
        if final and s != "绿":
            err(name, f"{aid} 终态（检查,执行完毕）时应为绿，实为 {s}")
if ONLY is None and n_cards == 0:
    print("未扫描到任何卡片，请确认 ROOT 路径")
    sys.exit(1)
TOP = os.path.join(ROOT, "knowledge/topics")
for name, stg, prg, nh, sysn in cards:
    if sysn and not (stg == "需求" and prg in ("未执行", "执行中")):
        doc = os.path.join(TOP, sysn + ".md")
        if not os.path.exists(doc):
            err(name, f"系统文档 {sysn}.md 不存在")
        elif stg == "检查" and prg == "执行完毕" and "状态：草稿" in open(doc, encoding="utf-8").read():
            err(name, f"已终态（检查,执行完毕），但 {sysn}.md 仍是草稿")
for f in sorted(glob.glob(os.path.join(TOP, "*.md"))):
    n = os.path.basename(f)
    if n.startswith("_"):
        continue
    t = open(f, encoding="utf-8").read()
    if "状态：草稿" not in t and "状态：定稿" not in t:
        err(n, "系统文档缺“状态：草稿/定稿”")
print(f"超限 {bad} 处")
sys.exit(1 if bad else 0)

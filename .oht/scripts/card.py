"""卡片结构写入唯一入口（人八项定案后新增：结构字段禁手改，一切角色写卡走本脚本）。

背景：frontmatter/状态/日期/章节骨架由脚本保证格式（构造即正确），agent 只产内容。
时间戳 stage_changed_at = 当前「stage,progress」生效时刻（ISO 8601 带时区），随状态
变更自动内嵌；进度行日期由系统时钟生成。互斥不设锁（T0031 废锁定案：单一会话主持
+工作流纪律），写卡走 temp+os.replace 原子替换防半写态。建卡用 newcard.py，本脚本
不管建卡。台账（dispatcher.log）含调度员现场判断，仍由调度员手写，本脚本不代写。

用法：python -I .oht/scripts/card.py [--root .oht根] <子命令> …
子命令（署名为进度行落名；状态类自动记进度行与时间戳）：
  receive  <id> --note 一句          咨询员接待：(需求,未执行)→(需求,执行中)
  progress <id> --note 一句          工人置毕：(X,执行中)→(X,执行完毕)
  advance  <id> --note 一句          调度员推进：需求毕→(实现,执行中)；实现毕→(检查,执行中)
  reassign <id> --note 一句          调度员打回：检查栏→(实现,执行中)，round+1（全绿终态拒）
  stop     <id> --role 角色 --stopped-at S --resume-to R --reason Z --question Q --note 一句
                                      谁卡谁停：need_human 四字段成套写，stage/progress 冻结
  resume   <id> --note 一句          调度员恢复：按 resume_to 置回，replied=true，四字段清空
  log      <id> --role 角色 --from 文件            进度行追加（日期+角色前缀自动；正文须单行）
  write    <id> --section 节名 --from 文件         整节覆盖（九节名之一；内容原样多行）
  accept   <id> add --from 文件 [--type auto|human] 验收条目追加（文件恰三行：标题/查/预期；
                                      A 号自动递增，状态置未写）
  accept   <id> status <A号> <绿|红|未写|人看>      验收条目状态改写
  lesson   <id> --from 文件          候选教训行追加（文件一行：场景｜教训）
  set      <id> --to <stage,progress> --note 一句  拆卡特殊置位（咨询员；终态不复活）
  set      <id> --replied true|false               咨询员代写人回复后的置位
  set      <id> [--intent|--status|--outcome 一句]  人话位直写（各 ≤40 字）
状态类命令均可选 --status 一句：状态变更时顺手更新人话位「现在怎样」。
状态类命令须 need_human=false（冻结卡禁动）；resume 须 need_human=true。
一切输出走 stdout 一行结果，失败 exit 1 并写 stderr。
"""
import argparse
import datetime
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ROOT = os.path.dirname(HERE)
SECTIONS = ["原话", "需求", "复述卡", "验收条目", "系统文档改动", "进度", "失败原因", "候选教训", "人的回复"]

# 合法状态转移表（need_human=false 前提下）；终态全绿卡另在 reassign 内拒
LEGAL = {
    "receive": {("需求", "未执行"): ("需求", "执行中")},
    "progress": {(s, "执行中"): (s, "执行完毕") for s in ("需求", "实现", "检查")},
    "advance": {("需求", "执行完毕"): ("实现", "执行中"), ("实现", "执行完毕"): ("检查", "执行中")},
    "reassign": {("检查", "执行中"): ("实现", "执行中"), ("检查", "执行完毕"): ("实现", "执行中")},
}
WORKER = {"需求": "咨询员", "实现": "实现员", "检查": "检查员"}


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


class Card:
    """单张卡：frontmatter 行列表 + 正文行列表；定位编辑，不整卡重写。"""

    def __init__(self, root, cid):
        cid = re.sub(r"\.md$", "", cid.strip())
        if not re.fullmatch(r"T\d{4,}", cid):
            die(f"卡号无效：{cid}（形如 T0047）")
        self.path = os.path.join(root, "tasks", cid + ".md")
        if not os.path.exists(self.path):
            die(f"卡片不存在：{self.path}")
        text = open(self.path, encoding="utf-8").read().replace("\r\n", "\n")
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
        if not m:
            die(f"{cid} 缺头部结构（--- frontmatter ---）")
        self.cid = cid
        self.fm = m.group(1).split("\n")
        self.body = m.group(2).split("\n")

    @property
    def fmtext(self):
        return "\n".join(self.fm)

    def get(self, key):
        m = re.search(rf"^{re.escape(key)}\s*:(.*?)(\s*#.*)?$", self.fmtext, re.M)
        return m.group(1).strip().strip('"') if m else ""

    def state(self):
        return self.get("stage"), self.get("progress")

    def set_fm(self, key, value, after_key=None):
        """改值保留行内注释；键不存在则插到 after_key 行后。"""
        pat = re.compile(rf"^({re.escape(key)}\s*:)(.*?)(\s*#.*)?$")
        for i, ln in enumerate(self.fm):
            m = pat.match(ln)
            if m:
                self.fm[i] = f"{key}: {value}" + (m.group(3) or "")
                return
        if after_key:
            for i, ln in enumerate(self.fm):
                if re.match(rf"^{re.escape(after_key)}\s*:", ln):
                    self.fm.insert(i + 1, f"{key}: {value}")
                    return
        self.fm.append(f"{key}: {value}")

    def section_range(self, name):
        """返回节的 [头行号, 尾行号) 区间（头=## name 行，尾=下一 ## 行或文件尾）。"""
        if name not in SECTIONS:
            die(f"节名无效：{name}（九节之一）")
        head = None
        for i, ln in enumerate(self.body):
            if ln.startswith("## "):
                if head is not None:
                    return head, i
                if ln[3:].strip() == name:
                    head = i
        if head is not None:
            return head, len(self.body)
        die(f"{self.cid} 缺「## {name}」节")

    def append_to_section(self, name, new_lines):
        """在节内最后一个非空行后插入（节尾空行让位于下一节）。"""
        head, tail = self.section_range(name)
        insert_at = head + 1
        for i in range(head + 1, tail):
            if self.body[i].strip():
                insert_at = i + 1
        self.body[insert_at:insert_at] = new_lines

    def log_line(self, role, note):
        date_s = datetime.datetime.now().astimezone().strftime("%Y-%m-%d")
        self.append_to_section("进度", [f"- {date_s} {role}：{note}"])

    def save(self):
        tmp = self.path + ".tmp-card"  # 非 .md 后缀：check-card/scanTasks 均不扫
        with open(tmp, "w", encoding="utf-8", newline="\n") as f:
            f.write("---\n" + "\n".join(self.fm) + "\n---\n" + "\n".join(self.body))
        os.replace(tmp, self.path)


def read_from(path):
    if not path or not os.path.isfile(path):
        die(f"--from 文件不存在：{path}")
    return open(path, encoding="utf-8").read().strip()


HUMAN_MAX = 40  # 人话位一句上限（防啰嗦硬闸，check-card 同口径校验）


def set_human(card, field, value):
    """写人话位（intent/status/outcome）：非空须 ≤40 字。"""
    if value is None:
        return
    if len(value) > HUMAN_MAX:
        die(f"{field} 人话位 {len(value)} 字 > {HUMAN_MAX}（一句说清）")
    card.set_fm(field, value)


def touch_timestamp(card):
    card.set_fm("stage_changed_at", datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "progress")


def guard_active(card, cmd):
    if card.get("need_human").lower() == "true":
        die(f"{card.cid} need_human=true 冻结中，{cmd} 禁动（先 resume）")
    (stg, prg) = card.state()
    if (stg, prg) not in LEGAL[cmd]:
        die(f"{card.cid} 当前 ({stg},{prg})，{cmd} 无合法转移（合法起点：{sorted(LEGAL[cmd])}）")


def apply_transition(card, cmd, note, role, human=None):
    (stg, prg) = card.state()
    nstg, nprg = LEGAL[cmd][(stg, prg)]
    if cmd in ("advance", "reassign"):
        card.set_fm("stage", nstg)
    if cmd == "reassign":
        card.set_fm("round", str(int(card.get("round") or 0) + 1))
    card.set_fm("progress", nprg)
    set_human(card, "status", human)
    touch_timestamp(card)
    card.log_line(role, note)
    card.save()
    r = f"round={card.get('round')}" if cmd == "reassign" else ""
    print(f"{card.cid} ({stg},{prg}) → ({nstg},{nprg}) {r}stage_changed_at={card.get('stage_changed_at')} 进度行已记")


def cmd_receive(a):
    c = Card(a.root, a.id)
    guard_active(c, "receive")
    apply_transition(c, "receive", a.note, "咨询员", getattr(a, 'status', None))


def cmd_progress(a):
    c = Card(a.root, a.id)
    guard_active(c, "progress")
    apply_transition(c, "progress", a.note, WORKER[c.state()[0]], getattr(a, 'status', None))


def cmd_advance(a):
    c = Card(a.root, a.id)
    guard_active(c, "advance")
    apply_transition(c, "advance", a.note, "调度员", getattr(a, 'status', None))


def cmd_reassign(a):
    c = Card(a.root, a.id)
    guard_active(c, "reassign")
    if c.state() == ("检查", "执行完毕") and not has_red(c):
        die(f"{c.cid} 终态全绿，reassign 拒（重派终态卡须人明示）")
    apply_transition(c, "reassign", a.note, "调度员", getattr(a, 'status', None))


def has_red(card):
    head, tail = card.section_range("验收条目")
    return any(re.match(r"^- 状态：(红)$", ln) for ln in card.body[head:tail])


def cmd_stop(a):
    c = Card(a.root, a.id)
    if c.get("need_human").lower() == "true":
        die(f"{c.cid} 已 need_human=true，勿重复 stop")
    (stg, prg) = c.state()
    if (stg, prg) == ("检查", "执行完毕") and not has_red(c):
        die(f"{c.cid} 终态全绿，stop 拒（终态卡无事可停）")
    c.set_fm("need_human", "true")
    c.set_fm("stopped_at", a.stopped_at)
    c.set_fm("resume_to", a.resume_to)
    c.set_fm("stop_reason", a.reason)
    c.set_fm("question", a.question)
    set_human(c, "status", getattr(a, "status", None))
    c.log_line(a.role, a.note)
    c.save()
    print(f"{c.cid} ({stg},{prg}) 停卡（{a.role}）：stopped_at={a.stopped_at} resume_to={a.resume_to}（stage/progress 冻结）")


def cmd_resume(a):
    c = Card(a.root, a.id)
    if c.get("need_human").lower() != "true":
        die(f"{c.cid} need_human=false，无停可恢复")
    m = re.fullmatch(r"(需求|实现|检查),(未执行|执行中|执行完毕)", c.get("resume_to"))
    if not m:
        die(f"{c.cid} resume_to 无效：{c.get('resume_to')!r}（形如 实现,执行中）")
    c.set_fm("need_human", "false")
    c.set_fm("stage", m.group(1))
    c.set_fm("progress", m.group(2))
    for k in ("stopped_at", "resume_to", "stop_reason", "question"):
        c.set_fm(k, '""')
    c.set_fm("replied", "false")  # PROTOCOL「人的介入」：恢复即消费，replied 复位
    touch_timestamp(c)
    c.log_line("调度员", a.note)
    c.save()
    print(f"{c.cid} 恢复 → ({m.group(1)},{m.group(2)}) stage_changed_at={c.get('stage_changed_at')}")


def cmd_log(a):
    c = Card(a.root, a.id)
    note = read_from(a.from_file)
    if "\n" in note:
        die("进度行正文须单行（多行内容用 write 写对应节）")
    c.log_line(a.role, note)
    c.save()
    print(f"{c.cid} 进度行已记（{a.role}）")


def cmd_write(a):
    c = Card(a.root, a.id)
    head, tail = c.section_range(a.section)
    content = read_from(a.from_file)
    new_block = [f"## {a.section}"] + (content.split("\n") if content else [])
    c.body[head:tail] = new_block + [""]
    c.save()
    print(f"{c.cid} 「{a.section}」节已覆盖（{len(content)} 字符）")


def cmd_accept(a):
    c = Card(a.root, a.id)
    if a.action == "add":
        lines = read_from(a.from_file).split("\n")
        if len(lines) != 3 or not all(x.strip() for x in lines):
            die("accept add 的 --from 文件须恰三行：标题 / 查 / 预期")
        head, tail = c.section_range("验收条目")
        nums = [int(n.group(1)) for n in (re.match(r"^### A(\d+)", ln) for ln in c.body[head:tail]) if n]
        aid = max(nums, default=0) + 1
        block = ["", f"### A{aid} {lines[0].strip()}", f"- 类型：{a.type}", f"- 查：{lines[1].strip()}",
                 f"- 预期：{lines[2].strip()}", "- 状态：未写"]
        c.append_to_section("验收条目", block)
        c.save()
        print(f"{c.cid} A{aid} 已追加（类型 {a.type}，状态未写）")
    else:  # status
        sta = a.value
        if sta not in ("绿", "红", "未写", "人看"):
            die(f"状态值无效：{sta}（绿|红|未写|人看）")
        head, tail = c.section_range("验收条目")
        pat = re.compile(rf"^### {re.escape(a.item)}\b")
        for i in range(head + 1, tail):
            if pat.match(c.body[i]):
                for j in range(i + 1, min(i + 8, tail)):
                    if c.body[j].startswith("- 状态："):
                        old = c.body[j][5:]
                        c.body[j] = f"- 状态：{sta}"
                        c.save()
                        print(f"{c.cid} {a.item} 状态 {old} → {sta}")
                        return
                die(f"{c.cid} {a.item} 块内未找到「- 状态：」行")
        die(f"{c.cid} 验收条目无 {a.item}")


def cmd_set(a):
    """特殊置位：拆卡（原卡置终态/子卡置执行完毕）与 replied 代写。--to 限咨询员拆卡场景。"""
    c = Card(a.root, a.id)
    if a.to:
        if c.get("need_human").lower() == "true":
            die(f"{c.cid} need_human=true 冻结中，set --to 禁动（先 resume）")
        m = re.fullmatch(r"(需求|实现|检查),(未执行|执行中|执行完毕)", a.to)
        if not m:
            die(f"--to 无效：{a.to!r}（形如 检查,执行完毕）")
        if c.state() == ("检查", "执行完毕") and a.to != "检查,执行完毕":
            die(f"{c.cid} 已终态不复活（事后纠正建跟进卡）")
        (ostg, oprg) = c.state()
        c.set_fm("stage", m.group(1))
        c.set_fm("progress", m.group(2))
        touch_timestamp(c)
        c.log_line("咨询员", a.note)
        c.save()
        print(f"{c.cid} ({ostg},{oprg}) set→ ({m.group(1)},{m.group(2)}) stage_changed_at={c.get('stage_changed_at')}")
    elif any((a.replied, a.intent, a.human_status, a.outcome)):
        if a.replied:
            if a.replied not in ("true", "false"):
                die("--replied 须 true 或 false")
            c.set_fm("replied", a.replied)
        set_human(c, "intent", a.intent)
        set_human(c, "status", a.human_status)
        set_human(c, "outcome", a.outcome)
        c.save()
        wrote = [k for k, v in (("intent", a.intent), ("status", a.human_status), ("outcome", a.outcome), ("replied", a.replied)) if v]
        print(f"{c.cid} 人话位已写: {' '.join(wrote)}")
    else:
        die("set 须 --to / --replied / 人话位之一")


def cmd_lesson(a):
    c = Card(a.root, a.id)
    parts = read_from(a.from_file).split("｜")
    if len(parts) != 2 or not all(p.strip() for p in parts):
        die("lesson 的 --from 文件须一行两段：场景｜教训")
    date_s = datetime.datetime.now().astimezone().strftime("%Y-%m-%d")
    c.append_to_section("候选教训", [f"- {date_s}｜{c.cid}｜{parts[0].strip()}｜{parts[1].strip()}｜0｜候选"])
    c.save()
    print(f"{c.cid} 教训候选已记")


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="卡片结构写入唯一入口")
    ap.add_argument("--root", default=DEFAULT_ROOT)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add(name, fn):
        p = sub.add_parser(name)
        p.add_argument("id")
        p.set_defaults(fn=fn)
        return p

    p = add("receive", cmd_receive); p.add_argument("--note", required=True); p.add_argument("--status")
    p = add("progress", cmd_progress); p.add_argument("--note", required=True); p.add_argument("--status")
    p = add("advance", cmd_advance); p.add_argument("--note", required=True); p.add_argument("--status")
    p = add("reassign", cmd_reassign); p.add_argument("--note", required=True); p.add_argument("--status")
    p = add("stop", cmd_stop)
    p.add_argument("--role", required=True)
    p.add_argument("--stopped-at", required=True); p.add_argument("--resume-to", required=True)
    p.add_argument("--reason", required=True); p.add_argument("--question", required=True)
    p.add_argument("--note", required=True); p.add_argument("--status")
    p = add("resume", cmd_resume); p.add_argument("--note", required=True); p.add_argument("--status")
    p = add("log", cmd_log); p.add_argument("--role", required=True); p.add_argument("--from", dest="from_file", required=True)
    p = add("write", cmd_write); p.add_argument("--section", required=True); p.add_argument("--from", dest="from_file", required=True)
    p = add("accept", cmd_accept)
    p.add_argument("action", choices=["add", "status"])
    p.add_argument("--from", dest="from_file")
    p.add_argument("--type", default="auto", choices=["auto", "human"])
    p.add_argument("item", nargs="?"); p.add_argument("value", nargs="?")
    p = add("set", cmd_set)
    p.add_argument("--to"); p.add_argument("--note"); p.add_argument("--replied")
    p.add_argument("--intent"); p.add_argument("--status", dest="human_status"); p.add_argument("--outcome")
    p = add("lesson", cmd_lesson); p.add_argument("--from", dest="from_file", required=True)

    a = ap.parse_args(argv)
    if a.cmd == "accept" and a.action == "add" and not a.from_file:
        die("accept add 须 --from 文件（三行：标题/查/预期）")
    if a.cmd == "accept" and a.action == "status" and (not a.item or not a.value):
        die("accept status 须 A号 与 状态值")
    if a.cmd == "set" and a.to and not a.note:
        die("set 须 --to+--note / --replied / 人话位之一")
    a.fn(a)
    return 0


if __name__ == "__main__":
    sys.exit(main())

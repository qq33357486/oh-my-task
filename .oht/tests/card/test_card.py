"""card.py 回归测试（断言式，python -I 运行，exit 0=全绿）。
覆盖：状态机全链转移/非法转移拒绝/时间戳与进度行/stop-resume 往返/冻结禁动/
write-log-accept-lesson/原子写无残留/契约（card.py 操作后 check-card.py 单卡 0 超限）。
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(os.path.dirname(os.path.dirname(HERE)), "scripts")
CARD = os.path.join(SCRIPTS, "card.py")
CHECK = os.path.join(SCRIPTS, "check-card.py")
TEMPLATE = os.path.join(os.path.dirname(SCRIPTS), "tasks", "_template.md")

fails = []


def ok(cond, name):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        fails.append(name)


def run(root, *args):
    r = subprocess.run([sys.executable, "-I", CARD, "--root", root, *args],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def check_one(card_path):
    r = subprocess.run([sys.executable, "-I", CHECK, card_path],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, r.stdout.strip()


def fresh_root():
    root = tempfile.mkdtemp(prefix="oht-card-test-")
    os.makedirs(os.path.join(root, "tasks"))
    shutil.copy(TEMPLATE, os.path.join(root, "tasks", "_template.md"))
    r = subprocess.run([sys.executable, "-I", os.path.join(SCRIPTS, "newcard.py"),
                        "--tasks", os.path.join(root, "tasks"), "--title", "测试卡"],
                       capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, r.stderr
    # 模板 A1 骨架查/预期为空（初建卡过不了 check-card 是框架既有事实：接待时填实）。
    # 契约链从「条目填实」起验，同时覆盖 write 子命令。
    spec = os.path.join(root, "spec.txt")
    open(spec, "w", encoding="utf-8", newline="\n").write(
        "### A1 断言测试条目\n- 类型：auto\n- 查：临时断言\n- 预期：通过\n- 状态：绿")
    r = run(root, "write", "T0001", "--section", "验收条目", "--from", spec)
    assert r[0] == 0, r[2]
    return root


def fm_of(path, key):
    m = re.search(rf"^{re.escape(key)}\s*:(.*?)(\s*#.*)?$", open(path, encoding="utf-8").read(), re.M)
    return m.group(1).strip() if m else None


def state_of(path):
    return fm_of(path, "stage"), fm_of(path, "progress")


# ---- 1. 全链状态机 + 契约（每步后 check-card 0 超限）----
root = fresh_root()
c = os.path.join(root, "tasks", "T0001.md")
ok(state_of(c) == ("需求", "未执行"), "建卡初态 (需求,未执行)")

code, out, _ = run(root, "receive", "T0001", "--note", "接待对齐需求")
ok(code == 0 and state_of(c) == ("需求", "执行中"), "receive → (需求,执行中)")
ok(fm_of(c, "stage_changed_at") and re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}", fm_of(c, "stage_changed_at")), "时间戳 ISO8601 带时区")
ok(re.search(r"^- \d{4}-\d{2}-\d{2} 咨询员：接待对齐需求$", open(c, encoding="utf-8").read(), re.M), "进度行日期+署名自动")
ok(check_one(c)[1].endswith("超限 0 处"), "契约:receive 后 check-card 0 超限")

code, _, err = run(root, "receive", "T0001", "--note", "重复接待")
ok(code == 1 and "无合法转移" in err, "重复 receive 拒绝")

run(root, "accept", "T0001", "status", "A1", "绿")  # 模板自带 A1 置绿防 delivered 未写
code, out, _ = run(root, "progress", "T0001", "--note", "需求定稿完毕")
ok(code == 0 and state_of(c) == ("需求", "执行完毕"), "progress → (需求,执行完毕)")
ok(check_one(c)[1].endswith("超限 0 处"), "契约:progress 后 0 超限")

code, out, _ = run(root, "advance", "T0001", "--note", "派发实现")
ok(code == 0 and state_of(c) == ("实现", "执行中"), "advance → (实现,执行中)")
code, out, _ = run(root, "progress", "T0001", "--note", "实现完毕")
code, out, _ = run(root, "advance", "T0001", "--note", "送检")
ok(code == 0 and state_of(c) == ("检查", "执行中"), "advance → (检查,执行中)")
code, out, _ = run(root, "progress", "T0001", "--note", "复核完毕")
ok(state_of(c) == ("检查", "执行完毕"), "全链到终态 (检查,执行完毕)")
ok(check_one(c)[1].endswith("超限 0 处"), "契约:终态 0 超限")
code, _, err = run(root, "advance", "T0001", "--note", "终态再推进")
ok(code == 1 and "无合法转移" in err, "终态 advance 拒绝")
code, _, err = run(root, "reassign", "T0001", "--note", "终态重派")
ok(code == 1 and "全绿" in err, "终态全绿 reassign 拒绝")
shutil.rmtree(root)

# ---- 2. reassign round+1 ----
root = fresh_root()
c = os.path.join(root, "tasks", "T0001.md")
run(root, "receive", "T0001", "--note", "接待")
run(root, "accept", "T0001", "status", "A1", "红")  # 有红，检查栏可打回
run(root, "progress", "T0001", "--note", "完毕")
run(root, "advance", "T0001", "--note", "派实现")
run(root, "progress", "T0001", "--note", "完毕")
run(root, "advance", "T0001", "--note", "送检")
code, out, _ = run(root, "reassign", "T0001", "--note", "A1 红打回")
ok(code == 0 and state_of(c) == ("实现", "执行中") and fm_of(c, "round") == "1", "reassign round 0→1")
ok(check_one(c)[1].endswith("超限 0 处"), "契约:reassign 后 0 超限")
shutil.rmtree(root)

# ---- 3. set：拆卡置位 / 终态不复活 / replied 代写 ----
root = fresh_root()
c = os.path.join(root, "tasks", "T0001.md")
code, out, _ = run(root, "set", "T0001", "--to", "需求,执行完毕", "--note", "拆卡即定稿")
ok(code == 0 and state_of(c) == ("需求", "执行完毕") and fm_of(c, "stage_changed_at"), "set 拆卡置位含时间戳")
code, out, _ = run(root, "set", "T0001", "--to", "检查,执行完毕", "--note", "原卡归档")
ok(code == 0 and state_of(c) == ("检查", "执行完毕"), "set 原卡置终态")
code, _, err = run(root, "set", "T0001", "--to", "实现,执行中", "--note", "终态复活")
ok(code == 1 and "不复活" in err, "set 终态不复活")
code, _, err = run(root, "set", "T0001", "--to", "需求,执行完毕")
ok(code == 1 and "--note" in err, "set --to 缺 note 拒绝")
code, out, _ = run(root, "set", "T0001", "--replied", "true")
ok(code == 0 and fm_of(c, "replied") == "true", "set replied 代写")
code, _, err = run(root, "set", "T0001", "--replied", "yes")
ok(code == 1 and "true 或 false" in err, "set replied 非法值拒绝")
shutil.rmtree(root)

# ---- 3b. stop/resume 往返与冻结 ----
root = fresh_root()
c = os.path.join(root, "tasks", "T0001.md")
run(root, "receive", "T0001", "--note", "接待")
code, out, _ = run(root, "stop", "T0001", "--role", "咨询员", "--stopped-at", "咨询员/拷问", "--resume-to", "需求,执行中",
                   "--reason", "需求有歧义", "--question", "选A还是B", "--note", "停卡待人")
ok(code == 0 and fm_of(c, "need_human") == "true" and state_of(c) == ("需求", "执行中"), "stop 冻结 stage/progress")
ok(fm_of(c, "question") == "选A还是B", "stop 四字段成套")
code, _, err = run(root, "advance", "T0001", "--note", "冻结中推进")
ok(code == 1 and "冻结" in err, "冻结卡 advance 拒绝")
code, out, _ = run(root, "resume", "T0001", "--note", "人已答复恢复")
ok(code == 0 and fm_of(c, "need_human") == "false" and fm_of(c, "replied") == "false", "resume 恢复+replied 复位")
ok(fm_of(c, "stopped_at") == '""' and fm_of(c, "question") == '""', "resume 四字段清空")
code, _, err = run(root, "resume", "T0001", "--note", "重复恢复")
ok(code == 1 and "无停可恢复" in err, "重复 resume 拒绝")
shutil.rmtree(root)

# ---- 4. log/write/accept/lesson ----
root = fresh_root()
c = os.path.join(root, "tasks", "T0001.md")
tmpf = os.path.join(root, "in.txt")
open(tmpf, "w", encoding="utf-8").write("单行正文")
code, out, _ = run(root, "log", "T0001", "--role", "实现员", "--from", tmpf)
ok(code == 0 and re.search(r"^- \d{4}-\d{2}-\d{2} 实现员：单行正文$", open(c, encoding="utf-8").read(), re.M), "log 进度行格式")
open(tmpf, "w", encoding="utf-8").write("两\n行")
code, _, err = run(root, "log", "T0001", "--role", "实现员", "--from", tmpf)
ok(code == 1 and "单行" in err, "log 多行拒绝")

open(tmpf, "w", encoding="utf-8").write("## 需求\n1. 甲乙丙\n2. 丁")
run(root, "write", "T0001", "--section", "需求", "--from", tmpf)
body = open(c, encoding="utf-8").read()
ok(re.search(r"## 需求\n1\. 甲乙丙\n2\. 丁\n\n## 复述卡", body), "write 整节覆盖且节序保位")
code, _, err = run(root, "write", "T0001", "--section", "不存在节", "--from", tmpf)
ok(code == 1 and "九节" in err, "write 非法节名拒绝")

open(tmpf, "w", encoding="utf-8").write("标题一\n查某断言\n预期通过")
code, out, _ = run(root, "accept", "T0001", "add", "--from", tmpf)
ok(code == 0 and "### A2 标题一" in open(c, encoding="utf-8").read(), "accept add A 号递增（模板 A1 后为 A2）")
open(tmpf, "w", encoding="utf-8").write("只两行\n查")
code, _, err = run(root, "accept", "T0001", "add", "--from", tmpf)
ok(code == 1 and "三行" in err, "accept add 非三行拒绝")
code, out, _ = run(root, "accept", "T0001", "status", "A2", "绿")
ok(code == 0 and re.search(r"^- 状态：绿$", open(c, encoding="utf-8").read(), re.M), "accept status 改绿")
code, _, err = run(root, "accept", "T0001", "status", "A9", "绿")
ok(code == 1, "accept status 未知条目拒绝")
code, _, err = run(root, "accept", "T0001", "status", "A2", "紫")
ok(code == 1 and "状态值无效" in err, "accept status 非法值拒绝")

open(tmpf, "w", encoding="utf-8").write("验收预期红类｜红因须与记载一致")
code, out, _ = run(root, "lesson", "T0001", "--from", tmpf)
ok(code == 0 and re.search(r"^- \d{4}-\d{2}-\d{2}｜T0001｜验收预期红类｜红因须与记载一致｜0｜候选$",
                            open(c, encoding="utf-8").read(), re.M), "lesson 六段格式")
ok(not [f for f in os.listdir(os.path.join(root, "tasks")) if f.endswith(".tmp-card")], "原子写无 tmp 残留")
shutil.rmtree(root)

# ---- 5. frontmatter 注释保留 ----
root = fresh_root()
c = os.path.join(root, "tasks", "T0001.md")
run(root, "receive", "T0001", "--note", "接待")
text = open(c, encoding="utf-8").read()
ok(re.search(r"^stage: 需求\s+# 需求 \| 实现 \| 检查", text, re.M) and
   re.search(r"^progress: 执行中\s+# 未执行 \| 执行中 \| 执行完毕", text, re.M), "改值保留行内注释")
ok(re.search(r"^stopped_at: \"\"\s+# need_human=true 时必填", text, re.M) is not None or
   fm_of(c, "stopped_at") == '""', "未动字段原样")
shutil.rmtree(root)

print(f"\n{'全绿' if not fails else '红 ' + str(len(fails)) + ' 处: ' + '; '.join(fails)}")
sys.exit(1 if fails else 0)

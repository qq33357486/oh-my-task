"""T0031 A3 红测试：废记录员、五态化落档（检查员锁定，实现员不得改）。

出处 T0031 需求 3（裁：记录员散开，done 即终态）。断言为语义匹配不锁措辞
（先例 T0020/a1_discipline.test.py 候选正则组）。

【授权变更 2026-11-04 T0032 需求 7】五态断言改四态：tests 态删除（测试前移
咨询员），A3-1 改断言 new/ready/review/done 四状态行。改前 sha1：
b8e1aea86743f92418c758c055ca048bcdcba0bc（先例 T0004/A4：历史锁定测试按
批准变更改写须录指纹）。其余断言（无 recorded/角色新语义）不变。

覆盖：
  A3-1 PROTOCOL.md「一张卡的一生」表为四态（T0032 授权改写）：new/ready/
       review/done 四个状态行齐备，且表内无 recorded
  A3-2 PROTOCOL.md 全文无 recorded 字样（状态机无废弃第六态，需求 3 生命周期
       表/谁写什么/系统文档/知识生命周期/记忆节同步改写，不留残留）
  A3-3 roles/recorder.md 不存在（内存层不留历史归 git）
  A3-4 roles/implementer.md 含收尾合并语义行（合并系统文档差异+定稿+已跟踪）
  A3-5 roles/checker.md 含文档核对语义行（review 核对：文档差异已合并且与
       测试代码一致）
  A3-6 roles/curator.md 含收割候选教训语义行（承接记录员筛选/去重/入 log）
  A3-7 roles/memory.md 无「唯一写入者」旧条款语义（唯一写入/记录员写入/
       其他角色禁止写入；新语义=各角色收尾自写候选、整理员维护；
       「禁止写入密钥」属内容红线非写入者条款，不在断言面）
  A3-8 check-card 无参 exit 0（卡面结构回归锚）

tests 阶段现状（2026-11-03 探针证实）→ A3-1~A3-7 红：
生命周期表含 recorded×2（12/13 行）且全文 recorded×4（+20/89 行）；
recorder.md 在；implementer/checker/curator 均无对应新语义行；
memory.md 有「记录员在任务结束时写入」「其他角色禁止写入」旧条款。
A3-8 现行即绿（回归锚，一并锁定；并行泳道落盘瞬间可能瞬时红——已实测
T0032 落盘中一过性红，红归属当刻写入方，以本卡 review 复跑为准）。
用法：python -I .oht/tests/T0031/a3_no_recorder.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PROTOCOL = os.path.join(ROOT, ".oht", "PROTOCOL.md")
ROLES = os.path.join(ROOT, ".oht", "roles")
CHECK_CARD = os.path.join(ROOT, ".oht", "scripts", "check-card.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FOUR_STATES = ["new", "ready", "review", "done"]  # T0032 需求 7 授权改写（原五态含 tests）

# 记录员职能散开后的新语义组（每组至少一行命中）。
NEW_SEMANTICS = [
    (".oht/roles/implementer.md", "收尾合并系统文档差异",
     [r"合并.{0,12}系统文档", r"系统文档.{0,12}差异", r"(收尾|完成.{0,3}前).{0,16}合并"]),
    (".oht/roles/checker.md", "review核对文档与测试代码一致",
     [r"(文档|差异).{0,12}(核对|一致|复核)", r"核对.{0,12}(文档|差异)",
      r"(合并|差异).{0,16}(一致|对上)"]),
    (".oht/roles/curator.md", "收割候选教训去重入log",
     [r"收割", r"候选教训", r"(筛选|去重).{0,10}log"]),
]

# memory.md 旧「唯一写入者=记录员」条款语义（出现即红）。
MEM_OLD = [r"唯一写入", r"记录员.{0,8}写", r"其他角色禁止写入"]

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def section_lines(lines, keyword):
    out, on = [], False
    for ln in lines:
        if ln.startswith("## "):
            on = keyword in ln
            continue
        if on:
            out.append(ln)
    return out


def first_hit(lines, pats):
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                return ln.strip()
    return ""


def check_lifecycle(proto_text, proto_lines):
    sec = section_lines(proto_lines, "一张卡的一生")
    if not sec:
        fail("[生命周期表四态] 未找到「一张卡的一生」节")
        return
    for st in FOUR_STATES:
        row = [l for l in sec if re.match(r"^\|\s*%s\s*\|" % st, l.strip())]
        if row:
            ok("[生命周期表四态] 状态行在: %s" % row[0].strip()[:60])
        else:
            fail("[生命周期表四态] 缺状态行: %s" % st)
    in_sec = first_hit(sec, [r"recorded"])
    if in_sec:
        fail("[生命周期表无recorded] 命中: %s" % in_sec.strip()[:60])
    else:
        ok("[生命周期表无recorded] 表内无 recorded")
    whole = first_hit(proto_lines, [r"recorded"])
    if whole:
        fail("[PROTOCOL全文无recorded] 残留: %s" % whole.strip()[:60])
    else:
        ok("[PROTOCOL全文无recorded] 无残留（状态机全文化）")


def check_absent(path):
    rel = os.path.relpath(path, ROOT)
    if os.path.exists(path):
        fail("[%s 不存在] 文件仍在（内存层删档归 git）" % rel)
    else:
        ok("[%s 不存在] 已删除" % rel)


def check_presence(rel_path, name, pats):
    path = os.path.join(ROOT, rel_path)
    if not os.path.isfile(path):
        fail("[%s|含%s] 文件缺失 %s" % (rel_path, name, path))
        return
    lines = open(path, encoding="utf-8").read().splitlines()
    h = first_hit(lines, pats)
    if h:
        ok("[%s|含%s] %s" % (rel_path, name, h[:60]))
    else:
        fail("[%s|含%s] 未命中语义行" % (rel_path, name))


def check_memory_old():
    path = os.path.join(ROLES, "memory.md")
    if not os.path.isfile(path):
        fail("[roles/memory.md 无唯一写入者旧条款] 文件缺失")
        return
    lines = open(path, encoding="utf-8").read().splitlines()
    bad = []
    for ln in lines:
        for p in MEM_OLD:
            if re.search(p, ln):
                bad.append(ln.strip())
                break
    if bad:
        for b in bad[:3]:
            fail("[roles/memory.md 无唯一写入者旧条款] 旧条款行: %s" % b[:60])
    else:
        ok("[roles/memory.md 无唯一写入者旧条款] 无旧条款（各角色自写候选+整理员维护）")


def check_card():
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, "-I", "-X", "utf8", CHECK_CARD], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=60, env=env)
    if p.returncode == 0:
        ok("[check-card无参exit0] %s" % (p.stdout or "").strip())
    else:
        fail("[check-card无参exit0] exit=%d\n%s%s"
             % (p.returncode, p.stdout, p.stderr))


def main():
    proto_text = open(PROTOCOL, encoding="utf-8").read()
    proto_lines = proto_text.splitlines()
    print("== T0031 A3 废记录员落档 ==")
    check_lifecycle(proto_text, proto_lines)
    check_absent(os.path.join(ROLES, "recorder.md"))
    for rel, name, pats in NEW_SEMANTICS:
        check_presence(rel, name, pats)
    check_memory_old()
    check_card()

    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

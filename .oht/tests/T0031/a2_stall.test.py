"""T0031 A2 红测试：判滞纪律落档（检查员锁定，实现员不得改）。

出处 T0031 需求 2（人两轮裁决定案：时长触发嫌疑+采样运行实录定性，
禁纯产物 mtime 判据——反例：死循环测试持续产出运行痕迹）。
断言为语义匹配不锁措辞（先例 T0020/a1_discipline.test.py 候选正则组）。

覆盖（落点 roles/dispatcher.md 全文）：
  A2-1 含「超 10 分钟嫌疑」语义行（时长线+嫌疑触发）
  A2-2 含「采样运行实录」语义行（TaskOutput 非阻塞/转录尾部，只采样不整读）
  A2-3 含「实锤击杀」语义行（重复同一动作/互等/等自己 → 击杀）
  A2-4 含「正常推进放行」语义行
  A2-5 含「留痕重派」语义行（击杀后卡面留痕+重派；同线共存或全文两词齐备）
  A2-6 反向断言防蒙混：无「纯产物 mtime 判滞」语义行——命中判据词
       （mtime/产物时间/卡面时间）且行内无禁止语境（禁/不/反例/误判等）才算
       阳性；「禁纯产物 mtime 判据」这类禁令行自身不算旧判据复辟
  A2-7 check-size 无参零超限（剃刀回归锚）

tests 阶段现状（2026-11-03 探针证实）→ A2-1~A2-4 红：
dispatcher 无 10 分钟嫌疑线、无采样/实录/实锤/击杀/放行语义；
A2-5 现状由旧锁节「失踪重派必须留痕」命中（非本卡语义，红由其余组承载，
实现后旧锁节删除、判滞节自带留痕重派）；A2-6/A2-7 现行即绿（守护锚）。
用法：python -I .oht/tests/T0031/a2_stall.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
DISPATCHER = os.path.join(ROOT, ".oht", "roles", "dispatcher.md")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 判滞新语义组（每组至少一行命中；措辞自由）。
STALL = [
    ("超10分钟嫌疑", [r"(超|过)\s*10\s*分钟", r"10\s*分钟.{0,24}(嫌疑|未完|疑)",
                      r"(嫌疑|疑).{0,24}10\s*分钟", r"十分钟",
                      r"600\s*秒.{0,24}(嫌疑|未完|疑)"]),
    ("采样运行实录", [r"采样", r"实录", r"(TaskOutput|转录|运行.{0,4}输出).{0,12}(尾|定性|采样)"]),
    ("实锤击杀", [r"实锤", r"击杀", r"TaskStop",
                  r"(重复同一|互等|等自己).{0,16}(杀|终止|停)"]),
    ("正常推进放行", [r"正常推进", r"放行",
                      r"(推进|有进展).{0,14}(放行|不杀|继续)"]),
]

# 旧判据词（出现即嫌疑，再看行内是否有禁止语境）。
MTIME_JUDGE = [r"mtime", r"产物.{0,8}(时间|判|新)", r"卡面.{0,8}(时间|新.{0,4}判)"]
NEGATE = r"禁|不再|不得|禁止|勿|反例|误判|废|弃|错误|不准"

FAILED = 0


def fail(msg):
    global FAILED
    FAILED += 1
    print("  红 %s" % msg)


def ok(msg):
    print("  绿 %s" % msg)


def first_hit(lines, pats):
    for ln in lines:
        for p in pats:
            if re.search(p, ln):
                return ln.strip()
    return ""


def check_trace_redispatch(lines):
    """A2-5 留痕重派：同线共存优先；否则全文「留痕/留迹」与「重派」两词齐备。"""
    co = first_hit(lines, [r"(留痕|留迹).{0,16}(重派|再派)",
                           r"(重派|再派).{0,16}(留痕|留迹)"])
    if co:
        ok("[含留痕重派] %s" % co[:60])
        return
    has_trace = any(re.search(r"留痕|留迹", l) for l in lines)
    has_redis = any(re.search(r"重派", l) for l in lines)
    if has_trace and has_redis:
        ok("[含留痕重派] 全文两词齐备（分行为）")
    else:
        fail("[含留痕重派] 未命中语义行")


def check_no_mtime(lines):
    """A2-6 反向断言：无「纯产物 mtime 判滞」语义（禁止语境行豁免）。"""
    bad = []
    for ln in lines:
        if not any(re.search(p, ln, re.I) for p in MTIME_JUDGE):
            continue
        if re.search(NEGATE, ln):
            continue  # 禁令/反例行是本卡要求的新语义，不算复辟
        bad.append(ln.strip())
    if bad:
        for b in bad[:3]:
            fail("[无纯产物mtime判滞] 阳性判据行: %s" % b[:70])
    else:
        ok("[无纯产物mtime判滞] 无阳性判据行（禁令行豁免）")


def main():
    lines = open(DISPATCHER, encoding="utf-8").read().splitlines()
    print("== T0031 A2 判滞纪律落档 ==")
    for name, pats in STALL:
        h = first_hit(lines, pats)
        if h:
            ok("[含%s] %s" % (name, h[:60]))
        else:
            fail("[含%s] 未命中语义行" % name)
            clue = [l.strip() for l in lines
                    if re.search(r"分钟|嫌疑|实录|采样|杀|放行|重派|留痕|停滞", l)]
            for c in clue[:3]:
                print("       现有相关行: %s" % c[:60])
    check_trace_redispatch(lines)
    check_no_mtime(lines)

    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, "-I", "-X", "utf8", CHECK_SIZE], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=60, env=env)
    if p.returncode == 0:
        ok("[check-size零超限] %s" % (p.stdout or "").strip())
    else:
        fail("[check-size零超限] exit=%d\n%s%s"
             % (p.returncode, p.stdout, p.stderr))

    if FAILED:
        print("== 结果：红（%d 处未达标，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""剃刀原则检查：单条字数、流程步骤数、内存层总量。用法：python3 -I .oht/scripts/check-size.py [.oht根目录]
待检文件实际校验 0 个时打印"未扫描到任何文件，请确认 ROOT 路径"并 exit 1。"""
import re, sys, glob, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HERE)  # 默认 .oht/
RULE_MAX = 40      # 一条规则（- 开头）的字数
STEP_MAX = 30      # 一个流程步骤（1. 开头）的字数
STEPS_PER_FLOW = 7 # 一个连续编号流程的步骤数
TOTAL_MAX = {"knowledge/rules.md": 1500}  # 每次必读文件的总字数

files = [os.path.join(ROOT, "AGENTS.md"), os.path.join(ROOT, "knowledge/rules.md")]
files += sorted(glob.glob(os.path.join(ROOT, "roles/*.md")))
files += sorted(glob.glob(os.path.join(ROOT, "knowledge/topics/*.md")))

bad = 0
checked = 0
for f in files:
    if not os.path.exists(f):
        continue
    checked += 1
    rel = os.path.relpath(f, ROOT).replace(os.sep, "/")
    text = open(f, encoding="utf-8").read()
    steps = 0
    for n, line in enumerate(text.splitlines(), 1):
        m = re.match(r"\s*(\d+)\.\s+(.*)", line)
        b = re.match(r"\s*[-*]\s+(.*)", line)
        if m:
            steps = steps + 1 if int(m.group(1)) > 0 else steps
            if len(m.group(2)) > STEP_MAX:
                print(f"{rel}:{n} 流程步骤 {len(m.group(2))} 字 > {STEP_MAX}"); bad += 1
            if steps == STEPS_PER_FLOW + 1:
                print(f"{rel}:{n} 流程超过 {STEPS_PER_FLOW} 步"); bad += 1
        else:
            steps = 0
            if b and len(b.group(1)) > RULE_MAX:
                print(f"{rel}:{n} 规则 {len(b.group(1))} 字 > {RULE_MAX}"); bad += 1
    if rel in TOTAL_MAX:
        total = len(re.sub(r"\s", "", text))
        if total > TOTAL_MAX[rel]:
            print(f"{rel} 总量 {total} 字 > {TOTAL_MAX[rel]}"); bad += 1
if checked == 0:
    print("未扫描到任何文件，请确认 ROOT 路径")
    sys.exit(1)
print(f"超限 {bad} 处")
sys.exit(1 if bad else 0)

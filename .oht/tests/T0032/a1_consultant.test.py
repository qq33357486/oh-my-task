"""T0032 A1 红测试：咨询员两职责落档（检查员锁定，实现员不得改）。

出处 T0032 需求 1（人批准"测试前移咨询员"：验收对齐属需求阶段，咨询员交测试自证红）。
断言为语义匹配不锁措辞（先例 T0020/a1_discipline.test.py 候选正则组）。

覆盖：
  A1-1 roles/consultant.md 含「对齐需求」语义行（职责①：人在场拷问/自治推断对齐需求）
  A1-2 roles/consultant.md 含「对齐验收」语义行（职责②命名，与职责①并列成对）
  A1-3 roles/consultant.md 含「写可执行测试」语义行（auto 条目直接落成可执行测试，
       随卡交付；排除旧语义"必须能写成测试"=可测性判定，非咨询员动笔）
  A1-4 roles/consultant.md 含「自证红」语义行（跑一遍，红证据写入进度）
  A1-5 check-size.py 无参零超限（新增纪律行落 roles/*.md 须过剃刀，回归锚点）

候选正则组刻意不含"拷问/写成测试"单独命中：现行 consultant.md 已有
"拷问人，直到理解完整""每条 auto 条目必须能写成测试"，若纳入则现状即绿，
违背本卡"现状未改→红"；目标语义是两职责显式命名+咨询员动笔写测试+自证红，
故各组锚定新措辞词根（对齐/可执行/落成/随卡交付/自证红）。
tests 阶段现状（2026-11-03 探针证实）：consultant.md 无对齐需求/对齐验收/
可执行测试/自证红任一语义 → A1-1~A1-4 红；A1-5 当前即绿（如实记锚）。
用法：python -I .oht/tests/T0032/a1_consultant.test.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CONSULTANT = os.path.join(ROOT, ".oht", "roles", "consultant.md")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 每职责一组候选正则（行内命中任一即算该语义行落档）。
DUIQI_XUQIU = [  # 职责① 对齐需求
    r"对齐需求",
    r"需求.{0,3}对齐|对齐.{0,3}需求",
    r"职责[①1一].{0,12}需求",
]
DUIQI_YANSHOU = [  # 职责② 对齐验收
    r"对齐验收",
    r"验收.{0,3}对齐|对齐.{0,3}验收",
]
XIE_KEZHIXING = [  # 写可执行测试（动笔，非"能写成"可测性判定）
    r"可执行测试",
    r"(落成|写成)[^，。]{0,6}可(执行|验收)",
    r"落成.{0,4}测试",
    r"随卡交付",
    r"(直接|亲自).{0,4}写.{0,8}测试",
]
ZIZHENG_HONG = [  # 自证红（跑一遍，红证据留痕）
    r"自证红",
    r"自证.{0,4}红",
    r"红.{0,10}(证据|留痕|写入)",
    r"(跑|运行).{0,10}红",
]

WANTS = [
    ("对齐需求", DUIQI_XUQIU),
    ("对齐验收", DUIQI_YANSHOU),
    ("写可执行测试", XIE_KEZHIXING),
    ("自证红", ZIZHENG_HONG),
]

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


def main():
    global FAILED
    print("== T0032 A1 咨询员两职责落档 ==")
    if not os.path.isfile(CONSULTANT):
        for name, _ in WANTS:
            fail("[roles/consultant.md|含%s] 文件缺失 %s" % (name, CONSULTANT))
    else:
        lines = open(CONSULTANT, encoding="utf-8").read().splitlines()
        for name, pats in WANTS:
            h = first_hit(lines, pats)
            if h:
                ok("[roles/consultant.md|含%s] %s" % (name, h[:60]))
            else:
                fail("[roles/consultant.md|含%s] 未命中语义行" % name)
                clue = [l.strip() for l in lines
                        if re.search(r"对齐|验收|测试|拷问|红|职责", l)]
                for c in clue[:5]:
                    print("       现有相关行: %s" % c[:60])

    # A1-5 check-size 无参零超限（回归锚点，当前即绿如实）
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    # -X utf8：-I 隐含 -E 忽略 PYTHONIOENCODING，须显式 UTF-8 模式防 GBK 乱码
    p = subprocess.run([sys.executable, "-I", "-X", "utf8", CHECK_SIZE], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=60, env=env)
    if p.returncode == 0:
        ok("[check-size零超限] %s" % (p.stdout or "").strip().splitlines()[-1:])
    else:
        fail("[check-size零超限] exit=%d\n%s%s" % (p.returncode, p.stdout, p.stderr))

    if FAILED:
        print("== 结果：红（%d 处未落档，exit 1）==" % FAILED)
        return 1
    print("== 结果：绿（exit 0）==")
    return 0


if __name__ == "__main__":
    sys.exit(main())

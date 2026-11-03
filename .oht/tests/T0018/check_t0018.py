"""T0018 红测试（A3/A4 条目）：多会话规则入档 + 回归基线。检查员锁定，实现员不得改。

覆盖：
  A3a  PROTOCOL.md 含一条 ≤40 字的会话形态规则（- /* 规则行形态），语义同时覆盖
       三个语义点（T0018 需求 4 的机读判定，关键词组映射——措辞自由，语义点必须命中）：
         1) 会话即工人     ：行含"会话" 且（"工人" 或 "生灭" 或 "替换"）
         2) 真相在 .oht/   ：行含".oht"  且（"真相" 或 "状态"）
         3) 定时器只是触发器之一：行含"定时" 且 "触发"
       通过标准示例（33 字，全命中）：
         - 会话即工人可生灭可替换，状态真相只在 .oht/，定时器与人的消息同为触发器
  A3b  python -I .oht/scripts/check-size.py 零超限（A3 条目字面验收，exit 0）
  A4p1 坏卡证伪先行：check-card 单卡模式对缺 title 卡必须拒绝（exit 非 0）——
       先证明检查器有牙，A4a 的"零超限"才不是空转绿（T0005 零卡假绿先例）
  A4p2 T0010 退役档案守护（先行断言）：run_t0010.py ①仍存在、②文件头含
       superseded/退役声明、③不被活跃脚本引用执行（.oht/scripts 与 .oht/tests
       下除档案守护形态外无执行形态调用）——退役档案被删/掏空/复活调用即转红。
       判定函数 a4p2_retired_archive_intact(run_path, scan_dirs) 两参均带真实
       默认值，参数化接口供 T0021 teeth 探测（见 .oht/tests/T0021/teeth.py）。
       A4p2 于 T0021 按 T0020 桩化同步改写（2026-11-03 对账孤儿红；先例
       T0004/A4、T0007、T0013 批准的需求变更同步改写锁定断言）；旧 11 项
       断言函数名清单契约随桩化整体删除，不留空壳。
  A4a  python -I .oht/scripts/check-card.py（无参）零超限（A4 条目字面验收，exit 0）
  A4b  【superseded 2026-11-03，不再执行】T0010 全量真唤醒回归已被人批 doctrine
       取代（出处：T0018 需求 5，2026-11-03 人在场批准；先例 T0004/A4、T0007，
       改写人：检查员）——锁机制快测 lock_a1.test.py / lock_a2.test.py（毫秒-秒级
       文件夹具）成为回归门槛，T0010 全量不再作常规回归。本文件已删除对
       run_t0010.py 的活执行；OHT_T0018_SKIP_T0010=1 旧调试开关随之失效（无全量
       可跳，置不置均同效）。A4p2 保留：转为守护退役档案 run_t0010.py 本体不被
       删/掏空的档案完整性检查。

tests 阶段现状（2026-11-03，历史记录）：PROTOCOL.md 无会话形态规则行 → A3a 红；
check-size / check-card 现行零超限、T0010 引擎套件现行实现未动 → A3b/A4p1/
A4p2/A4a/A4b 基线绿，作为回归锚点一并锁定（同 T0015 A2b 先例）。
"当前即绿"的处理按 T0015 先例：A3 的红由 A3a 承载；A4 无现状红可承载，
补 A4p1/A4p2 两个先行断言使其可红（检查器失牙或套件被掏空即红），
条目红绿的最终判定在实现后复跑（实现未完成不得标绿）。
实现完成后五个活检查全绿（退出码 0）；A4b 仅存本说明，不执行、不计红绿。
用法：python -I .oht/tests/T0018/check_t0018.py   （cwd 任意）
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))  # 仓库根
PROTOCOL = os.path.join(ROOT, ".oht", "PROTOCOL.md")
CHECK_SIZE = os.path.join(ROOT, ".oht", "scripts", "check-size.py")
CHECK_CARD = os.path.join(ROOT, ".oht", "scripts", "check-card.py")
RUN_T0010 = os.path.join(ROOT, ".oht", "tests", "T0010", "run_t0010.py")
RULE_MAX = 40  # 与 check-size.py RULE_MAX 同口径


def run_py(script, timeout=3600):
    """python -I -X utf8 <script>（-I 隐含 -E，故用 -X utf8 保证子进程 stdout 编码，同 T0015）。"""
    env = dict(os.environ)
    return subprocess.run(
        [sys.executable, "-I", "-X", "utf8", script],
        capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
        cwd=ROOT, timeout=timeout,
    )


def a3a_protocol_session_rule():
    """PROTOCOL.md 存在一条 ≤40 字规则行，同时命中三个会话形态语义点。"""
    text = open(PROTOCOL, encoding="utf-8").read().replace("\r\n", "\n")
    hits = []
    for n, line in enumerate(text.splitlines(), 1):
        m = re.match(r"\s*[-*]\s+(.*)", line)
        if not m:
            continue
        body = m.group(1).strip()
        if len(body) > RULE_MAX:
            continue
        worker = ("会话" in body) and (("工人" in body) or ("生灭" in body) or ("替换" in body))
        truth = (".oht" in body) and (("真相" in body) or ("状态" in body))
        trigger = ("定时" in body) and ("触发" in body)
        if worker and truth and trigger:
            hits.append((n, body))
    assert hits, (
        "PROTOCOL.md 无命中三语义点的 ≤40 字规则行"
        "（语义点：①会话即工人②真相在.oht/③定时器只是触发器之一；"
        "行须为 - /* 规则行形态且 ≤40 字，与 check-size 同口径）。"
        "通过标准示例：- 会话即工人可生灭可替换，状态真相只在 .oht/，定时器与人的消息同为触发器"
    )
    return hits[0]


def a3b_check_size_passes():
    r = run_py(CHECK_SIZE)
    assert "超限" in r.stdout, f"check-size 未正常执行：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert r.returncode == 0, f"check-size 有超限：exit={r.returncode}\n{r.stdout}{r.stderr}"


# 最小合法结构卡，仅缺 title（T0015 起为 check-card 硬校验）：status=new 免验收条目，
# system 留空免系统文档联动。写在嵌套临时目录，隔离母本（同 T0015 run_check_card 法）。
TOOTHLESS_CARD = """---
id: T9999B
type: ""
status: new
round: 0
parent: ""
origin: ""
knowledge: []
system: ""
lane: ""
touches: []
batch: ""
stopped_at: ""
resume_to: ""
stop_reason: ""
question: ""
replied: false
---

## 原话
测试

## 需求
测试

## 复述卡
测试

## 验收条目

## 系统文档改动

## 进度

## 失败原因

## 候选教训

## 人的回复
"""


def a4p1_bad_card_rejected():
    """坏卡证伪先行：check-card 必须能拒绝缺 title 卡，否则 A4a 的零超限是假绿。"""
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "cards", "T9999B.md")
        os.makedirs(os.path.dirname(p))
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(TOOTHLESS_CARD)
        env = dict(os.environ)
        r = subprocess.run(
            [sys.executable, "-I", "-X", "utf8", CHECK_CARD, p],
            capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
        )
    assert "超限" in r.stdout, f"check-card 未正常执行（坏卡证伪）：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert "title" in r.stdout, f"check-card 未检出缺 title（文案不含 title）：\n{r.stdout}{r.stderr}"
    assert r.returncode != 0, f"坏卡未被拒绝（检查器失牙，零超限不可信）：exit=0\n{r.stdout}{r.stderr}"


# ---- A4p2 退役档案守护（T0021 按 T0020 桩化同步改写；出处与先例见文件头 docstring） ----
# 旧契约（11 项锁定断言函数名清单）随 T0020 桩化整体删除，不留空壳。
# 参数化接口契约见 .oht/tests/T0021/teeth.py：恰一个 a4p2* 判定函数，
# 签名 f(run_path, scan_dirs)，两参带真实默认值，违例抛 AssertionError。

A4P2_SCAN_DIRS = (
    os.path.join(ROOT, ".oht", "scripts"),
    os.path.join(ROOT, ".oht", "tests"),
)
_A4P2_EXEC_CALL = re.compile(r"subprocess|Popen")


def _scan_active_callers(scan_dirs, run_path, self_path):
    """扫 scan_dirs 下脚本文件，返回执行形态引用退役档案的 [(file, lineno, line)]。

    执行形态 = 同一行既含 subprocess/Popen 又引用 run_t0010（忽略大小写，
    覆盖直接路径与 RUN_T0010 类常量引用）。两类档案守护/说明形态不判（卡面
    "除档案说明外"的外延，T0021 检查员边界注记）：
    - self_path：本检查器自身的守护路径常量（本检查的载体）；
    - 文件自证退役验证/守护身份：文内同含 run_t0010 + "桩"或"守护" +
      "superseded"或"退役"——如 T0020 a2_residue.test.py 的桩运行（验证退役
      行为本身，T0020 锁定测试，现行绿）与本卡 teeth.py 的调用者样本字面量。
    除此之外的执行形态引用即红。仅扫可执行脚本后缀；.md 属档案说明不扫。
    """
    stem = os.path.splitext(os.path.basename(run_path))[0]
    run_re = re.compile(re.escape(stem), re.I)
    hits = []
    for base in scan_dirs:
        for dirpath, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d != "__pycache__"]
            for fn in sorted(files):
                if not fn.endswith((".py", ".sh", ".bat", ".ps1")):
                    continue
                p = os.path.join(dirpath, fn)
                try:
                    text = open(p, encoding="utf-8", errors="replace").read()
                except OSError:
                    continue
                is_self = (os.path.normpath(os.path.abspath(p)) == self_path)
                guarded = is_self or (
                    run_re.search(text)
                    and any(w in text for w in ("桩", "守护"))
                    and any(w in text for w in ("superseded", "退役"))
                )
                if guarded:
                    continue
                for i, line in enumerate(text.splitlines(), 1):
                    if _A4P2_EXEC_CALL.search(line) and run_re.search(line):
                        hits.append((os.path.relpath(p, base), i, line.strip()[:70]))
    return hits


def a4p2_retired_archive_intact(run_path=RUN_T0010, scan_dirs=A4P2_SCAN_DIRS):
    """T0010 退役档案守护三重断言（先行断言，参数化接口供 T0021 teeth 探测）。

    A4b 退役（T0018 需求 5，2026-11-03 人批）后本检查不再守护活回归，转为守护
    退役档案 run_t0010.py 本体（T0020 桩化后旧 11 项断言名契约与现实矛盾成
    孤儿红，T0021 对账改写）：①档案在位；②文件头含 superseded/退役声明；
    ③不被活跃脚本引用执行（scan_dirs 内除档案守护形态外无执行形态调用）。
    档案被删/声明被抹/复活调用即抛 AssertionError。"""
    assert os.path.isfile(run_path), f"退役档案缺失：{run_path}"
    with open(run_path, encoding="utf-8", errors="replace") as f:
        head = "".join(f.readline() for _ in range(30))
    assert ("superseded" in head.lower()) or ("退役" in head), (
        "退役档案文件头缺 superseded/退役声明（声明须在头部醒目处，"
        "防档案被无批准改动后冒充在役代码）"
    )
    hits = _scan_active_callers(list(scan_dirs), run_path,
                                os.path.normpath(os.path.abspath(__file__)))
    assert not hits, (
        "退役档案被活跃脚本引用执行（除档案守护/退役验证形态外）：\n      "
        + "\n      ".join(f"{p} L{i}: {ln}" for p, i, ln in hits)
    )


def a4a_check_card_passes():
    r = run_py(CHECK_CARD)
    assert "超限" in r.stdout, f"check-card 未正常执行：exit={r.returncode}\n{r.stdout}{r.stderr}"
    assert r.returncode == 0, f"check-card 全仓有超限：exit={r.returncode}\n{r.stdout}{r.stderr}"


# A4b（T0010 引擎套件活执行）已 superseded 删除：出处 T0018 需求 5，2026-11-03
# 人在场批准；取代物 lock_a1.test.py / lock_a2.test.py（毫秒-秒级文件夹具）。
# 改写人：检查员；先例 T0004/A4、T0007。此处不再保留任何 T0010 活断言。


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    checks = [
        ("A3a PROTOCOL含≤40字会话形态规则", a3a_protocol_session_rule),
        ("A3b check-size零超限", a3b_check_size_passes),
        ("A4p1 坏卡证伪:check-card须拒缺title卡", a4p1_bad_card_rejected),
        ("A4p2 T0010退役档案在位+声明+不被活跃执行", a4p2_retired_archive_intact),
        ("A4a check-card无参零超限", a4a_check_card_passes),
    ]
    bad = 0
    ran = 0
    for name, fn in checks:
        try:
            extra = fn()
            ran += 1
            note = f"\n      命中 L{extra[0]}：{extra[1]}" if isinstance(extra, tuple) else ""
            print(f"GREEN {name}{note}")
        except AssertionError as e:
            ran += 1
            bad += 1
            msg = str(e).replace("\n", "\n      ")
            print(f"RED   {name}\n      {msg}")
        except Exception as e:  # 环境错误也按红计，不让脚本静默通过
            ran += 1
            bad += 1
            print(f"ERROR {name}\n      {type(e).__name__}: {e}")
    print("NOTE  A4b T0010全量回归已superseded（T0018需求5，2026-11-03人批doctrine）："
          "不再执行，回归门槛移交 lock_a1/lock_a2 快测")
    print(f"红 {bad} / {ran}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

"""T0021 红测试（A2 条目）：A4p2 新断言有牙。检查员锁定，实现员不得改。

牙测对象：改写后的 check_t0018.py A4p2 判定函数（退役档案完整性守护）。
T0020 桩化 run_t0010.py 后，A4p2 旧契约（11 项断言函数名在位）与现实矛盾成
孤儿红；T0021 需求 1 要求改写为三重断言：①run_t0010.py 仍存在；②文件头含
"superseded"/退役声明；③不再被任何活跃脚本引用执行（.oht/scripts 与
.oht/tests 下除档案说明外无调用）。11 项函数名子断言整体删除，不留空壳。

接口契约（A2 查列"临时目录可探"的可判定化，实现员按此对齐）：
  check_t0018.py 模块内恰有一个模块级 a4p2* 判定函数（a4p2 前缀专属判定函数，
  辅助函数不得占用该前缀）；签名次序 f(run_path, scan_dirs)：
    第 1 参 = 退役档案路径；第 2 参 = 调用扫描目录列表；
    两参均须带默认值（默认=真实仓库档案与 [.oht/scripts, .oht/tests]），
    main() 无参调用即走默认；判定违例（缺失/无声明/被活跃调用）抛 AssertionError。
  违反契约（缺函数/多函数/无参数化接口/有接口无牙/原样误伤）任一情形，本测试红。

覆盖（A2 查列三情形 + 情形①对照组防假牙，T0005 证伪先行先例）：
  A2-1a 对照组：真实档案原样拷贝进临时布局（空扫描目录）→ 应绿。
        证明判定对"无害副本"不误伤，下一条的红确由抹声明单独造成。
  A2-1b 抹声明应红：拷贝 run_t0010.py 并抹掉头部"superseded"/退役声明
        （全文去 (?i)superseded 与"退役"字样，兼容头部判定与全文判定两种实现）
        → 判定应红。
  A2-2  活跃调用者应红：真实档案 + 临时 scripts 目录放一个 subprocess 调用
        run_t0010.py 的脚本 → 判定应红（scan_dirs 须真被扫描，不查即无牙）。
  A2-3  原样应绿：无参调用（真实仓库默认）→ 应绿。这一条同时证明：
        档案在位、声明在位、无活跃调用，且 check_t0018.py 自身守护引用与
        T0020 a2_residue.test.py 桩运行（退役验证形态，即卡面"档案说明"外延）
        不被误伤——孤儿红归位后不引入新矛盾（对账一致性）。

tests 阶段现状（2026-11-03，历史记录）：A4p2 仍是旧契约（11 项名清单、无
参数化接口）→ A2-1a/A2-3 红（旧判定对真实档案即红）、A2-1b/A2-2 红（无接口，
TypeError）。实现后四例全绿。

设施修复（2026-11-03 检查员修牙，review 阶段）：实现员按锁定契约完成 A4p2
重构后本文件实测红 2/4，红因归属本设施自身——case_1/case_2 在
with tempfile.TemporaryDirectory() 块内只建输入即 return，main() 稍后才调
判定函数，此时目录已销毁、输入悬空（A2-1a 悬空触发"档案缺失"误报误伤、
A2-1b 同因悬空"档案缺失"假绿、A2-2 caller.py 已删扫不出调用者假报无牙）。
修复：判定调用移入 with 存活期内完成并收集结论，目录销毁后只汇报结果。
先例：T0004/A4 批准的需求变更同步改写锁定断言；T0019 jsdom PointerEvent
测试设施缺陷先例——设施自毁不等于实现无牙，修设施而非改判定。四例的
标签、预期、call_judgment 判定契约一字未改。
用法：python -I .oht/tests/T0021/teeth.py   （cwd 任意）
"""
import importlib.util
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))  # 仓库根
CHECK_T0018 = os.path.join(ROOT, ".oht", "tests", "T0018", "check_t0018.py")

CALLER_SRC = (
    "import subprocess, sys\n"
    "subprocess.run([sys.executable, 'run_t0010.py'])\n"
)


def load_module():
    """按路径加载 check_t0018 模块（__main__ 守卫在，不会触发其 main）。"""
    spec = importlib.util.spec_from_file_location("check_t0018_locked", CHECK_T0018)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def find_judgment(mod):
    """恰有一个 a4p2* 模块级判定函数；缺失/不唯一即红（防留旧空壳+新增双函数）。"""
    names = [n for n in vars(mod)
             if n.startswith("a4p2") and callable(getattr(mod, n))]
    assert len(names) == 1, (
        f"check_t0018 应恰有一个 a4p2* 判定函数，实得 {len(names)} 个：{names or '无'}"
        "（11 项函数名子断言须整体删除不留空壳，旧判定应就地改写而非并存）"
    )
    return getattr(mod, names[0]), names[0]


def call_judgment(fn, label, args, expect_raise):
    """统一调用包装。

    expect_raise=True：AssertionError=牙利（通过）；无异常=无牙（红）。
    expect_raise=False：无异常=不误伤（通过）；AssertionError=误伤（红）。
    TypeError=无 f(run_path, scan_dirs) 契约接口（红）；其余异常=判定实现有 bug（红）。
    """
    try:
        fn(*args)
    except AssertionError:
        if expect_raise:
            return
        raise AssertionError(f"{label}：判定误伤（应绿却红）——牙不准")
    except TypeError as e:
        raise AssertionError(
            f"{label}：A4p2 判定函数无契约接口 f(run_path, scan_dirs)（{e}）"
            "——T0021 接口契约未落地，teeth 无法探测临时情形"
        )
    except Exception as e:
        raise AssertionError(f"{label}：判定抛了非 AssertionError 异常 {type(e).__name__}: {e}")
    if expect_raise:
        raise AssertionError(f"{label}：判定未红（新断言无牙）")


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def observe(fn, name, label, args, expect_raise):
    """在临时目录存活期内调用判定一次并归档结论，返回 (label, ok, detail)。

    ok=True：该例符合预期（应红则红/应绿则绿）；ok=False：违例，detail 给红因。
    只在输入文件存活期内调用——不在目录销毁后延迟探测（2026-11-03 修牙要点）。
    """
    try:
        call_judgment(fn, label, args, expect_raise)
    except AssertionError as e:
        return (label, False, str(e))
    except Exception as e:
        return (label, False, f"{type(e).__name__}: {e}")
    return (label, True, "")


def case_1_strip_declaration(mod, fn, name):
    """A2-1：对照组原样拷贝应绿；抹掉 superseded/退役声明后应红。

    判定调用在 with 块内存活期内完成并收集结论（2026-11-03 修牙：旧版在此
    只建输入即 return，目录销毁后 main() 才探测悬空路径。先例 T0004/A4、
    T0019 jsdom PointerEvent 设施缺陷）。
    """
    text = open(mod.RUN_T0010, encoding="utf-8").read()
    stripped = re.sub(r"(?i)superseded", "", text).replace("退役", "")
    out = []
    with tempfile.TemporaryDirectory() as d:
        scripts = os.path.join(d, "scripts")
        tests = os.path.join(d, "tests")
        os.makedirs(scripts)
        os.makedirs(tests)
        ctl = os.path.join(d, "ctl", "run_t0010.py")
        stp = os.path.join(d, "stp", "run_t0010.py")
        os.makedirs(os.path.dirname(ctl))
        os.makedirs(os.path.dirname(stp))
        write(ctl, text)
        write(stp, stripped)
        out.append(observe(fn, name,
                           "A2-1a 对照组:原样拷贝+空扫描目录应绿",
                           (ctl, [scripts, tests]), False))
        out.append(observe(fn, name,
                           "A2-1b 抹掉superseded/退役声明应红",
                           (stp, [scripts, tests]), True))
    return out


def case_2_active_caller(mod, fn, name):
    """A2-2：真实档案 + 临时 scripts 目录含调用者 → 应红。"""
    out = []
    with tempfile.TemporaryDirectory() as d:
        scripts = os.path.join(d, "scripts")
        tests = os.path.join(d, "tests")
        os.makedirs(scripts)
        os.makedirs(tests)
        write(os.path.join(scripts, "caller.py"), CALLER_SRC)
        out.append(observe(fn, name,
                           "A2-2 临时scripts目录放活跃调用者应红",
                           (mod.RUN_T0010, [scripts, tests]), True))
    return out


def case_3_default(mod, fn, name):
    """A2-3：无参调用（真实仓库默认）→ 应绿。"""
    return [observe(fn, name, "A2-3 原样无参调用(真实仓库默认)应绿", (), False)]


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    bad = 0
    ran = 0
    try:
        mod = load_module()
        fn, name = find_judgment(mod)
        results = (case_1_strip_declaration(mod, fn, name)
                   + case_2_active_caller(mod, fn, name)
                   + case_3_default(mod, fn, name))
        for label, ok, detail in results:
            ran += 1
            if ok:
                print(f"GREEN {label}  [判定函数: {name}]")
            else:
                bad += 1
                print(f"RED   {label}  [判定函数: {name}]\n      {detail}")
    except AssertionError as e:  # 装载/发现阶段即不满足契约
        bad += 1
        ran += 1
        print(f"RED   A2 契约装载\n      {e}")
    except Exception as e:
        bad += 1
        ran += 1
        print(f"ERROR A2 契约装载\n      {type(e).__name__}: {e}")
    print(f"红 {bad} / {ran}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

"""T0010 自动化引擎系统测试 harness —— 骨架（检查员锁定断言契约）。

用法（A1 一条命令，可重复运行）：
    python -I .oht/tests/T0010/run_t0010.py

调试辅助：设环境变量 OHT_T0010_KEEP=1 保留沙盒目录（默认用完即删）。

【骨架红因】TODO-WAKE 未实现：wake_dispatcher() 抛 NotImplementedError，
后续断言全部阻塞，harness exit 1 并打印红因。
【实现员职责】只补 wake_dispatcher 一个函数（本文件其余部分为锁定契约，不得改）。
机制自定（候选见 README）：zcode CLI 非交互调用并工作区指向沙盒 / 或其他子代理方案；
若确认不可行，按流程把 T0010 转 need_human 说明。

【wake_dispatcher 返回值契约】(WakeReport dict，实现员按此填充)：
    {
      "lock_seen": bool,   # 唤醒运行期间任一时刻采样到沙盒 .oht/tasks/.lock 存在即 True
      "report_text": str,  # 调度员本轮最终报告全文（须含 new/need_human 卡清单）
      "exit_code": int,    # 唤醒进程退出码，0 为正常完成（无可派即止）
    }

【断言契约】对应 T0010 验收条目 A1~A4，测试写好即锁定：
  A1 harness 可重复：本脚本一条命令跑完整轮，全部断言绿则 exit 0。
  A2 锁与分派映射：
     - 唤醒运行期间锁存在（lock_seen=True）、结束后 .lock 删除；
     - card_new 保持 status=new，且 report_text 含 "card_new"（不派咨询员只入报告）；
     - card_nh（need_human 未回复）status 仍为 need_human 且 replied=false；
     - card_nh_replied 转 resume_to 所指状态（本夹具为 tests）且 replied 复位 false。
  A3 生命周期推进：
     - card_tests → ready（复跑测试红）；
     - card_ready → review（实现动作后测试绿）；
     - card_review → done（复跑绿）；
     - card_done → recorded（记录员提炼）；
     - card_broken 不崩引擎：文件仍在、replica 解析 ok=false 不抛、唤醒进程 exit 0。
  A4 看板一致：parseCard+scanTasks 读沙盒 .oht/tasks/ 的状态分布与磁盘卡面一致。
     骨架阶段用 python 最小复刻（replica_parse_card / replica_scan_tasks，逐条对齐
     app/src/lib/parseCard.ts、scanTasks.ts 契约）；实现员可改为经 esbuild 转译直调
     app/src 后以同一断言比对。
"""
import os
import re
import shutil
import sys
import tempfile
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# 本文件位于 <仓库根>/.oht/tests/T0010/，向上四级是仓库根
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
T0010_DIR = os.path.dirname(os.path.abspath(__file__))
PRESETS = os.path.join(T0010_DIR, "presets")
if not os.path.isdir(os.path.join(REPO, ".oht")):
    sys.exit("harness 自检失败：仓库根定位错误 " + REPO)

# ---------------------------------------------------------------------------
# 沙盒初始化产物清单：镜像 app/src/template.ts（TEMPLATE_FILES + 业务区空壳 + 宿主引用行）。
# 等价路径：初始化逻辑在 app/ 前端 TS 里，python 无法直接调用，骨架阶段从本仓库
# .oht/ 母本逐文件拷贝（字节等价）；实现员可改为调用 app 初始化产物。
# ---------------------------------------------------------------------------
FRAMEWORK_FILES = [
    ".oht/AGENTS.md",
    ".oht/PROTOCOL.md",
    ".oht/roles/checker.md",
    ".oht/roles/consultant.md",
    ".oht/roles/consultant-brief.md",
    ".oht/roles/curator.md",
    ".oht/roles/dispatcher.md",
    ".oht/roles/dispatcher-intake.md",
    ".oht/roles/implementer.md",
    ".oht/roles/memory.md",
    ".oht/roles/memory-tools.md",
    ".oht/roles/patrol.md",
    ".oht/roles/recorder.md",
    ".oht/scripts/check-card.py",
    ".oht/scripts/check-size.py",
    ".oht/tasks/_template.md",
    ".oht/knowledge/rules.md",
    ".oht/knowledge/topics/_template.md",
]
SHELL_DIRS = [".oht/knowledge/log", ".oht/local"]  # 业务数据区空壳（对应 SHELL_GITKEEP_PATHS）
HOST_REFERENCE_LINE = "循环工程入口：先读 .oht/AGENTS.md 并按其调度（任务卡在 .oht/tasks/）。"

PRESET_CARDS = [
    "card_new.md", "card_broken.md", "card_nh.md", "card_nh_replied.md",
    "card_tests.md", "card_ready.md", "card_review.md", "card_done.md",
]
PROP_TESTS = ["fake_spec.test.py", "ready_impl.test.py", "review_green.test.py"]


def build_sandbox(sandbox):
    """a) 建临时沙盒：等价路径——直接拷贝 .oht/ 框架文件进沙盒 .oht/，
    实现员可改为调用 app 初始化产物（app/src/template.ts + runInit）。"""
    for rel in FRAMEWORK_FILES:
        src = os.path.join(REPO, rel)
        if not os.path.isfile(src):
            sys.exit("harness 自检失败：框架母本缺失 " + rel)
        dst = os.path.join(sandbox, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
    for rel in SHELL_DIRS:  # 业务数据区空壳，保证目录存在
        os.makedirs(os.path.join(sandbox, rel.replace("/", os.sep)), exist_ok=True)
    # 宿主 AGENTS.md 引用行（新建项目=整行内容，见 template.ts HOST_REFERENCE_LINE）
    with open(os.path.join(sandbox, "AGENTS.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(HOST_REFERENCE_LINE + "\n")


def inject_presets(sandbox):
    """b) 注入预置卡组（只读夹具，母本 presets/ 不被写）与占位测试到沙盒。"""
    tasks = os.path.join(sandbox, ".oht", "tasks")
    os.makedirs(tasks, exist_ok=True)
    for name in PRESET_CARDS:
        shutil.copyfile(os.path.join(PRESETS, name), os.path.join(tasks, name))
    prop_dst = os.path.join(sandbox, ".oht", "tests", "T0010")
    os.makedirs(prop_dst, exist_ok=True)
    for name in PROP_TESTS:
        shutil.copyfile(os.path.join(T0010_DIR, name), os.path.join(prop_dst, name))


def wake_dispatcher(sandbox):
    """c) 唤醒一轮调度员（TODO-WAKE 已实现：zcode CLI 非交互调用，cwd=沙盒）。

    机制选型（README 候选①）：子进程执行
        zcode -p <唤醒提示词> --cwd <沙盒> --no-color
    提示词自包含且只含相对路径（读 .oht/AGENTS.md → PROTOCOL →
    roles/dispatcher.md → 按 status 派子代理 → 无可派即止）。

    子代理派发适配（实测）：桌面端把内置子代理（general-purpose/Explore）
    的模型绑在 account:* provider 上（~/.zcode/v2/agents-state.json），而非
    交互 CLI 的 Provider Registry 只注册 provider_config.json 里的 provider，
    两者对不上 → Agent 工具报 "Provider Registry 中不存在 Provider"。
    解法：为唤醒子进程派生一个隔离 ZCODE_STORAGE_DIR——拷贝 v2 认证/配置态，
    只把子代理模型改绑到注册表内首个可用 provider（可用环境变量
    OHT_T0010_SUBAGENT_MODEL=providerId/modelId 覆盖）；用户原配置不动，
    隔离目录用完即删。

    锁采样：运行期后台线程每 0.5s 采样沙盒 .oht/tasks/.lock 是否存在 →
    lock_seen（锁由沙盒内调度员按 dispatcher.md 自建自删，harness 不代劳）。
    report_text = 唤醒进程 stdout（=调度员最终报告全文）。
    exit_code = 唤醒进程退出码；超时（默认 2700s，OHT_T0010_WAKE_TIMEOUT
    可覆盖）则终止进程并记 124。
    """
    import json
    import subprocess
    import tempfile as _tmpmod
    import threading

    timeout_s = int(os.environ.get("OHT_T0010_WAKE_TIMEOUT", "2700"))

    # 唤醒提示词：沙盒自包含，全部相对 cwd，不出现宿主仓库绝对路径。
    WAKE_PROMPT = """你是循环工程项目的调度员，正在执行一次自动化定时唤醒。无人到场：不许向人提问，拿不准的按协议转 need_human。当前工作目录就是项目根，一切路径用相对路径；只允许读取和改动本项目（当前工作目录）内的文件。

第一步：读 .oht/AGENTS.md，再读 .oht/PROTOCOL.md，再读 .oht/roles/dispatcher.md；若存在 local/roles/dispatcher.md 也读。你是调度员：只决定和分派，不亲自干活；角色的工作一律用 Task/Agent 工具派子代理完成，并在派发指令中要求子代理先读对应角色提示词 .oht/roles/<角色>.md（如存在 local/roles/同名文件也读）再动手。

第二步 锁：查 .oht/tasks/.lock；若存在且 30 分钟内修改过，直接输出报告并结束。否则立即创建 .oht/tasks/.lock（内容一行唤醒时间）。唤醒全程持有，最后一步删除它。

第三步 盘点：读 .oht/tasks/ 下全部 *.md（跳过 _ 开头的文件），逐张取 frontmatter 的 status/replied/resume_to。无 frontmatter 或解析失败的残缺卡：跳过并记入报告，绝不能因此中断。

第四步 处理（一轮唤醒=每张卡至多推进一步；本轮已处理过的卡不再二次派发）：
a. replied=true 的卡：把 status 改成该卡 resume_to 的值、replied 复位 false，记入报告；本轮到此为止，不再派发（下一轮唤醒再按新状态推进）。
b. status=need_human 且 replied=false：不动，逐卡列入报告的"待人回复"清单。
c. status=new：无人到场不派咨询员，status 不变，逐卡列入报告的"new 卡"清单，必须逐卡写出卡的 id 原文。
d. 其余卡按状态各派一次对应角色子代理，返回后核对任务单 status 已被角色更新；若未变则重派一次，仍不变按协议转 need_human：
   - tests → 检查员（tests 模式：为 auto 条目确认测试为红，然后推 ready）
   - ready → 实现员（让测试变绿后推 review）；同 lane 的多张 ready 卡合成一批派给同一个子代理
   - review → 检查员（review 模式：复跑本卡全部测试，全绿则条目改绿推 done）
   - done → 记录员（只按卡片上的材料提炼，完成后置 recorded）
e. 所有角色与子代理只允许改动本项目 .oht/ 下的文件；禁止新建任务卡；禁止改动 .oht/ 之外的任何文件。

第五步 结束：全部处理完（无可派）后，删除 .oht/tasks/.lock，然后输出最终报告作为你的最后一条消息（纯文本），逐项包含：
1. 每张处理过的卡的 id 与 status 变化（含 resume 处理）；
2. new 卡清单（逐卡 id 原文）；
3. 未回复 need_human 卡清单（逐卡 id）；
4. 残缺卡清单。"""

    def find_cli():
        """定位 zcode CLI 与其内置 provider 配置文件。

        返回 (argv, builtin_cfg)。CLI 来源：OHT_T0010_ZCODE_BIN > PATH >
        桌面版安装内入口（resources/glm/zcode.cjs）。
        builtin_cfg：干净 shell 里 CLI 自身解析不到内置 provider 配置
        （实测报"无法定位 CLI ZCode Built-in Provider Config"），须由
        harness 显式设 ZCODE_BUILTIN_PROVIDER_CONFIG_FILE；定位顺序：
        OHT_T0010_ZCODE_BUILTIN_CONFIG > CLI 同级 provider/ > 安装目录
        resources/config/provider/ > 会话已设值（存在才用）。
        """
        override = os.environ.get("OHT_T0010_ZCODE_BIN", "").strip()
        argv = None
        base = None  # CLI 所在目录
        if override:
            if override.lower().endswith(".cjs"):
                node = shutil.which("node")
                if not node:
                    raise RuntimeError("OHT_T0010_ZCODE_BIN 指向 .cjs 但 PATH 无 node")
                argv, base = [node, override], os.path.dirname(override)
            else:
                argv, base = [override], os.path.dirname(override)
        else:
            for name in ("zcode", "zcode.cmd", "zcode.exe", "zcode.bat"):
                p = shutil.which(name)
                if p:
                    argv, base = [p], os.path.dirname(p)
                    break
            if argv is None:
                local = os.environ.get("LOCALAPPDATA", "")
                node = shutil.which("node")
                if local and node:
                    cjs = os.path.join(local, "Programs", "ZCode", "resources", "glm", "zcode.cjs")
                    if os.path.isfile(cjs):
                        argv, base = [node, cjs], os.path.dirname(cjs)
        if argv is None:
            raise RuntimeError(
                "唤醒机制不可用：未找到 zcode CLI（PATH 无 zcode，桌面版入口 "
                "%LOCALAPPDATA%\\Programs\\ZCode\\resources\\glm\\zcode.cjs 缺失或无 node）。"
                "可用 OHT_T0010_ZCODE_BIN 指定 CLI 路径；仍不可行则按协议转 need_human。")
        cands = []
        ovr = os.environ.get("OHT_T0010_ZCODE_BUILTIN_CONFIG", "").strip()
        if ovr:
            cands.append(ovr)
        if base:
            cands.append(os.path.join(base, "provider", "zcode-builtin.json"))
            cands.append(os.path.join(os.path.dirname(base), "config", "provider", "zcode-builtin.json"))
        inherited = os.environ.get("ZCODE_BUILTIN_PROVIDER_CONFIG_FILE", "").strip()
        if inherited:
            cands.append(inherited)
        builtin_cfg = next((c for c in cands if c and os.path.isfile(c)), "")
        return argv, builtin_cfg

    def pick_subagent_selection(v2_dir):
        """从 provider_config.json 选注册表内首个可用 provider/model 作子代理绑定。"""
        override = os.environ.get("OHT_T0010_SUBAGENT_MODEL", "").strip()
        if override and "/" in override:
            pid, mid = override.split("/", 1)
            return {"providerId": pid, "modelId": mid, "options": {"reasoningLevel": "high"}}
        cfg_path = os.path.join(v2_dir, "provider_config.json")
        if not os.path.isfile(cfg_path):
            return {}
        try:
            with open(cfg_path, encoding="utf-8") as f:
                cfg = json.load(f).get("config", {})
        except (OSError, ValueError):
            return {}
        rules = {r.get("providerId"): r for r in cfg.get("providerConfigRules", {}).get("providerRules", [])}
        for pid in cfg.get("providerOrder", []):
            rule = rules.get(pid) or {}
            rc = rule.get("config", {})
            mids = rc.get("modelOrder") or rc.get("personalModelIds") or []
            if pid and mids:
                return {"providerId": pid, "modelId": mids[0],
                        "options": {"reasoningLevel": "high"}}
        return {}

    def build_storage():
        """派生隔离 ZCODE_STORAGE_DIR：拷贝 v2 认证/配置态，只改子代理模型绑定。

        为什么：非交互 CLI 的 Provider Registry 无桌面端 account:* provider，
        沿用用户 agents-state.json 会让 Agent 工具启动失败（provider-not-found）。
        拷贝而非改原配置：harness 不得动用户环境；隔离目录由调用方删除。
        """
        home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
        src_v2 = os.path.join(home, ".zcode", "v2")
        storage = _tmpmod.mkdtemp(prefix="oht-t0010-zstorage-")
        dst_v2 = os.path.join(storage, "v2")
        os.makedirs(dst_v2)
        for fn in ("config.json", "credentials.json", "provider_config.json",
                   "setting.json", "onboarding-record.json",
                   "coding-plan-cache.json", "telemetry-state.json"):
            p = os.path.join(src_v2, fn)
            if os.path.isfile(p):
                shutil.copyfile(p, os.path.join(dst_v2, fn))
        ag = {}
        agp = os.path.join(src_v2, "agents-state.json")
        if os.path.isfile(agp):
            try:
                with open(agp, encoding="utf-8") as f:
                    ag = json.load(f)
            except (OSError, ValueError):
                ag = {}
        if not isinstance(ag, dict):
            ag = {}
        ag["builtInModelSelectionOverrides"] = pick_subagent_selection(dst_v2)
        with open(os.path.join(dst_v2, "agents-state.json"), "w", encoding="utf-8") as f:
            json.dump(ag, f, ensure_ascii=False, indent=1)
        return storage

    # 运行期锁采样：任一时刻见到 .lock 即 lock_seen=True（自补一线程，守护进程退出）。
    lock_path = os.path.join(sandbox, ".oht", "tasks", ".lock")
    seen = {"lock": False}
    stop = threading.Event()

    def _sample():
        while not stop.wait(0.5):
            if os.path.exists(lock_path):
                seen["lock"] = True
                return

    sampler = threading.Thread(target=_sample, daemon=True)
    sampler.start()
    storage = build_storage()
    try:
        env = dict(os.environ)
        # 剥掉宿主会话可能注入的 ZCODE_*（provider 指针等），否则唤醒子进程的
        # 注册表随运行环境漂移，破坏 A1 可重复性；只留 harness 显式设置项。
        for k in [k for k in env if k.startswith("ZCODE_")]:
            del env[k]
        env["ZCODE_STORAGE_DIR"] = storage
        argv, builtin_cfg = find_cli()
        if builtin_cfg:
            env["ZCODE_BUILTIN_PROVIDER_CONFIG_FILE"] = builtin_cfg
        argv = argv + ["-p", WAKE_PROMPT, "--cwd", sandbox, "--no-color"]
        try:
            proc = subprocess.run(argv, cwd=sandbox, env=env, capture_output=True,
                                  text=True, encoding="utf-8", errors="replace",
                                  timeout=timeout_s)
            out, code = (proc.stdout or ""), proc.returncode
        except subprocess.TimeoutExpired as e:
            out = e.stdout or b""
            if isinstance(out, bytes):
                out = out.decode("utf-8", "replace")
            out += "\n[唤醒超时 %ds，进程已终止]" % timeout_s
            code = 124
    finally:
        shutil.rmtree(storage, ignore_errors=True)
        stop.set()
        sampler.join(timeout=2)
    return {"lock_seen": seen["lock"], "report_text": out, "exit_code": code}


# ---------------------------------------------------------------------------
# app/src/lib/parseCard.ts、scanTasks.ts 的 python 最小复刻（骨架阶段 A4 断言用；
# 契约逐条对齐：残缺卡不抛、ok=false + error 非空、安全默认值）。
# 实现员可改为经 esbuild 转译直调 app/src，断言逻辑不变。
# ---------------------------------------------------------------------------
SECTIONS9 = ["原话", "需求", "复述卡", "验收条目", "系统文档改动", "进度", "失败原因", "候选教训", "人的回复"]
BROKEN = "解析失败"


def _failed(error):
    return {"id": "", "type": "", "status": "", "round": 0, "parent": "", "origin": "",
            "lane": "", "batch": "", "sections": {}, "ok": False, "error": error}


def _unquote(raw):
    v = raw.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
        return v[1:-1]
    return v


def replica_parse_card(text):
    """parseCard 复刻：frontmatter 关键字段 + 九节切分 + 残缺安全默认值。"""
    try:
        if not isinstance(text, str) or len(text) == 0:
            return _failed("输入为空或不是字符串")
        m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)", text)
        if not m:
            return _failed("缺少 frontmatter（未找到开头的 --- 块）")
        fm = {}
        for line in m.group(1).splitlines():
            if not line.strip() or line.strip().startswith("#"):
                continue
            idx = line.find(":")
            if idx <= 0:
                continue
            fm[line[:idx].strip()] = _unquote(line[idx + 1:])
        if not fm.get("id"):
            return _failed("frontmatter 缺少 id 字段")
        try:
            rnd = int(float(_unquote(fm.get("round", "0"))))
        except ValueError:
            rnd = 0
        sections, current, buf = {}, None, []
        for line in text[m.end():].splitlines():
            sm = re.match(r"^##\s+(.+?)\s*$", line)
            if sm:
                if current is not None:
                    sections[current] = "\n".join(buf)
                current, buf = sm.group(1), []
            elif current is not None:
                buf.append(line)
        if current is not None:
            sections[current] = "\n".join(buf)
        return {
            "id": fm["id"], "type": fm.get("type", ""), "status": fm.get("status", ""),
            "round": rnd, "parent": fm.get("parent", ""), "origin": fm.get("origin", ""),
            "lane": fm.get("lane", ""), "batch": fm.get("batch", ""),
            "sections": sections, "ok": True, "error": "",
        }
    except Exception as e:  # 契约：解析异常不抛，降级为 ok=false
        return _failed("解析异常: " + str(e))


def replica_scan_tasks(sandbox):
    """scanTasks 复刻：扫沙盒 .oht/tasks/*.md，跳 _*，单卡失败不影响其余，按文件名排序。"""
    tasks_dir = os.path.join(sandbox, ".oht", "tasks")
    if not os.path.isdir(tasks_dir):
        return {}
    out = {}
    for name in sorted(os.listdir(tasks_dir)):
        path = os.path.join(tasks_dir, name)
        if not os.path.isfile(path) or not name.endswith(".md") or name.startswith("_"):
            continue
        with open(path, encoding="utf-8") as f:
            out[name] = replica_parse_card(f.read())
    return out


def disk_statuses(sandbox):
    """磁盘卡面：独立于复刻解析器，直接读每张卡 frontmatter 的 status。
    无 frontmatter 记 BROKEN；有则记 status 原值（可能为空串）。"""
    tasks_dir = os.path.join(sandbox, ".oht", "tasks")
    out = {}
    for name in sorted(os.listdir(tasks_dir)):
        path = os.path.join(tasks_dir, name)
        if not os.path.isfile(path) or not name.endswith(".md") or name.startswith("_"):
            continue
        with open(path, encoding="utf-8") as f:
            text = f.read()
        m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)", text)
        if not m:
            out[name] = BROKEN
            continue
        st = ""
        for line in m.group(1).splitlines():
            k, _, v = line.partition(":")
            if k.strip() == "status":
                st = _unquote(v.split("#")[0])
                break
        out[name] = st
    return out


def read_card(sandbox, name):
    with open(os.path.join(sandbox, ".oht", "tasks", name), encoding="utf-8") as f:
        return replica_parse_card(f.read())


# ---------------------------------------------------------------------------
# d) 断言（契约锁定，实现员不得改）：每个函数返回 (ok, detail)
# ---------------------------------------------------------------------------
def a_lock_seen(ctx):
    ok = ctx["report"].get("lock_seen") is True
    return ok, "WakeReport.lock_seen=%r（唤醒期间应采样到 .oht/tasks/.lock 存在）" % ctx["report"].get("lock_seen")


def a_lock_removed(ctx):
    lock = os.path.join(ctx["sandbox"], ".oht", "tasks", ".lock")
    ok = not os.path.exists(lock)
    return ok, "唤醒结束后 .lock %s" % ("已删除" if ok else "仍存在（应删除）")


def a_new_stays_new(ctx):
    card = read_card(ctx["sandbox"], "card_new.md")
    in_report = "card_new" in ctx["report"].get("report_text", "")
    ok = card["status"] == "new" and in_report
    return ok, "card_new status=%r（应仍 new），报告含 card_new=%s（不派咨询员只入报告）" % (card["status"], in_report)


def a_nh_untouched(ctx):
    card = read_card(ctx["sandbox"], "card_nh.md")
    text = open(os.path.join(ctx["sandbox"], ".oht", "tasks", "card_nh.md"), encoding="utf-8").read()
    replied = re.search(r"^replied:\s*(\S+)", text.split("---")[1], re.M).group(1).strip()
    ok = card["status"] == "need_human" and replied == "false"
    return ok, "card_nh status=%r replied=%r（未回复卡不得推进、不得翻转 replied）" % (card["status"], replied)


def a_nh_replied_resumes(ctx):
    card = read_card(ctx["sandbox"], "card_nh_replied.md")
    with open(os.path.join(PRESETS, "card_nh_replied.md"), encoding="utf-8") as f:
        src = f.read()
    resume_to = re.search(r"^resume_to:\s*(.+)$", src.split("---")[1], re.M).group(1).strip().strip('"')
    text = open(os.path.join(ctx["sandbox"], ".oht", "tasks", "card_nh_replied.md"), encoding="utf-8").read()
    replied = re.search(r"^replied:\s*(\S+)", text.split("---")[1], re.M).group(1).strip()
    ok = card["status"] == resume_to and replied == "false"
    return ok, "card_nh_replied status=%r（应转 resume_to=%r），replied=%r（应复位 false）" % (card["status"], resume_to, replied)


def a_tests_to_ready(ctx):
    card = read_card(ctx["sandbox"], "card_tests.md")
    ok = card["status"] == "ready"
    return ok, "card_tests status=%r（测试红，应被检查员推 ready）" % card["status"]


def a_ready_to_review(ctx):
    card = read_card(ctx["sandbox"], "card_ready.md")
    ok = card["status"] == "review"
    return ok, "card_ready status=%r（实现后测试绿，应推 review）" % card["status"]


def a_review_to_done(ctx):
    card = read_card(ctx["sandbox"], "card_review.md")
    ok = card["status"] == "done"
    return ok, "card_review status=%r（复跑全绿，应推 done）" % card["status"]


def a_done_to_recorded(ctx):
    card = read_card(ctx["sandbox"], "card_done.md")
    ok = card["status"] == "recorded"
    return ok, "card_done status=%r（应被记录员置 recorded）" % card["status"]


def a_broken_no_crash(ctx):
    path = os.path.join(ctx["sandbox"], ".oht", "tasks", "card_broken.md")
    exists = os.path.isfile(path)
    parsed = replica_parse_card(open(path, encoding="utf-8").read()) if exists else _failed("文件丢失")
    survived = ctx["report"].get("exit_code") == 0
    ok = exists and (not parsed["ok"]) and bool(parsed["error"]) and survived
    return ok, ("card_broken 存在=%s，解析 ok=%s error=%r（应非空），唤醒 exit=%r（应 0，即引擎未崩）"
                % (exists, parsed["ok"], parsed["error"][:40], ctx["report"].get("exit_code")))


def a_board_consistency(ctx):
    board = replica_scan_tasks(ctx["sandbox"])
    board_view = {n: (BROKEN if not c["ok"] else c["status"]) for n, c in board.items()}
    disk = disk_statuses(ctx["sandbox"])
    ok = board_view == disk and set(disk) >= {n for n in PRESET_CARDS}
    dist = dict(Counter(disk.values()))
    return ok, "看板视图=%r 磁盘=%r 分布=%r" % (board_view, disk, dist)


ASSERTIONS = [
    ("A2", "锁_运行期间存在", a_lock_seen),
    ("A2", "锁_结束删除", a_lock_removed),
    ("A2", "new卡_不派咨询员只入报告", a_new_stays_new),
    ("A2", "need_human未回复_不动", a_nh_untouched),
    ("A2", "replied_转resume_to", a_nh_replied_resumes),
    ("A3", "tests转ready_测试红", a_tests_to_ready),
    ("A3", "ready转review_测试绿", a_ready_to_review),
    ("A3", "review转done", a_review_to_done),
    ("A3", "done转recorded", a_done_to_recorded),
    ("A3", "残缺卡_不崩引擎", a_broken_no_crash),
    ("A4", "看板与磁盘一致", a_board_consistency),
]


def main():
    print("== T0010 自动化引擎系统测试 harness（骨架）==")
    print("仓库根: " + REPO)
    sandbox = tempfile.mkdtemp(prefix="oht-t0010-")
    results = []

    def record(name, ok, detail):
        results.append(ok)
        print("  %s %s %s" % ("绿" if ok else "红", name, detail))

    try:
        # 前置自检（非契约断言，失败即 harness 自身坏，exit 1）
        build_sandbox(sandbox)
        inject_presets(sandbox)
        tasks = os.path.join(sandbox, ".oht", "tasks")
        missing = [n for n in PRESET_CARDS if not os.path.isfile(os.path.join(tasks, n))]
        missing += [n for n in PROP_TESTS if not os.path.isfile(os.path.join(sandbox, ".oht", "tests", "T0010", n))]
        if missing:
            sys.exit("harness 自检失败：沙盒注入缺失 " + ", ".join(missing))
        print("[自检] 沙盒构建+夹具注入 绿（8 卡 + 3 占位测试，沙盒 " + sandbox + "）")

        print("== 唤醒一轮调度员 ==")
        try:
            report = wake_dispatcher(sandbox)
        except NotImplementedError as e:
            print("红因：" + str(e))
            print("== 断言（全部阻塞，待实现员补 TODO-WAKE 后执行）==")
            for tag, name, _fn in ASSERTIONS:
                results.append(False)
                print("  红 [%s] %s （阻塞：TODO-WAKE 未实现）" % (tag, name))
            passed = sum(1 for r in results if r)
            print("== 结果：红（%d/%d 过；红因：TODO-WAKE 未实现，exit 1）==" % (passed, len(results)))
            return 1
        if not isinstance(report, dict):
            print("红因：wake_dispatcher 返回非 dict（违反 WakeReport 契约）：%r" % (report,))
            return 1
        ctx = {"sandbox": sandbox, "report": report}
        print("== 断言 ==")
        for tag, name, fn in ASSERTIONS:
            ok, detail = fn(ctx)
            record("[%s] %s" % (tag, name), ok, detail)
        passed = sum(1 for r in results if r)
        if passed == len(results):
            print("== 结果：绿（%d/%d 过，exit 0）==" % (passed, len(results)))
            return 0
        print("== 结果：红（%d/%d 过，exit 1）==" % (passed, len(results)))
        return 1
    finally:
        if os.environ.get("OHT_T0010_KEEP") == "1":
            print("[自检] OHT_T0010_KEEP=1，保留沙盒：" + sandbox)
        else:
            shutil.rmtree(sandbox, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())

"""锁机制脚本（T0018 需求 1）：三要素 JSON、心跳、对账接管全为纯代码，文件夹具可测。

锁形态契约（.oht/tasks/.lock）：
  认领形态（事务期）：JSON 对象 {"epoch": <Unix秒>, "owner": "<持锁者标识>",
    "claim": {"<卡号>": {"at": <认领Unix秒>, "purpose": "<目的>"}}}
  工作者形态（干活期）：裸数字 Unix 秒文本（心跳，兼容 cat 直读）。
  无锁：文件不存在。未知形态：既非合法认领 JSON 也非纯数字，按 mtime 判新旧。

子命令（路径默认按脚本位置推导仓库根，--lock/--tasks 可覆盖）：
  take     --owner ID [--claim 卡号=目的 ...]   无锁则写认领锁；同属主认领锁则合并
            认领并刷 epoch（盘点后补登用）；其余形态一律拒绝，须先 reconcile。
  heartbeat [--at 秒]                           工作者心跳：无锁/裸数字则覆写为当前
            秒；认领形态/未知形态自拒不覆写（跳过即可，照常干活）。
  hand      --owner ID [--at 秒]                派发完转交：认领锁（须属主本人）或裸
            数字覆写为裸数字当前秒；无锁为 nothing；不得碰他人认领锁。
  reconcile [--owner ID] [--fresh-seconds 秒] [--tasks 目录] [--at 秒]
            唤醒遇锁先对账。心跳距今 <=15 分钟（默认 900s，--fresh-seconds 可调）
            = 新鲜：秒退，不动锁。停滞分三支：认领锁停滞看 claim——任一认领卡
            mtime 晚于认领时刻=有进展，不接管秒退；全部无进展=持锁者失踪，接管
            （写新认领锁，owner 注明「接管自 <旧owner>，缘由心跳停滞」，claim 按
            当前时刻重登记）并输出重派计划；裸数字/未知形态停滞=残留，清除。
  status   [--at 秒]                            打印锁形态、epoch、年龄、属主、认领。

stdout 一律一行 JSON（机器可读，调度员原样抄入报告即留痕）。退出码：
  0 = 已处理可继续（free/clear/takeover；take/heartbeat/hand 成功或自拒跳过）
  3 = 秒退（reconcile 判 fresh / keep_progress）
  1 = 出错或拒绝（take 撞他人锁、hand 碰他人锁、参数缺失等）

时钟统一走 --at 注入（默认当前秒），测试夹具据此做到毫秒级确定性。
"""
import argparse
import json
import os
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_LOCK = os.path.join(ROOT, ".oht", "tasks", ".lock")
DEFAULT_TASKS = os.path.join(ROOT, ".oht", "tasks")
FRESH_SECONDS_DEFAULT = 900  # 需求 3：心跳距今 ≤15 分钟=新鲜
MS_THRESHOLD = 10 ** 11      # epoch 大于此视为毫秒，折算为秒


# ---------------------------------------------------------------------------
# 纯函数：读锁、新鲜判定、认领卡进展、写锁（原子替换，防采样读到半截）
# ---------------------------------------------------------------------------
def read_lock(path):
    """返回 (form, data)。form ∈ claim/worker/none/unknown。"""
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        return "none", None
    text = text.strip()
    if not text:
        return "unknown", text
    if text.isdigit():
        val = int(text)
        if val > MS_THRESHOLD:
            val //= 1000
        return "worker", val
    try:
        obj = json.loads(text)
    except ValueError:
        return "unknown", text
    if isinstance(obj, dict) and valid_epoch(obj.get("epoch")) \
            and isinstance(obj.get("owner"), str) and obj["owner"].strip() \
            and isinstance(obj.get("claim"), dict):
        claim = {}
        for card, entry in obj["claim"].items():
            card = str(card)
            if isinstance(entry, dict):
                at = entry.get("at")
                purpose = entry.get("purpose")
                claim[card] = {
                    "at": int(at) if valid_epoch(at) else None,
                    "purpose": purpose if isinstance(purpose, str) else "",
                }
            elif valid_epoch(entry):
                claim[card] = {"at": int(entry), "purpose": ""}
            else:
                claim[card] = {"at": None, "purpose": ""}
        return "claim", {
            "epoch": int(obj["epoch"]),
            "owner": obj["owner"],
            "claim": claim,
        }
    return "unknown", text


def valid_epoch(val):
    if isinstance(val, bool):
        return False
    if isinstance(val, int):
        return val > 0
    if isinstance(val, str) and val.strip().isdigit():
        return int(val) > 0
    return False


def as_epoch(val):
    v = int(val)
    return v // 1000 if v > MS_THRESHOLD else v


def lock_age(form, data, path, now):
    """锁年龄秒数；无锁返回 None。未知形态按 mtime。"""
    if form == "none":
        return None
    if form in ("claim", "worker"):
        return max(0, now - as_epoch(data["epoch"] if form == "claim" else data))
    try:
        return max(0, now - int(os.path.getmtime(path)))
    except OSError:
        return None


def card_progress(card, entry, tasks_dir, lock_epoch):
    """认领卡自认领以来有无进展：卡文件 mtime 晚于认领时刻=有进展。"""
    name = card if card.endswith(".md") else card + ".md"
    path = os.path.join(tasks_dir, name)
    base = entry.get("at") if entry.get("at") else lock_epoch
    try:
        return os.path.getmtime(path) > base
    except OSError:
        return False  # 卡失踪按无进展算（僵尸方向，宁可接管留痕）


def write_text_atomic(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def write_claim(path, owner, claim, now):
    payload = {"epoch": int(now), "owner": owner,
               "claim": {c: {"at": int(now), "purpose": p} for c, p in claim.items()}}
    write_text_atomic(path, json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    return payload


def write_bare(path, now):
    write_text_atomic(path, "%d\n" % int(now))


# ---------------------------------------------------------------------------
# 动作：take / heartbeat / hand / reconcile（供 CLI 与测试复用）
# ---------------------------------------------------------------------------
def do_take(path, owner, claims, now):
    form, data = read_lock(path)
    if form == "none":
        payload = write_claim(path, owner, claims, now)
        return 0, {"action": "taken", "form": "claim", "lock": payload}
    if form == "claim" and data["owner"] == owner:
        merged = {c: {"at": data["epoch"], "purpose": e["purpose"]}
                  for c, e in data["claim"].items()}
        for c, p in claims.items():
            merged[c] = {"at": int(now), "purpose": p}
        payload = {"epoch": int(now), "owner": owner, "claim": merged}
        write_text_atomic(path, json.dumps(payload, ensure_ascii=False,
                                           separators=(",", ":")) + "\n")
        return 0, {"action": "claim_amended", "form": "claim", "lock": payload}
    return 1, {"action": "refused",
               "reason": "锁已被持有（form=%s），先 reconcile 再 take" % form,
               "form": form}


def do_heartbeat(path, now):
    form, data = read_lock(path)
    if form in ("claim", "unknown"):
        return 0, {"action": "skip", "form": form,
                   "reason": "认领/未知形态不覆写，工作者跳过照常干活"}
    write_bare(path, now)
    return 0, {"action": "heartbeat", "form": "worker", "epoch": int(now)}


def do_hand(path, owner, now):
    form, data = read_lock(path)
    if form == "none":
        return 0, {"action": "nothing", "reason": "无锁可转交"}
    if form == "claim" and data["owner"] != owner:
        return 1, {"action": "refused", "reason": "他人认领锁不得转交"}
    if form == "unknown":
        return 1, {"action": "refused", "reason": "未知形态先 reconcile"}
    write_bare(path, now)
    return 0, {"action": "handed_over", "form": "worker", "epoch": int(now)}


def do_reconcile(path, tasks_dir, now, fresh_seconds, owner):
    form, data = read_lock(path)
    if form == "none":
        return 0, {"action": "free"}
    age = lock_age(form, data, path, now)
    info = {"form": form, "age_seconds": age}
    if age is not None and age <= fresh_seconds:
        return 3, dict(info, action="fresh", reason="心跳新鲜，在途秒退不动锁")
    if form in ("worker", "unknown"):
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass
        return 0, dict(info, action="clear",
                       reason="停滞残留已清除，可重新取锁")
    # 认领锁停滞：核 claim 卡面进展
    cards = data["claim"]
    progress = {c: card_progress(c, e, tasks_dir, data["epoch"])
                for c, e in cards.items()}
    if any(progress.values()):
        return 3, dict(info, action="keep_progress",
                       reason="认领卡有进展，不接管防误杀在途代理",
                       cards=progress)
    new_owner = "%s（接管自 %s，缘由心跳停滞）" % (owner, data["owner"])
    dispatch = [{"card": c, "purpose": e["purpose"]} for c, e in cards.items()]
    payload = write_claim(path, new_owner,
                          {c: e["purpose"] for c, e in cards.items()}, now)
    return 0, dict(info, action="takeover",
                   reason="认领卡无进展，判僵尸锁接管重派",
                   old_owner=data["owner"], new_lock=payload, dispatch=dispatch)


def do_status(path, now, fresh_seconds):
    form, data = read_lock(path)
    if form == "none":
        return 0, {"form": "none"}
    age = lock_age(form, data, path, now)
    out = {"form": form, "age_seconds": age, "fresh": age is not None and age <= fresh_seconds}
    if form == "claim":
        out.update(epoch=data["epoch"], owner=data["owner"],
                   claim={c: e for c, e in data["claim"].items()})
    elif form == "worker":
        out.update(epoch=data)
    else:
        out["raw"] = str(data)[:200]
    return 0, out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def emit(code, out):
    print(json.dumps(out, ensure_ascii=False))
    return code


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="锁机制脚本（T0018）：三要素/心跳/对账")
    ap.add_argument("--lock", default=DEFAULT_LOCK, help="锁文件路径")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        # --lock 同时挂主解析器与子解析器；子级 default=SUPPRESS 防止子解析器
        # 把主级已解析的值清洗成默认值（argparse 同名参数覆盖陷阱）。
        p.add_argument("--lock", default=argparse.SUPPRESS,
                       help="锁文件路径（亦可放子命令前）")
        p.add_argument("--at", type=int, default=None, help="注入当前 Unix 秒（测试用）")

    p = sub.add_parser("take", help="取认领锁；同属主合并认领")
    p.add_argument("--owner", required=True)
    p.add_argument("--claim", action="append", default=[], metavar="卡号=目的")
    p.add_argument("--tasks", default=DEFAULT_TASKS)
    common(p)

    p = sub.add_parser("heartbeat", help="工作者心跳：覆写裸数字；认领形态自拒")
    common(p)

    p = sub.add_parser("hand", help="派发完转交裸数字心跳")
    p.add_argument("--owner", required=True)
    common(p)

    p = sub.add_parser("reconcile", help="唤醒对账：新鲜秒退/停滞接管或清除")
    p.add_argument("--owner", default="dispatcher", help="接管时新属主标识")
    p.add_argument("--fresh-seconds", type=int, default=FRESH_SECONDS_DEFAULT)
    p.add_argument("--tasks", default=DEFAULT_TASKS)
    common(p)

    p = sub.add_parser("status", help="查看锁形态与年龄")
    p.add_argument("--fresh-seconds", type=int, default=FRESH_SECONDS_DEFAULT)
    common(p)

    a = ap.parse_args(argv)
    now = int(a.at if a.at is not None else time.time())
    if a.cmd == "take":
        claims = {}
        for item in a.claim:
            if "=" not in item:
                return emit(1, {"action": "error", "reason": "claim 须为 卡号=目的：%r" % item})
            card, purpose = item.split("=", 1)
            claims[card.strip()] = purpose.strip()
        return emit(*do_take(a.lock, a.owner, claims, now))
    if a.cmd == "heartbeat":
        return emit(*do_heartbeat(a.lock, now))
    if a.cmd == "hand":
        return emit(*do_hand(a.lock, a.owner, now))
    if a.cmd == "reconcile":
        return emit(*do_reconcile(a.lock, a.tasks, now, a.fresh_seconds, a.owner))
    if a.cmd == "status":
        return emit(*do_status(a.lock, now, a.fresh_seconds))
    return emit(1, {"action": "error", "reason": "未知子命令"})


if __name__ == "__main__":
    sys.exit(main())

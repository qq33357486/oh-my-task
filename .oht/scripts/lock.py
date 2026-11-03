"""锁机制脚本 —— 【superseded 2026-11-04，已桩化退役，不再执行】

出处：T0031 需求 1（人八项定案 2026-11-03：废锁改台账）。原为 T0018 实现的
锁机制（三要素认领/心跳/对账接管，.oht/tasks/.lock），锁机制被裁为画蛇添足：
调度员单一会话主持，在途子代理清清楚楚，无需进程间互斥。

承接映射（原 12 项锁快测与 PROTOCOL 锁条文的语义去向）：
  互斥/认领/心跳/对账接管（锁活性与事务语义）→ 调度员台账制：派发即记账、
    完成通知即销账、报告在途须台账+现场双源印证、台账空即事实空闲
    （PROTOCOL.md「并发与通知」、roles/dispatcher.md「台账」节，T0031/A1）。
  停滞判定（原锁 mtime 对账）→ 判滞纪律：超 10 分钟嫌疑，采样运行实录定性，
    实锤（重复同一动作/互等/等自己）才 TaskStop 击杀+留痕+重派；禁纯产物
    mtime 判据（roles/dispatcher.md「判滞」节，T0031/A2）。

退役改写（实现员，T0031 需求 1，按 run_t0010.py/run_t0018.py 桩先例）：全部
锁逻辑删除，不留任何与台账制矛盾的活断言；任何参数运行只打印本说明并
exit 0（旧调用命令不再阻塞，也不伪装成绿——见 NOTICE 行）。
.oht/tasks/.lock 不再创建不再读取；历史见 T0018/T0031 卡面与 git 历史。
"""
import sys

NOTICE = (
    "SUPERSEDED 2026-11-04：锁机制已退役（T0031 需求 1，人八项定案：废锁改台账），"
    "本脚本不再执行任何锁操作，.oht/tasks/.lock 不再创建不再读取。承接：互斥→"
    "调度员台账制（派发记账/通知销账/双源印证），活性停滞→判滞纪律（超 10 分钟"
    "嫌疑、采样运行实录定性）。出处与承接映射见本文件 docstring、PROTOCOL.md"
    "「并发与通知」与 roles/dispatcher.md。"
)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(NOTICE)
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""T0018 引擎级测试 harness —— 【superseded 2026-11-03，已退役，不再执行】

出处：T0018 需求 5（人批 doctrine，2026-11-03 人在场批准）：锁机制抽为
.oht/scripts/lock.py 纯代码后，回归门槛移交锁快测（lock_a1.test.py 7 例 /
lock_a2.test.py 5 例，毫秒-秒级文件夹具），引擎真唤醒场景与 T0010 全量不再
作为常规回归。

本文件原为真实 zcode 唤醒引擎 harness（场景 a1/a2t/a2n；断言 A1a 事务认领 /
A1b 工作者心跳 / A1c 唤醒先行结束 / A1d 第二唤醒秒退 / A2a 失踪重派留痕 /
A2b 反向不动），tests 阶段（2026-11-03）锁定并产出红基线，历史见 T0018 卡面
进度。断言对象已由快测承接：A1a→lock_a1/A1-1，A1b→A1-2，A1d→A1-3 与
lock_a2/A2-5，A2a→lock_a2/A2-1，A2b→lock_a2/A2-2，A1c（异步放锁端到端观察）
随引擎场景一并退役，由 lock_a1/A1-5（hand 转交=派发即释放的机制侧）近似承接。

退役改写：检查员 2026-11-03 按人批变更执行（先例 T0004/A4、T0007）。本文件
已删除全部场景、唤醒、采样与断言代码，不留任何与新语义矛盾的活断言；运行只
打印本说明并 exit 0（历史调用命令不再阻塞，也不伪装成绿——见 NOTICE 行）。

退役前最后一只金丝雀（2026-11-03，检查员裁量，单次 OHT_T0018_SCENES=a2t）：
沙盒 dispatcher 未接管、未派发，伪造停滞锁逐字未动（锁带空格分隔且无尾换行，
可证 lock.py 从未写过它），卡保持 ready——提示词依从性一次观测存疑；harness
未落盘唤醒报告，成因无法定诊。证据与裁量记 T0018 卡面进度；按 doctrine 不
迭代追查，后续靠真实运行观察或人决跟进卡。
"""
import sys

NOTICE = (
    "SUPERSEDED 2026-11-03：T0018 引擎场景已退役（T0018 需求 5，人批 doctrine），"
    "本文件不再执行任何唤醒/断言。回归门槛=.oht/tests/T0018/lock_a1.test.py 与 "
    "lock_a2.test.py；出处与承接映射见本文件 docstring 与 T0018 卡面进度。"
)


def main():
    print(NOTICE)
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""T0010 自动化引擎全量 harness —— 【superseded 2026-11-03，已退役，不再执行】

出处：T0010（自动化引擎系统测试，2026-11-03 review 曾全绿，历史见 T0010 卡面
进度与 README.md）。原为真实 zcode 唤醒 harness：临时沙盒 + 预置卡组 +
唤醒一轮调度员 + 11 项断言（A1 可重复 / A2 锁与分派 / A3 生命周期 / A4 看板一致）。

被 T0020 doctrine 取代（2026-11-03，人两条纠正定案）：测试与干活由在途工作者
自跑用例——不新起 CLI 实例、不嵌套派人、不指定外部模型。真唤醒正是被禁形态：
桌面会话模型绑定与 CLI Provider Registry 错配，沙盒唤醒实际跑在外部模型上并
消耗其额度；且机制已前移——锁机制入 .oht/scripts/lock.py，回归门槛移交锁快测
（lock_a1.test.py 7 例 / lock_a2.test.py 5 例，毫秒-秒级），全量唤醒失去存在理由。

退役改写（实现员，T0020 需求 2，按 run_t0018.py 先例）：场景、沙盒、唤醒与
断言代码全部删除，不留任何与新语义矛盾的活断言；运行只打印本说明并 exit 0。
断言承接：A2/A3 锁与生命周期语义由锁快测与 T0018 桩 docstring 的承接映射近似
承接；A4 看板一致由 app vitest 承接；夹具语义（presets/、占位测试）只读留档。
"""
import sys

NOTICE = (
    "SUPERSEDED 2026-11-03：T0010 真唤醒 harness 已退役，被 T0020 测试执行纪律"
    "（自跑用例：不新起 CLI 实例、不嵌套派人、不指定外部模型）取代，本文件不再"
    "执行任何沙盒/唤醒/断言。回归门槛=.oht/tests/T0018/lock_a1.test.py 与 "
    "lock_a2.test.py、app vitest；出处与承接见本文件 docstring、T0010/README.md "
    "与 T0020 卡面进度。"
)


def main():
    print(NOTICE)
    return 0


if __name__ == "__main__":
    sys.exit(main())

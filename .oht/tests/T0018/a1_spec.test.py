"""T0018 引擎夹具（检查员锁定，实现员不得改本文件）：card A1 tests 态的被检测试，恒红。

沙盒内检查员角色对 t0018a1_tests 卡（status=tests）复跑本测试得红，卡随之满足
tests→ready 时序（同 T0010 fake_spec.test.py 先例）。本测试无实现路径，永红，
只作卡状态推进的时序依据，不承载 T0018 任何断言语义。
"""
import sys

print("a1_spec.test.py：红（T0018 A1 场景恒红夹具，仅作 tests→ready 时序依据）")
sys.exit(1)

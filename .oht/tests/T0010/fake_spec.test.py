"""T0010 引擎夹具（检查员锁定，实现员不得改）：恒失败占位测试。

用途：card_tests（tests→ready）与 need_human 两张夹具卡的"查"命令。
无论沙盒处于什么状态，本测试恒失败（exit 1）——这正是 card_tests 被
检查员推 ready 的依据（测试红即达标）。运行：python -I 本文件
"""
import sys

print("fake_spec.test.py：红（恒失败占位，T0010 引擎夹具）")
sys.exit(1)

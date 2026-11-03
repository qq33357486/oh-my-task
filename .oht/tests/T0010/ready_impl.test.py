"""T0010 引擎夹具（检查员锁定，实现员不得改本文件）：card_ready 的被实现测试，出厂即红。

给沙盒内的实现员角色：按实现员职责"让测试变绿"，本测试的可判定实现路径是
创建标记文件 <项目根>/.oht/local/ready_impl_done（内容任意）。标记存在即绿，
卡随之时序满足 ready→review。项目根按本文件位置推导，与运行时工作目录无关。
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MARKER = os.path.join(ROOT, ".oht", "local", "ready_impl_done")

if os.path.isfile(MARKER):
    print("ready_impl.test.py：绿（检测到实现标记）")
    sys.exit(0)
print("ready_impl.test.py：红（缺 " + os.path.join(".oht", "local", "ready_impl_done") + "，见文件头实现提示）")
sys.exit(1)

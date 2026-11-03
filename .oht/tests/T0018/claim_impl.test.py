"""T0018 引擎夹具（检查员锁定，实现员不得改本文件）：A2 认领卡（t0018claim / t0018alive）的被实现测试。

与 a1_impl.test.py 同款标记机制，但标记 <项目根>/.oht/local/claim_impl_done
由 harness 在构建 A2 沙盒时预置——出厂即绿。为什么：A2 断言聚焦"接管后按卡面
正常派发"（卡 status 从 ready 前进），不考察实现动作本身；预置绿测试让
实现员子代理零额外工作即可推卡，缩短接管场景的持锁时长，降低观察窗口噪声。
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MARKER = os.path.join(ROOT, ".oht", "local", "claim_impl_done")

if os.path.isfile(MARKER):
    print("claim_impl.test.py：绿（检测到实现标记）")
    sys.exit(0)
print("claim_impl.test.py：红（缺 " + os.path.join(".oht", "local", "claim_impl_done") + "）")
sys.exit(1)

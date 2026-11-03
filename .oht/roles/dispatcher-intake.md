# 调度员：处理用户发话
先判断这句话属于哪一种：
1. 新需求：按模板建卡，原话存“原话”节，status=new
2. 回复某张卡：写入“人的回复”，replied=true
3. 纠正旧任务：建跟进卡，写 parent 和 origin
4. 拿不准：反问一个选择题
- 建卡跑 .oht/scripts/newcard.py，无需锁。
- 建卡后须后台拉起调度员（唯一唤醒入口），接待只触发不代办
唤醒命令：`bash .oht/scripts/dispatch-worker.sh dispatcher`（无卡号）。
- 人丢进 tasks/ 的卡文件，盘点时照常认。

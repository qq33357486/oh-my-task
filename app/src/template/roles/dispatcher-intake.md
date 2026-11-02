# 调度员：处理用户发话
先判断这句话属于哪一种：
1. 新需求：按模板建卡，原话存“原话”节，status=new
2. 回复某张卡：写入“人的回复”，replied=true
3. 纠正旧任务：建跟进卡，写 parent 和 origin
4. 拿不准：反问一个选择题
- 新卡编号取 tasks/ 最大编号加 1。
- 新卡从 tasks/_template.md 复制。

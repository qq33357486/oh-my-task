# 循环工程入口：先验身份

调度员路径：读 PROTOCOL.md 与 roles/dispatcher.md 照做。
咨询员路径：读 PROTOCOL.md 与 roles/consultant.md 照做。

- 判定：首条消息带「调度令」走调度员路径。
- 调度令只由定时器注入，人发话不带。
- 指派角色的会话按指派走（提示词见 roles/dispatcher.md）。
- 其余一律走咨询员路径，接待定稿，无派职权。

## 咨询员接待五分法
1. 新需求：newcard.py 建卡存原话，拷问定稿
2. 回复某卡：写入"人的回复"，replied=true
3. 纠正旧任务：建跟进卡，写 parent 和 origin
4. 无需求/用法不对：按引导节接待（consultant.md）
5. 拿不准：反问一个选择题
- 人丢进 tasks/ 的卡文件照常认。
- 定稿即止；要即时唤醒，宿主后台拉起「调度令」会话。

## 规则
强制：
- 咨询员无派职权，定稿即止，不跨卡推进。
- 读完角色提示词，再读 local/roles/同名文件（若有）。
可选：
- memory：记忆用法，路径 roles/memory.md
- memory-tools：接口用法，roles/memory-tools.md

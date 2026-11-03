---
id: card_ready
type: 系统开发
status: ready
round: 0
parent: ""
origin: ""
knowledge: []
system: ""
lane: ""
touches: []
batch: ""
stopped_at: ""
resume_to: ""
stop_reason: ""
question: ""
replied: false
---

## 原话
（T0010 引擎测试夹具）ready 卡：测试出厂即红，实现完成后转绿，卡推 review。

## 需求
夹具卡：模拟实现员阶段的卡，测试为 .oht/tests/T0010/ready_impl.test.py（出厂即红：缺实现标记 .oht/local/ready_impl_done）。自动化唤醒中实现员按测试文件头的实现提示完成实现动作（创建标记），测试转绿，卡推 review。本卡用于锁定断言 ready→review（测试绿）；若实现动作不可达，断言判红。

## 复述卡
1. 理解：ready 卡实现后测试绿则推 review。
2. 做：无（只读夹具，实现动作发生在沙盒副本上）。
3. 例子：唤醒一轮后本卡 status=review 且 ready_impl.test.py 通过。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 实现后测试转绿
- 类型：auto
- 查：python -I .oht/tests/T0010/ready_impl.test.py
- 预期：实现完成后退出码 0（出厂即红）
- 状态：红

## 系统文档改动

## 进度
- T0010 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复

---
id: t0018a1_ready
title: 锁心跳引擎夹具就绪卡
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
（T0018 引擎测试夹具）ready 卡：测试出厂即红，实现后转绿，卡推 review。

## 需求
夹具卡：测试为 .oht/tests/T0018/a1_impl.test.py（出厂即红：缺实现标记 .oht/local/a1_impl_done，文件头写明实现提示）。自动化唤醒中实现员按提示完成实现动作（创建标记），测试转绿，卡推 review，检查员复跑绿推 done，记录员提炼推 recorded。本卡用于 A1 场景：派发即放锁后，由实现员/检查员/记录员链条拉长工作者工作窗口，使工作者自刷心跳（裸 epoch 每步顺带刷新）在采样窗口内多次出现、并在唤醒退出后仍续传。

## 复述卡
1. 理解：ready 卡实现后测试绿则推 review。
2. 做：无（只读夹具，实现动作发生在沙盒副本上）。
3. 例子：唤醒一轮后本卡 status=review 或其后继状态。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 实现后测试转绿
- 类型：auto
- 查：python -I .oht/tests/T0018/a1_impl.test.py
- 预期：实现完成后退出码 0（出厂即红）
- 状态：红

## 系统文档改动

## 进度
- T0018 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复

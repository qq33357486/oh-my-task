---
id: t0018a1_tests
title: 锁心跳引擎夹具测试卡
type: 系统开发
status: tests
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
（T0018 引擎测试夹具）tests 卡：被检测试恒红，检查员复跑得红后推 ready。

## 需求
夹具卡：模拟检查员阶段的卡，测试为 .oht/tests/T0018/a1_spec.test.py（恒红，无实现路径）。自动化唤醒中检查员按 tests 模式复跑得红，卡推 ready。本卡用于 A1 场景：给唤醒一张真实可派卡并拉长工作者工作窗口，供采样器观察事务期认领登记（卡号+时刻+目的）与工作者自刷心跳（裸 epoch）。测试永红属夹具设计，不代表引擎故障。

## 复述卡
1. 理解：tests 卡测试红则推 ready。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡 status=ready。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 夹具恒红推进
- 类型：auto
- 查：python -I .oht/tests/T0018/a1_spec.test.py
- 预期：退出码 1（恒红，检查员据此推 ready）；唤醒后本卡 status=ready
- 状态：红

## 系统文档改动

## 进度
- T0018 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复

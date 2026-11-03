---
id: card_tests
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
（T0010 引擎测试夹具）tests 卡：测试已写且为红，等待检查员确认后推 ready。

## 需求
夹具卡：模拟检查员阶段的卡，测试为 .oht/tests/T0010/fake_spec.test.py（恒失败占位）。自动化唤醒中检查员复跑得红，按生命周期把卡推进 ready。

## 复述卡
1. 理解：tests 卡测试复跑为红则推 ready。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡 status=ready。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 夹具测试恒失败
- 类型：auto
- 查：python -I .oht/tests/T0010/fake_spec.test.py
- 预期：退出码非 0（红）
- 状态：红

## 系统文档改动

## 进度
- T0010 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复

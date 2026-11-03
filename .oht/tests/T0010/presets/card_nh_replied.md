---
id: card_nh_replied
type: 系统开发
status: need_human
round: 0
parent: ""
origin: ""
knowledge: []
system: ""
lane: ""
touches: []
batch: ""
stopped_at: checker
resume_to: tests
stop_reason: 测试环境缺外层依赖，无法自动判定
question: 夹具选择题：选 A 还是选 B？
replied: true
---

## 原话
（T0010 引擎测试夹具）need_human 已回复卡：调度员唤醒后应把 status 置为 resume_to 并复位 replied。

## 需求
夹具卡：模拟 need_human 且人已回复（replied=true）。自动化唤醒中调度员把 status 改为 resume_to 所指状态（本卡为 tests），replied 复位 false，再按新状态派发。

## 复述卡
1. 理解：已回复卡被唤醒后回到 resume_to。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡 status=tests 且 replied=false。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 夹具占位条目
- 类型：auto
- 查：python -I .oht/tests/T0010/fake_spec.test.py
- 预期：退出码非 0（恒失败占位，仅作卡格式完整性）
- 状态：红

## 系统文档改动

## 进度
- T0010 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复
（夹具）选 B，理由见原需求。2026-11-03

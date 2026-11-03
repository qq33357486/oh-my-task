---
id: card_nh
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
question: 夹具选择题：日志落 local/ 还是落 tasks/？
replied: false
---

## 原话
（T0010 引擎测试夹具）need_human 未回复卡：人在回复前，引擎不得推进本卡。

## 需求
夹具卡：模拟 need_human 且 replied=false。自动化唤醒中调度员只把它列入通知清单，不改状态、不派角色。

## 复述卡
1. 理解：未回复的 need_human 卡唤醒后原地不动。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡仍 status=need_human 且 replied=false。
4. 拆分：无。
5. 待你定：无（本题留给真人的位置由真卡承担）。

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

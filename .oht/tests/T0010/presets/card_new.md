---
id: card_new
type: 系统开发
status: new
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
（T0010 引擎测试夹具）给看板加一个深色模式。

## 需求
夹具卡：模拟自动化唤醒遇到的普通 new 卡。无人到场，按调度员规则 new 卡不派咨询员、只入报告、状态不变。

## 复述卡
1. 理解：普通 new 卡在自动唤醒中保持 new 并入报告。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡仍在 tasks/ 且 status=new。
4. 拆分：无。
5. 待你定：无。

## 验收条目

## 系统文档改动

## 进度
- T0010 预置夹具（只读），由 harness 注入沙盒，勿在母本仓库改动状态。

## 失败原因

## 候选教训

## 人的回复

---
id: card_review
type: 系统开发
status: review
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
（T0010 引擎测试夹具）review 卡：复跑测试全绿样，检查员确认后推 done。

## 需求
夹具卡：模拟实现员做完送审的卡，测试为 .oht/tests/T0010/review_green.test.py（恒通过占位，即"测试全绿样"）。条目状态按协议在 review 阶段保持红（检查员判定绿时才改绿并推 done）。自动化唤醒中检查员复跑得绿，把条目改绿、卡推 done。

## 复述卡
1. 理解：review 卡复跑全绿则条目改绿、卡推 done。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡 status=done 且条目状态为绿。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 复跑全绿
- 类型：auto
- 查：python -I .oht/tests/T0010/review_green.test.py
- 预期：退出码 0（绿）
- 状态：红

## 系统文档改动

## 进度
- T0010 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复

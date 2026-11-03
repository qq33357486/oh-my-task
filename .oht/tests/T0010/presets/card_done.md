---
id: card_done
type: 系统开发
status: done
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
（T0010 引擎测试夹具）done 卡：等待记录员提炼经验后转 recorded。

## 需求
夹具卡：模拟已判定绿、等待记录员的卡（条目全绿）。自动化唤醒中记录员提炼候选教训后把卡置 recorded。

## 复述卡
1. 理解：done 卡被记录员置 recorded。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡 status=recorded。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 已验证占位
- 类型：auto
- 查：python -I .oht/tests/T0010/review_green.test.py
- 预期：退出码 0（绿）
- 状态：绿

## 系统文档改动

## 进度
- T0010 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复

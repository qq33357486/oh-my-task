---
id: T0000
title: ""            # 必填：人话单行 ≤24 字，无日期、卡号、括号注记——给人看的摘要
type: ""
stage: 需求          # 需求 | 实现 | 检查（跨阶段变动只有调度员可写）
progress: 未执行     # 未执行 | 执行中 | 执行完毕（本阶段工人可写）
stage_changed_at: "" # 当前「stage,progress」生效时刻（ISO 8601；card.py 状态命令自动写）
intent: ""           # 人话位：这卡要干嘛（咨询员定稿写，一句 ≤40 字）
status: ""           # 人话位：现在怎样（状态动作顺手 --status 更新，≤40 字）
outcome: ""          # 人话位：做成了什么（终态写，一句 ≤40 字）
need_human: false    # true 时为旁路暂停态，stage/progress 冻结
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

## 需求

## 复述卡

## 验收条目

### A1 玩家做X，发生Y
- 类型：auto
- 查：
- 预期：
- 状态：未写

## 系统文档改动

## 进度

## 失败原因

## 候选教训

## 人的回复

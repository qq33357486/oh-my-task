---
id: t0018claim
title: 锁心跳接管场景认领卡
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
（T0018 引擎测试夹具）A2 失踪重派场景的认领卡：被停滞锁认领且认领后无进展，唤醒应判持锁者失踪、重派本卡并留痕。

## 需求
夹具卡：harness 构建沙盒时预置一把心跳停滞（epoch 与文件 mtime 均距今约 40 分钟 > 30 分钟新鲜窗）的认领形态伪造锁，claim 含本卡号+认领时刻+目的；本卡文件 mtime 早于认领时刻（认领以来无 status 进展）。自动化唤醒对账后应判持锁者失踪：重派本卡（本卡测试 .oht/tests/T0018/claim_impl.test.py 已被 harness 预置标记，实现员零工作即绿），卡 status 从 ready 前进，且重派动作留痕（唤醒报告或锁注记点名本卡/旧属主与缘由）。

## 复述卡
1. 理解：心跳停滞且认领卡无进展=持锁者失踪，唤醒重派认领卡并留痕。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡 status=review/…后继，报告或锁含失踪/重派留痕。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 认领卡被失踪重派
- 类型：auto
- 查：python -I .oht/tests/T0018/claim_impl.test.py
- 预期：退出码 0（harness 已预置实现标记）；重派唤醒后本卡 status 非 ready 且留痕可查
- 状态：红

## 系统文档改动

## 进度
- T0018 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复

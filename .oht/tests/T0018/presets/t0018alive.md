---
id: t0018alive
title: 锁心跳反向场景认领卡
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
（T0018 引擎测试夹具）A2 反向场景的认领卡：被停滞锁认领但认领后有进展，唤醒不得动锁派卡，秒退。

## 需求
夹具卡：harness 构建沙盒时预置一把心跳停滞（epoch 与文件 mtime 均距今约 40 分钟 > 30 分钟新鲜窗）的认领形态伪造锁，claim 含本卡号+认领时刻+目的；但本卡文件 mtime 晚于认领时刻（认领以来有进展，模拟在途代理仍活着可能写回）。自动化唤醒对账后不得动锁不得派卡：锁保持原样（epoch/owner 逐字不变、不删除），本卡不被派发（status 保持 ready），唤醒进程快速正常退出。

## 复述卡
1. 理解：停滞锁但认领卡有进展，说明在途代理可能仍在写回，不动锁秒退。
2. 做：无（只读夹具）。
3. 例子：唤醒一轮后本卡仍 ready，锁内容与预置一致。
4. 拆分：无。
5. 待你定：无。

## 验收条目

### A1 反向场景卡不被派发
- 类型：auto
- 查：python -I .oht/tests/T0018/claim_impl.test.py
- 预期：退出码 0（harness 已预置实现标记）；对账唤醒后本卡 status 保持 ready 且锁原样
- 状态：红

## 系统文档改动

## 进度
- T0018 预置夹具（只读），由 harness 注入沙盒。

## 失败原因

## 候选教训

## 人的回复

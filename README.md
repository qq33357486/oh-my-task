# oh-my-task

中性的"循环工程"框架：人只提创意，AI 员工按状态流转，经验越用越多。

```
roles/       员工提示词（一个文件一个角色）
tasks/       任务单，一个任务一个文件（状态约定见 PROTOCOL.md）
knowledge/   经验库
  rules.md   常驻规则：很短，每次必读
  topics/    按需资料：按任务类型分文件，用到才读
  log/       日志：只追加，平时不读
PROTOCOL.md  状态约定（所有角色的交接依据）
```

调度由定时任务驱动：每次唤醒 = 运行 `roles/dispatcher.md`，只推进一件事。

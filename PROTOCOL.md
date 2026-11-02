# 状态约定

任务是一张卡片（`tasks/<id>.md`）。人和 AI 异步地往同一张卡片上写，不需要同步对话。任务不会“结束后丢失上下文”：停下只是暂停，状态和原因都在卡片里。

## 任务单头部
```
---
id: T0001
type: <任务类型，对应 knowledge/topics/<type>.md>
status: <见下表>
round: 0              # 实现-检查往返次数
parent: ""            # 跟进任务指向原任务，如 T0003
knowledge: [topics/xxx.md]
lane: ""              # 泳道：系统开发取 parent，小修取主知识库名
touches: []           # 会改的模块；跨泳道重叠则后者等待
batch: ""             # 同批次的编号，由调度员填
stopped_at: ""        # status=need_human 时必填：停在哪个角色/步骤
resume_to: ""         # status=need_human 时必填：人回复后回到哪个 status
stop_reason: ""       # status=need_human 时必填：终止原因
question: ""          # status=need_human 时必填：一个具体的选择题
replied: false        # 人回复后由页面置 true
---
```

## 正文固定六节
`## 需求`、`## 验收条目`（机器可判定）、`## 进度`（追加，写“为什么”）、`## 失败原因`（追加，写真实原因）、`## 候选教训`（各角色顺手追加，只是候选）、`## 人的回复`（人追加，带日期）。

## 状态流转
| status | 下一位 |
|---|---|
| new | consultant |
| ready | implementer |
| review | checker |
| done | recorder |
| recorded | （结束） |
| need_human | 人（异步） |

- checker 不通过 → ready（round+1）；round 超上限 → need_human。
- need_human：任何角色拿不准或卡住都可设置，必须同时填 stopped_at、resume_to、stop_reason、question。

## 泳道与批次
- 泳道：按 lane 分组。泳道之间并行，泳道内合并成批。
- 批次：同泳道所有 ready 的卡，交给一个实现员一次做完。
- 验收、检查、提交仍逐卡；一张失败只退回那一张。
- 批次内需求冲突：冲突的卡转 need_human，其余继续。
- 新来的卡不打断进行中的批次，等下一批。
- 批次大小由上下文装得下决定，装不下拆两批。
- 跨泳道 touches 重叠，后者等待。
- 只有运行引擎的检查全局排队。

## 人的介入（异步）
1. **任务卡住**：人在页面看到 need_human 卡片，按编号回复（如“T0003 选 B，因为……”），回复写入“人的回复”，replied=true。调度员下次醒来把 status 改为 resume_to，replied=false，任务从断点继续。
2. **任务已结束事后发现不对**：不重开旧卡，新建跟进任务，`parent: T0003`，“需求”节写纠正和一句原因，status=new。

## 规则
- 一份信息只有一个主人；派生内容重生成，不修补。
- 文档分两层：内存层（AGENTS.md、roles/、knowledge/rules.md、topics/）始终是最终版，直接改写，不留历史，历史交给 git；外存层（knowledge/log/、记忆系统）只追加，旧条目标记 superseded 并链接新条目。
- 所有文档遵循剃刀原则：只留最核心。内存层（AGENTS.md、roles/、rules.md、topics/）篇幅上限：规则一条 ≤40 字，流程步骤一步 ≤30 字，一个流程 ≤7 步（多了拆子流程文件），rules.md 总量 ≤1500 字。硬限制，超了不得写入；写不下的细节放外存，内存层只留指针。由 `scripts/check-size.py` 检查。
- 准入：每条规则须能追溯到一次真实错误或人的纠正（出处放外存），并写明适用条件；能写成自动检查的，转成检查后从文档删除。每条须独立可读，不依赖上下文。
- 角色只改自己负责的节和 status。
- 每个角色做完一步，当场写“为什么”，不只写结果。

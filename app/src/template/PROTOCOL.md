# 状态约定

任务是一张卡片（`tasks/<id>.md`）。人和 AI 异步地往同一张卡片上写，不需要同步对话。停下只是暂停，状态和原因都在卡片里。卡片模板见 `tasks/_template.md`，由 `scripts/check-card.py` 检查。

## 一张卡的一生
| status | 谁处理 | 做什么 | 下一状态 |
|---|---|---|---|
| new | consultant | 拷问、写需求和验收条目、写复述卡 | tests |
| tests | checker | 为 auto 条目先写测试，确认是红 | ready，条目写不清退回 new |
| ready | implementer | 实现，让测试变绿 | review |
| review | checker | 复跑全部测试，逐条判定 | done 或 ready |
| done | recorder | 提炼经验 | recorded |
| recorded | — | 结束 | — |
| need_human | 人（异步） | 回复后回到 resume_to | resume_to |

- 复述卡有“待你定”：new 直接转 need_human，不进 tests。
- review 不通过：ready，round+1。round 超 3 转 need_human（3 是草案）。
- 全是“人看”条目、没有 auto 条目：checker 在 tests 直接转 ready。
- 大需求拆分：咨询员建子卡（origin=split，parent=原卡），原卡直接置 recorded。
- 事后纠正：新建跟进卡（origin=followup，parent=原卡），status=new。

## 谁写什么
| 字段或节 | 主人 |
|---|---|
| id、parent、origin、原话、初始 status=new | 调度员 |
| type、knowledge、lane、touches | 咨询员 |
| batch、round（实现失败以外的重试） | 调度员 |
| round（检查不通过 +1） | 检查员 |
| 需求、复述卡、验收条目（除状态） | 咨询员 |
| system、系统文档改动、新系统文档草稿 | 咨询员 |
| 系统文档的合并 | 记录员 |
| 验收条目的“状态”、.oht/tests/<id>/ | 检查员 |
| 进度 | 实现员（追加） |
| 失败原因 | 检查员（追加） |
| 候选教训 | 各角色（追加） |
| 人的回复、replied | 人（页面或调度员代写） |
| need_human 四字段 | 设置它的角色 |

编号：调度员取 tasks/ 里最大编号加 1，格式 T0001。

## 任务单头部
```
---
id: T0001
type: <任务类型，对应 knowledge/topics/<type>.md>
status: <见上表>
round: 0              # 实现-检查往返次数
parent: ""            # 拆分子卡或跟进卡指向原卡
origin: ""            # split 或 followup；普通卡留空
knowledge: [topics/xxx.md]
system: ""            # 本卡改哪个系统，对应 knowledge/topics/<system>.md
lane: ""              # 泳道：系统开发取 parent，小修取主知识库名
touches: []           # 会改的模块；跨泳道重叠则后者等待
batch: ""             # 同批次的编号，由调度员填
stopped_at: ""        # status=need_human 时必填：停在哪个角色/步骤
resume_to: ""         # status=need_human 时必填：人回复后回到哪个 status
stop_reason: ""       # status=need_human 时必填：终止原因
question: ""          # status=need_human 时必填：一个具体的选择题
replied: false        # 人回复后置 true
---
```

## 正文固定九节
`## 原话`（人的原话，不改）、`## 需求`（完整，给 AI 读）、`## 复述卡`（≤200字，给人看，见 roles/consultant-brief.md）、`## 验收条目`、`## 系统文档改动`（只写差异：新增、修改、删除哪几条约束）、`## 进度`、`## 失败原因`、`## 候选教训`、`## 人的回复`。

## 验收条目格式（TDD）
每条一个小节，四项缺一不可：
```
### A1 玩家做X，发生Y
- 类型：auto 或 human
- 查：命令、测试路径或截图对比（human 写“人看”）
- 预期：具体结果，可判定
- 状态：未写 → 红 → 绿（human：人看 → 绿）
```
- 顺序：咨询员写条目 → 检查员先写测试并确认红 → 实现员做到绿 → 检查员复跑。
- 测试写好即锁定：实现员只能新增，不得改或删。
- 写不成测试的（手感、效果图）标 human，进复述卡的人验收区。
- human 条目由检查员转 need_human，问人一个选择题。
- 状态要求：ready、review 时 auto 全是红；done 起全是绿。

## 系统文档
- 每个系统一份：knowledge/topics/<system>.md，模板见 topics/_template.md。
- 它是现状快照，属内存层，始终是最终版。
- 新系统：咨询员起草，标“草稿”；首卡 done 后记录员改“定稿”。
- 已有系统：咨询员只在卡里写差异，不直接改文档。
- 卡 done 后，记录员把差异小幅合并进文档，再置 recorded。
- 人不直接改文档；要改就提新需求，走新卡。
- 每条约束标对应测试；没有测试的归“意图”。
- 文档与测试、代码矛盾时，以测试和代码为准。
- 整理员定期核对，矛盾只提议修正。
- 改了系统的卡，system 与差异节必须同时填写。

## 记忆（可选，MemOS）
- 文件是事实源；MemOS 只存候选和观察中的经验，检索用。
- 生效后进 knowledge/ 文件，MemOS 只留指针。
- 一个项目一个 MCP 配置、一个 user_id，不按角色拆：经验要全员共享。
- 角色区分用内容前缀；检索用“角色名+关键词”，filter 不可靠。
- 谁用：咨询员、实现员、检查员、巡检员读；记录员写；整理员维护。
- 调度员不用。没有 memos 时全部退回文件，流程不变。
- 密钥只放 .zcode/config.json，已被 git 忽略。

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
1. **任务卡住**：人按编号回复（如“T0003 选 B，因为……”），写入“人的回复”，replied=true。调度员下次醒来把 status 改为 resume_to，replied=false，从断点继续。
2. **任务已结束事后发现不对**：不重开旧卡，建跟进卡，“原话”写纠正和一句原因。

## 并发与通知
- tasks/.lock：同一时刻只允许一个调度员运行，超 30 分钟视为失效。
- 新卡编号只在持锁时分配；巡检员入队同样先取锁。
- 通知人：need_human 卡就是收件箱，不另发消息。

## 知识生命周期
- 条目格式：日期｜卡号｜适用条件｜内容｜命中数｜状态。
- 状态：候选 → 生效 → 固化，或 superseded。
- 候选：各角色写的候选教训，记录员筛选后入 log。
- 生效：人的纠正直接生效；AI 自发现的命中 3 次生效（3 是草案）。
- 固化三去处：rules.md 常驻、topics 按需、转自动检查后删文本。
- 失效：被取代、与测试代码矛盾或长期未命中，标 superseded 归档，不物理删。
- 越用越好用的指标，由整理员从卡片统计：每卡 need_human 次数、一次通过率、同类错误重复数。指标不降先查晋升流程，不加新规则。

## 框架与业务
- 框架：AGENTS.md、PROTOCOL.md、roles/、scripts/、模板。
- 业务：knowledge/、tasks/、local/、项目代码。
- 项目对角色的补充写 local/roles/<角色>.md，叠加不覆盖。
- 业务经验升格为框架规则，只能由人决定。
- 框架升级 = 替换框架文件，业务目录不动。
- 本仓库自举：页面代码放 app/，改框架文件须人批准。
- 目标形态（未实现）：框架放只读 .oht/，由初始化功能生成。

## 规则
- 一份信息只有一个主人；派生内容重生成，不修补。
- 文档分两层：内存层（AGENTS.md、roles/、knowledge/rules.md、topics/）始终是最终版，直接改写，不留历史，历史交给 git；外存层（knowledge/log/、记忆系统）只追加，旧条目标记 superseded 并链接新条目。
- 剃刀原则：内存层规则一条 ≤40 字，流程步骤一步 ≤30 字，一个流程 ≤7 步（多了拆子流程文件），rules.md 总量 ≤1500 字。硬限制，写不下的细节放外存，内存层只留指针。由 `scripts/check-size.py` 检查。
- 准入：每条规则须能追溯到一次真实错误或人的纠正（出处放外存），并写明适用条件；能写成自动检查的，转成检查后从文档删除。每条须独立可读。
- 角色只改自己负责的字段和节。
- 每个角色做完一步，当场写“为什么”，不只写结果。
- 临时产物用完即删；久留产物住 .oht/ 或产品目录，并定期清理冗余。

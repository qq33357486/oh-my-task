# Spec Delta

## ADDED Requirements

### Requirement: 拷问由人启动，说法不限

> 出处：人类的原话『我的想法，不要用斜杆，而是变成指令。指南里写清楚。』『我有一个想法：XXX，请拷问我。然后就让它去读拷问我with docs 的技能。』『拷问的启动灵活点，别弄成必须说那四个字』；打了 /grill-with-docs 也算、人没要求时 AI 停下等，是人类答复 AI 假设时的原话『其他都ok』

默认工作流 SHALL 写明：人要求拷问时才启动，说法不限，「请拷问我」只是其中一个例子；在认技能的 AI 工具里打了 `/grill-with-docs` 也一样算；人没要求时，AI 读完已有的就停下等，不自己开始追问。

#### Scenario: 换个说法也能启动

- **WHEN** 一个新开的 AI 只拿到项目根 `AGENTS.md` 的路径，人对它说「这个想法帮我拷问一下：我想做某件事。」
- **THEN** 它同样按 grill-with-docs 开始拷问，向人提出第一轮问题

#### Scenario: 人没要求时不动

- **WHEN** 一个新开的 AI 只拿到项目根 `AGENTS.md` 的路径，人只是说了一句需求，没有要求拷问
- **THEN** 它读完已有的就停下等，不自己开始追问

### Requirement: 拷问只按 grill-with-docs 做，必须留痕

> 出处：人类的原话『但启动只允许启动with docs 的，必须留痕。如果可以，干掉不留痕的路径。』；三样痕迹、缺了就打回，是人类当面对答的原话『就这三样 (Recommended)』『立规矩加硬闸 (Recommended)』

默认工作流 SHALL 写明：拷问只按 grill-with-docs 做，不单独用 grilling。拷问 SHALL 留下三样痕迹，缺一不可：

1. 拷问记录写进任务夹的 `proposal.md`：「人的原话，按轮次」，用表格，一行一轮。
2. 术语和长期决策当场写进术语表和决策记录。
3. 每条需求带出处。

独立审查 SHALL 把缺了其中任何一样的任务夹按 AI 错误打回。

#### Scenario: 核对默认工作流的文字

- **WHEN** 在默认工作流里找拷问那一步、独立审查那一步和分流表
- **THEN** 写着只按 grill-with-docs 做、不单独用 grilling，写着三样痕迹；独立审查的审查范围里有这三样痕迹；分流表「AI 错误」那一行里有拷问没留痕

#### Scenario: 没留痕的任务夹过不了审查

- **WHEN** 独立审查发现任务夹的 `proposal.md` 没有「拷问记录」，或者有需求不带出处
- **THEN** 结论是 AI 错误，任务夹被打回，不进执行阶段

### Requirement: 技能文件的路径写明，只留一条路

> 出处：人类的原话『然后就让它去读拷问我with docs 的技能。』『如果可以，干掉不留痕的路径。』；给 grilling 的说明加标记和一句限制，是人类当面对答的原话『立规矩加硬闸 (Recommended)』

`.omt/AGENTS.md` SHALL 写明三份技能文件的完整路径：`.agents/skills/grill-with-docs/SKILL.md`、`.agents/skills/grilling/SKILL.md`、`.agents/skills/domain-modeling/SKILL.md`，并写明直接读文件、不靠斜杠命令、不单独用 grilling。

grilling 的 `SKILL.md` SHALL 做两处改动，别的不动：说明里加一行 `disable-model-invocation: true`；正文第一句写明它只经 grill-with-docs 用、不单独用。grill-with-docs 和 domain-modeling 两份 SHALL 不改。

#### Scenario: 核对任务系统说明的文字

- **WHEN** 在 `.omt/AGENTS.md` 里找「要拷问时」那一条
- **THEN** 写着三份技能文件的完整路径，写着直接读文件、不靠斜杠命令、不单独用 grilling

#### Scenario: 核对 grilling 的说明

- **WHEN** 读 `.agents/skills/grilling/SKILL.md`
- **THEN** 说明里有 `disable-model-invocation: true`，正文第一句写着只经 grill-with-docs 用、不单独用
- **AND** grill-with-docs 和 domain-modeling 两份和改之前逐字一样

#### Scenario: [关键] 没有斜杠命令的 AI 也能开始拷问

> 出处：人类确认这一条带「关键」标签，是答复 AI 假设时的原话『其他都ok』（第 6 条）；对应人的原话『但其他工具不会安装啊。所以/没用啊。』

- **WHEN** 一个新开的 AI 没有 Skill 工具、没有任何技能列表，只拿到项目根 `AGENTS.md` 的路径，人对它说「我想做某件事。请拷问我。」
- **THEN** 它照着文件里写明的路径读到 grill-with-docs、grilling、domain-modeling 三份技能文件，没有靠猜；报告里能指出是哪一份文件的哪一行让它去读的
- **AND** 然后向人提出第一轮问题

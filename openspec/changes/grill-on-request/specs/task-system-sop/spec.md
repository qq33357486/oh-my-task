# Spec Delta

## ADDED Requirements

### Requirement: 拷问由人用一句话启动

> 出处：人类的原话『我的想法，不要用斜杆，而是变成指令。指南里写清楚。』『我有一个想法：XXX，请拷问我。然后就让它去读拷问我with docs 的技能。』『但其他工具不会安装啊。所以/没用啊。』；打了 /grill-with-docs 也算启动、人没说这句时 AI 停下等，是 AI 假设 1

默认工作流 SHALL 写明：人说了「请拷问我」才启动拷问；在认技能的 AI 工具里打了 `/grill-with-docs` 也一样算；人还没说时，AI 读完已有的就停下等。AI 读 `.agents/skills/grill-with-docs/SKILL.md`，照它自带的规矩做，不靠 AI 工具的斜杠命令。

#### Scenario: 核对默认工作流的文字

- **WHEN** 在默认工作流里找拷问那一步
- **THEN** 写着人说了「请拷问我」才启动，写着技能文件的完整路径 `.agents/skills/grill-with-docs/SKILL.md`
- **AND** 找不到「由人启动 grill-with-docs」这种只靠技能的说法

### Requirement: 技能文件的路径写明

> 出处：人类的原话『然后就让它去读拷问我with docs 的技能。』；技能文件本身不改是 AI 假设 2

`.omt/AGENTS.md` SHALL 写明 grill-with-docs 技能文件的完整路径，并写明它会让人再读 grilling 和 domain-modeling、两个都在 `.agents/skills/` 下、直接读文件、不靠斜杠命令。三份技能文件本身 SHALL 不改。

#### Scenario: 核对任务系统说明的文字

- **WHEN** 在 `.omt/AGENTS.md` 里找「要拷问时」那一条
- **THEN** 写着完整的路径和上面那几句
- **AND** 三份技能文件和改之前逐字一样

#### Scenario: 没有斜杠命令的 AI 也能开始拷问

> 出处：人类的原话『但其他工具不会安装啊。所以/没用啊。』；这一条要不要带「关键」标签，等人确认

- **WHEN** 一个新开的 AI 没有 Skill 工具、没有任何技能列表，只拿到项目根 `AGENTS.md` 的路径，人对它说「我想做某件事。请拷问我。」
- **THEN** 它照着文件里写明的路径读到 grill-with-docs、grilling、domain-modeling 三份技能文件，没有靠猜；报告里能指出是哪一份文件的哪一行让它去读的
- **AND** 然后向人提出第一轮问题

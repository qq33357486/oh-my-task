# Spec Delta

## ADDED Requirements

### Requirement: 人要求了就必须拷问，没要求由 AI 判断
> 出处：人类的原话『回到第一版的思路，是否拷问由AI决定，当用户没强制要求拷问的时候。这与拷问的技能描述不冲突，因为它是下层，你是上层决策层。』『拷问的启动灵活点，别弄成必须说那四个字』；打了 /grill-with-docs 也算要求拷问，是人类答复 AI 假设时的原话『其他都ok』

默认工作流 SHALL 写明：人明确要求拷问的，必须拷问，说法不限；在认技能的 AI 工具里打了 `/grill-with-docs` 也一样算。人没有明确要求的，由 AI 自己判断：简单的需求不拷问，直接建任务夹；需要问清楚的，AI 直接开始拷问，不先问人要不要拷问。

#### Scenario: 人明确要求就拷问
- **WHEN** 一个新开的 AI 只拿到项目根 `AGENTS.md` 的路径，人对它说「这个想法帮我拷问一下：我想做某件事。」
- **THEN** 它直接按 grill-with-docs 开始拷问，把第一轮问题写出来

#### Scenario: 简单需求不拷问
- **WHEN** 一个新开的 AI 只拿到项目根 `AGENTS.md` 的路径，人只说了「把登录按钮上的文字从『登陆』改成『登录』」，没有要求拷问
- **THEN** 它判断不用拷问，不提问，直接准备建任务夹，并说明为什么不用拷问

#### Scenario: 需要问清楚的需求，AI 自己开始拷问
- **WHEN** 一个新开的 AI 只拿到项目根 `AGENTS.md` 的路径，人只说了「我想给网站加一个深色模式的开关」，没有要求拷问
- **THEN** 它判断需要问清楚，不先问人要不要拷问，直接按 grill-with-docs 开始拷问，把第一轮问题写出来

#### Scenario: 核对默认工作流的文字（做不做）
- **WHEN** 在默认工作流里找拷问那一步
- **THEN** 写着人明确要求就必须拷问、说法不限；写着没要求时由 AI 判断，简单的不拷问、要问清楚的直接开始
- **AND** 找不到「由人启动 grill-with-docs」

### Requirement: 没拷问的任务
> 出处：人类当面对答的原话『没有关键验收用例 (Recommended)』；打回时直接问人、`.omt/AGENTS.md` 补那半句、「谁写」补一句，是人类答复 AI 假设时的原话『可以』（原 AI 假设 11、12）

没拷问的任务，每条需求仍然要带出处，没有关键验收用例；验收场景和回做次数照建任务夹那一步办。`.omt/AGENTS.md` SHALL 写明：先读已有的、写过的不再问，拷问的任务和没拷问的任务都管；没拷问的任务有歧义时，AI 直接问人那一件。

默认工作流 SHALL 写明：每条需求带出处，没拷问的任务同样带；拷问那一步后半段的要求只管拷问的任务；没拷问的任务被独立审查打回、回到这一步时，AI 直接问人那一件，不再问要不要拷问；没拷问的任务，术语和长期决策在固定新东西时写。

#### Scenario: 核对默认工作流的文字（没拷问的任务）
- **WHEN** 在默认工作流里找拷问那一步、「固定新东西」的「谁写」
- **THEN** 写着不拷问的任务直接建任务夹、没有关键验收用例、每条需求同样带出处；写着后半段只管拷问的任务；写着打回时没拷问的不问要不要拷问、直接问人那一件；「谁写」里有「没拷问的任务在这一步写」

#### Scenario: 核对任务系统说明里的那一句
- **WHEN** 在 `.omt/AGENTS.md` 里找「提需求时有歧义就问人」那一条
- **THEN** 写着先读已有的、写过的不再问；写着没拷问的任务，AI 直接问人那一件

### Requirement: 拷问只按 grill-with-docs 做
> 出处：人类的原话『但启动只允许启动with docs 的，必须留痕。如果可以，干掉不留痕的路径。』『不要用斜杆，而是变成指令』『然后就让它去读拷问我with docs 的技能』；三份技能文件的路径写明，是人类当面对答的原话『三份都写明 (Recommended)』；拷问记录不立规矩，是人类当面对答的原话『不用留，已记的留着 (Recommended)』

默认工作流 SHALL 写明：拷问只按 grill-with-docs 做，不单独用 grilling；三份技能文件直接读文件，不靠斜杠命令。拷问要留痕：每条需求带出处，术语和长期决策当场写。这两样是已有的规矩；其中每条需求带出处管所有的任务，没拷问的也一样。

#### Scenario: 核对「只按 grill-with-docs 做」的文字
- **WHEN** 在默认工作流里找拷问那一步
- **THEN** 写着只按 grill-with-docs 做、不单独用 grilling、直接读文件，写着每条需求带出处、术语和长期决策当场写、没拷问的任务同样带出处
- **AND** 找不到「拷问记录」

### Requirement: 技能文件的路径写明
> 出处：人类当面对答的原话『三份都写明 (Recommended)』；人类的原话『然后就让它去读拷问我with docs 的技能。』

`.omt/AGENTS.md` SHALL 写明三份技能文件的完整路径，并写明直接读文件、不靠斜杠命令、不单独用 grilling。

#### Scenario: 核对任务系统说明的文字
- **WHEN** 在 `.omt/AGENTS.md` 里找「要拷问时」那一条
- **THEN** 写着 `.agents/skills/grill-with-docs/SKILL.md`、`.agents/skills/grilling/SKILL.md`、`.agents/skills/domain-modeling/SKILL.md` 三个路径，写着直接读文件、不靠斜杠命令、不单独用 grilling

### Requirement: grilling 的说明加一道硬闸
> 出处：人类当面对答的原话『立规矩加硬闸 (Recommended)』；人类的原话『如果可以，干掉不留痕的路径。』

grilling 的 `SKILL.md` SHALL 做两处改动，别的不动：说明里加一行 `disable-model-invocation: true`；正文最前面加一句，写明它只经 grill-with-docs 用、不单独用。grill-with-docs 和 domain-modeling 两份 SHALL 不改。

#### Scenario: 核对 grilling 的说明
- **WHEN** 读 `.agents/skills/grilling/SKILL.md`
- **THEN** 说明里有 `disable-model-invocation: true`，正文第一句写着只经 grill-with-docs 用、不单独用，这句后面的原文一字不少
- **AND** grill-with-docs 和 domain-modeling 两份和改之前逐字一样

#### Scenario: 打了 /grill-with-docs 也走得通
- **WHEN** 在认技能的工具里（比如 ZCode），人打了 `/grill-with-docs`
- **THEN** 拷问照常开始：两份技能加载得进来，或者照写明的路径读文件，都算走得通

#### Scenario: [关键] 没有斜杠命令的 AI 也能开始拷问
> 出处：人类确认这一条带「关键」标签，是答复 AI 假设时的原话『其他都ok』（第 6 条）；对应人的原话『但其他工具不会安装啊。所以/没用啊。』；用例的文字在审查后改过两处，改后的说法是人类答复 AI 假设时的原话『可以』（原 AI 假设 15）

- **WHEN** 一个新开的 AI 被明确要求：不用 Skill 工具、不用斜杠命令、不看技能列表，只能读文件，并且要在报告里如实写明自己有没有做到。只给它项目根 `AGENTS.md` 的路径，人对它说「我想做某件事。请拷问我。」
- **THEN** 它照着文件里写明的路径读到 grill-with-docs、grilling、domain-modeling 三份技能文件，没有靠猜；报告里能指出是哪一份文件的哪一行让它去读的，并写明它有没有做到
- **AND** 把第一轮问题写出来交给主会话（新开的 AI 问不了人，写到这一步为止）

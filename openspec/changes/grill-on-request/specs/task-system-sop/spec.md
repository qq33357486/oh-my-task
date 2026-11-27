# Spec Delta

## ADDED Requirements

### Requirement: 拷问做不做由人定

> 出处：人类的原话『拷问的启动灵活点，别弄成必须说那四个字』『询问用户吧，是否需要拷问，因为有的简单需求不需要拷问的。』；打了 /grill-with-docs 也算，是人类答复 AI 假设时的原话『其他都ok』

默认工作流 SHALL 写明：人提了需求，AI 先问一句要不要拷问。人已经要求拷问的，说法不限；在认技能的 AI 工具里打了 `/grill-with-docs` 也一样算，不用再问。人说要，才启动拷问。人说不要，就不拷问，直接建任务夹。

#### Scenario: 人没要求拷问时先问一句

- **WHEN** 一个新开的 AI 只拿到项目根 `AGENTS.md` 的路径，人只是说了一句需求，没有要求拷问
- **THEN** 它问人要不要拷问，不自己开始追问，也不先建任务夹

#### Scenario: 换个说法也能启动

- **WHEN** 一个新开的 AI 只拿到项目根 `AGENTS.md` 的路径，人对它说「这个想法帮我拷问一下：我想做某件事。」
- **THEN** 它不再问，直接按 grill-with-docs 开始拷问，向人提出第一轮问题

#### Scenario: 核对默认工作流的文字（做不做）

- **WHEN** 在默认工作流里找拷问那一步
- **THEN** 写着做不做由人定、人没要求时先问一句、说法不限、人说不要就不拷问
- **AND** 找不到「由人启动 grill-with-docs」

### Requirement: 没拷问的任务

> 出处：人类当面对答的原话『没有关键验收用例 (Recommended)』『询问用户吧，是否需要拷问，因为有的简单需求不需要拷问的。』

没拷问的任务，每条需求仍然要带出处，没有关键验收用例。`.omt/AGENTS.md` SHALL 写明：没拷问的任务有歧义时，AI 直接问人那一件。

默认工作流 SHALL 写明：拷问那一步后半段的要求只管拷问的任务；没拷问的任务被独立审查打回、回到这一步时，AI 直接问人那一件，不再问要不要拷问。

#### Scenario: 核对默认工作流的文字（没拷问的任务）

- **WHEN** 在默认工作流里找拷问那一步
- **THEN** 写着不拷问的任务直接建任务夹、没有关键验收用例；写着后半段只管拷问的任务；写着打回时没拷问的直接问人那一件

#### Scenario: 核对任务系统说明里的那一句

- **WHEN** 在 `.omt/AGENTS.md` 里找「提需求时有歧义就问人」那一条
- **THEN** 写着没拷问的任务，AI 直接问人那一件

### Requirement: 拷问只按 grill-with-docs 做

> 出处：人类的原话『但启动只允许启动with docs 的，必须留痕。如果可以，干掉不留痕的路径。』；拷问记录不立规矩，是人类当面对答的原话『不用留，已记的留着 (Recommended)』

默认工作流 SHALL 写明：拷问只按 grill-with-docs 做，不单独用 grilling，调不了就读文件。拷问要留痕：每条需求带出处，术语和长期决策当场写。这两样是已有的规矩。拷问记录不立规矩。

#### Scenario: 核对「只按 grill-with-docs 做」的文字

- **WHEN** 在默认工作流里找拷问那一步
- **THEN** 写着只按 grill-with-docs 做、不单独用 grilling、调不了就读文件，写着每条需求带出处、术语和长期决策当场写

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

- **WHEN** 在认技能、也认「禁止 AI 自己调用」这个标记的工具里（比如 ZCode），人打了 `/grill-with-docs`
- **THEN** 拷问照常开始：grilling 调不了，AI 就照写明的路径读文件

#### Scenario: [关键] 没有斜杠命令的 AI 也能开始拷问

> 出处：人类确认这一条带「关键」标签，是答复 AI 假设时的原话『其他都ok』（第 6 条）；对应人的原话『但其他工具不会安装啊。所以/没用啊。』

- **WHEN** 一个新开的 AI 被明确要求：不用 Skill 工具、不用斜杠命令、不看技能列表，只能读文件，并且要在报告里如实写明自己有没有做到。只给它项目根 `AGENTS.md` 的路径，人对它说「我想做某件事。请拷问我。」
- **THEN** 它照着文件里写明的路径读到 grill-with-docs、grilling、domain-modeling 三份技能文件，没有靠猜；报告里能指出是哪一份文件的哪一行让它去读的，并写明它没有用 Skill 工具、斜杠命令和技能列表
- **AND** 然后向人提出第一轮问题

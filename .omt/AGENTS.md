# 任务系统说明

本项目用「任务系统」管理从提需求到归档的全过程。本说明只写框架本身怎么用，放进任何项目都一样。和具体项目有关的内容（这个项目是什么、参考资料）放 `.omt/知识库/`，不写进这里。

## 什么时候读什么

- 开始任何工作前：读本说明。
- 人类提了需求：读 `.omt/工作流/默认工作流.md`，一个任务从头到尾都按它走。
- 这类业务具体怎么走：读 `.omt/工作流/` 里对应业务的那一份。
- 要拷问时：只按 grill-with-docs 做。读 `.agents/skills/grill-with-docs/SKILL.md`，照它做；它会让你再加载 grilling 和 domain-modeling：有 Skill 工具就调 Skill 工具加载，没有就直接读文件，路径是 `.agents/skills/grilling/SKILL.md` 和 `.agents/skills/domain-modeling/SKILL.md`。不靠斜杠命令，不单独用 grilling。
- 要建任务、写任务夹、归档时：用 OpenSpec 的技能（`.agents/skills/openspec-*`），任务夹在 `openspec/`。
- 查术语、过往决策、项目资料时：读 `.omt/术语/` 和 `.omt/知识库/`。

人出现在哪、各环节怎么走，见 `默认工作流.md`，本说明不重复。

## 框架文件

以下由 DJTASK 的初始化置入、更新管理，业务项目里只读，不要改：本说明、`.omt/工作流/默认工作流.md`、`.agents/skills/` 下的三个拷问技能（grill-with-docs、grilling、domain-modeling）。以 oh my task 仓库的框架名单为准。要改，向 DJTASK 提需求，由维护者在源头改。

## 目录约定

- `openspec/`：OpenSpec 自己的目录，原样不动，不往里放别的文件。
- `.omt/`：这套系统自己的东西，全部放这里，不放项目根。
  - `AGENTS.md`：本说明。
  - `知识库/`：本项目自己的知识和参考资料。
  - `工作流/`：`默认工作流.md`（任何任务都按它走），加每类业务一份的业务工作流。
  - `术语/GLOSSARY.md`：术语表。词条多了按领域拆，用 `术语/GLOSSARY-MAP.md` 登记。
  - `术语/ADR/`：长期决策记录，一条一个文件。

## OpenSpec 自带规程碰到人的地方

- 「提需求时有歧义就问人」：先读已有的，写过的不再问。拷问时由拷问接管；没拷问的任务，AI 直接问人那一件。
- 「OpenSpec 提示可以开工（Next: apply）」：不等于可以开工，独立审查通过才算。
- 「实施时卡住或超出范围就停下问人」：保留。
- 「归档前请人确认」：保留，相当于验收后的关任务。

# Spec Delta

## MODIFIED Requirements

### Requirement: 框架文件在业务项目里只读

> 出处：人类的原话『给这个项目起个名字，叫多杰任务系统。 DJTASK』＋人类回答『一并改（推荐）』（specs 指产品的旧称一并改）

默认工作流 SHALL 写明：业务项目里不改框架文件；要改就向 DJTASK 提需求，由维护者在源头改。业务项目里的 AI 发现默认工作流本身有问题时，SHALL 不在本项目里记任何东西，只在最终汇报里说明。

#### Scenario: 整理时发现默认工作流缺一步
- **WHEN** 业务项目里的 AI 在整理归纳阶段发现默认工作流本身缺一步
- **THEN** 它不在本项目里写任何文件，只在最终汇报里说这是 DJTASK 的问题

### Requirement: 任务系统说明里点明框架文件

> 出处：人类的原话『给这个项目起个名字，叫多杰任务系统。 DJTASK』＋人类回答『一并改（推荐）』

`.omt/AGENTS.md` SHALL 写明：哪些是框架文件，业务项目里只读，由 DJTASK 的初始化置入、更新管理。并写明：OpenSpec 提示可以开工（Next: apply）不等于可以开工，独立审查通过才算。

#### Scenario: 新会话读入口
- **WHEN** AI 在业务项目里读到 `.omt/AGENTS.md`
- **THEN** 它知道哪些文件不能改，要改该向谁提

#### Scenario: 新会话看到 OpenSpec 的提示
- **WHEN** AI 在业务项目里看到 OpenSpec 提示 Next: apply
- **THEN** 它知道这不算可以开工，先确认独立审查过没过

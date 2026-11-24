# framework-init Specification

## Purpose

把任务系统需要的那套目录与文件置入任意一个业务项目，让这个项目从此能用任务系统。除了在根 `AGENTS.md` 开头放入口块，项目里已有的东西一样不动。

## Requirements

### Requirement: 置入

用户点「初始化此目录」后，系统 SHALL 把框架名单上的每个目录与文件写入选定的业务项目，路径与仓库里相同，内容逐字一致。除此之外只做两件事：在根 `AGENTS.md` 开头放入口块，建两个空目录（见下面两条）。

#### Scenario: 初始化一个空目录
- **WHEN** 用户对一个空目录点「初始化此目录」
- **THEN** 目录里出现 `.omt/AGENTS.md`、`.omt/工作流/默认工作流.md`、`.agents/skills/` 下的三个拷问技能，内容与网页内置的逐字一致
- **AND** 另有根 `AGENTS.md` 的入口块，和空的 `.omt/术语/`、`.omt/知识库/`

### Requirement: 同名文件要报警

初始化 SHALL 不覆盖任何已有的文件，唯一的例外是根 `AGENTS.md`：只在开头插入口块，原内容逐字保留。目标里有和框架名单同名的文件时，不论内容是否相同，系统 SHALL 用醒目的警告列出这些文件并停下，一个文件都不写，让人一定看得到。

#### Scenario: 技能目录里已经有同名文件
- **WHEN** 目标的 `.agents/skills/grill-with-docs/SKILL.md` 已存在
- **THEN** 页面出现醒目的警告，列出这个文件，目标目录里没有任何变化

#### Scenario: 内容相同的同名文件
- **WHEN** 目标里有一个和框架名单同名的文件，内容与内置的一模一样
- **THEN** 同样报警并停下，不当作没冲突

### Requirement: 根 AGENTS.md 的入口

初始化 SHALL 在根 `AGENTS.md` 的开头放一个入口块，内容是这一行：「开始任何工作前，先读 `.omt/AGENTS.md`（任务系统在本项目的说明）。」文件不存在就新建；已存在就在开头插入，原内容逐字保留；已含 `.omt/AGENTS.md` 字样就不动它。已有的文件只在认得出编码时才改：UTF-8 算认得出，带不带 BOM 都行，带 BOM 的 BOM 留在最前面；只有英文的 ANSI 文件本来就是 UTF-8，照常。认不出时初始化 SHALL 停下，一个文件都不写，并提示把它另存成 UTF-8。UTF-16 算认不出，带不带 BOM 都一样；带中文的 ANSI（GBK）也算。

#### Scenario: 没有 AGENTS.md
- **WHEN** 目标没有根 AGENTS.md
- **THEN** 新建一个，内容只有入口块

#### Scenario: 有自己的 AGENTS.md
- **WHEN** 目标已有根 AGENTS.md，里面没有 `.omt/AGENTS.md`
- **THEN** 开头是入口块，原内容逐字跟在后面

#### Scenario: 已经有入口
- **WHEN** 目标根 AGENTS.md 已含 `.omt/AGENTS.md`
- **THEN** 这个文件一个字节都不变

#### Scenario: 根 AGENTS.md 带 BOM
- **WHEN** 目标根 AGENTS.md 是带 BOM 的 UTF-8，里面没有 `.omt/AGENTS.md`
- **THEN** BOM 还在文件最前面，入口块紧跟在后面，原内容逐字跟在后面

#### Scenario: 根 AGENTS.md 不是 UTF-8
- **WHEN** 目标根 AGENTS.md 被存成了 UTF-16（带不带 BOM 都一样），或含中文的 ANSI
- **THEN** 初始化停下，目标目录里没有任何变化，页面提示把它另存成 UTF-8（带不带 BOM 都行）

### Requirement: 已初始化的目录不走初始化

目标已有 `.omt/` 时，初始化 SHALL 被拒绝，不写任何文件，返回「这个目录已经初始化过，用更新」。页面上不提供能对这种目录触发初始化的入口，这条由测试守住。

#### Scenario: 重复初始化
- **WHEN** 初始化在一个已有 `.omt/` 的目录上被触发（测试里直接调用）
- **THEN** 返回这句话，目录没有任何变化

### Requirement: 旧版 DJ Task

目标含 `.oht/` 时，初始化 SHALL 被拒绝，返回「先删除旧版」。系统自己 SHALL 不删除任何文件。页面上对这种目录显示什么，见 project-switching。

#### Scenario: 目录里有 .oht
- **WHEN** 初始化在一个含 `.oht/` 的目录上被触发（测试里直接调用）
- **THEN** 返回这句话，目录没有任何变化

### Requirement: 不碰 OpenSpec

初始化 SHALL 不创建、不修改 `openspec/` 和 OpenSpec 的技能文件。目标没有 `openspec/` 时，系统 SHALL 在完成后提示用户自己去初始化 OpenSpec，并给出命令 `openspec init`。怎么调用由用户自己决定，页面不指定工具和范围。

#### Scenario: 还没装 OpenSpec
- **WHEN** 对一个没有 `openspec/` 的目录完成初始化
- **THEN** 页面提示「还差一步：这个目录还没有 OpenSpec」和「请自己初始化 OpenSpec，在这个目录里运行 `openspec init`」，目录里没有出现 `openspec/`

#### Scenario: 已经装了 OpenSpec
- **WHEN** 目标已有 `openspec/`
- **THEN** 初始化后 `openspec/` 里的每个文件逐字不变

### Requirement: 空的项目文件目录

初始化 SHALL 建好空目录 `.omt/术语/` 和 `.omt/知识库/`。

#### Scenario: 初始化之后
- **WHEN** 初始化完成
- **THEN** `.omt/术语/` 和 `.omt/知识库/` 存在且为空

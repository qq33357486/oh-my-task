/**
 * 初始化模板清单（T0004）。
 *
 * app/src/template/ 下文件 = 本仓库 .oht/ 框架区「原样拷贝」（字节一致），
 * 每份导入处的注释标明来源母本，发版时从本仓库 .oht/ 重新同步。
 * 结构约定（.oht/ 布局）必须与本仓库框架区一致，见 .oht/PROTOCOL.md「框架与业务」。
 *
 * 不属模板的部分：
 * - 业务数据区（tasks/ 的卡、knowledge/log/、local/）由 runInit 生成空壳
 *   （.gitkeep 占位），不在这里拷贝；
 * - 引导卡 .oht/tasks/T0001.md 由 runInit 生成，内容为本模块常量
 *   （母本仓库的 tasks/ 里没有它，它是给被初始化项目的种子卡）。
 */
import AGENTS_MD from './template/AGENTS.md?raw'; // 来源：.oht/AGENTS.md
import PROTOCOL_MD from './template/PROTOCOL.md?raw'; // 来源：.oht/PROTOCOL.md
import ROLE_CHECKER from './template/roles/checker.md?raw'; // 来源：.oht/roles/checker.md
import ROLE_CONSULTANT from './template/roles/consultant.md?raw'; // 来源：.oht/roles/consultant.md
import ROLE_CONSULTANT_BRIEF from './template/roles/consultant-brief.md?raw'; // 来源：.oht/roles/consultant-brief.md
import ROLE_CURATOR from './template/roles/curator.md?raw'; // 来源：.oht/roles/curator.md
import ROLE_DISPATCHER from './template/roles/dispatcher.md?raw'; // 来源：.oht/roles/dispatcher.md
import ROLE_DISPATCHER_INTAKE from './template/roles/dispatcher-intake.md?raw'; // 来源：.oht/roles/dispatcher-intake.md
import ROLE_IMPLEMENTER from './template/roles/implementer.md?raw'; // 来源：.oht/roles/implementer.md
import ROLE_MEMORY from './template/roles/memory.md?raw'; // 来源：.oht/roles/memory.md
import ROLE_MEMORY_TOOLS from './template/roles/memory-tools.md?raw'; // 来源：.oht/roles/memory-tools.md
import ROLE_PATROL from './template/roles/patrol.md?raw'; // 来源：.oht/roles/patrol.md
import ROLE_RECORDER from './template/roles/recorder.md?raw'; // 来源：.oht/roles/recorder.md
import SCRIPT_CHECK_CARD from './template/scripts/check-card.py?raw'; // 来源：.oht/scripts/check-card.py
import SCRIPT_CHECK_SIZE from './template/scripts/check-size.py?raw'; // 来源：.oht/scripts/check-size.py
import TASKS_TEMPLATE from './template/tasks/_template.md?raw'; // 来源：.oht/tasks/_template.md
import KNOWLEDGE_RULES from './template/knowledge/rules.md?raw'; // 来源：.oht/knowledge/rules.md
import TOPICS_TEMPLATE from './template/knowledge/topics/_template.md?raw'; // 来源：.oht/knowledge/topics/_template.md

export interface TemplateFile {
  /** 相对目标目录根的 POSIX 风格路径（如 .oht/AGENTS.md） */
  path: string;
  content: string;
}

/** 框架区模板全套（与母本 .oht/ 框架区一一对应） */
export const TEMPLATE_FILES: TemplateFile[] = [
  { path: '.oht/AGENTS.md', content: AGENTS_MD },
  { path: '.oht/PROTOCOL.md', content: PROTOCOL_MD },
  { path: '.oht/roles/checker.md', content: ROLE_CHECKER },
  { path: '.oht/roles/consultant.md', content: ROLE_CONSULTANT },
  { path: '.oht/roles/consultant-brief.md', content: ROLE_CONSULTANT_BRIEF },
  { path: '.oht/roles/curator.md', content: ROLE_CURATOR },
  { path: '.oht/roles/dispatcher.md', content: ROLE_DISPATCHER },
  { path: '.oht/roles/dispatcher-intake.md', content: ROLE_DISPATCHER_INTAKE },
  { path: '.oht/roles/implementer.md', content: ROLE_IMPLEMENTER },
  { path: '.oht/roles/memory.md', content: ROLE_MEMORY },
  { path: '.oht/roles/memory-tools.md', content: ROLE_MEMORY_TOOLS },
  { path: '.oht/roles/patrol.md', content: ROLE_PATROL },
  { path: '.oht/roles/recorder.md', content: ROLE_RECORDER },
  { path: '.oht/scripts/check-card.py', content: SCRIPT_CHECK_CARD },
  { path: '.oht/scripts/check-size.py', content: SCRIPT_CHECK_SIZE },
  { path: '.oht/tasks/_template.md', content: TASKS_TEMPLATE },
  { path: '.oht/knowledge/rules.md', content: KNOWLEDGE_RULES },
  { path: '.oht/knowledge/topics/_template.md', content: TOPICS_TEMPLATE },
];

/** 业务数据区空壳：.gitkeep 占位，保证空目录可提交可感知 */
export const SHELL_GITKEEP_PATHS: readonly string[] = [
  '.oht/knowledge/log/.gitkeep',
  '.oht/local/.gitkeep',
];

/** 宿主 AGENTS.md 的引用行（新建=整行内容；已存在=末尾追加这一行） */
export const HOST_REFERENCE_LINE =
  '循环工程入口：先读 .oht/AGENTS.md 并按其调度（任务卡在 .oht/tasks/）。';

/**
 * 引导卡（T0004 需求 4）：status=new、type=引导，教使用者三件事。
 * 内容按卡格式写（frontmatter + 九节），保证目标项目跑 check-card.py 可过
 * （T0015 起 frontmatter 须含合规 title）。
 */
export const BOOTSTRAP_CARD: TemplateFile = {
  path: '.oht/tasks/T0001.md',
  content: `---
id: T0001
title: 循环工程引导卡
type: 引导
status: new
round: 0
parent: ""
origin: ""
knowledge: []
system: ""
lane: ""
touches: []
batch: ""
stopped_at: ""
resume_to: ""
stop_reason: ""
question: ""
replied: false
---

## 原话
欢迎使用循环工程。本卡是初始化时自动生成的引导卡：教你发出第一个需求、看懂任务卡流转、开启定时角色。三件事都试过一遍后，把本卡交给 Agent 置 recorded 即可。

## 需求
本卡教使用者三件事，各花一分钟：
1. 发第一个需求：直接对 Agent（ZCode）说人话，不用任何格式。例如"给看板加一个深色模式"。调度员会把这句话变成任务卡。
2. 看懂卡流转：一行生命周期 new→tests→ready→review→done→recorded。只有 need_human 状态需要你：回复写在卡里"人的回复"节。
3. 开定时角色：对 ZCode 说"给巡检员建每 2 小时的定时任务"。定时器由 Agent 侧配置，项目目录里不需要任何配置文件。

## 复述卡
1. 理解：照本卡学会发需求、看流转、开定时角色。
2. 做：发一个需求；看一张卡走完生命周期；开一个定时角色。
3. 例子：对 Agent 说"给看板加深色模式"，稍后 tasks/ 里出现新卡并在看板上流转。
4. 拆分：无。
5. 待你定：无。

## 验收条目

## 系统文档改动

## 进度
- 初始化时由程序生成（T0004 模板）。三件事照做完，让 Agent 把本卡置 recorded。

## 失败原因

## 候选教训

## 人的回复
`,
};

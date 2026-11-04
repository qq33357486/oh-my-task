/**
 * 内置框架副本门面（T0035 生成式重构，手拷退役）。
 *
 * 数据唯一来源：src/template/bundle.gen.ts——由 app/scripts/gen-template.py
 * 从仓库母本（.oht/ + 根 AGENTS.md，清单唯一权威源 = pack.py 的
 * FRAMEWORK_FILES）生成，重跑幂等，禁手改。一致性由
 * lib/__tests__/frameworkBundle.test.ts 锁定（content 逐字一致、sha256
 * 独立 oracle 复核、FRAMEWORK_VERSION 同源、RULES_SKELETON 非业务文件）。
 *
 * 本文件只做派生与既有导出的兼容：
 * - TEMPLATE_FILES 改为派生自 FRAMEWORK_FILES（.oht/ 下 20 项；根
 *   AGENTS.md 不入初始化模板，由 runInit 语义自理：引用行、宿主自管）。
 * - rules.md 属业务文件不入清单；初始化时由 runInit 写 RULES_SKELETON。
 * - 业务数据区（tasks/ 的卡、knowledge/log/、local/）由 runInit 生成空壳
 *   （.gitkeep 占位）；引导卡 .oht/tasks/T0001.md 由 runInit 生成为常量
 *   BOOTSTRAP_CARD（母本 tasks/ 里没有它）。
 */
import {
  FRAMEWORK_FILES,
  FRAMEWORK_VERSION,
  RULES_SKELETON,
  type BundleFile,
} from './template/bundle.gen';

export { FRAMEWORK_FILES, FRAMEWORK_VERSION, RULES_SKELETON };
export type { BundleFile };

export interface TemplateFile {
  /** 相对目标目录根的 POSIX 风格路径（如 .oht/AGENTS.md） */
  path: string;
  content: string;
}

/** 初始化模板清单（派生：FRAMEWORK_FILES 的 .oht/ 子集，20 项） */
export const TEMPLATE_FILES: TemplateFile[] = FRAMEWORK_FILES.filter(
  (file: BundleFile) => file.path.startsWith('.oht/'),
).map((file) => ({ path: file.path, content: file.content }));

/** 业务数据区空壳：.gitkeep 占位，保证空目录可提交可感知 */
export const SHELL_GITKEEP_PATHS: readonly string[] = [
  '.oht/knowledge/log/.gitkeep',
  '.oht/local/.gitkeep',
];

/** 宿主 AGENTS.md 的引用行（新建=整行内容；已存在=末尾追加这一行） */
export const HOST_REFERENCE_LINE =
  '循环工程入口：先读 .oht/AGENTS.md 并按其调度（任务卡在 .oht/tasks/）。';

/**
 * 引导卡（T0004 需求 4）：建卡初态（需求,未执行）、type=引导，教使用者三件事。
 * 内容按卡格式写（frontmatter + 九节），保证目标项目跑 check-card.py 可过
 * （T0015 起 frontmatter 须含合规 title；T0037 起状态为二维 stage×progress）。
 */
export const BOOTSTRAP_CARD: TemplateFile = {
  path: '.oht/tasks/T0001.md',
  content: `---
id: T0001
title: 循环工程引导卡
type: 引导
stage: 需求
progress: 未执行
need_human: false
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
欢迎使用循环工程。本卡是初始化时自动生成的引导卡：教你发出第一个需求、看懂任务卡流转、开启定时角色。三件事都试过一遍后，把本卡交给 Agent 收尾即可。

## 需求
本卡教使用者三件事，各花一分钟：
1. 发第一个需求：直接对 Agent（ZCode）说人话，不用任何格式。例如"给看板加一个深色模式"。调度员会把这句话变成任务卡。
2. 看懂卡流转：每张卡在需求→实现→检查三个阶段流转，每阶段有未执行/执行中/执行完毕三种进度；"执行完毕"的卡由调度员推入下一阶段，检查执行完毕即完成归档。只有需要你拍板的卡（待你定）需要你：回复写在卡里"人的回复"节。
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
- 初始化时由程序生成（T0004 模板）。三件事照做完，让 Agent 把本卡收尾。

## 失败原因

## 候选教训

## 人的回复
`,
};

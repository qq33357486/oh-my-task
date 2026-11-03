/**
 * T0009 集成测试夹具：任务卡取自 .oht/tasks/T0001~T0008 真实卡的精简版
 * （保留 frontmatter 形态与"需求"节的可断言片段；status 按验收条目 A2 的
 * 需要构造：need_human 一张，其余 new/done/recorded/tests 等）。
 * 另含一张残缺卡（无 frontmatter）供 A6 降级显示，与 _template.md
 * （_ 前缀，扫描必须跳过）。
 */
import { memDir, type DirTree } from './mockFs';

/** 最小合法卡：frontmatter 关键字段 + 原话/需求两节（parseCard 契约内）。
 * T0015 起夹具卡带 title（看板主显字段，与真实卡形态一致）。
 * T0016 起支持 question/stopReason（need_human 卡人话决策点，与真实卡
 * need_human 形态一致；默认空串保持既有卡行为不变）。 */
function card(
  id: string,
  status: string,
  title: string,
  type: string,
  whish: string,
  requirement: string,
  question = '',
  stopReason = '',
): string {
  return `---
id: ${id}
title: ${title}
type: ${type}
status: ${status}
round: 0
parent: T0001
origin: split
knowledge: []
system: 网页系统
lane: T0001
touches: [app]
batch: ""
stopped_at: ""
resume_to: ""
stop_reason: ${stopReason}
question: ${question}
replied: false
---

## 原话
${whish}

## 需求
${requirement}

## 进度
- （夹具精简版，进度略）
`;
}

// 精简自 .oht/tasks/T0002.md（迁移单目录形态）
const T0002 = card(
  'T0002',
  'recorded',
  '循环工程收进单目录形态',
  '系统开发',
  '循环工程全部目录收进单一目录，不影响宿主项目根目录',
  '把 oh-my-task 迁移为单目录形态，产物同时作为初始化功能的模板形态。',
);

// 精简自 .oht/tasks/T0004.md（status 按夹具需要构造为 done）
const T0004 = card(
  'T0004',
  'done',
  '一键初始化循环工程',
  '系统开发',
  '把循环工程装进任意目录，一键初始化',
  '初始化目录：runInit 生成 .oht/ 框架全套并附引导卡，目录已含 .oht/ 时拒绝执行不覆盖。',
);

// 精简自 .oht/tasks/T0005.md（status 按夹具需要构造为 new）
const T0005 = card(
  'T0005',
  'new',
  '页面骨架与三态内容',
  '系统开发',
  '网页要有一个像样的页面骨架',
  '页面骨架：页眉（目录名、刷新）+ 三态内容（选目录/未初始化/看板）。',
);

// 精简自 .oht/tasks/T0006.md（status 按夹具需要构造为 tests；A5 轮询变更此卡）
const T0006 = card(
  'T0006',
  'tests',
  '看板轮询跟进任务变化',
  '系统开发',
  '目录里任务卡变了，看板要跟得上',
  '集成锚点：轮询周期内看板应反映任务卡目录的变化。',
);

// 精简自 .oht/tasks/T0008.md（真实 need_human 卡；T0016 起补 question/
// stop_reason——真实 need_human 卡两字段本就非空，夹具随形态对齐）
const T0008 = card(
  'T0008',
  'need_human',
  '后台角色定时器驱动',
  '系统开发',
  '后台角色要有定时器',
  '巡检员与整理员等后台角色由 Agent 侧定时器驱动，项目目录里不放配置文件。',
  '后台定时器放哪：A Agent 侧定时器驱动（推荐）／B 页面内置定时器',
  '定时器落点需人拍板',
);

// _ 前缀模板（真实 .oht/tasks/_template.md 的精简形态；id 若渲染即 T0000）
const TEMPLATE = `---
id: T0000
title: ""
type: 模板
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
（模板卡，_ 前缀文件不得被扫描渲染）
`;

// 残缺卡：无 frontmatter（A6 降级显示）
const BROKEN = '这不是一张任务卡：缺 frontmatter 与九节，扫描时必须降级显示且不崩溃。';

/** 已初始化工程的根目录夹具（A2/A5/A6-残缺/A7-scanTasks 共用） */
export function fixtureRoot(): FileSystemDirectoryHandle {
  return memDir('oh-my-task-fixture', {
    '.oht': {
      'AGENTS.md': '# 循环工程入口\n你是调度员。先读 PROTOCOL.md。\n',
      tasks: {
        '_template.md': TEMPLATE,
        'T0002.md': T0002,
        'T0004.md': T0004,
        'T0005.md': T0005,
        'T0006.md': T0006,
        'T0008.md': T0008,
        'broken.md': BROKEN,
        '.lock': 'lock-file-not-md',
      },
      roles: { 'checker.md': '# 检查员\n' },
    },
    app: { 'App.tsx': '// 产品代码占位\n' },
  });
}

/** 空目录夹具（A3 未初始化分支） */
export function emptyRoot(): FileSystemDirectoryHandle {
  return memDir('fresh-project');
}

/** 已含 .oht/ 与宿主文件的目录夹具（A4 幂等拒绝用） */
export function initializedRoot(writeLog?: string[]): {
  handle: FileSystemDirectoryHandle;
  tree: DirTree;
} {
  const tree: DirTree = {
    '.oht': {
      'AGENTS.md': '# 循环工程入口\n已有框架。\n',
      tasks: {
        'T0001.md': card(
          'T0001',
          'recorded',
          '循环工程引导卡',
          '引导',
          '引导卡',
          '已初始化的既有卡。',
        ),
      },
    },
    'AGENTS.md': '# 宿主项目\n项目自身的说明，一个字都不能动。\n',
    app: { 'index.ts': 'export {};\n' },
  };
  return { handle: memDir('initialized-project', tree, writeLog ? { writeLog } : undefined), tree };
}

/**
 * 入口页和使用说明上的全部文字。页面只从这里取字，不在组件里写死。
 * 这一份和 copy.test.ts 里另抄的期望文字是故意重复的：改一句文案，测试会红，改的人必须两处一起改。
 */

/** 入口页首屏 */
export const hero = {
  /** 方块图标里的字，装饰，不读出来 */
  mark: 'DJ',
  brand: 'DJ Task',
  brandSub: '多杰任务系统',
  titleLead: '只做决策，',
  titleRest: '不碰文档。',
  subtitle: '一套靠文档运转的任务系统：文档全由 AI 写、读、查，你只管决定。',
  cta: '开始享受',
  /** 点了按钮、浏览器不支持时才出现的提示 */
  unsupported: '请用电脑上的 Chrome 或 Edge 打开，才能选择项目文件夹。',
  loop: '五个阶段',
  loopSub: '你只出场两次',
} as const;

export interface StageCopy {
  name: string;
  who: string;
  slogan: string;
  what: string;
  why: string;
}

/** 环上的五个阶段，顺时针：左上、右上、右下、左下、左边中间 */
export const stages: readonly StageCopy[] = [
  {
    name: '需求',
    who: '你出场',
    slogan: '你说一句，AI 问到底。',
    what: '用 grill-with-docs 围着需求拷问，问过的不重复问；你的原话当场记下。',
    why: '需求说不清、AI 自己脑补、同一个问题反复问。',
  },
  {
    name: '文档',
    who: 'AI 出场',
    slogan: '文档 AI 写，也 AI 审。',
    what: '按 OpenSpec 写成规格文档，不由你审：独立子代理拿着拷问的结果独立审查，有错自动改，该问的回到需求接着问。',
    why: '成堆的文档等你审，审到身心疲惫。',
  },
  {
    name: '实现',
    who: 'AI 出场',
    slogan: '做一步，测一步，再由独立子代理查。',
    what: '照文档干活；做完由独立子代理对着你的原话独立验收，不过就打回重做。',
    why: '它说做完了，你不敢信。',
  },
  {
    name: '验收',
    who: '你出场',
    slogan: '你只说一句：通过，或不通过。',
    what: '都查过了才来找你；你最在意的几条结果摆出来，只有你能判断的你亲手过一遍。',
    why: '为了验收去读代码、读报告、逐条核对。',
  },
  {
    name: '整理',
    who: 'AI 出场',
    slogan: '每转一圈，项目多懂你一点。',
    what: '你拍板的决定、说定的叫法、踩过的坑、走通的流程写进项目文件，归档；下次开工先读。',
    why: '经验散在聊天记录里，换个会话又得从头教。',
  },
];

/** 右边说明里两个固定的标签 */
export const facts = {
  what: '发生了什么',
  why: '解决了什么',
} as const;

/** 右边说明最上面那一行：01 · 你出场 */
export const stageKicker = (index: number): string => `0${index + 1} · ${stages[index].who}`;

/** 入口页首屏以下 */
export const below = {
  pain: {
    kicker: '01',
    title: '让 AI 干活，为什么累的还是你',
    items: [
      { no: '一', text: '需求你写，规范你定，它交来一大堆，还得你审。' },
      { no: '二', text: '文档越攒越多，没时间看，又不敢不看。' },
      { no: '三', text: '同一个坑，这次填了，下次它还往里跳。' },
    ],
  },
  split: {
    kicker: '02',
    title: '所以，换了种分工',
    rows: [
      { title: '你说，AI 写。', text: '用一句话说清要什么，AI 追问到底，写成需求和验收标准。它拿不准的先问你。' },
      { title: 'AI 做，子代理查。', text: '干活的和查的不是同一个：独立子代理对着你的原话查，查不过就打回重做。' },
      { title: '你只看结果。', text: '做完了才来找你，你说通过还是不通过。你说过的话都留着，做没做到一查便知。' },
    ],
  },
  believe: {
    kicker: '03',
    title: '我们相信',
    cards: [
      { title: '文档是好事，但不该压在人身上。', text: 'AI 写得起、读得完，人只出决定。' },
      { title: '放心不靠信任，靠对得上。', text: '每条需求都记着你的原话。' },
      { title: '不靠记忆，靠积累。', text: '每做完一个任务，定下来的事实就写进项目：决定、叫法、经验、流程。换会话、换 AI 工具，它们都在。越用越懂你。' },
    ],
  },
  closingTitle: '只做决策，不碰文档。',
  footer: 'DJ Task · 多杰任务系统',
} as const;

/** 使用说明（从页眉点开的那一页） */
export const guide = {
  mark: 'DJ',
  brand: 'DJ Task',
  title: '使用说明',
  back: '回到看板',
  now: {
    kicker: '01',
    title: '现在做什么',
    text: '打开你的 AI 工具，切到这个项目的目录，说一句你要什么，后面加一句「请拷问我」。不用装任何东西，也不用斜杠命令。',
    quoteLabel: '可以直接抄这一句',
    quote: '我想做：＿＿＿＿。请拷问我。',
    note: '拷问做不做由 AI 判断：想被追问就说「请拷问我」，不想就直说。',
  },
  how: {
    kicker: '02',
    title: '它是怎么运转的',
    stages: [
      { name: '需求', who: '你出场', text: '你说一句，AI 问到底。问过的不再问，你的原话就是需求。' },
      { name: '文档', who: 'AI 出场', text: 'AI 按 OpenSpec 写成规格文档，独立子代理拿着拷问的结果审；有错自动改，该问的回到需求。' },
      { name: '实现', who: 'AI 出场', text: 'AI 照文档做，做一步测一步；做完由独立子代理对着原话验收，不过就打回。' },
      { name: '验收', who: '你出场', text: '轮到你：看结果，说一句通过，或不通过。' },
      { name: '整理', who: 'AI 出场', text: '决定、叫法、经验、流程写进项目并归档，下个任务开工先读。' },
    ],
  },
  board: {
    kicker: '03',
    title: '看板怎么看',
    columns: ['需求', '执行', '等你验收', '已归档'],
    /** 四列里亮着的那一列 */
    hot: '等你验收',
    notes: [
      { name: '需求', text: 'AI 在问、在写文档，还没开工。' },
      { name: '执行', text: '开工了。卡上的 3/7 是已完成的待办数。' },
      { name: '等你验收', text: '做完了、查过了。回到会话里，告诉 AI：通过，还是不通过。' },
      { name: '已归档', text: '你验收通过的，默认收起。' },
    ],
    update: '页眉亮起「有更新」：规矩出了新版本，点一下就更新。',
  },
} as const;

/** 零碎的几个按钮名 */
export const ui = {
  /** 入口页出错提示里那个按钮 */
  pick: '选择目录',
} as const;

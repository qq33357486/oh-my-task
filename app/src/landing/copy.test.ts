import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { below, facts, guide, hero, stageKicker, stages, ui } from './copy';
import { pageText, textLeaves } from '../test/pageText';
import LandingPage from './LandingPage';
import UsageGuide from './UsageGuide';

/**
 * 期望的文字，照任务夹 entry-page-and-guide 的 design.md「文案定稿」另抄的一份，不从 copy.ts 读。
 * 任务夹归档以后，这一份就是定稿。改文案必须 copy.ts 和这里一起改。
 */
const EXPECTED = {
  hero: {
    mark: 'DJ',
    brand: 'DJ Task',
    brandSub: '多杰任务系统',
    titleLead: '只做决策，',
    titleRest: '不碰文档。',
    subtitle: '一套靠文档运转的任务系统：文档全由 AI 写、读、查，你只管决定。',
    cta: '开始享受',
    unsupported: '请用电脑上的 Chrome 或 Edge 打开，才能选择项目文件夹。',
    loop: '五个阶段',
    loopSub: '你只出场两次',
  },
  stages: [
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
  ],
  facts: { what: '发生了什么', why: '解决了什么' },
  below: {
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
  },
  guide: {
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
      hot: '等你验收',
      notes: [
        { name: '需求', text: 'AI 在问、在写文档，还没开工。' },
        { name: '执行', text: '开工了。卡上的 3/7 是已完成的待办数。' },
        { name: '等你验收', text: '做完了、查过了。回到会话里，告诉 AI：通过，还是不通过。' },
        { name: '已归档', text: '你验收通过的，默认收起。' },
      ],
      update: '页眉亮起「有更新」：规矩出了新版本，点一下就更新。',
    },
  },
  ui: { pick: '选择目录' },
};

/** 把嵌套对象里的每一句文字摊平成「路径 → 文字」，数组按下标。 */
function flatten(value: unknown, path = '', out: [string, string][] = []): [string, string][] {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((item, i) => flatten(item, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) flatten(item, path ? `${path}.${key}` : key, out);
  return out;
}

const COPY = { hero, stages, facts, below, guide, ui };

/** 页面上不许出现的叫法 */
const FORBIDDEN = ['换一个 AI', '全新的 AI', '/grill-with-docs', '先读根目录的 AGENTS.md', '常见问题'];

describe('文案和定稿一字不差', () => {
  it('copy.ts 里每一条文字都和期望的一样', () => {
    const actual = flatten(COPY);
    const expected = flatten(EXPECTED);
    // 先找出第一处不一样的地方写进报错，改的人一眼看到是哪一句。
    const length = Math.max(actual.length, expected.length);
    for (let i = 0; i < length; i++) {
      const [aPath, aText] = actual[i] ?? ['（没有这一条）', ''];
      const [ePath, eText] = expected[i] ?? ['（没有这一条）', ''];
      if (aPath !== ePath || aText !== eText) {
        expect(actual, `第 ${i + 1} 处不一样：${ePath}，期望「${eText}」，实际「${aText}」（${aPath}）`).toEqual(expected);
      }
    }
    expect(actual).toEqual(expected);
  });

  it.each([...flatten(EXPECTED).map(([path, text]) => [path, text] as [string, string])])('「%s」这一句里没有不该出现的叫法', (_path, text) => {
    for (const word of FORBIDDEN) expect(text, `出现了「${word}」`).not.toContain(word);
  });

  it('右边说明最上面那一行是「0几 · 谁出场」', () => {
    expect(stages.map((_, i) => stageKicker(i))).toEqual(['01 · 你出场', '02 · AI 出场', '03 · AI 出场', '04 · 你出场', '05 · AI 出场']);
  });
});

describe('读页面文字的办法', () => {
  it('一处一项：元素之间分开，文字节点里的空白算一个，aria-hidden 的不算', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<p>只做决策，<em>不碰文档。</em></p><b>  DJ Task </b><small>多杰\n任务系统</small><span aria-hidden="true">DJ</span>';
    expect(pageText(root)).toBe('只做决策， 不碰文档。 DJ Task 多杰 任务系统');
  });
});

/** 入口页上全部文字，按出现的先后，照期望的那一份排出来。图标里的「DJ」是装饰，不算。 */
function landingLeaves(stageIndex: number): string[] {
  const e = EXPECTED;
  const stage = e.stages[stageIndex];
  const closingRest = e.below.closingTitle.endsWith(e.hero.titleRest) ? e.below.closingTitle.slice(-e.hero.titleRest.length) : '';
  const closingLead = closingRest ? e.below.closingTitle.slice(0, -closingRest.length) : e.below.closingTitle;
  return [
    e.hero.brand,
    e.hero.brandSub,
    e.hero.titleLead,
    e.hero.titleRest,
    e.hero.subtitle,
    e.hero.cta,
    e.hero.loop,
    e.hero.loopSub,
    ...e.stages.map((item) => item.name),
    `0${stageIndex + 1} · ${stage.who}`,
    stage.name,
    stage.slogan,
    e.facts.what,
    stage.what,
    e.facts.why,
    stage.why,
    e.below.pain.kicker,
    e.below.pain.title,
    ...e.below.pain.items.flatMap((item) => [item.no, item.text]),
    e.below.split.kicker,
    e.below.split.title,
    ...e.below.split.rows.flatMap((row) => [row.title, row.text]),
    e.below.believe.kicker,
    e.below.believe.title,
    ...e.below.believe.cards.flatMap((card) => [card.title, card.text]),
    closingLead,
    ...(closingRest ? [closingRest] : []),
    e.hero.cta,
    e.below.footer,
  ];
}

// 这一份是 .ts，页面用 createElement 画（不放 JSX）。
function mountLanding(props: Partial<ComponentProps<typeof LandingPage>> = {}) {
  return render(createElement(LandingPage, { onStart: () => {}, onPick: () => {}, ...props }));
}

describe('入口页画出来的文字和定稿一字不差', () => {
  it('没点过：整页的全部文字，多一句、少一句、改一个字都算不过', () => {
    const { container } = mountLanding();
    expect(textLeaves(container)).toEqual(landingLeaves(0));
  });

  it.each([1, 2, 3, 4])('点了第 %i 站以后：只有右边那一块换了', async (index) => {
    const { container } = mountLanding();
    await userEvent.click(screen.getByRole('button', { name: EXPECTED.stages[index].name }));
    expect(textLeaves(container)).toEqual(landingLeaves(index));
  });

  it('页面上找不到不该出现的叫法', () => {
    const { container } = mountLanding();
    const text = pageText(container);
    for (const word of FORBIDDEN) expect(text, `页面上出现了「${word}」`).not.toContain(word);
  });

  it('出错提示和不支持时的那句提示：多出来的只有它们自己', () => {
    const error = { title: '没有拿到这个目录的读写权限', next: '再点一次，并允许访问' };
    const plain = landingLeaves(0);
    const { container } = mountLanding({ error, unsupportedHint: true });
    expect(textLeaves(container)).toEqual([...plain.slice(0, 5), error.title, error.next, EXPECTED.ui.pick, plain[5], EXPECTED.hero.unsupported, ...plain.slice(6)]);
  });
});

/** 使用说明上全部文字，按出现的先后，照期望的那一份排出来。图标里的「DJ」、✕ 和看板小样的四列是装饰，不算。 */
function guideLeaves(): string[] {
  const e = EXPECTED.guide;
  return [
    e.brand,
    e.title,
    e.back,
    e.now.kicker,
    e.now.title,
    e.now.text,
    e.now.quoteLabel,
    e.now.quote,
    e.now.note,
    e.how.kicker,
    e.how.title,
    ...e.how.stages.flatMap((stage) => [stage.name, stage.who, stage.text]),
    e.board.kicker,
    e.board.title,
    ...e.board.notes.flatMap((note) => [note.name, note.text]),
    e.board.update,
  ];
}

describe('使用说明画出来的文字和定稿一字不差', () => {
  it('整页的全部文字，多一句、少一句、改一个字都算不过', () => {
    const { container } = render(createElement(UsageGuide, {}));
    expect(textLeaves(container)).toEqual(guideLeaves());
  });

  it('页面上找不到不该出现的叫法', () => {
    const { container } = render(createElement(UsageGuide, {}));
    const text = pageText(container);
    for (const word of FORBIDDEN) expect(text, `页面上出现了「${word}」`).not.toContain(word);
  });
});

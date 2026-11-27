import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toLf } from './manifest';

// 测试在 app/ 下跑，仓库根是它的上一级。
const repoRoot = join(process.cwd(), '..');
const disk = (path: string) => toLf(readFileSync(join(repoRoot, path), 'utf8'));

const AGENTS = '.omt/AGENTS.md';
const WORKFLOW = '.omt/工作流/默认工作流.md';

/**
 * 期望的文字抄自任务夹 grill-on-request 的 design.md「文字定稿」（2026-11-27）。
 * 故意在这里另抄一份，不从 design.md 读：规则文件改了字、这里没跟着改，测试就红，
 * 改的人必须回任务夹把定稿一起改。
 */
const EXPECTED = {
  agentsGrill:
    '- 要拷问时：只按 grill-with-docs 做。读 `.agents/skills/grill-with-docs/SKILL.md`，照它做；它会让你再加载 grilling 和 domain-modeling：有 Skill 工具就调 Skill 工具加载，没有就直接读文件，路径是 `.agents/skills/grilling/SKILL.md` 和 `.agents/skills/domain-modeling/SKILL.md`。不靠斜杠命令，不单独用 grilling。',
  agentsAsk:
    '- 「提需求时有歧义就问人」：先读已有的，写过的不再问。拷问时由拷问接管；没拷问的任务，AI 直接问人那一件。',
  workflowGrillHead:
    '2. **拷问**（人＋AI，主会话）：人明确要求拷问的（说法不限，比如「请拷问我」；在认技能的工具里打了 `/grill-with-docs` 也算），必须拷问；人明说不要拷问的，不拷问。人没有明确要求的，由 AI 判断，不先问人要不要，也不把拷不拷问交回给人：判断和理由自己写出来，照判断往下做。简单的需求不拷问，直接建任务夹，不转关键验收用例；需要问清楚的，直接开始拷问。只按 grill-with-docs 做（不管是怎么触发的），不单独用 grilling。三份技能文件不靠斜杠命令：先读 `.agents/skills/grill-with-docs/SKILL.md`，照它做；它让你再加载的 grilling 和 domain-modeling 两份，有 Skill 工具就调 Skill 工具加载，没有就直接读文件，路径在 `.omt/AGENTS.md`「要拷问时」那一条里。拷问要留痕：术语和长期决策当场写，每条需求带出处；没拷问的任务，每条需求同样带出处。审查说需人信息、回到这一步时：拷问过的接着拷问，没拷问的不再问要不要拷问，直接问人那一件。下面从「另外」起到这一步结尾的话只管拷问的任务。',
  // 拷问那一步从「另外」起的后半句是原来就有的，这次没动。整句钉住，免得被顺手改掉。
  workflowGrillTail:
    '另外要问出人想要什么：做完之后人看到什么、能做什么；人说的可能不是全貌，没说出来的也问出来，问哪里由 AI 判断。从中挑出最重要的，转成能程序化验收的验收用例，不逐条等比提炼，数量不设上下限。收尾时在对话里每条一行列给人确认，不另成文档；人改了的当场增删、转好再给看，人确认后才往下走。人确认过的才带标签，就是关键验收用例；人没明说确认的不算确认，不带标签；人自己要求加的那条也一样，转好、人看过确认之前不带标签。',
  whoWrites: '**谁写**：AI 写。术语和长期决策在拷问当时写（没拷问的任务在这一步写），其余在这一步写。',
};

/** 整行比对之外再逐句找一遍：哪一句没对上，报错里能直接看到是哪一句。 */
const AGENTS_PHRASES = [
  '.agents/skills/grill-with-docs/SKILL.md',
  '.agents/skills/grilling/SKILL.md',
  '.agents/skills/domain-modeling/SKILL.md',
  '只按 grill-with-docs 做',
  '调 Skill 工具加载',
  '直接读文件',
  '不靠斜杠命令',
  '不单独用 grilling',
  '先读已有的，写过的不再问',
  '拷问时由拷问接管',
  '没拷问的任务，AI 直接问人那一件',
];

const WORKFLOW_PHRASES = [
  '必须拷问',
  '说法不限',
  '/grill-with-docs',
  '人明说不要拷问的，不拷问',
  '由 AI 判断',
  '不先问人要不要',
  '简单的需求不拷问',
  '直接建任务夹',
  '不转关键验收用例',
  '需要问清楚的，直接开始拷问',
  '只按 grill-with-docs 做',
  '不管是怎么触发的',
  '不单独用 grilling',
  '不靠斜杠命令',
  '.agents/skills/grill-with-docs/SKILL.md',
  '有 Skill 工具就调 Skill 工具加载',
  '没有就直接读文件',
  '路径在 `.omt/AGENTS.md`',
  '术语和长期决策当场写',
  '每条需求带出处',
  '同样带出处',
  '审查说需人信息',
  '拷问过的接着拷问',
  '没拷问的不再问要不要拷问',
  '直接问人那一件',
  '只管拷问的任务',
  '没拷问的任务在这一步写',
];

/** 旧做法的说法，不许再出现。「拷问记录」不立规矩，也不写进默认工作流。 */
const WORKFLOW_ABSENT = ['由人启动 grill-with-docs', '拷问记录'];

const lineStarting = (text: string, prefix: string) => text.split('\n').find((line) => line.startsWith(prefix));

describe('拷问怎么启动（规则文档里的文字）', () => {
  it('.omt/AGENTS.md「要拷问时」那一条和定稿逐字相同', () => {
    expect(lineStarting(disk(AGENTS), '- 要拷问时：')).toBe(EXPECTED.agentsGrill);
  });

  it('.omt/AGENTS.md「提需求时有歧义就问人」那一条和定稿逐字相同', () => {
    expect(lineStarting(disk(AGENTS), '- 「提需求时有歧义就问人」：')).toBe(EXPECTED.agentsAsk);
  });

  it('默认工作流拷问那一步，从行首到「另外」之前，和定稿逐字相同', () => {
    const line = lineStarting(disk(WORKFLOW), '2. **拷问**');
    const cut = line?.indexOf(EXPECTED.workflowGrillTail) ?? -1;
    expect(cut, '这一步里找不到「另外要问出人想要什么」').toBeGreaterThan(0);
    expect(line?.slice(0, cut)).toBe(EXPECTED.workflowGrillHead);
    expect(line?.slice(cut)).toBe(EXPECTED.workflowGrillTail);
  });

  it('默认工作流「谁写」那一句和定稿逐字相同', () => {
    expect(lineStarting(disk(WORKFLOW), '**谁写**：')).toBe(EXPECTED.whoWrites);
  });

  it.each(AGENTS_PHRASES)('.omt/AGENTS.md 里有「%s」', (phrase) => {
    expect(disk(AGENTS), `缺的是这一句：${phrase}`).toContain(phrase);
  });

  it.each(WORKFLOW_PHRASES)('默认工作流里有「%s」', (phrase) => {
    expect(disk(WORKFLOW), `缺的是这一句：${phrase}`).toContain(phrase);
  });

  it.each(WORKFLOW_ABSENT)('默认工作流里找不到「%s」', (phrase) => {
    expect(disk(WORKFLOW), `不该再出现：${phrase}`).not.toContain(phrase);
  });
});

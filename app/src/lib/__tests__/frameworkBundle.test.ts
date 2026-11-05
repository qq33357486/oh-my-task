/**
 * T0035/A5 内置框架副本=母本生成（咨询员随卡交付，锁定契约；漂移探测器）。
 *
 * 契约（src/template.ts 新增导出，产物由生成脚本从母本 .oht/ + pack 清单产出）：
 * - FRAMEWORK_FILES: {path, content, sha256}[]，路径集合与
 *   .oht/scripts/pack.py 的 FRAMEWORK_FILES（唯一权威清单）全等；
 * - content 与仓库对应文件逐字一致（path 相对仓库根：'AGENTS.md' 指根文件，
 *   '.oht/…' 指框架区文件）——手拷漂移（旧例：dispatcher-intake 已删未同步、
 *   业务 rules.md 被当模板）在此必红；
 * - sha256 为 content 的十六进制 sha256（.manifest 直写依赖，独立 oracle 复核）；
 * - FRAMEWORK_VERSION === .oht/VERSION；
 * - RULES_SKELETON：装机空骨架（install.py 语义），绝不能是母本业务 rules.md。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_CARD, FRAMEWORK_FILES, FRAMEWORK_VERSION, RULES_SKELETON } from '../../template';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

function readRepo(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, ...rel.split('/')), 'utf8');
}

/** 从 pack.py 源文本提取 FRAMEWORK_FILES 清单（唯一权威源，不另立清单） */
function packManifest(): string[] {
  const src = readRepo('.oht/scripts/pack.py');
  const start = src.indexOf('FRAMEWORK_FILES = [');
  const end = src.indexOf('\n]', start);
  const block = src.slice(start, end);
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('T0039 引导分支、心跳与引导卡改序（语义锚）', () => {
  const file = (rel: string): string =>
    FRAMEWORK_FILES.find((f) => f.path === rel)?.content ?? '';

  it('入口五分法：AGENTS.md 含引导分支与「拿不准」降为第 5', () => {
    const agents = file('.oht/AGENTS.md');
    expect(agents).toContain('咨询员接待五分法');
    expect(agents).toContain('4. 无需求/用法不对：按引导节接待');
    expect(agents).toContain('5. 拿不准：反问一个选择题');
  });

  it('consultant.md 引导节：三分支 + 心跳判活 + 勿扰与命名建议', () => {
    const consultant = file('.oht/roles/consultant.md');
    expect(consultant).toContain('## 引导（五分法第 4 分支）');
    expect(consultant).toContain('读 .oht/local/dispatcher.log 末行');
    expect(consultant).toContain('无心跳或停摆：协助建调度员');
    expect(consultant).toContain('命名建议「调度员【自动】」');
    expect(consultant).toContain('需求另开会话交代，勿扰调度员会话');
  });

  it('dispatcher.md 心跳：收尾一行 + 截尾 50', () => {
    const dispatcher = file('.oht/roles/dispatcher.md');
    expect(dispatcher).toContain('收尾记心跳：.oht/local/dispatcher.log 一行');
    expect(dispatcher).toContain('超 50 行截尾留 50');
  });

  it('引导卡三件事改序：调度员第一，调度令话术在卡，巡检员教程退役', () => {
    const bootstrap = BOOTSTRAP_CARD.content;
    expect(bootstrap).toContain('1. 开启循环（最关键）');
    expect(bootstrap).toContain('调度令：读 .oht/AGENTS.md 并照做');
    expect(bootstrap).toContain('调度员【自动】');
    expect(bootstrap).toContain('2. 发第一个需求');
    expect(bootstrap).toContain('3. 看懂卡流转');
    expect(bootstrap, '巡检员定时教程已过时，不得残留在引导卡').not.toContain('巡检员');
  });

  it('框架版本 0.1.11', () => {
    expect(FRAMEWORK_VERSION).toBe('0.1.11');
  });
});

describe('card.py 结构写入唯一入口（语义锚）', () => {
  const file = (rel: string): string =>
    FRAMEWORK_FILES.find((f) => f.path === rel)?.content ?? '';

  it('card.py 进 bundle：十三子命令与状态机防呆在文', () => {
    const card = file('.oht/scripts/card.py');
    expect(card).toContain('advance  <id>');
    for (const cmd of ['receive', 'progress', 'advance', 'reassign', 'stop', 'resume',
      'log', 'write', 'accept', 'lesson', 'set']) {
      expect(card, `${cmd} 子命令须在`).toContain(cmd);
    }
    expect(card, '转移合法性表是防呆核心').toContain('LEGAL = {');
    expect(card, '原子写防半写态').toContain('os.replace');
    expect(card, '时间戳自动内嵌').toContain('stage_changed_at');
  });

  it('PROTOCOL.md：状态变更走 card.py 与禁手改双条', () => {
    const protocol = file('.oht/PROTOCOL.md');
    expect(protocol).toContain('状态变更一律走 scripts/card.py');
    expect(protocol).toContain('禁手改 frontmatter 状态字段');
    expect(protocol).toContain('stage_changed_at');
  });

  it('_template 与 check-card：字段在模板、校验在看门', () => {
    expect(file('.oht/tasks/_template.md')).toContain('stage_changed_at');
    const check = file('.oht/scripts/check-card.py');
    expect(check).toContain('stage_changed_at 须 ISO 8601');
    expect(check).toContain('晚于今天');
  });

  it('question 结构化（0.1.11）：问句+A=/B= 选项协议与看板点选口径', () => {
    const protocol = file('.oht/PROTOCOL.md');
    expect(protocol).toContain('问句 + A=/B=/C= 选项（看板可点选）');
    expect(file('.oht/roles/consultant.md')).toContain('看板点选直答');
  });

  it('人话位（0.1.10）：模板三字段、card.py 顺写、check-card 40 字闸、四手册义务', () => {
    const tpl = file('.oht/tasks/_template.md');
    for (const k of ['intent', 'status', 'outcome']) {
      expect(tpl, `${k} 人话位在模板`).toContain(`${k}: ""`);
    }
    const card = file('.oht/scripts/card.py');
    expect(card, '--status 顺写入口').toContain('--status');
    expect(card, '人话位字数闸').toContain('HUMAN_MAX = 40');
    const check = file('.oht/scripts/check-card.py');
    expect(check, '校验同口径').toContain('人话位');
    for (const rel of ['.oht/roles/consultant.md', '.oht/roles/implementer.md',
      '.oht/roles/checker.md', '.oht/roles/dispatcher.md']) {
      expect(file(rel), `${rel} 须有顺更义务`).toContain('--status');
    }
  });

  it('四手册各指路 card.py 并禁手改状态', () => {
    for (const rel of ['.oht/roles/dispatcher.md', '.oht/roles/consultant.md',
      '.oht/roles/implementer.md', '.oht/roles/checker.md']) {
      const t = file(rel);
      expect(t, `${rel} 须指路 card.py`).toContain('card.py');
      expect(t, `${rel} 须禁手改状态`).toContain('手改');
    }
    expect(file('.oht/roles/dispatcher.md')).toContain('脚本失败停下报人');
  });
});

describe('T0046 拆卡即定稿与待接待滞留报人（语义锚）', () => {
  const file = (rel: string): string =>
    FRAMEWORK_FILES.find((f) => f.path === rel)?.content ?? '';

  it('A1 consultant.md：子卡材料齐备同会话定稿，缺则等接待', () => {
    const consultant = file('.oht/roles/consultant.md');
    expect(consultant).toContain('子卡定稿材料齐备');
    expect(consultant).toContain('同会话 set 置执行完毕');
    expect(consultant).toContain('置（需求,未执行）等接待');
    expect(
      consultant,
      '旧拆卡句「子卡（需求,未执行）」把已定稿子卡留在无人格，必须整句改写',
    ).not.toContain('子卡（需求,未执行）');
  });

  it('A2 dispatcher.md：待接待滞留 3 轮显式报人', () => {
    const dispatcher = file('.oht/roles/dispatcher.md');
    expect(dispatcher).toContain('连续 3 轮未动');
    expect(dispatcher).toContain('等人接待');
  });

  it('A3 PROTOCOL.md：大需求拆分行与拆卡即定稿同语义', () => {
    const protocol = file('.oht/PROTOCOL.md');
    expect(protocol).toContain('定稿材料齐备');
    expect(protocol).toContain('同会话置（需求,执行完毕）');
  });

  it('A6 check-card.py：预留条目豁免仅限（需求,执行完毕），实现栏不放行', () => {
    const checkCard = file('.oht/scripts/check-card.py');
    expect(checkCard).toContain('reserved = bool(chk_line) and "预留" in chk_line.group(1)');
    expect(checkCard).toContain('stg == "需求" and prg == "执行完毕" and reserved');
  });
});

describe('T0035/A5 内置框架副本与母本一致', () => {
  it('路径集合与 pack.py 权威清单全等', () => {
    const expected = packManifest();
    const got = FRAMEWORK_FILES.map((f) => f.path);
    expect(got.sort()).toEqual(expected.sort());
  });

  it('每个框架文件 content 与仓库母本逐字一致', () => {
    for (const f of FRAMEWORK_FILES) {
      expect(
        f.content,
        `${f.path} 必须与母本逐字一致（生成式拷贝，禁手改）`,
      ).toBe(readRepo(f.path));
    }
  });

  it('每项 sha256 是 content 的十六进制 sha256', () => {
    for (const f of FRAMEWORK_FILES) {
      expect(f.sha256, `${f.path} 的 sha256 与独立 oracle 不符`).toBe(
        sha256(f.content),
      );
    }
  });

  it('FRAMEWORK_VERSION 与 .oht/VERSION 同值', () => {
    expect(FRAMEWORK_VERSION).toBe(readRepo('.oht/VERSION').trim());
  });

  it('清单负锚：无 dispatcher-intake、无业务 rules.md；正锚：scripts 全套与 VERSION 在列', () => {
    const paths = FRAMEWORK_FILES.map((f) => f.path);
    expect(paths, 'dispatcher-intake 已随框架批次删除，不得复活').not.toContain(
      '.oht/roles/dispatcher-intake.md',
    );
    expect(paths, 'rules.md 属业务文件，只能装机生成骨架').not.toContain(
      '.oht/knowledge/rules.md',
    );
    for (const rel of [
      'AGENTS.md',
      '.oht/AGENTS.md',
      '.oht/VERSION',
      '.oht/scripts/card.py',
      '.oht/scripts/install.py',
      '.oht/scripts/lock.py',
      '.oht/scripts/newcard.py',
      '.oht/scripts/pack.py',
    ]) {
      expect(paths, `${rel} 必须在内置清单（升级要写它）`).toContain(rel);
    }
  });

  it('RULES_SKELETON 是装机骨架而非母本业务 rules.md', () => {
    expect(RULES_SKELETON.length, '骨架非空').toBeGreaterThan(0);
    expect(RULES_SKELETON).toContain('常驻规则');
    expect(RULES_SKELETON, '不得把母本业务 rules.md 当模板拷贝').not.toBe(
      readRepo('.oht/knowledge/rules.md'),
    );
  });
});

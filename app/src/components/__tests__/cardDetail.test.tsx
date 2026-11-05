/**
 * 卡片详情组件结构锚（人反馈批 2026-11-06）：点开卡片只显示整理好给人看的。
 * 锚：标签行无裸键值/决策区仅在 need_human/复述卡 lead chip/验收状态 chip/
 * 时间线最新在前+折叠/折叠区默认收起且空节不渲染。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CardDetail } from '../CardDetail';
import { buildCardDetail } from '../../lib/cardDetail';
import type { ParsedCard } from '../../lib/parseCard';
import { parseCard } from '../../lib/parseCard';

const NOW = Date.parse('2026-11-06T12:00:00+08:00');

function mkCard(fm: Record<string, string>, sections: Record<string, string>): ParsedCard {
  const fmText = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  const body = Object.entries(sections).map(([n, c]) => `## ${n}\n${c}`).join('\n\n');
  return parseCard(`---\n${fmText}\n---\n\n${body}\n`);
}

const FM = {
  id: 'T0099', title: '示例卡', type: '界面', stage: '实现', progress: '执行中',
  need_human: 'false', round: '2', parent: 'T0012', origin: 'split',
  'stage_changed_at': '2026-11-06T09:00:00+08:00',
};

function renderDetail(card: ParsedCard) {
  return render(<CardDetail detail={buildCardDetail(card, NOW)} />);
}

afterEach(cleanup);

describe('卡片详情（人反馈批 2026-11-06）', () => {
  it('标签行：状态 chip 化，无 frontmatter 裸键值（lane/batch 等不出現）', () => {
    renderDetail(mkCard(FM, { 复述卡: '1. 我的理解:画布纯化。' }));
    const meta = document.querySelector('[data-detail-meta]')!;
    expect(meta.textContent).toContain('实现');
    expect(meta.textContent).toContain('第2轮');
    expect(meta.textContent).toContain('⏱3:00:00');
    expect(meta.textContent).toContain('拆自 T0012');
    for (const bare of ['lane', 'batch', 'need_human', 'stage:', 'progress:']) {
      expect(document.body.textContent).not.toContain(bare);
    }
  });

  it('决策区：need_human 卡置顶直显 question；普通卡不渲染', () => {
    const { unmount } = renderDetail(mkCard(FM, {}));
    expect(document.querySelector('[data-detail-decision]')).toBeNull();
    unmount();
    renderDetail(mkCard(
      { ...FM, need_human: 'true', question: '选 A 还是 B？', stop_reason: '方向分叉' }, {},
    ));
    const dec = document.querySelector('[data-detail-decision]')!;
    expect(dec.textContent).toContain('选 A 还是 B？');
    expect(dec.textContent).toContain('方向分叉');
  });

  it('复述卡 lead chip 化；人的原话/回复引用块；空节不渲染', () => {
    renderDetail(mkCard(FM, {
      复述卡: '1. 我的理解:画布纯化。\n2. 做:三层。',
      原话: '中间只放画布。',
      人的回复: '答:B 都要改。',
    }));
    const leads = [...document.querySelectorAll('[data-detail-lead]')];
    expect(leads.map((l) => l.textContent)).toEqual(['我的理解', '做']);
    expect(document.querySelector('[data-detail-quote]')!.textContent).toContain('中间只放画布');
    expect(document.querySelector('[data-detail-reply]')!.textContent).toContain('答:B 都要改');
  });

  it('验收条目：状态 chip（绿）+ 查/预期行；全绿显示 ✓', () => {
    renderDetail(mkCard(FM, {
      验收条目:
        '### A1 中间纯画布\n- 类型：auto\n- 查：tests/x.test.tsx\n- 预期：通过\n- 状态：绿  # 人评通过',
    }));
    const a = document.querySelector('[data-detail-accept="A1"]')!;
    expect(a.querySelector('[data-detail-status]')!.textContent).toBe('绿');
    expect(a.textContent).toContain('tests/x.test.tsx');
    expect(a.textContent).toContain('人评通过');
    expect(document.body.textContent).toContain('全绿');
  });

  it('时间线：最新在前、超 6 条折叠为「更早 N 条」点开全显', () => {
    const logs = Array.from({ length: 8 }, (_, i) =>
      `- 2026-11-0${i + 1} 实现员：第${i + 1}天进展。`).join('\n');
    renderDetail(mkCard(FM, { 进度: logs }));
    const items = [...document.querySelectorAll('[data-detail-log]')];
    expect(items).toHaveLength(6); // 直显上限
    expect(items[0].textContent).toContain('第8天'); // 最新在前
    expect(document.querySelector('[data-detail-log-more]')!.textContent).toContain('更早 2 条');
    fireEvent.click(document.querySelector('[data-detail-log-more]')!);
    expect(document.querySelectorAll('[data-detail-log]')).toHaveLength(8);
  });

  it('折叠区：需求默认收起（内容不挂载），空节连标题都不出现', () => {
    renderDetail(mkCard(FM, { 需求: '1. 完整的 AI 契约正文。' }));
    expect(screen.getByText('需求')).toBeTruthy(); // 折叠入口可见
    expect(document.querySelector('[data-detail-collapse="需求"]')).toBeNull(); // 内容未挂载
    expect(screen.queryByText('失败原因')).toBeNull(); // 空节不进折叠区
    expect(screen.queryByText('系统文档改动')).toBeNull();
  });
});

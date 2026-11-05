/**
 * 卡片详情组件结构锚（0.1.10 人话位批）：默认=极简四句+验收徽章行，
 * 其余一切收「查看全部细节」二级。
 * 锚：默认视图无机器流内容/人话位四行/徽章统计/二级切换/决策区常驻。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('卡片详情极简视图（0.1.10 人话位）', () => {
  it('默认视图：标签行+四句+徽章行，机器流内容一概不见', () => {
    renderDetail(mkCard(
      { ...FM, intent: '画布纯化一眼分清类型', status: '实现员铺满画布自检过', outcome: '' },
      {
        复述卡: '1. 我的理解:画布纯化。\n2. 做:三层。',
        验收条目:
          '### A1 画布\n- 类型：auto\n- 查：tests/x.test.tsx\n- 预期：过\n- 状态：绿\n### A2 判定块\n- 类型：auto\n- 查：tests/y.test.tsx\n- 预期：过\n- 状态：红',
        进度: '- 2026-11-06 实现员：铺满画布。',
        需求: '1. 完整的 AI 契约长文……',
      },
    ));
    const brief = document.querySelector('[data-detail-brief]')!;
    expect(brief.textContent).toContain('画布纯化一眼分清类型'); // 做什么
    expect(brief.textContent).toContain('实现员铺满画布自检过'); // 现在
    expect(brief.querySelector('[data-detail-badges]')!.textContent).toContain('1/2');
    // 机器流默认不可见：验收明细标题/查行/时间线/需求全文都不在 brief
    expect(brief.textContent).not.toContain('tests/x.test.tsx');
    expect(brief.textContent).not.toContain('铺满画布。'); // 时间线正文（人话位替代）
    expect(document.querySelector('[data-detail-timeline]')).toBeNull();
    expect(document.querySelector('[data-detail-digest]')).toBeNull();
  });

  it('人话位零回退：status 缺失不显示该行（不拿机器进度冒充人话）', () => {
    renderDetail(mkCard(FM, {
      复述卡: '1. 我的理解:画布中间只放主角。',
      进度: '- 2026-11-06 实现员：铺满画布收尾中。',
    }));
    const brief = document.querySelector('[data-detail-brief]')!;
    expect(brief.textContent).toContain('示例卡'); // intent 兜底 title（人话天生）
    expect(brief.textContent).not.toContain('画布中间只放主角'); // 复述卡原文不上默认视图
    expect(brief.textContent).not.toContain('铺满画布收尾中'); // 机器进度不上卡面
    expect(brief.querySelector('[data-detail-key="现在"]')).toBeNull();
  });

  it('二级切换：点「查看全部细节」出全量（复述卡/验收明细/时间线/折叠区）', () => {
    renderDetail(mkCard(FM, {
      复述卡: '1. 我的理解:画布纯化。',
      验收条目:
        '### A1 画布\n- 类型：auto\n- 查：tests/x.test.tsx\n- 预期：过\n- 状态：绿  # 人评通过',
      进度: '- 2026-11-06 实现员：铺满画布。',
      需求: '1. 完整契约。',
    }));
    expect(document.querySelector('[data-detail-full]')).toBeNull();
    fireEvent.click(document.querySelector('[data-detail-more]')!);
    const full = document.querySelector('[data-detail-full]')!;
    expect(full.querySelector('[data-detail-lead]')!.textContent).toBe('我的理解');
    expect(full.querySelector('[data-detail-accept="A1"]')!.textContent).toContain('tests/x.test.tsx');
    expect(full.querySelector('[data-detail-log]')!.textContent).toContain('铺满画布');
    expect(screen.getByText('需求')).toBeTruthy(); // 折叠入口（默认收起内容不挂载）
    expect(document.querySelector('[data-detail-collapse="需求"]')).toBeNull();
    fireEvent.click(screen.getByText('← 收起，只看摘要'));
    expect(document.querySelector('[data-detail-full]')).toBeNull();
    expect(document.querySelector('[data-detail-brief]')).toBeTruthy();
  });

  it('决策区：问句大字 + A/B/C 可点选项，点选写回并锁定', async () => {
    const replies: Array<[string, string]> = [];
    render(
      <CardDetail
        detail={buildCardDetail(mkCard(
          { ...FM, need_human: 'true',
            question: '画布是否已占满中间区域,主题正常?A=认可(T0013 置绿终态);B=不认可(写明哪里不对);C=部分认可(写明残余问题)。' },
          {},
        ), NOW)}
        onReply={async (id, key, text) => {
          replies.push([id, key]);
          return key !== 'B';
        }}
      />,
    );
    const dec = document.querySelector('[data-detail-decision]')!;
    expect(dec.querySelector('[data-detail-ask]')!.textContent).toContain('画布是否已占满中间区域');
    const opts = [...dec.querySelectorAll('[data-detail-option]')];
    expect(opts.map((o) => o.getAttribute('data-detail-option'))).toEqual(['A', 'B', 'C']);
    fireEvent.click(dec.querySelector('[data-detail-option="B"]')!);
    await waitFor(() => expect(replies).toEqual([['T0099', 'B']]));
    expect(dec.querySelector('[data-detail-answered]')).toBeNull(); // B 写回失败不锁
    fireEvent.click(dec.querySelector('[data-detail-option="A"]')!);
    await waitFor(() => expect(replies).toEqual([['T0099', 'B'], ['T0099', 'A']]));
    expect(dec.querySelector('[data-detail-answered]')!.textContent).toContain('选 A');
    expect(dec.querySelector('[data-detail-option="A"]')).toHaveProperty('disabled', true);
  });

  it('决策区无选项：只显示问句（写回入口隐藏）', () => {
    renderDetail(mkCard(
      { ...FM, need_human: 'true', question: '方向二选一没写选项标记的自述长文' }, {},
    ));
    const dec = document.querySelector('[data-detail-decision]')!;
    expect(dec.querySelector('[data-detail-ask]')!.textContent).toContain('方向二选一');
    expect(dec.querySelector('[data-detail-options]')).toBeNull();
  });
});

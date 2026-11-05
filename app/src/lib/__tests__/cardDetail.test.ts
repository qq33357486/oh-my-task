/**
 * buildCardDetail 单测（人反馈批 2026-11-06）：九节原文 → 结构化详情。
 * 锚：meta 标签派生/decision/复述卡 lead 拆分/验收条目四行+状态备注拆分/
 * 时间线宽容解析（角色可缺、续行并前条、无日期行兜底）与最新在前/
 * 折叠区空节不进。
 */
import { describe, expect, it } from 'vitest';
import { buildCardDetail } from '../cardDetail';
import type { ParsedCard } from '../parseCard';
import { parseCard } from '../parseCard';

const NOW = Date.parse('2026-11-06T12:00:00+08:00');

function cardWith(fm: Record<string, string>, sections: Record<string, string>): ParsedCard {
  const fmText = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  const body = Object.entries(sections)
    .map(([name, content]) => `## ${name}\n${content}`)
    .join('\n\n');
  return parseCard(`---\n${fmText}\n---\n\n${body}\n`);
}

const BASE_FM = {
  id: 'T0099', title: '示例卡', type: '界面', stage: '实现', progress: '执行中',
  need_human: 'false', round: '2', parent: 'T0012', origin: 'split',
  lane: '', batch: '', 'stage_changed_at': '2026-11-06T09:00:00+08:00',
};

describe('buildCardDetail（人反馈批 2026-11-06）', () => {
  it('meta：状态标签全派生、来龙去脉一句人话、时长可算', () => {
    const d = buildCardDetail(cardWith(BASE_FM, {}), NOW);
    expect(d.stage).toBe('实现');
    expect(d.round).toBe(2);
    expect(d.elapsed).toBe('3:00:00');
    expect(d.lineage).toBe('拆自 T0012');
    expect(d.decision).toBeNull();
  });

  it('decision：need_human 卡带 question/stop_reason', () => {
    const d = buildCardDetail(
      cardWith({ ...BASE_FM, need_human: 'true', question: '选 A 还是 B', stop_reason: '方向分叉' }, {}),
      NOW,
    );
    expect(d.decision).toEqual({ question: '选 A 还是 B', stopReason: '方向分叉' });
  });

  it('digest：编号行拆 lead（我的理解:）与正文；无编号整段兜底', () => {
    const d = buildCardDetail(
      cardWith(BASE_FM, { 复述卡: '1. 我的理解:画布纯化。\n2. 做:三层。\n自由文本段。' }),
      NOW,
    );
    expect(d.digest).toEqual([
      { lead: '我的理解', text: '画布纯化。' },
      { lead: '做', text: '三层。' },
      { lead: '', text: '自由文本段。' },
    ]);
  });

  it('acceptances：A 块四行解析，状态行内注释拆为 statusNote', () => {
    const d = buildCardDetail(
      cardWith(BASE_FM, {
        验收条目:
          '### A1 中间纯画布\n- 类型：auto\n- 查：tests/x.test.tsx\n- 预期：断言通过\n- 状态：绿  # 人 11-05 评通过',
      }),
      NOW,
    );
    expect(d.acceptances).toHaveLength(1);
    expect(d.acceptances[0]).toMatchObject({
      id: 'A1', title: '中间纯画布', type: 'auto',
      check: 'tests/x.test.tsx', expect: '断言通过',
      status: '绿', statusNote: '人 11-05 评通过',
    });
  });

  it('timeline：角色可缺、无日期续行并入前条、最新在前', () => {
    const d = buildCardDetail(
      cardWith(BASE_FM, {
        进度:
          '- 2026-11-05 咨询员：定稿与红测试。\n续行归前条。\n- 2026-11-06 实现员：铺满画布。',
      }),
      NOW,
    );
    expect(d.timeline).toEqual([
      { date: '2026-11-06', role: '实现员', text: '铺满画布。' },
      { date: '2026-11-05', role: '咨询员', text: '定稿与红测试。\n续行归前条。' },
    ]);
  });

  it('collapsibles：空节不进；需求默认折叠区在列', () => {
    const d = buildCardDetail(
      cardWith(BASE_FM, { 需求: '1. 完整契约…', 失败原因: '', 候选教训: '' }),
      NOW,
    );
    expect(d.collapsibles.map((s) => s.name)).toEqual(['需求']);
    expect(d.quote).toBe('');
    expect(d.reply).toBe('');
  });
});

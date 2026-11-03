/**
 * T0034/A2 外围四角色渲染级契约（咨询员锁定语义由人直批直改落地，
 * 实现员不得改本测试，只能新增）。
 *
 * 锁定契约（人 2026-11-04 拍板：咨询员形象节点/调度形象+虚线辐射/
 * 巡查空壳面板/整理员独立）：
 * - data-flow-role 恰四个：咨询员、巡查员、整理员、调度，均定位在
 *   环容器内（data-flow-ring）；
 * - 喂需线 data-flow-feed 恰两条：「咨询员→需求」「巡查员→需求」
 *   （需求产源，单向不成环）；咨询员/巡查员是仅有的两条喂需线源；
 * - 调度虚线 data-flow-hub-line 恰 5 条：需求、实现、检查、咨询员、
 *   巡查员（派发关系；dasharray 与实线弧区分——类名 flow-hub-line）；
 * - 巡查面板为空壳：面板元素内无 data-flow-card-id（不渲染卡），
 *   含「巡查」占位文案；
 * - 整理员独立：不出现在 feed/hub-line 任何值中（无连线）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { FlowView } from '../../components/FlowView';
import type { ParsedCard } from '../../lib/parseCard';

function makeCard(overrides: Partial<ParsedCard>): ParsedCard {
  return {
    id: 'T0000',
    title: '',
    type: '系统开发',
    status: 'new',
    round: 0,
    parent: '',
    origin: '',
    lane: '',
    batch: '',
    sections: { 原话: 'T0034 角色夹具卡' },
    ok: true,
    ...overrides,
  };
}

describe('T0034/A2 外围四角色：形象/面板/喂需线/虚线辐射', () => {
  afterEach(() => {
    cleanup();
  });

  it('data-flow-role 恰四个且均在环容器内；巡查面板空壳不渲染卡', () => {
    const { container } = render(
      <FlowView cards={[makeCard({ id: 'T34R', title: '角色夹具卡' })]} />,
    );

    const ring = container.querySelector('[data-flow-ring="true"]');
    expect(ring, '环容器应存在').toBeTruthy();

    const roles = Array.from(container.querySelectorAll('[data-flow-role]'));
    expect(
      roles.map((r) => r.getAttribute('data-flow-role')).sort(),
      '外围角色应恰四个（咨询员/巡查员/整理员/调度）',
    ).toEqual(['咨询员', '巡查员', '整理员', '调度'].sort());
    for (const role of roles) {
      expect(
        ring!.contains(role),
        `角色「${role.getAttribute('data-flow-role')}」应定位在环容器内`,
      ).toBe(true);
    }

    // 巡查面板空壳：无卡、含占位文案
    const patrol = roles.find((r) => r.getAttribute('data-flow-role') === '巡查员')!;
    expect(
      patrol.querySelectorAll('[data-flow-card-id]').length,
      '巡查面板为空壳容器，不得渲染卡（巡查机制未配置）',
    ).toBe(0);
    expect(patrol.textContent, '巡查面板应含「巡查」占位文案').toContain('巡查');
  });

  it('喂需线恰两条指向需求；调度虚线辐射恰 5 条；整理员无连线', () => {
    const { container } = render(
      <FlowView cards={[makeCard({ id: 'T34R', title: '角色夹具卡' })]} />,
    );

    const feeds = Array.from(container.querySelectorAll('[data-flow-feed]'));
    expect(
      feeds.map((f) => f.getAttribute('data-flow-feed')).sort(),
      '喂需线应恰两条：咨询员→需求、巡查员→需求（需求产源不成环）',
    ).toEqual(['咨询员→需求', '巡查员→需求'].sort());

    const hubs = Array.from(container.querySelectorAll('[data-flow-hub-line]'));
    expect(
      hubs.map((h) => h.getAttribute('data-flow-hub-line')).sort(),
      '调度虚线辐射应恰 5 条（三环节+咨询员+巡查）',
    ).toEqual(['实现', '巡查员', '咨询员', '检查', '需求'].sort());
    for (const h of hubs) {
      expect(
        h.classList.contains('flow-hub-line'),
        '虚线辐射应带 flow-hub-line 类（dasharray 与实线弧区分）',
      ).toBe(true);
    }

    // 整理员独立：不出现在任何连线值中
    const allLineValues = [
      ...feeds.map((f) => f.getAttribute('data-flow-feed') ?? ''),
      ...hubs.map((h) => h.getAttribute('data-flow-hub-line') ?? ''),
    ];
    expect(
      allLineValues.some((v) => v.includes('整理员')),
      '整理员独立无连线，不得出现在 feed/hub-line 任何值中',
    ).toBe(false);
  });
});

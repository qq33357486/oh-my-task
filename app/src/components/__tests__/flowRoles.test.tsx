/**
 * 外围四角色渲染级契约（指挥台口径改写；原 T0034/A2 环形角色契约中的
 * 形象/面板/喂需线语义保留，虚线辐射与环容器定位随画布退役）。
 *
 * 契约：
 * - data-flow-role 恰四个：咨询员、调度、巡查员、整理员，均在「团队」区内；
 * - 喂需标记 data-flow-feed 恰两条：「咨询员→需求」「巡查员→需求」
 *   （需求产源，单向；其余角色不带）；
 * - 巡查员为空壳：不渲染卡（无 data-flow-card-id），含「巡查」占位文案；
 * - 角色形象图为压缩 webp（≤ 8KB/张，防回退到 MB 级 PNG）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { statSync } from 'node:fs';
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
    sections: { 原话: '角色夹具卡' },
    ok: true,
    ...overrides,
  };
}

describe('外围四角色：形象/空壳/喂需标记', () => {
  afterEach(cleanup);

  it('data-flow-role 恰四个且均在团队区内；巡查员空壳不渲染卡', () => {
    const { container } = render(
      <FlowView cards={[makeCard({ id: 'T34R', title: '角色夹具卡' })]} />,
    );
    const team = container.querySelector('.flow-team');
    expect(team, '团队区应存在').toBeTruthy();
    const roles = Array.from(container.querySelectorAll('[data-flow-role]'));
    expect(roles.map((r) => r.getAttribute('data-flow-role')).sort()).toEqual(
      ['咨询员', '巡查员', '整理员', '调度'].sort(),
    );
    for (const r of roles) expect(team!.contains(r)).toBe(true);

    const patrol = container.querySelector('[data-flow-role="巡查员"]')!;
    expect(patrol.querySelector('[data-flow-card-id]')).toBeNull();
    expect(patrol.textContent ?? '').toContain('巡查');
  });

  it('喂需标记恰两条指向需求；整理员与调度不带', () => {
    const { container } = render(<FlowView cards={[]} />);
    const feeds = Array.from(container.querySelectorAll('[data-flow-feed]')).map((f) =>
      f.getAttribute('data-flow-feed'),
    );
    expect(feeds.sort()).toEqual(['咨询员→需求', '巡查员→需求'].sort());
    for (const name of ['整理员', '调度']) {
      const el = container.querySelector(`[data-flow-role="${name}"]`)!;
      expect(el.querySelector('[data-flow-feed]')).toBeNull();
    }
  });

  it('角色形象为压缩 webp：四张均存在且 ≤ 8KB', () => {
    const { container } = render(<FlowView cards={[]} />);
    const srcs = Array.from(container.querySelectorAll('.flow-role__img')).map((i) =>
      i.getAttribute('src'),
    );
    expect(srcs.length).toBe(4);
    for (const src of srcs) {
      expect(src, '应为 webp').toMatch(/\.webp$/);
      const size = statSync(`public${src}`).size;
      expect(size, `${src} 体积应 ≤ 8KB（当前 ${size}B）`).toBeLessThanOrEqual(8 * 1024);
    }
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { describe, expect, it } from 'vitest';
import type { ChangeDetail, ChangeInfo } from '../lib/changes';
import { initialState, useStore } from '../store';
import TaskDetail from './TaskDetail';

function info(name: string, progress: ChangeInfo['progress']): ChangeInfo {
  return { name, dirName: name, archived: false, archivedOn: null, progress, lastModified: 0 };
}

function setup(detail: ChangeDetail | null, item: ChangeInfo | null, loading = false) {
  useStore.setState({
    ...initialState,
    selected: item?.dirName ?? null,
    detail,
    detailLoading: loading,
    changes: item && !item.archived ? [item] : [],
  });
  return render(
    <AntApp>
      <TaskDetail />
    </AntApp>,
  );
}

const spec = '### Requirement: 四列看板\n> 出处：人类的原话「其他按建议走。」（第 5 轮）\n\n看板 SHALL 有四列。\n';

describe('卡片详情', () => {
  it('默认只显示每条需求的名字和它的出处行', () => {
    const item = info('加登录', { total: 7, done: 3 });
    setup({ proposal: '# Proposal', design: '# Design', tasks: '- [ ] 1.1', specs: [{ file: 'specs/a/spec.md', text: spec }] }, item);
    expect(screen.getByText('四列看板')).toBeInTheDocument();
    expect(screen.getByText('人类的原话「其他按建议走。」（第 5 轮）')).toBeInTheDocument();
    // 其余文档默认折叠：只看得到标题，看不到正文
    expect(screen.getByText('design.md')).toBeInTheDocument();
    expect(screen.queryByText('# Design')).toBeNull();
  });

  it('拷问记录一节的答复也显示', () => {
    const item = info('加登录', { total: 7, done: 3 });
    const proposal = '# Proposal\n\n## 拷问记录\n\n| 轮 | 问的是 | 人的原话 |\n|---|---|---|\n| 1 | 边界 | 对 |\n';
    setup({ proposal, design: null, tasks: null, specs: [] }, item);
    expect(screen.getByText('对')).toBeInTheDocument();
  });

  it('拷问记录里没有答复', () => {
    const item = info('加登录', { total: 7, done: 3 });
    setup({ proposal: '# Proposal\n\n## 拷问记录\n\n| 轮 | 问的是 | 人的原话 |\n|---|---|---|\n', design: null, tasks: null, specs: [] }, item);
    expect(screen.getByText('拷问记录里还没有答复')).toBeInTheDocument();
  });

  it('一条出处都没有：给一句提示', () => {
    const item = info('加登录', { total: 7, done: 3 });
    setup({ proposal: null, design: null, tasks: null, specs: [{ file: 'specs/a/spec.md', text: '### Requirement: 甲\n看板 SHALL 有四列。\n' }] }, item);
    expect(screen.getByText('这个任务夹还没写出处')).toBeInTheDocument();
  });

  it('在等你验收这一列：提醒回会话里说', () => {
    setup({ proposal: null, design: null, tasks: null, specs: [] }, info('加登录', { total: 7, done: 7 }));
    expect(screen.getByText('去会话里告诉 AI：通过，还是不通过。')).toBeInTheDocument();
  });

  it('不在等你验收这一列：没有提醒', () => {
    setup({ proposal: null, design: null, tasks: null, specs: [] }, info('加登录', { total: 7, done: 3 }));
    expect(screen.queryByText(/去会话里告诉 AI/)).toBeNull();
  });

  it('没有任何能提交验收结果的控件', () => {
    setup({ proposal: null, design: null, tasks: null, specs: [] }, info('加登录', { total: 7, done: 7 }));
    const drawer = screen.getByRole('dialog');
    expect(drawer.querySelectorAll('input, textarea, select')).toHaveLength(0);
    expect([...drawer.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent)).not.toSatisfy((names: string[]) =>
      names.some((n) => /通过|不通过|打回|提交/.test(n ?? '')),
    );
  });

  it('展开折叠的文档，看到的是原文，没有排版渲染', async () => {
    const item = info('加登录', { total: 7, done: 3 });
    setup({ proposal: null, design: '# Design\n\n- [x] 原样', tasks: null, specs: [] }, item);
    await userEvent.setup().click(screen.getByText('design.md'));
    // 逐字比对：原文里的空行和列表符号都原样在，没有被排版渲染。
    const raw = await screen.findByText((_, el) => el?.tagName === 'PRE' && el.textContent === '# Design\n\n- [x] 原样');
    expect(raw).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Design' })).toBeNull();
  });

  it('正在读取', () => {
    setup(null, info('加登录', { total: 7, done: 3 }), true);
    expect(screen.getByText('正在读取这个任务夹…')).toBeInTheDocument();
  });
});

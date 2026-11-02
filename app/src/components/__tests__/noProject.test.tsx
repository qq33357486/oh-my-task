/**
 * T0003/A3 未初始化目录提示（测试已锁定，实现员不得改）。
 * 接口定为独立组件 <NoProject />（无 props），契约见 src/components/NoProject.tsx。
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NoProject } from '../NoProject';

describe('NoProject', () => {
  it('文案包含“未初始化”', () => {
    const { container } = render(<NoProject />);
    expect(container.textContent ?? '', '应渲染提示文案').toContain('未初始化');
  });
});

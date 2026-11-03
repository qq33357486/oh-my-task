import '@testing-library/jest-dom/vitest';

// T0022/A2：声明 React act 测试环境（React 18 的
// "The current testing environment is not configured to support act(...)"
// 警告由该全局开关控制；置 true 后 act() 内外更新按测试语义处理，警告清零）。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// T0022/A2：jsdom 对 window.getComputedStyle 的第二参数（伪元素）抛
// "Not implemented: window.getComputedStyle(elt, pseudoElt)"（AntD 会传
// 伪元素探测样式）。包一层丢弃 pseudoElt，只按元素本身取计算样式——
// 仅测试环境行为，不影响产物代码，不改任何测试断言。
const origGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((elt: Element) => origGetComputedStyle(elt)) as typeof window.getComputedStyle;

/**
 * 读页面上给人看的文字，给「文案一字不差」的测试用。
 *
 * 一处一处地取：每个文字节点算一处，连续的空白算一个空格。元素之间的边界保留成两处，
 * 这样「多了」「少了」「改了」都能对到是哪一处。标了 aria-hidden 的装饰（图标里的字、✕）不算。
 */
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/** 页面上全部文字，一处一项，按出现的先后。 */
export function textLeaves(root: Node): string[] {
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 1 && (node as Element).getAttribute('aria-hidden') === 'true') return;
    if (node.nodeType === 3) {
      const text = collapse(node.nodeValue ?? '');
      if (text) out.push(text);
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(root);
  return out;
}

/** 页面上全部文字连成一句，中间一个空格。 */
export function pageText(root: Node): string {
  return textLeaves(root).join(' ');
}

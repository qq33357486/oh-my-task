/**
 * 轻量 markdown 渲染（T0003）：只做标题 / 列表 / 代码块 / 行内代码与加粗。
 * 自写而不引 marked：任务卡正文格式固定，够用且零依赖。
 */
import type { ReactNode } from 'react';

/** 行内：`code`、**bold** */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-c${i}`}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(2, -2)}</strong>);
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.trimStart().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结尾 ```
      blocks.push(
        <pre key={`k${key++}`}>
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2], `k${key}`);
      if (level === 1) blocks.push(<h2 key={`k${key++}`}>{content}</h2>);
      else if (level === 2) blocks.push(<h3 key={`k${key++}`}>{content}</h3>);
      else blocks.push(<h4 key={`k${key++}`}>{content}</h4>);
      i++;
      continue;
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`k${key++}`}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item, `k${key}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.、)]\s*/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.、)]\s*/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.、)]\s*/, ''));
        i++;
      }
      blocks.push(
        <ol key={`k${key++}`}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item, `k${key}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // 空行
    if (!line.trim()) {
      i++;
      continue;
    }

    // 普通段落（连续非空非特殊行合为一段）
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.、)]\s*/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('```') &&
      !/^#{1,4}\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={`k${key++}`}>{renderInline(para.join(' '), `k${key}`)}</p>);
  }

  return <div className="md-text">{blocks}</div>;
}

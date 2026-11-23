/** 从任务夹的文件里找出「人说过的话」：每条需求的出处行，和拷问记录那一节。 */

export interface RequirementSource {
  requirement: string;
  /** 出处行的内容，去掉「出处：」；需求下面没有这一行时为 null */
  source: string | null;
  file: string;
}

/**
 * 每条需求的标题下紧随着的第一行，去掉引用符以后以「出处：」开头的，才算出处行。
 */
export function parseProvenance(markdown: string, file = ''): RequirementSource[] {
  const lines = markdown.split('\n');
  const out: RequirementSource[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^### Requirement:\s*(.+?)\s*$/.exec(lines[i]);
    if (!match) continue;
    const next = (lines[i + 1] ?? '').replace(/^>\s?/, '').trim();
    out.push({ requirement: match[1], source: next.startsWith('出处：') ? next.slice('出处：'.length).trim() : null, file });
  }
  return out;
}

/**
 * proposal.md 里「## 拷问记录」到下一个二级标题之间的表格行，每行拆成几格。
 * 没有这一节返回 null。
 */
export function parseGrillingRecord(proposalMarkdown: string): string[][] | null {
  const lines = proposalMarkdown.split('\n');
  const start = lines.findIndex((line) => /^## 拷问记录\s*$/.test(line));
  if (start < 0) return null;
  const rows: string[][] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^## /.test(line)) break;
    if (!line.startsWith('|')) continue;
    const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

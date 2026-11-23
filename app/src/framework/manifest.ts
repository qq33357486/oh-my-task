// 框架名单：初始化置入、更新覆盖的文件就是这些，路径和仓库里一样。
// 内容用 ?raw 从仓库里的原文件直接读入，没有生成脚本，也没有第二份副本（做法同 DJUI）。
import omtAgents from '../../../.omt/AGENTS.md?raw';
import omtWorkflow from '../../../.omt/工作流/默认工作流.md?raw';
import grillWithDocs from '../../../.agents/skills/grill-with-docs/SKILL.md?raw';
import grillWithDocsOpenai from '../../../.agents/skills/grill-with-docs/agents/openai.yaml?raw';
import grilling from '../../../.agents/skills/grilling/SKILL.md?raw';
import grillingOpenai from '../../../.agents/skills/grilling/agents/openai.yaml?raw';
import domainModeling from '../../../.agents/skills/domain-modeling/SKILL.md?raw';
import domainModelingGlossary from '../../../.agents/skills/domain-modeling/GLOSSARY-FORMAT.md?raw';
import domainModelingAdr from '../../../.agents/skills/domain-modeling/ADR-FORMAT.md?raw';
import domainModelingOpenai from '../../../.agents/skills/domain-modeling/agents/openai.yaml?raw';

/** 换行统一成 LF，不随构建机器变。 */
export function toLf(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export interface FrameworkFile {
  /** 仓库里的路径，也是它在业务项目里的路径 */
  path: string;
  content: string;
}

const file = (path: string, content: string): FrameworkFile => ({ path, content: toLf(content) });

export const FRAMEWORK_FILES: readonly FrameworkFile[] = [
  file('.omt/AGENTS.md', omtAgents),
  file('.omt/工作流/默认工作流.md', omtWorkflow),
  file('.agents/skills/grill-with-docs/SKILL.md', grillWithDocs),
  file('.agents/skills/grill-with-docs/agents/openai.yaml', grillWithDocsOpenai),
  file('.agents/skills/grilling/SKILL.md', grilling),
  file('.agents/skills/grilling/agents/openai.yaml', grillingOpenai),
  file('.agents/skills/domain-modeling/SKILL.md', domainModeling),
  file('.agents/skills/domain-modeling/GLOSSARY-FORMAT.md', domainModelingGlossary),
  file('.agents/skills/domain-modeling/ADR-FORMAT.md', domainModelingAdr),
  file('.agents/skills/domain-modeling/agents/openai.yaml', domainModelingOpenai),
];

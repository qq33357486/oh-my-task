/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0003/A1 立；T0037 改写：
 * 一维 status 字段退役，改二维 stage×progress + need_human 布尔旁路，
 * 改前 sha256 见 git 历史 0c72eaa 版 parseCard.ts）。
 *
 * parseCard(text: string): ParsedCard
 *
 * 契约：
 * - 输入为一张任务卡的完整文本（frontmatter + 正文九节）。
 * - frontmatter 关键字段：id、type、stage、progress、need_human、round、
 *   parent、origin、lane、batch、
 *   title（T0015 新增：人话单行标题，看板主显用；旧卡缺该字段时为 ''）、
 *   question 与 stop_reason（T0016 新增：need_human 卡的人话决策问题与
 *   终止原因，看板卡面直显用；frontmatter 缺该字段时为 undefined，
 *   与既有必填字段的 '' 缺省不同——本两类字段按需可选）。
 *   round 解析为 number；need_human 解析为 boolean（缺省 false，值须
 *   true/false 否则 false）；其余为 string。
 * - sections：键 = 正文九节标题（不含 "## "）：
 *   原话、需求、复述卡、验收条目、系统文档改动、进度、失败原因、候选教训、人的回复；
 *   值 = 该节标题行之后到下一节标题之前的原文（含换行，不去空白）。
 * - 完整卡：ok=true，error 为 undefined。
 * - 残缺卡（无 frontmatter、缺 id 等）：不抛异常，返回安全默认值
 *   （string 字段 ''、round 0、sections {}），ok=false，error 为非空字符串。
 */
export interface ParsedCard {
  id: string;
  /** 人话单行标题（T0015：看板卡面主显；旧卡缺失时为 ''） */
  title: string;
  type: string;
  /** 阶段：需求 | 实现 | 检查（T0037 二维状态机） */
  stage: string;
  /** 阶段内进度：未执行 | 执行中 | 执行完毕 */
  progress: string;
  /** 旁路暂停态：true 时卡在收件箱，stage/progress 冻结 */
  needHuman: boolean;
  round: number;
  parent: string;
  origin: string;
  lane: string;
  batch: string;
  /** need_human 卡的人话决策问题（T0016：frontmatter question；缺失时 undefined） */
  question?: string;
  /** need_human 卡的终止原因（T0016：frontmatter stop_reason；缺失时 undefined） */
  stop_reason?: string;
  /** 九节标题 → 内容，键不含 "## " 前缀 */
  sections: Record<string, string>;
  ok: boolean;
  error?: string;
}

/** 残缺卡的安全默认值（契约：不抛异常、ok=false、error 非空） */
function failedCard(error: string): ParsedCard {
  return {
    id: '',
    title: '',
    type: '',
    stage: '',
    progress: '',
    needHuman: false,
    round: 0,
    parent: '',
    origin: '',
    lane: '',
    batch: '',
    sections: {},
    ok: false,
    error,
  };
}

/** 去掉值两侧的引号（模板里 parent: "" 这类写法） */
function unquote(raw: string): string {
  const v = raw.trim();
  // 带行内注释的引号值：title: "xxx"   # 必填：…  → 只取引号内文本
  const commented = /^(["'])(.*)\1\s+#.*$/.exec(v);
  if (commented) return commented[2];
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1);
    }
  }
  // T0045：非引号值剥行内注释，语义对齐 check-card.py:49 的
  // v.split("#")[0].strip()——值中空白 + # 起的尾注剥掉；带引号值已在
  // 上方分支取出引号内文本，值内 # 不误伤。否则照抄模板注释的卡
  // （stage: 实现  # …）读成 40 字长串，mapToNode 未知降级收件箱。
  const commentAt = v.search(/\s#/);
  if (commentAt >= 0) return v.slice(0, commentAt).trim();
  return v;
}

/**
 * 手写 frontmatter 解析（不引 yaml 依赖）。
 * 本项目 frontmatter 只有简单 key: value 与 [a, b] 数组；
 * 数组与未知键原样保留字符串，调用方按需取字段。
 */
function parseFrontmatter(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = unquote(line.slice(idx + 1));
    result[key] = value;
  }
  return result;
}

/**
 * 按 "## <节名>" 切分正文为九节。
 * 只匹配恰好两级标题（"### 子节" 第三字符是 #，不匹配 ^##\s），
 * 因此验收条目内的 ### A1 等子节留在所属节内。
 */
function splitSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = body.split(/\r?\n/);
  let current: string | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (current !== null) sections[current] = buf.join('\n');
    buf.length = 0;
  };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      current = m[1];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

export function parseCard(text: string): ParsedCard {
  try {
    if (typeof text !== 'string' || text.length === 0) {
      return failedCard('输入为空或不是字符串');
    }
    const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!fmMatch) {
      return failedCard('缺少 frontmatter（未找到开头的 --- 块）');
    }
    const fm = parseFrontmatter(fmMatch[1]);
    if (!fm.id) {
      return failedCard('frontmatter 缺少 id 字段');
    }
    const roundNum = Number(unquote(fm.round ?? '0'));
    const sections = splitSections(text.slice(fmMatch[0].length));
    return {
      id: fm.id,
      title: fm.title ?? '',
      type: fm.type ?? '',
      stage: fm.stage ?? '',
      progress: fm.progress ?? '',
      needHuman: (fm.need_human ?? '').trim().toLowerCase() === 'true',
      round: Number.isFinite(roundNum) ? roundNum : 0,
      parent: fm.parent ?? '',
      origin: fm.origin ?? '',
      lane: fm.lane ?? '',
      batch: fm.batch ?? '',
      // T0016：仅在 frontmatter 有该字段时承载（缺失保持 undefined）；
      // 字段存在但为空串（如模板 question: ""）时如实传 ''，由渲染层判空。
      question: fm.question,
      stop_reason: fm.stop_reason,
      sections,
      ok: true,
    };
  } catch (e) {
    return failedCard(`解析异常: ${e instanceof Error ? e.message : String(e)}`);
  }
}

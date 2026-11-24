/**
 * 根 AGENTS.md 是唯一会被 DJTASK 改写的已有文件，又不备份。
 * 所以按字节读它：认得出 UTF-8（带不带 BOM 都行）才动，认不出就停下，不写坏它。
 */

export class AgentsMdEncodingError extends Error {
  constructor() {
    super('根 AGENTS.md 不是 UTF-8 编码');
    this.name = 'AgentsMdEncodingError';
  }
}

export interface DecodedAgentsMd {
  /** 去掉 BOM 以后的正文 */
  text: string;
  /** 文件开头有 UTF-8 的 BOM。写回时要原样放回去。 */
  bom: boolean;
}

export function decodeAgentsMd(bytes: Uint8Array): DecodedAgentsMd {
  // UTF-8 的 BOM：记下来，写回时放回去。
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  let text: string;
  try {
    // 严格解码：有一个字节不合 UTF-8 就抛错，不悄悄换成乱码。
    // 带 BOM 的 UTF-16 头两个字节就不合，在这里被拦下。
    text = new TextDecoder('utf-8', { fatal: true }).decode(bom ? bytes.subarray(3) : bytes);
  } catch {
    throw new AgentsMdEncodingError();
  }
  // 不带 BOM 的 UTF-16 漏得过严格解码：西文后面跟一个零字节，凑巧是合法的 UTF-8。
  // 文本文件里不该有零字节，有就不是 UTF-8。
  if (text.includes('\u0000')) throw new AgentsMdEncodingError();
  return { text, bom };
}

/**
 * 根 AGENTS.md 是唯一会被 oh my task 改写的已有文件，又不备份。
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
  // UTF-16 的 BOM：认不出，停下。
  if (
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
  ) {
    throw new AgentsMdEncodingError();
  }
  // UTF-8 的 BOM：记下来，写回时放回去。
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = bom ? bytes.subarray(3) : bytes;
  try {
    // 严格解码：有一个字节不合 UTF-8 就抛错，不悄悄换成乱码。
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(body), bom };
  } catch {
    throw new AgentsMdEncodingError();
  }
}

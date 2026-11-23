/**
 * 造文件在磁盘上的真实字节，给「根 AGENTS.md 的编码」那组测试用。
 * 平时假目录里的文件都是字符串（按 UTF-8 存）；要试记事本存出来的别的编码，得自己给字节。
 */

const encoder = new TextEncoder();

/** 按 UTF-8 解码，开头的 BOM 留在结果里（默认会悄悄去掉）。用来检查写回去的文件 BOM 还在不在。 */
export function decodeKeepingBom(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
}

/** UTF-8 的字节。withBom 为真时开头带 BOM，就是记事本「UTF-8 (带 BOM)」存出来的样子。 */
export function utf8(text: string, withBom = false): Uint8Array {
  const body = encoder.encode(text);
  return withBom ? new Uint8Array([0xef, 0xbb, 0xbf, ...body]) : body;
}

/** UTF-16 的字节。withBom 为真时开头带 BOM，就是记事本的「UTF-16 LE」「UTF-16 BE」存出来的样子。 */
export function utf16(text: string, order: 'le' | 'be' = 'le', withBom = true): Uint8Array {
  const body = [...text].flatMap((ch) => {
    const code = ch.charCodeAt(0);
    return order === 'le' ? [code & 0xff, code >> 8] : [code >> 8, code & 0xff];
  });
  if (!withBom) return new Uint8Array(body);
  return new Uint8Array(order === 'le' ? [0xff, 0xfe, ...body] : [0xfe, 0xff, ...body]);
}

/** 「# 我的规则」的 GBK 编码：中文 Windows 上不少编辑器默认存成这个。不是合法的 UTF-8。 */
export const GBK_RULES = new Uint8Array([0x23, 0x20, 0xce, 0xd2, 0xb5, 0xc4, 0xb9, 0xe6, 0xd4, 0xf2]);

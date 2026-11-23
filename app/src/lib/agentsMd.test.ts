import { describe, expect, it } from 'vitest';
import { GBK_RULES, utf16, utf8 } from '../test/encodings';
import { AgentsMdEncodingError, decodeAgentsMd } from './agentsMd';

describe('decodeAgentsMd', () => {
  it('普通的 UTF-8：认得出，没有 BOM', () => {
    expect(decodeAgentsMd(utf8('# 我的规则'))).toEqual({ text: '# 我的规则', bom: false });
  });

  it('只有英文的文件（也就是别人说的纯 ASCII 的 ANSI）：它本来就是合法的 UTF-8，照常', () => {
    expect(decodeAgentsMd(utf8('# My rules'))).toEqual({ text: '# My rules', bom: false });
  });

  it('空文件：认得出，正文是空的', () => {
    expect(decodeAgentsMd(new Uint8Array())).toEqual({ text: '', bom: false });
  });

  it('UTF-8 带 BOM：认得出，BOM 单独交出来，不在正文里', () => {
    expect(decodeAgentsMd(utf8('# 我的规则', true))).toEqual({ text: '# 我的规则', bom: true });
  });

  // 不带 BOM 的 UTF-16 LE 漏得过严格解码：西文后面跟一个零字节，凑巧是合法的 UTF-8；
  // 中文也一样：「规」在 UTF-16 LE 里是 c4 89，恰好是 UTF-8 的一个双字节字符。
  const sneaky: Array<[string, Uint8Array]> = [
    ['不带 BOM 的 UTF-16 LE，纯英文', utf16('# My rules', 'le', false)],
    ['不带 BOM 的 UTF-16 LE，带中文', utf16('# 规则', 'le', false)],
  ];
  it.each(sneaky)('%s：字节本身是合法的 UTF-8，照样认不出', (_label, bytes) => {
    // 先证明这不是靠解码失败拦下的
    expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toContain('\u0000');
    expect(() => decodeAgentsMd(bytes)).toThrow(AgentsMdEncodingError);
  });

  it.each([
    ['UTF-16 LE', utf16('# 我的规则', 'le')],
    ['UTF-16 BE', utf16('# 我的规则', 'be')],
    // BE 的头一个字节就落在中文区（0x89），不是合法的 UTF-8，解码这一步就拦下
    ['不带 BOM 的 UTF-16 BE，带中文', utf16('# 规则', 'be', false)],
    ['GBK', GBK_RULES],
  ])('%s：认不出，抛错，不悄悄解成乱码', (_label, bytes) => {
    expect(() => decodeAgentsMd(bytes)).toThrow(AgentsMdEncodingError);
  });

  it('正文里有不合法的字节：一样认不出', () => {
    expect(() => decodeAgentsMd(new Uint8Array([0x23, 0x20, 0xff]))).toThrow(AgentsMdEncodingError);
  });

  it('正文里有零字节：认不出，哪怕其余都合法', () => {
    expect(() => decodeAgentsMd(new Uint8Array([0x23, 0x00, 0x20, 0x00]))).toThrow(AgentsMdEncodingError);
  });

  it('认不出时没有动原来的字节', () => {
    const bytes = utf16('# 我的规则');
    const copy = new Uint8Array(bytes);
    expect(() => decodeAgentsMd(bytes)).toThrow();
    expect(bytes).toEqual(copy);
  });
});

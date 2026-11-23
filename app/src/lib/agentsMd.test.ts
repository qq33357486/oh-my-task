import { describe, expect, it } from 'vitest';
import { GBK_RULES, utf16, utf8 } from '../test/encodings';
import { AgentsMdEncodingError, decodeAgentsMd } from './agentsMd';

describe('decodeAgentsMd', () => {
  it('普通的 UTF-8：认得出，没有 BOM', () => {
    expect(decodeAgentsMd(utf8('# 我的规则'))).toEqual({ text: '# 我的规则', bom: false });
  });

  it('空文件：认得出，正文是空的', () => {
    expect(decodeAgentsMd(new Uint8Array())).toEqual({ text: '', bom: false });
  });

  it('UTF-8 带 BOM：认得出，BOM 单独交出来，不在正文里', () => {
    expect(decodeAgentsMd(utf8('# 我的规则', true))).toEqual({ text: '# 我的规则', bom: true });
  });

  it.each([
    ['UTF-16 LE', utf16('# 我的规则', 'le')],
    ['UTF-16 BE', utf16('# 我的规则', 'be')],
    ['GBK', GBK_RULES],
  ])('%s：认不出，抛错，不悄悄解成乱码', (_label, bytes) => {
    expect(() => decodeAgentsMd(bytes)).toThrow(AgentsMdEncodingError);
  });

  it('正文里有不合法的字节：一样认不出', () => {
    expect(() => decodeAgentsMd(new Uint8Array([0x23, 0x20, 0xff]))).toThrow(AgentsMdEncodingError);
  });

  it('认不出时没有动原来的字节', () => {
    const bytes = utf16('# 我的规则');
    const copy = new Uint8Array(bytes);
    expect(() => decodeAgentsMd(bytes)).toThrow();
    expect(bytes).toEqual(copy);
  });
});

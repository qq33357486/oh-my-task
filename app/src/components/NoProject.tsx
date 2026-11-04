/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0003/A3）。
 *
 * <NoProject />
 * 无 props。渲染的文本内容必须包含“未初始化”
 * （完整文案自定，如“该目录未初始化循环工程”）。
 *
 * T0009 可动作化：未初始化分支的三个动作都在本组件内——
 * 「初始化此目录」直接写已选中的根句柄（runInitOnDirectory，
 * 不再弹 picker），成功后重扫转看板；「取消」清除瞬态提示、
 * 停留在本提示页。
 */
import { useState } from 'react';
import { Alert, Button, Result, Space } from 'antd';
import { runInitOnDirectory } from '../fs/initFs';
import { friendlyError } from '../lib/uiError';
import { useAppStore } from '../store';

type InitState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'refused'; reason: string }
  | { kind: 'error'; message: string };

export function NoProject() {
  const root = useAppStore((s) => s.root);
  const refresh = useAppStore((s) => s.refresh);
  const [state, setState] = useState<InitState>({ kind: 'idle' });

  const runInit = async () => {
    if (!root || state.kind === 'running') return;
    setState({ kind: 'running' });
    try {
      const result = await runInitOnDirectory(root);
      if (result.ok) {
        // 重扫后 hasOht 变 true，App 层切到看板，本组件卸载
        await refresh();
      } else {
        setState({ kind: 'refused', reason: result.reason ?? '该目录已初始化' });
      }
    } catch (e) {
      setState({ kind: 'error', message: friendlyError('初始化', e) });
    }
  };

  const cancel = () => {
    // 取消：清除瞬态提示，停留在未初始化提示页
    setState({ kind: 'idle' });
  };

  return (
    // T0024：入口页统一骨架——外层加 entry-card 类（no-project 语义类保留），
    // 顶部渐变 logo、底部脚注；Result/两按钮/两 Alert 原样不动。
    <div className="no-project entry-card">
      <div className="entry-card__logo" aria-hidden="true">OHT</div>
      <Result
        status="warning"
        title="该目录未初始化循环工程"
        subTitle="这个目录还没有循环工程。可以「初始化此目录」一键装入，或取消留在本页。"
      />
      <Space size="middle" style={{ justifyContent: 'center', display: 'flex' }}>
        <Button
          type="primary"
          size="large"
          loading={state.kind === 'running'}
          onClick={() => void runInit()}
        >
          初始化此目录
        </Button>
        {/* antd 对恰好两字的按钮文案自动插视觉空格（渲染成“取 消”），
            会改变可访问名；aria-label 直接锁定可访问名为「取消」 */}
        <Button size="large" aria-label="取消" onClick={cancel}>
          取消
        </Button>
      </Space>
      {state.kind === 'refused' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12, maxWidth: 640, marginInline: 'auto' }}
          message={state.reason}
        />
      )}
      {state.kind === 'error' && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12, maxWidth: 640, marginInline: 'auto' }}
          message={`初始化失败: ${state.message}`}
        />
      )}
      <div className="entry-card__foot">纯本地运行 · 文件不上传 · 需 Chrome / Edge</div>
    </div>
  );
}

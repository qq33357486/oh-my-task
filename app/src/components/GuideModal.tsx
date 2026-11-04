/**
 * T0036 使用指南弹窗：只讲「如何用起来」，不讲界面（各面板含义）。
 *
 * - 内容五节，按时间线排：定位 → 工作原理 → 建定时器 → 提需求 → 边界
 *   （每节挂 `data-guide-section` 锚，测试与样式 alike 可定位）。
 * - 术语双称：Loop Engineering（循环工程）。
 * - 建定时器一节给可复制调度令话术（Typography copyable，一键复制原文）。
 * - 「已看过」标记：GUIDE_SEEN_KEY 落 localStorage（try/catch 兜底：
 *   存储不可用时视为已看过，宁可不打扰也不每次都弹）。
 * - 载体复用：MenuBar 帮助菜单手动开（不受标记限制）、App/MenuBar 自动弹
 *   （初始化成功后仅一次），共用本组件。
 */
import { Modal, Typography } from 'antd';
import type { ReactNode } from 'react';

/** 调度员定时任务提示词（复制即用，验收 A1 锚文本） */
export const DISPATCH_PROMPT = '调度令：读 .oht/AGENTS.md 并照做';

/** 调度任务频率建议（与话术同节展示） */
const DISPATCH_INTERVAL = '10~30 分钟';

/** 「已看过」标记的 localStorage 键（自动弹只弹一次） */
export const GUIDE_SEEN_KEY = 'oht.guideSeen';

/** 是否已看过指南（自动弹用；存储不可用时按已看过处理） */
export function isGuideSeen(): boolean {
  try {
    return localStorage.getItem(GUIDE_SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

/** 落「已看过」标记（自动弹时调用；值记时刻便于排查） */
export function markGuideSeen(): void {
  try {
    localStorage.setItem(GUIDE_SEEN_KEY, new Date().toISOString());
  } catch {
    // 存储不可用：静默跳过（下次最多多弹一次，可接受）
  }
}

function Section({
  name,
  title,
  children,
}: {
  name: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="guide-section" data-guide-section={name}>
      <Typography.Title level={5} style={{ marginBottom: 4 }}>
        {title}
      </Typography.Title>
      {children}
    </div>
  );
}

/** 指南正文五节（弹窗内容与渲染快照共用；不含任何界面布局讲解） */
export function GuideContent() {
  return (
    <>
      <Section name="定位" title="定位">
        <Typography.Paragraph>
          这里是 Loop Engineering（循环工程）的工作平台：人提需求，AI
          员工按流程循环推进任务，文件全程留在本地、不上传。
        </Typography.Paragraph>
      </Section>
      <Section name="工作原理" title="工作原理">
        <Typography.Paragraph>
          人提出需求（写成任务卡）→ AI
          员工按状态流转：需求 → 实现 → 检查，不通过打回重做，通过即归档，如此循环。
        </Typography.Paragraph>
        <Typography.Paragraph>
          网页上出现「待你定」的问题时，回到你的会话回答
          AI（拍板回路），循环即可继续。
        </Typography.Paragraph>
      </Section>
      <Section name="建定时器" title="建定时器（关键一步）">
        <Typography.Paragraph>
          初始化完成后，请在你的 Agent 工具里创建一个定时任务作为调度员，循环才会自动转起来（建议频率：每{' '}
          {DISPATCH_INTERVAL} 一次）。
        </Typography.Paragraph>
        <Typography.Paragraph>
          定时任务必须跑在单一专用会话里：干活的智能体都是该会话的子代理，不会有多会话并发冲突。
        </Typography.Paragraph>
        <Typography.Paragraph>
          定时任务提示词（复制即用）：
          <br />
          <Typography.Text
            copyable={{ text: DISPATCH_PROMPT, tooltips: ['复制提示词', '已复制'] }}
          >
            <code>{DISPATCH_PROMPT}</code>
          </Typography.Text>
        </Typography.Paragraph>
      </Section>
      <Section name="提需求" title="提需求">
        <Typography.Paragraph>
          另开其他会话，对人话说出需求即可：入口会自动分流给咨询员接待，对齐后创建需求卡片。
        </Typography.Paragraph>
      </Section>
      <Section name="边界" title="边界">
        <Typography.Paragraph>
          目前只有「人发起需求」一个途径，暂无自动监控问题的能力（巡查员未配置）；需要这类扩展请自行开发。
        </Typography.Paragraph>
      </Section>
    </>
  );
}

export function GuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      title="使用指南"
      open={open}
      footer={null}
      width={560}
      onCancel={onClose}
    >
      <GuideContent />
    </Modal>
  );
}

/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0003/A3）。
 *
 * <NoProject />
 * 无 props。渲染的文本内容必须包含“未初始化”
 * （完整文案自定，如“该目录未初始化循环工程”）。
 */
import { Result } from 'antd';

export function NoProject() {
  return (
    <div className="no-project">
      <Result
        status="warning"
        title="该目录未初始化循环工程"
        subTitle="未找到 .oht/ 目录。请确认选择的是循环工程根目录，或先在仓库根目录完成初始化（后续版本提供一键初始化）。"
      />
    </div>
  );
}

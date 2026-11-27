# Spec Delta

## MODIFIED Requirements

### Requirement: 浏览器

> 出处：人类的原话『请在电脑上打开这个提示不需要，而是用户点击后再提示。』；提示的原句是 AI 假设 2

网页 SHALL 能在 Chrome 和 Edge 的当前稳定版里完整使用。在别的浏览器里打开时，入口页 SHALL 照常显示；用户点了「开始享受」以后，系统 SHALL 显示一句「请用电脑上的 Chrome 或 Edge 打开，才能选择项目文件夹。」，不显示看板。

#### Scenario: 用 Firefox 打开

- **WHEN** 用户用 Firefox 打开页面
- **THEN** 显示入口页，页面上没有那句提示，不显示看板
- **WHEN** 用户点「开始享受」
- **THEN** 出现那句话

#### Scenario: 页面刚打开

- **WHEN** 页面刚打开，还没读完浏览器里存了上次的哪个目录
- **THEN** 页面是空白的，不先显示入口页再换成别的

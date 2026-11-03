# T0010 harness —— 自动化引擎系统测试（骨架）

被测物：循环工程自动化引擎（调度员唤醒 + 卡生命周期 + 角色派发）。
模式：临时沙盒工程 + 预置卡组（只读夹具）+ 唤醒一轮调度员 + 逐项断言。

## 用法（A1 一条命令）

```
python -I .oht/tests/T0010/run_t0010.py
```

- 每次运行新建临时沙盒、注入夹具、唤醒、断言、清理，可重复。
- 调试：设 `OHT_T0010_KEEP=1` 保留沙盒目录。
- **当前必红**：`TODO-WAKE` 未实现——`wake_dispatcher()` 抛
  `NotImplementedError`，后续断言全部阻塞，exit 1 并打印红因。
  实现员只需补这一个函数（文件其余部分为锁定契约，不得改），
  返回值契约 `WakeReport {lock_seen, report_text, exit_code}` 见脚本 docstring。

## 预置卡组（presets/，全部过 check-card 单卡校验；card_broken 豁免）

| 夹具 | 状态 | 引擎预期行为（断言目标） |
|---|---|---|
| card_new.md | new | 不派咨询员，status 不变，入报告（A2） |
| card_nh.md | need_human, replied=false | 未回复不推进（A2） |
| card_nh_replied.md | need_human, replied=true | 转 resume_to=tests，replied 复位 false（A2） |
| card_tests.md | tests（指向恒失败 fake_spec.test.py） | 检查员复跑得红 → ready（A3） |
| card_ready.md | ready（指向 ready_impl.test.py，出厂即红） | 实现后测试绿 → review（A3） |
| card_review.md | review（指向恒通过 review_green.test.py，"测试全绿样"） | 复跑绿 → done（A3）。注意：条目状态按协议在 review 阶段保持红，检查员判定绿时才改绿推 done |
| card_done.md | done（条目全绿） | 记录员 → recorded（A3） |
| card_broken.md | 残缺（无 frontmatter） | 不崩引擎，文件仍在，解析降级 ok=false（A3）。**豁免 check-card**：残缺本身是被测属性 |

占位测试（T0010/ 根，注入沙盒同路径 `.oht/tests/T0010/`）：
- `fake_spec.test.py` 恒失败（exit 1）——card_tests 被"测试红"推 ready 的依据；
- `ready_impl.test.py` 出厂即红，文件头写明可判定实现路径（创建沙盒
  `.oht/local/ready_impl_done` 标记即绿）——保证 ready→review 断言可达，
  否则恒死测试下该断言永不可满足；此为骨架阶段锁定的夹具语义；
- `review_green.test.py` 恒通过（exit 0）——card_review / card_done 用。

## 断言契约（11 项，对应 A1~A4，锁定）

见 `run_t0010.py` 模块 docstring。A4 看板一致性当前用
parseCard/scanTasks 的 python 最小复刻（逐条对齐 app/src 契约，
注明于脚本内）；实现员可改为 esbuild 转译直调 app/src。

## 沙盒构建（等价路径）

初始化逻辑在 app/ 前端 TS（`app/src/template.ts` + runInit），python 不可直接调。
骨架阶段：按 TEMPLATE_FILES 清单从本仓库 `.oht/` 母本逐文件拷贝 +
业务区空壳 + 宿主 AGENTS.md 引用行。实现员可改为调用 app 初始化产物。

## 唤醒机制候选方案（TODO-WAKE，实现员定）

1. zcode CLI 非交互调用：cwd=沙盒，提示词指向 `.oht/AGENTS.md` 入口，
   harness 期间采样 `.lock` 存在性 → 首选，最贴近真实引擎；
2. 其他子代理执行自动化提示词的方案（工作区指向沙盒）；
3. 若确认都不可行：按流程把 T0010 转 need_human 说明。
注意：沙盒与母本仓库隔离，无 .lock 竞争；唤醒须循环到无可派为止。

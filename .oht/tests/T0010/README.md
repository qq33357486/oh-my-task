# T0010 harness —— 自动化引擎系统测试【superseded 2026-11-03，已退役（T0020）】

真唤醒 harness（run_t0010.py）已按 T0020 测试执行纪律退役：测试与干活由在途
工作者自跑用例——不新起 CLI 实例、不嵌套派人、不指定外部模型；T0010 时代的
真唤醒（子进程拉起 CLI 唤醒沙盒）正是被禁形态，且桌面会话模型绑定错配致其
实际消耗外部模型额度。本目录现仅存：退役桩 run_t0010.py（运行只打印说明，
exit 0）、只读夹具 presets/ 与占位测试，留作历史出处；原唤醒机制、隔离与
调试环境变量说明不再复述，见 git 历史。

## 用法（退役后）

```
python -I .oht/tests/T0010/run_t0010.py
```

只打印 superseded 说明并 exit 0：不再建沙盒、不再唤醒、不再断言。

## 回归门槛（移交）

- 锁与生命周期语义：`.oht/tests/T0018/lock_a1.test.py`（7 例）与
  `lock_a2.test.py`（5 例）；
- 看板一致：app vitest 全量。

## 预置卡组（presets/，历史夹具，只读；全部过 check-card 单卡校验，card_broken 豁免）

| 夹具 | 状态 | 引擎预期行为（原断言目标） |
|---|---|---|
| card_new.md | new | 不派咨询员，status 不变，入报告（A2） |
| card_nh.md | need_human, replied=false | 未回复不推进（A2） |
| card_nh_replied.md | need_human, replied=true | 转 resume_to=tests，replied 复位 false（A2） |
| card_tests.md | tests（指向恒失败 fake_spec.test.py） | 检查员复跑得红 → ready（A3） |
| card_ready.md | ready（指向 ready_impl.test.py，出厂即红） | 实现后测试绿 → review（A3） |
| card_review.md | review（指向恒通过 review_green.test.py） | 复跑绿 → done（A3） |
| card_done.md | done（条目全绿） | 记录员 → recorded（A3） |
| card_broken.md | 残缺（无 frontmatter） | 不崩引擎，解析降级 ok=false（A3） |

占位测试（T0010/ 根，历史夹具）：fake_spec.test.py 恒失败、ready_impl.test.py
出厂即红（沙盒标记 `.oht/local/ready_impl_done` 即绿）、review_green.test.py
恒通过——仅作 presets/ 语义出处留档，不再被任何 harness 注入运行。

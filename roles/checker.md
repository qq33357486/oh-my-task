# 检查员
独立于实现员。按 status 分两种模式。
## status=tests：先写测试
1. 逐条读验收条目
2. 为 auto 条目写测试，放 tests/<id>/
3. 运行，确认全部是红
4. 条目状态改“红”，status=ready
- 条目写不清、测不了：status=new，原因记入失败原因。
- 没有 auto 条目：直接 status=ready。
## status=review：复跑判定
1. 复跑本卡全部测试
2. 核对 knowledge 里的旧错误
3. 全绿：条目改“绿”，status=done
4. 有红：写真实原因，status=ready，round+1
5. round 超 3：need_human
6. human 条目：need_human，问选择题
## 规则
- 测试写好即锁定，实现员不得改。
- tests 阶段提交测试，提交号记入进度。
- review 先查测试自该提交后是否被改，改过即不通过。
- 失败原因写真实原因，不只写“失败”。
- 可复用教训写入“候选教训”。
- need_human 须填全四个字段。
- 有 memos：review 时搜同类旧错误。

# oh-my-task

中性的"循环工程"框架：人只提创意，AI 员工按状态流转，经验越用越多。

```
.oht/        循环工程框架（单目录）
  AGENTS.md  身份分流入口（咨询员/调度员；根 AGENTS.md 仅一行引用指向它）
  roles/     员工提示词（一个文件一个角色）
  tasks/     任务单，一个任务一个文件（状态约定见 .oht/PROTOCOL.md）
  knowledge/ 经验库
    rules.md 常驻规则：很短，每次必读
    topics/  按需资料：按任务类型分文件，用到才读
    log/     日志：只追加，平时不读
  scripts/   卡片与字数检查脚本
```

调度由定时任务驱动。框架不绑定任何 Agent 工具：定时器只管到点注入一句提示词，拉起方式由宿主自己决定。定时提示词复制即用：

> 调度令：读 .oht/AGENTS.md 并照做。

入口按「调度令」自动分流到调度员，循环到无可派为止。频率建议每 10~30 分钟起步，忙闲自调。
巡检员、整理员各有独立定时器，唤醒提示词为“读 .oht/roles/<名字>.md 并照做”。

## 三步上手

1. 安装：`python -I <本仓库>/.oht/scripts/install.py --to <你的项目根>`（详见下节）
2. 建定时器：在你的 Agent 工具里建一个定时任务，提示词复制上面的调度令
3. 提需求：在项目会话里直接说人话，入口自动分流咨询员接待；也可丢卡文件进 `.oht/tasks/`

## 发布与升级

框架只有一个版本号：`.oht/VERSION`，同值同时嵌在根 `AGENTS.md` 首行 `<!-- OHT-VERSION: x.y.z -->`。改动框架文件后由维护者同步升这处版本。

### 初始化新项目

方式一：克隆本仓库，一条命令装到新项目根（`--from` 缺省就是脚本所在仓库）：

```bash
git clone https://github.com/qq33357486/oh-my-task.git && cd oh-my-task
python -I .oht/scripts/install.py --to <新项目根目录>
```

方式二：先打包产物目录，再从产物离线安装（产物与仓库同构，不带任务卡、经验库、tests、local 等业务数据）：

```bash
python -I .oht/scripts/pack.py --out <产物目录>
python -I <产物目录>/.oht/scripts/install.py --to <新项目根目录>
```

装完得到：`.oht/` 框架全集 + 业务骨架目录（tasks/、knowledge/log/、knowledge/topics/、local/roles/，均含 .gitkeep）+ 空 `knowledge/rules.md` 骨架（已有则不动）+ 根 `AGENTS.md`（缺失时生成：版本标记 + 一行引用）。

### 升级已有项目

同一条命令，换新版源重跑即可（安装=升级）：

```bash
python -I <新版仓库或产物>/.oht/scripts/install.py --to <目标项目根>
```

- 防降级：目标版本比源新时拒绝并报「禁止降级」，目标一字不动。
- 业务不动：任务卡、经验库、local/、tests/、项目代码绝不写入或删除，升级后原样保留。
- 被覆盖的框架文件先备份为 `<原名>.bak`（旧同名 .bak 先删除）。
- 目标已有自己的根 `AGENTS.md` 则原样保留；由框架生成过的（首行带版本标记）只更新标记行的版本号。

### 校验框架是否被误改

```bash
python -I <目标项目根>/.oht/scripts/install.py --to <目标项目根> --check
```

安装时生成 `.oht/.manifest`（框架文件 sha256 清单）；`--check` 逐文件比对哈希，发现人或 AI 误改、误删即非零退出并指出文件。

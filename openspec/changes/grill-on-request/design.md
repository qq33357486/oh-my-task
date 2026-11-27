# Design

任务夹在 `openspec/changes/grill-on-request/`。改的是框架文件的正本，就在本仓库。和 `openspec/changes/entry-page-and-guide/` 一起发布。

## Context

**现在的两句话**（2026-11-27 读文件核实）：

- `.omt/AGENTS.md` 第 10 行：`- 要拷问时：用 grill-with-docs 技能。`
- `.omt/工作流/默认工作流.md` 第 30 行开头：`2. **拷问**（人＋AI，主会话）：由人启动 grill-with-docs，照它自带的规矩做。`

**技能文件**：三份在 `.agents/skills/` 下：grill-with-docs、grilling、domain-modeling。grill-with-docs 的 `SKILL.md` 只有一句正文：让调用两次 Skill 工具，分别加载 grilling 和 domain-modeling；它的说明里有一行 `disable-model-invocation: true`，意思是 AI 不能自己调用这个技能。这一行不动。三份技能文件都不动，和上游保持一致（见知识库「拷问技能的来源」）。

**问题出在哪**：斜杠命令 `/grill-with-docs` 只有认 `.agents/skills/` 这个目录的 AI 工具才有。2026-11-27 搜到的说法是 Codex、Cursor、Gemini CLI、VS Code 会读这个目录，Claude Code 读的是 `.claude/skills/`。这是搜索摘要里的结论，没有逐个到官方文档核实。人的判断是『其他工具不会安装啊。所以/没用啊。』。

**实验**（2026-11-27，一次）：新开一个 AI，要求它不用 Skill 工具、不用斜杠命令、不依赖技能列表，只给它根 `AGENTS.md` 的路径，对它说「我想给网站加一个深色模式的开关。请拷问我。」。

- 它顺着文件读下去：根 `AGENTS.md` → `.omt/AGENTS.md` → 默认工作流 → grill-with-docs 的 `SKILL.md` → grilling 和 domain-modeling 的 `SKILL.md` → 术语表和业务工作流，然后提出了第一轮七个问题。
- 它报告：前两跳是文件直接指的路径；第三跳是猜的，没有任何文件写明 `.agents/skills/grill-with-docs/SKILL.md` 这个路径，它是从「`.agents/skills/` 下的三个拷问技能」这句推出目录，再列目录确认的。读 grilling 和 domain-modeling 的路径也是按同样的约定推的。
- 局限：只跑了一次，一个模型（和做这次任务的 AI 同一个），在 ZCode 的子代理里跑的，「没有技能」是靠要求它做到的，不是环境真的没有。

结论：一句话指令这条路走得通，薄弱处是路径靠猜。把路径写明就补上了。

**人定的前提**：所有 AI 都自动支持读根目录的 `AGENTS.md`。所以指令里不需要写「先读根目录的 AGENTS.md」。

## Decisions

### 1. 路径写在 `.omt/AGENTS.md` 里，技能文件不改

`.omt/AGENTS.md` 是任务系统的说明，每个业务项目都有，AI 一进来就读它。把三份技能文件的位置写在它里面，AI 就不用猜。三份技能文件本身不改：它们是上游来的，本地只有 domain-modeling 有已知的改动，再改会和上游走样，更新时要多合并一处。

### 2. 两种说法并存

人说了「请拷问我」算启动，在认技能的工具里打了 `/grill-with-docs` 也算。已经在用斜杠命令的人不受影响。

### 3. 人没说这句时，AI 停下等

默认工作流原来就是「由人启动」，只是把「启动」的说法从斜杠命令换成一句话。AI 读完已有的以后，人还没说「请拷问我」，就停下等，不自己开始追问。

### 4. 怎么验

- 两份文件的文字核对用自动测试，读仓库的真实文件。
- 「没有斜杠命令的 AI 也能开始拷问」由新开的 AI 照场景里的条件跑：不用 Skill 工具、不用斜杠命令、只给根 `AGENTS.md` 的路径。跑两遍，把交回的原文留在任务夹里。重点看它的报告里「哪一行让它去读的」是不是指向写明的路径，而不是推断。

## 文字定稿

改前、改后都是整行。只改这两处，别的地方提到 grill-with-docs 的句子不动。

**`.omt/AGENTS.md` 第 10 行**

改前：

```text
- 要拷问时：用 grill-with-docs 技能。
```

改后：

```text
- 要拷问时：读 `.agents/skills/grill-with-docs/SKILL.md`，照它做。它会让你再读 grilling 和 domain-modeling，都在 `.agents/skills/` 下，直接读文件。不靠斜杠命令。
```

**`.omt/工作流/默认工作流.md` 第 30 行的开头**

改前：

```text
2. **拷问**（人＋AI，主会话）：由人启动 grill-with-docs，照它自带的规矩做。
```

改后：

```text
2. **拷问**（人＋AI，主会话）：人说了「请拷问我」才启动，在认技能的工具里打了 `/grill-with-docs` 也一样；人还没说时，读完已有的就停下等。AI 读 `.agents/skills/grill-with-docs/SKILL.md`，照它自带的规矩做。
```

这一行从「另外要问出人想要什么」起的后半句不动。

## Risks / Trade-offs

- **别的 AI 未必照做。** 实验只跑了一个模型。所以独立验收时要新开 AI 跑两遍，并且把「哪一行让它去读的」写进报告里。
- **「所有 AI 都自动支持读根目录的 AGENTS.md」是人定的前提，没有核实。** 要是某个工具不读，那句「请拷问我」它就不知道按什么规矩问。按人的决定办，这一条记在这里备查。
- **改的是所有业务项目都要遵守的规矩。** 所以单独一个任务夹、单独审查；人类验收时由人确认默认工作流的改动。
- **框架文件是内置在网页里的。** 改完要重新构建、重新部署，各业务项目再点一次「有更新」才拿到。和网页那个任务一起发布，只部署一次。
- **网页的使用说明里已经写了「请拷问我」。** 所以两个任务要一起发布，不能网页先上、规矩后到。

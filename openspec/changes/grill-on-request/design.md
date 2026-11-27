# Design

任务夹在 `openspec/changes/grill-on-request/`。改的是框架文件的正本，就在本仓库。和 `openspec/changes/entry-page-and-guide/` 一起发布。

## Context

**现在怎么启动拷问**（2026-11-27 读文件核实）：

- `.omt/AGENTS.md` 第 10 行：`- 要拷问时：用 grill-with-docs 技能。`
- `.omt/工作流/默认工作流.md` 第 30 行开头：`2. **拷问**（人＋AI，主会话）：由人启动 grill-with-docs，照它自带的规矩做。`
- 这两份文件里没有一处写明技能文件的完整路径，也没有「拷问记录」这几个字。

**不留痕的路径有两条**：

- `grilling` 的 `SKILL.md` 可以单独用。它的说明里没有 `disable-model-invocation`，AI 能自己调用它；它只有拷问的做法，不带写文档那半截。
- 默认工作流没有要求写拷问记录。只有看板的卡片详情会去读 `proposal.md` 的「拷问记录」一节（`openspec/specs/task-board/spec.md`）。

**三份技能文件**（`.agents/skills/` 下）：

- grill-with-docs 的 `SKILL.md`：说明里有 `disable-model-invocation: true`，正文只有一句，让调用两次 Skill 工具，分别加载 grilling 和 domain-modeling。
- grilling 的 `SKILL.md`：说明里没有这个标记，见知识库「拷问技能的来源」。本地这份落后上游一次提交，没有本地改动。
- domain-modeling 的 `SKILL.md`：有本地改动。

**问题出在哪**：斜杠命令 `/grill-with-docs` 只有认 `.agents/skills/` 这个目录的 AI 工具才有。2026-11-27 搜到的说法是 Codex、Cursor、Gemini CLI、VS Code 会读这个目录，Claude Code 读的是 `.claude/skills/`。这是搜索摘要里的结论，没有逐个到官方文档核实。人的判断是『其他工具不会安装啊。所以/没用啊。』。

**实验**（2026-11-27，一次）：新开一个 AI，要求它不用 Skill 工具、不用斜杠命令、不依赖技能列表，只给它根 `AGENTS.md` 的路径，对它说「我想给网站加一个深色模式的开关。请拷问我。」。

- 它顺着文件读下去：根 `AGENTS.md` → `.omt/AGENTS.md` → 默认工作流 → grill-with-docs 的 `SKILL.md` → grilling 和 domain-modeling 的 `SKILL.md` → 术语表和业务工作流，然后提出了第一轮七个问题。
- 它报告：前两跳是文件直接指的路径；第三跳是猜的，没有任何文件写明 `.agents/skills/grill-with-docs/SKILL.md` 这个路径，它是从「`.agents/skills/` 下的三个拷问技能」这句推出目录，再列目录确认的。读 grilling 和 domain-modeling 的路径也是按同样的约定推的。
- 局限：只跑了一次，一个模型（和做这次任务的 AI 同一个），在 ZCode 的子代理里跑的，「没有技能」是靠要求它做到的，不是环境真的没有。

结论：一句话指令这条路走得通，薄弱处是路径靠猜。把三份文件的路径都写明就补上了。

**人定的前提**：所有 AI 都自动支持读根目录的 `AGENTS.md`。所以指令里不需要写「先读根目录的 AGENTS.md」。

## Decisions

### 1. 说法不限，但仍然由人启动

人要求拷问，AI 才开始。「请拷问我」只是举的例子，别的说法（「帮我拷问一下这个想法」）也算。人只说了需求、没要求拷问时，AI 读完已有的就停下等。在认技能的工具里打 `/grill-with-docs` 也算启动，已经在用的人不受影响。

不做成「不等人要求就自动拷问」：人没有要这个。

### 2. 只走 grill-with-docs，三样痕迹缺一不可

拷问只按 grill-with-docs 做：它带着 grilling 和 domain-modeling，边问边写。三样痕迹：

1. 拷问记录：人的原话按轮次，写进任务夹 `proposal.md` 的「拷问记录」一节，用表格。看板的卡片详情读的就是这一节。
2. 术语和长期决策：当场写进术语表和决策记录。
3. 每条需求带出处。

把关的地方是独立审查：缺任何一样，按 AI 错误打回。写进默认工作流的拷问一步、独立审查一步和分流表。

### 3. 给 grilling 加一道硬闸

grilling 的 `SKILL.md` 改两处，别的不动：

- 说明里加一行 `disable-model-invocation: true`。认这个标记的工具里，AI 不能自己调用它。
- 正文第一句写明它只经 grill-with-docs 用、不单独用。不认标记的工具里，AI 读到这句也知道不能单独用。

这是能做的最硬的一道。做不到更硬的：把 grilling 从框架名单里拿掉、并进 grill-with-docs，会让 grill-with-docs 和上游走样，而且已经初始化过的项目里旧的 grilling 文件删不掉，那条路还在。

### 4. 路径写全三份

`.omt/AGENTS.md` 写明 grill-with-docs、grilling、domain-modeling 三份 `SKILL.md` 的完整路径。grilling 加了标记以后，认标记的工具里 AI 调不了它，只能照路径直接读文件，所以三份路径都要写明。

### 5. 怎么验

- 文字核对用自动测试，读仓库的真实文件。
- 「换个说法也能启动」「人没要求时不动」「没有斜杠命令的 AI 也能开始拷问」由新开的 AI 照场景里的条件跑。每个跑两遍，交回的原文留在任务夹里。重点看它的报告里「哪一行让它去读的」是不是指向写明的路径，而不是推断。

## 文字定稿

改前、改后都是整行。只改这几处，别的地方不动。

**`.omt/AGENTS.md` 第 10 行**

改前：

```text
- 要拷问时：用 grill-with-docs 技能。
```

改后：

```text
- 要拷问时：只按 grill-with-docs 做。读 `.agents/skills/grill-with-docs/SKILL.md`，照它做；它会让你再读 `.agents/skills/grilling/SKILL.md` 和 `.agents/skills/domain-modeling/SKILL.md`，直接读文件。不靠斜杠命令，不单独用 grilling。拷问要留痕：拷问记录写进任务夹的 `proposal.md`，术语和长期决策当场写，每条需求带出处。
```

**`.omt/工作流/默认工作流.md` 第 30 行的开头**

改前：

```text
2. **拷问**（人＋AI，主会话）：由人启动 grill-with-docs，照它自带的规矩做。
```

改后：

```text
2. **拷问**（人＋AI，主会话）：人要求拷问时才启动，说法不限（比如「请拷问我」），在认技能的工具里打了 `/grill-with-docs` 也一样；人没要求时，读完已有的就停下等。只按 grill-with-docs 做：AI 读 `.agents/skills/grill-with-docs/SKILL.md`，照它自带的规矩做，不单独用 grilling。拷问要留痕，缺一不可：拷问记录（人的原话，按轮次，用表格）写进任务夹的 `proposal.md`；术语和长期决策当场写；每条需求带出处。
```

这一行从「另外要问出人想要什么」起的后半句不动。

**`.omt/工作流/默认工作流.md` 第 32 行里的一处**

改前（片段）：

```text
带标签的用例和它的出处、留给人亲手验的用例也在审查范围内，多核两项：
```

改后（片段）：

```text
带标签的用例和它的出处、留给人亲手验的用例、拷问留的三样痕迹（拷问记录、术语和长期决策、出处）也在审查范围内，多核两项：
```

这一行的其余部分不动。

**`.omt/工作流/默认工作流.md` 第 34 行**

改前：

```text
| AI 错误（写错、漏了、没出处；带标签的用例转偏了；能验的说成转不了） | AI 改任务夹，回到第 4 步 |
```

改后：

```text
| AI 错误（写错、漏了、没出处、拷问没留痕；带标签的用例转偏了；能验的说成转不了） | AI 改任务夹，回到第 4 步 |
```

**`.agents/skills/grilling/SKILL.md`**

改前（开头五行）：

```text
---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding.
```

改后（开头六行）：

```text
---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
disable-model-invocation: true
---

Use this only through grill-with-docs, never on its own: a grilling must leave a record (the grilling log, the glossary, the decision records).

Interview the user relentlessly until you reach a shared understanding.
```

这份文件用英文写，加的两处也用英文，和它保持一致。

## Risks / Trade-offs

- **硬闸不是处处管用。** `disable-model-invocation` 只有认它的工具才拦；ZCode 这次就把带这个标记的 grill-with-docs 也列了出来。正文里那句限制是给不认标记的工具准备的，靠 AI 读了照做。真正把关的是独立审查：没留痕就打回。
- **别的 AI 未必照做。** 实验只跑了一个模型。所以独立验收时每个场景跑两遍，并且把「哪一行让它去读的」写进报告里。
- **「所有 AI 都自动支持读根目录的 AGENTS.md」是人定的前提，没有核实。** 要是某个工具不读，那句「请拷问我」它就不知道按什么规矩问。按人的决定办，这一条记在这里备查。
- **说法不限，就可能认错。** 人随口一句带「拷问」的话，AI 可能当成要求拷问。人定了要灵活，接受这一点；真认错了，说一声不做就行。
- **改的是所有业务项目都要遵守的规矩。** 所以单独一个任务夹、单独审查；人类验收时由人确认默认工作流的改动。
- **grilling 从此有本地改动。** 知识库「拷问技能的来源」里记的是「grilling 直接用上游的」，整理时要改成有本地改动、更新时合并这两处。
- **框架文件是内置在网页里的。** 改完要重新构建、重新部署，各业务项目再点一次「有更新」才拿到。和网页那个任务一起发布，只部署一次。
- **网页的使用说明里已经写了「请拷问我」。** 所以两个任务要一起发布，不能网页先上、规矩后到。

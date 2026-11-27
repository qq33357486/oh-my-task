# Design

任务夹在 `openspec/changes/grill-on-request/`。改的是框架文件的正本，就在本仓库。和 `openspec/changes/entry-page-and-guide/` 一起发布。

## Context

**现在怎么启动拷问**（2026-11-27 读文件核实）：

- `.omt/AGENTS.md` 第 10 行：`- 要拷问时：用 grill-with-docs 技能。`
- `.omt/工作流/默认工作流.md` 第 30 行开头：`2. **拷问**（人＋AI，主会话）：由人启动 grill-with-docs，照它自带的规矩做。`
- 这两份文件里没有一处写明技能文件的完整路径。

**不留痕的路径**：`grilling` 的 `SKILL.md` 可以单独用。它的说明里没有 `disable-model-invocation`，AI 能自己调用它；它只有拷问的做法，不带写文档那半截（术语表和决策记录）。

**已有的留痕规矩**（默认工作流里已经写着，这次不新增）：每条需求带出处（规则、强制第 3 条）；术语和长期决策在拷问当时写（「固定新东西」的「谁写」）。拷问记录：到现在为止每个任务夹的 `proposal.md` 都有「拷问记录」一节，看板的卡片详情读的就是它（`openspec/specs/task-board/spec.md`），但默认工作流没有写「必须记」。它是做法，不是规矩。人定了这次不动它。

**三份技能文件**（`.agents/skills/` 下）：

- grill-with-docs 的 `SKILL.md`：说明里有 `disable-model-invocation: true`，正文只有一句，让调用两次 Skill 工具，分别加载 grilling 和 domain-modeling。
- grilling 的 `SKILL.md`：说明里没有这个标记，见知识库「拷问技能的来源」。本地这份落后上游一次提交，没有本地改动。
- domain-modeling 的 `SKILL.md`：有本地改动。

**问题出在哪**：斜杠命令 `/grill-with-docs` 只有认 `.agents/skills/` 这个目录的 AI 工具才有。2026-11-27 搜到的说法是 Codex、Cursor、Gemini CLI、VS Code 会读这个目录，Claude Code 读的是 `.claude/skills/`。这是搜索摘要里的结论，没有逐个到官方文档核实。人的判断是『其他工具不会安装啊。所以/没用啊。』。

**实验**（2026-11-27，一次）：新开一个 AI，要求它不用 Skill 工具、不用斜杠命令、不依赖技能列表，只给它根 `AGENTS.md` 的路径，对它说「我想给网站加一个深色模式的开关。请拷问我。」。

- 它顺着文件读下去：根 `AGENTS.md` → `.omt/AGENTS.md` → 默认工作流 → grill-with-docs 的 `SKILL.md` → grilling 和 domain-modeling 的 `SKILL.md` → 术语表和业务工作流，然后提出了第一轮七个问题。
- 它报告：前两跳是文件直接指的路径；第三跳是猜的，没有任何文件写明 `.agents/skills/grill-with-docs/SKILL.md` 这个路径，它是从「`.agents/skills/` 下的三个拷问技能」这句推出目录，再列目录确认的。读 grilling 和 domain-modeling 的路径也是按同样的约定推的。
- 局限：只跑了一次，一个模型（和做这次任务的 AI 同一个），在 ZCode 的子代理里跑的。「没有技能」是靠要求它做到的，不是环境真的没有：ZCode 把带 `disable-model-invocation` 的技能也列了出来。

结论：一句话指令这条路走得通，薄弱处是路径靠猜。把三份文件的路径都写明就补上了。

**人定的前提**：所有 AI 都自动支持读根目录的 `AGENTS.md`。所以指令里不需要写「先读根目录的 AGENTS.md」。

## Decisions

### 1. 做不做由人定，AI 先问一句

人提了需求，AI 先问一句要不要拷问。人已经要求拷问的（说法不限，比如「请拷问我」；在认技能的工具里打了 `/grill-with-docs` 也一样），不用再问。人说要，才启动。人说不要（简单需求），就不拷问，直接建任务夹；每条需求仍然要带出处，出处是人那一句话需求，或者标了 AI 假设、在建任务夹时请人答。

不做成「不等人要求就自动拷问」：人没有要这个。

### 2. 只走 grill-with-docs

拷问只按 grill-with-docs 做：它带着 grilling 和 domain-modeling，边问边写。留痕按已有的两条规矩：每条需求带出处，术语和长期决策当场写。把关的地方不变：没有出处的需求不进审查（强制第 3 条）。拷问记录照原来的做法，这次不立规矩。

### 3. 给 grilling 加一道硬闸

grilling 的 `SKILL.md` 改两处，都是插入，原有的一个字不动：

- 说明里加一行 `disable-model-invocation: true`。认这个标记的工具里，AI 不能自己调用它。
- 正文最前面加一句，写明它只经 grill-with-docs 用、不单独用。不认标记的工具里，AI 读到这句也知道不能单独用。

这是能做的最硬的一道。做不到更硬的：把 grilling 从框架名单里拿掉、并进 grill-with-docs，会让 grill-with-docs 和上游走样，而且已经初始化过的项目里旧的 grilling 文件删不掉，那条路还在。

### 4. 路径写全三份

`.omt/AGENTS.md` 写明 grill-with-docs、grilling、domain-modeling 三份 `SKILL.md` 的完整路径。grilling 加了标记以后，认标记的工具里 AI 调不了它，只能照路径直接读文件，所以三份路径都要写明。默认工作流里也补半句「调不了就读文件」，因为 grill-with-docs 的正文让 AI 去调 Skill 工具。

### 5. 怎么验

- 文字核对用自动测试，读仓库的真实文件。
- 「人没要求拷问时先问一句」「换个说法也能启动」「没有斜杠命令的 AI 也能开始拷问」由新开的 AI 照场景里的条件跑。条件是要求它不用 Skill 工具、斜杠命令和技能列表，并在报告里如实写明有没有做到；环境里做不到真的没有。每条跑两遍，交回的原文写进 tasks.md 的普通条目里。重点看它的报告里「哪一行让它去读的」是不是指向写明的路径，而不是推断。

## 文字定稿

只改这几处，别的地方不动。

**`.omt/AGENTS.md` 第 10 行**

改前：

```text
- 要拷问时：用 grill-with-docs 技能。
```

改后：

```text
- 要拷问时：只按 grill-with-docs 做。读 `.agents/skills/grill-with-docs/SKILL.md`，照它做；它会让你再读 `.agents/skills/grilling/SKILL.md` 和 `.agents/skills/domain-modeling/SKILL.md`，直接读文件。不靠斜杠命令，不单独用 grilling。
```

**`.omt/工作流/默认工作流.md` 第 30 行的开头**

改前：

```text
2. **拷问**（人＋AI，主会话）：由人启动 grill-with-docs，照它自带的规矩做。
```

改后：

```text
2. **拷问**（人＋AI，主会话）：做不做由人定。人提了需求，AI 先问一句要不要拷问；人已经要求拷问的（说法不限，比如「请拷问我」；在认技能的工具里打了 `/grill-with-docs` 也一样），不用再问。人说要，只按 grill-with-docs 做：AI 读 `.agents/skills/grill-with-docs/SKILL.md`（调不了就读文件），照它自带的规矩做，不单独用 grilling；拷问要留痕，每条需求带出处，术语和长期决策当场写。人说不要，就不拷问，直接建任务夹。
```

这一行从「另外要问出人想要什么」起的后半句不动。默认工作流的其余部分不动，独立审查那一步和分流表也不动。

**`.agents/skills/grilling/SKILL.md`**

改前（开头六行，第六行只摘了前半句）：

```text
---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: …
```

改后（开头九行）：只插入两处，原有的每一行都不动。

```text
---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
disable-model-invocation: true
---

Use this only through grill-with-docs, never on its own: a grilling must leave a record (the glossary, the decision records, a source on every requirement).

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: …
```

- 第一处：在 `description:` 那一行后面插入 `disable-model-invocation: true`。
- 第二处：在说明头（第二道 `---`）后面的空行和 `Interview the user relentlessly` 之间，插入上面那一句英文，再跟一个空行。

这份文件用英文写，加的两处也用英文，和它保持一致。

## Risks / Trade-offs

- **硬闸不是处处管用。** `disable-model-invocation` 只有认它的工具才拦；ZCode 这次就把带这个标记的 grill-with-docs 也列了出来。正文里那句限制是给不认标记的工具准备的，靠 AI 读了照做。真正把关的还是已有的规矩：没有出处的需求不进审查。
- **别的 AI 未必照做。** 实验只跑了一个模型。所以独立验收时每个场景跑两遍，并且把「哪一行让它去读的」写进报告里。
- **「环境里真的没有技能」这个条件造不出来。** 带标签的用例只能靠要求新开的 AI 不用，并让它报告有没有做到。这一点写进了场景的条件里。
- **「所有 AI 都自动支持读根目录的 AGENTS.md」是人定的前提，没有核实。** 要是某个工具不读，那句「请拷问我」它就不知道按什么规矩问。按人的决定办，这一条记在这里备查。
- **说法不限，就可能认错。** 人随口一句带「拷问」的话，AI 可能当成要求拷问。人定了要灵活，接受这一点；真认错了，说一声不做就行。
- **改的是所有业务项目都要遵守的规矩。** 所以单独一个任务夹、单独审查；人类验收时由人确认默认工作流的改动。
- **grilling 从此有本地改动。** 知识库「拷问技能的来源」里记的是「grilling 直接用上游的」，整理时要改成有本地改动、更新时合并这两处。
- **框架文件是内置在网页里的。** 改完要重新构建、重新部署，各业务项目再点一次「有更新」才拿到。和网页那个任务一起发布，只部署一次。
- **网页的使用说明里已经写了「请拷问我」。** 所以两个任务要一起发布，不能网页先上、规矩后到。

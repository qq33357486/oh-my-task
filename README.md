# DJTASK（多杰任务系统）

任务系统的窗口。对一个业务项目做三件事：初始化、更新、展示。

- **展示**：四列看板（需求、执行、等你验收、已归档）。阶段全部从 OpenSpec 的文件现算，页面只读。
- **初始化**：把内置的框架文件置入一个业务项目，不覆盖任何已有文件。
- **更新**：始终覆盖，让项目里的框架文件和网页内置的保持一致。

纯前端静态网页，没有后端。读写目录靠浏览器的 File System Access API，只能在 Chrome、Edge 里用。

## 用之前

- **用 Chrome 或 Edge 打开。** 地址必须是 `https://` 或 `localhost`，否则浏览器不给出选目录的能力，页面只会显示「请用 Chrome 或 Edge 打开」。
- **OpenSpec 自己装。** 在业务项目里运行 `openspec init`。DJTASK 不替你装，只在你没装的时候提示。
- **两个项目的文件夹不能同名。** 最近项目和目录授权都按文件夹名记，同名会互相覆盖。这是浏览器的限制，它不告诉网页目录的完整路径。
- **业务项目根目录的 `AGENTS.md` 要是 UTF-8 编码**（带不带 BOM 都行）。初始化、更新会在它开头放一行入口；不是 UTF-8 时（比如被存成了 UTF-16，或带中文的 ANSI）页面会停下、不动它，另存成 UTF-8 再试。只有英文的文件本来就是 UTF-8。

## 内置的框架文件

正本就是本仓库里的文件，打包时直接内置。名单在 `app/src/framework/manifest.ts`：

- `.omt/AGENTS.md`
- `.omt/工作流/默认工作流.md`
- `.agents/skills/` 下的 grill-with-docs、grilling、domain-modeling

改了这些文件，要重新构建、重新部署网页，各业务项目再点一次「有更新」。

新模块只有被页面引用了才会进构建包。内置内容变了以后，跑 `npm run check:bundle` 确认生产包里真有这些内容。

## 构建

在 `app/` 下：

```bash
npm install
npm run dev        # 开发服务器
npm test           # 单元测试
npm run typecheck  # 类型检查
npm run build      # 构建静态产物到 app/dist
npm run check:bundle   # 确认构建包里有全部 10 个框架文件（先 build）
```

## 部署

镜像的构建上下文是仓库根，Dockerfile 在 `app/Dockerfile`：

```bash
docker build -f app/Dockerfile -t oh-my-task .
```

推送到 `master` 后，GitHub Actions 自动构建镜像并发布到 `ghcr.io/qq33357486/oh-my-task`（标签 `latest` 和提交号）。服务器拉取新镜像、换容器。镜像名跟着 GitHub 仓库名走：仓库不改名，镜像名也就保留 oh-my-task，不改。

## 来源

三个拷问技能（grill-with-docs、grilling、domain-modeling）来自 <https://github.com/mattpocock/skills>，MIT License，Copyright (c) 2026 Matt Pocock。其中 domain-modeling 有本地改动。

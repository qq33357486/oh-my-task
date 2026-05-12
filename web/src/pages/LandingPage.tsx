import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Code2,
  GitBranch,
  LayoutDashboard,
  LockKeyhole,
  Sparkles,
} from 'lucide-react'

const features = [
  {
    icon: GitBranch,
    title: '按项目和版本组织任务',
    description: '把需求、版本、主任务和子任务放在同一个工作区，适合个人项目和小团队节奏。',
  },
  {
    icon: CalendarClock,
    title: '自动排期更贴近真实交付',
    description: '任务可以设置预计天数，自动排期会跳过周末与节假日，减少手动推算。',
  },
  {
    icon: Bot,
    title: '为 AI Agent 准备的 MCP 工具',
    description: '通过 REST API 和 MCP Token，让 AI 助手直接创建、查询、推进和完成任务。',
  },
]

const steps = [
  '注册并创建你的第一个项目',
  '拆分版本、任务和子任务',
  '用 Web、API 或 MCP 接入日常工作流',
]

const stats = [
  { label: '统一入口', value: 'Web / API / MCP' },
  { label: '任务状态', value: '待办 / 进行中 / 完成' },
  { label: '部署方式', value: '公共服务 / Docker' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f8fb] text-[#111827]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-sky-300">
              <CheckCircle2 className="size-5" />
            </span>
            <span>oh-my-task</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-950">功能</a>
            <a href="#how-it-works" className="hover:text-slate-950">开始使用</a>
            <a href="#deploy" className="hover:text-slate-950">自托管</a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/qq33357486/oh-my-task"
              className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 sm:flex"
            >
              <Code2 className="size-4" />
              GitHub
            </a>
            <Link
              to="/app"
              className="hidden items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 sm:inline-flex"
            >
              开始使用
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-20">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
              <Sparkles className="size-4" />
              面向人和 AI Agent 的任务管理
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              <span className="block">把任务、版本、排期</span>
              <span className="block">和 AI 协作放在一个地方</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              oh-my-task 是一个轻量的任务管理与 AI 协作系统。你可以直接使用 task.duojie.games，也可以自托管，并通过 REST API / MCP 接入自己的 AI 工作流。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
              >
                免费开始
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="https://github.com/qq33357486/oh-my-task"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <Code2 className="size-4" />
                查看源码
              </a>
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {stats.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex min-w-0 items-center">
            <div className="absolute -left-6 top-8 hidden h-28 w-28 rounded-full bg-sky-200/60 blur-3xl lg:block" />
            <div className="absolute -bottom-4 right-4 hidden h-32 w-32 rounded-full bg-emerald-200/60 blur-3xl lg:block" />
            <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/12">
              <img
                src="/marketing/app-overview.svg"
                alt="oh-my-task 任务工作区截图"
                className="aspect-[16/10] w-full rounded-xl object-cover"
              />
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-sky-700">核心能力</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">从计划到执行，给 AI 一个清晰任务空间</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm">
                    <feature.icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{feature.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold text-sky-700">三步开始</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">直接使用公共服务，也能随时切到自托管</h2>
            <div className="mt-8 space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/8">
            <img
              src="/marketing/mcp-settings.svg"
              alt="oh-my-task MCP 配置截图"
              className="aspect-[16/10] w-full rounded-xl object-cover"
            />
          </div>
        </section>

        <section id="deploy" className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold text-sky-300">公共服务 + 开源自托管</p>
              <h2 className="mt-3 text-3xl font-semibold">你可以立刻使用，也可以掌控自己的数据</h2>
              <p className="mt-5 leading-7 text-slate-300">
                公共站点适合快速开始；Docker 镜像适合个人服务器、团队内网和长期项目。Web、REST API 和 MCP 共用同一个服务入口。
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
                <LockKeyhole className="size-4" />
                Docker 快速启动
              </div>
              <pre className="overflow-x-auto rounded-xl bg-black/45 p-4 text-sm leading-7 text-slate-100"><code>{`docker run -d --name oh-my-task \\
  -p 17173:17173 \\
  -v oh-my-task-data:/app/data \\
  ghcr.io/qq33357486/oh-my-task:latest`}</code></pre>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                <LayoutDashboard className="size-4" />
                task.duojie.games
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">现在就把任务空间建起来</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                创建账号
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                登录已有账号
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

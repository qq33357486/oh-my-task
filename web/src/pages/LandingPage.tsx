import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { cn } from '@/lib/utils'

const features = [
  {
    icon: GitBranch,
    title: '面向个人的任务空间',
    description: '每个人管理自己的项目、版本、主任务和子任务。它不是团队协作套件，团队能力需要按自己的流程二次扩展。',
  },
  {
    icon: Bot,
    title: 'AI + MCP 是核心入口',
    description: '任务创建、查询、推进和完成优先通过 AI 对话完成，再由 MCP 工具把操作落到系统里。',
  },
  {
    icon: CalendarClock,
    title: '网页用于查看和校准',
    description: 'Web 界面用于看清当前任务、版本状态和 Token 配置，不把拖拽操作当作主要工作流。',
  },
]

const stats = [
  { label: '使用对象', value: '个人任务 / 个人项目' },
  { label: '核心入口', value: 'AI 对话 / MCP' },
  { label: '网页定位', value: '查看 / 配置' },
]

const flowSteps = [
  { title: '告诉 AI 目标', caption: '用自然语言描述要做什么' },
  { title: 'AI 拆成任务', caption: '生成项目、版本和子任务' },
  { title: 'MCP 写入系统', caption: '把对话结果落到任务库' },
  { title: '持续推进', caption: '开始、完成、排期都可对话' },
  { title: '网页查看状态', caption: '随时校准当前进度' },
]

const storySteps = [
  {
    eyebrow: '01 / Personal',
    title: '先建立你的个人任务空间',
    description: '每个账号对应自己的任务视角，适合个人项目、个人工作流和 AI 辅助开发节奏。',
    highlight: '个人项目：官网推广与公共服务',
  },
  {
    eyebrow: '02 / Conversation',
    title: '把网页操作变成 AI 对话',
    description: '不需要把任务管理变成拖拽和表单维护。你告诉 AI 当前进展，AI 通过 MCP 更新任务。',
    highlight: '对话：开始做登录页 / 这个任务完成了',
  },
  {
    eyebrow: '03 / Web',
    title: '网页负责把状态展示清楚',
    description: 'Web 是辅助面板：查看版本、任务流、排期和 MCP 配置。真正的管理动作交给 AI 完成。',
    highlight: 'Web：任务流 / 版本进度 / Token 配置',
  },
]

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(element)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.18 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('omt-reveal', isVisible && 'is-visible', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function AnimatedWorkflow() {
  const ref = useRef<HTMLElement | null>(null)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let timer: number | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        let next = 0
        setActiveStep(0)
        timer = window.setInterval(() => {
          next += 1
          setActiveStep(next)
          if (next >= flowSteps.length - 1 && timer) {
            window.clearInterval(timer)
          }
        }, 360)
        observer.unobserve(element)
      },
      { threshold: 0.35 },
    )

    observer.observe(element)
    return () => {
      observer.disconnect()
      if (timer) window.clearInterval(timer)
    }
  }, [])

  return (
    <section ref={ref} id="workflow" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-sky-700">动态流程</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
            从一句对话到任务落库，个人任务流持续点亮
          </h2>
          <p className="mt-4 leading-7 text-slate-600">
            页面滚动到这里时，流程节点会逐步激活，展示你如何通过 AI 对话管理个人任务，而不是在网页里反复拖拽维护。
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-5">
          {flowSteps.map((step, index) => {
            const isActive = index <= activeStep
            return (
              <div key={step.title} className="relative">
                {index > 0 && (
                  <div
                    className={cn(
                      'flow-connector left-0 top-10 hidden md:block',
                      isActive && 'is-active',
                    )}
                  />
                )}
                <div
                  className={cn(
                    'flow-node relative z-10 rounded-2xl border bg-slate-50 p-5 transition-all duration-500',
                    isActive
                      ? 'border-sky-300 bg-white shadow-xl shadow-sky-100'
                      : 'border-slate-200 shadow-sm',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-10 items-center justify-center rounded-xl text-sm font-bold transition-colors',
                      isActive ? 'bg-slate-950 text-white' : 'bg-white text-slate-500',
                    )}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.caption}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function StoryCard({
  step,
  index,
}: {
  step: (typeof storySteps)[number]
  index: number
}) {
  return (
    <Reveal delay={index * 80}>
      <article className="story-card group rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-sky-700">{step.eyebrow}</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Step {index + 1}
          </span>
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-slate-950">{step.title}</h3>
        <p className="mt-3 leading-7 text-slate-600">{step.description}</p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
          <div className="mb-4 flex gap-2">
            <span className="size-2 rounded-full bg-rose-300" />
            <span className="size-2 rounded-full bg-amber-300" />
            <span className="size-2 rounded-full bg-emerald-300" />
          </div>
          <div className="space-y-3">
            <div className="h-3 w-1/2 rounded-full bg-white/18" />
            <div className="story-highlight rounded-xl border border-sky-300/30 bg-sky-300/10 p-3 text-sm font-medium text-sky-100">
              {step.highlight}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 rounded-xl bg-white/10" />
              <div className="h-16 rounded-xl bg-white/10" />
              <div className="h-16 rounded-xl bg-white/10" />
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f8fb] text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-sky-300">
              <CheckCircle2 className="size-5" />
            </span>
            <span>oh-my-task</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-950">功能</a>
            <a href="#workflow" className="hover:text-slate-950">流程</a>
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
        <section className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-24">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_70%_20%,rgba(125,211,252,0.24),transparent_34%),radial-gradient(circle_at_35%_45%,rgba(16,185,129,0.14),transparent_32%)]" />
          <div className="relative flex min-w-0 flex-col justify-center">
            <Reveal delay={40}>
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
                <Sparkles className="size-4" />
                面向个人的 AI 任务管理器
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
                <span className="block">用 AI 对话</span>
                <span className="block">管理你的个人任务</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                oh-my-task 是一个面向个人的任务管理器。核心不是在网页上拖拽卡片，而是通过 AI + MCP 创建、查询、推进和完成任务；网页则用于查看当前状态与配置接入。
              </p>
            </Reveal>
            <Reveal delay={280}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl"
                >
                  免费开始
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href="https://github.com/qq33357486/oh-my-task"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50"
                >
                  <Code2 className="size-4" />
                  查看源码
                </a>
              </div>
            </Reveal>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {stats.map((item, index) => (
                <Reveal key={item.label} delay={340 + index * 70}>
                  <div className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg">
                    <p className="text-xs font-medium text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{item.value}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={180} className="relative flex min-w-0 items-center">
            <div className="absolute -left-6 top-8 hidden h-28 w-28 rounded-full bg-sky-200/60 blur-3xl lg:block" />
            <div className="absolute -bottom-4 right-4 hidden h-32 w-32 rounded-full bg-emerald-200/60 blur-3xl lg:block" />
            <div className="hero-shot relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/12">
              <img
                src="/marketing/app-overview.svg"
                alt="oh-my-task 任务工作区截图"
                className="aspect-[16/10] w-full rounded-xl object-cover"
              />
            </div>
          </Reveal>
        </section>

        <section id="features" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold text-sky-700">核心能力</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">个人管理为主，AI 交互为核心</h2>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {features.map((feature, index) => (
                <Reveal key={feature.title} delay={index * 90}>
                  <article className="group rounded-2xl border border-slate-200 bg-slate-50 p-6 transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:bg-white hover:shadow-xl hover:shadow-sky-100">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm transition group-hover:scale-105 group-hover:bg-sky-50">
                      <feature.icon className="size-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-slate-950">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <AnimatedWorkflow />

        <section id="how-it-works" className="bg-[#f6f8fb]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Reveal>
                <p className="text-sm font-semibold text-sky-700">滚动叙事</p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                  像产品发布页一样，把使用路径讲清楚
                </h2>
                <p className="mt-5 leading-7 text-slate-600">
                  向下滚动时，每一张状态卡都会浮现并高亮关键区域，展示 oh-my-task 如何把个人任务管理从网页操作转向 AI 对话。
                </p>
                <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/8">
                  <img
                    src="/marketing/mcp-settings.svg"
                    alt="oh-my-task MCP 配置截图"
                    className="aspect-[16/10] w-full rounded-xl object-cover"
                  />
                </div>
              </Reveal>
            </div>
            <div className="space-y-6 lg:space-y-10">
              {storySteps.map((step, index) => (
                <StoryCard key={step.title} step={step} index={index} />
              ))}
            </div>
          </div>
        </section>

        <section id="deploy" className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <Reveal>
              <div>
                <p className="text-sm font-semibold text-sky-300">公共服务 + 开源自托管</p>
                <h2 className="mt-3 text-3xl font-semibold">先按个人工作流使用，再按需要扩展</h2>
                <p className="mt-5 leading-7 text-slate-300">
                  公共站点适合快速开始；Docker 镜像适合个人服务器和长期项目。如果你需要团队协作、权限流转或组织级流程，可以基于开源版本自行修改。
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-2xl border border-white/10 bg-white/6 p-5 shadow-2xl shadow-sky-950/20">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <LockKeyhole className="size-4" />
                  Docker 快速启动
                </div>
                <pre className="overflow-x-auto rounded-xl bg-black/45 p-4 text-sm leading-7 text-slate-100"><code>{`docker run -d --name oh-my-task \\
  -p 17173:17173 \\
  -v oh-my-task-data:/app/data \\
  ghcr.io/qq33357486/oh-my-task:latest`}</code></pre>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-white">
          <Reveal>
            <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                  <LayoutDashboard className="size-4" />
                  task.duojie.games
                </div>
                <h2 className="mt-3 text-3xl font-semibold text-slate-950">现在就把个人任务空间建起来</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  创建账号
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  登录已有账号
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  )
}

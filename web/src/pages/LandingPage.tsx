import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Code2,
  Copy,
  GitBranch,
  LayoutDashboard,
  LockKeyhole,
  Sparkles,
  Trophy,
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

const guideSteps = [
  {
    group: '基础流程',
    title: '创建版本草稿',
    description: '先告诉 AI 你要做一个什么阶段，AI 会创建版本草稿，后续任务都归到这个版本里。',
    prompts: ['创建版本 v1.0：个人博客改版', '帮我为「官网推广」创建一个版本草稿'],
    tools: ['create_version'],
    result: 'Web 上出现一个未开始的版本，后续可以继续补任务。',
  },
  {
    group: '基础流程',
    title: '拆分任务',
    description: '用自然语言列出目标，AI 会把它拆成主任务和子任务，不需要你在网页里手动拖拽整理。',
    prompts: ['在 v1.0 下创建任务：设计首页、接入登录、整理 README', '把「登录功能」拆成表单、接口、错误提示三个子任务'],
    tools: ['create_task', 'list_tasks'],
    result: '任务流里能看到主任务、子任务和预计工作量。',
  },
  {
    group: '基础流程',
    title: '自动排期并开始',
    description: '任务准备好后，让 AI 排期。确认后再开始版本，版本会从草稿进入正式执行。',
    prompts: ['给 v1.0 的任务自动排期，从下周一开始', '确认开始 v1.0，帮我启动这个版本'],
    tools: ['auto_schedule', 'start_version'],
    result: 'Web 上显示版本开始日期、预计截止日期和任务时间线。',
  },
  {
    group: '中间维护',
    title: '插入临时任务',
    description: '版本已经开始后新增任务，会被标记为插队任务，用来记录临时需求或紧急修复。',
    prompts: ['插入一个临时任务：修复登录按钮在手机上的样式', '给当前版本加一个插队任务：补充部署说明'],
    tools: ['create_task', 'auto_schedule'],
    result: '任务会带有插队标记，必要时可以重新排期。',
  },
  {
    group: '中间维护',
    title: '删除或调整任务',
    description: '任务不再需要时，直接告诉 AI 删除。之后可以让 AI 重新列出任务，确认当前状态。',
    prompts: ['删除「旧版首页截图」这个任务', '列出当前版本还没完成的任务'],
    tools: ['delete_task', 'list_tasks'],
    result: 'Web 上任务列表更新，已删除任务不会继续影响当前任务流。',
  },
  {
    group: '结项流程',
    title: '完成任务和版本',
    description: '任务完成后告诉 AI。全部任务结束时，再让 AI 完成版本，并准备下一个版本。',
    prompts: ['「登录功能」做完了，帮我标记完成', '当前版本全部完成，结束 v1.0，并创建 v1.1 草稿'],
    tools: ['complete_task', 'complete_version', 'create_version'],
    result: '版本进入完成状态；你可以归档旧版本，继续规划下一阶段。',
  },
]

const ACHIEVEMENT_STORAGE_KEY = 'oh-my-task-landing-achievement-seen'

function readAchievementSeen() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(ACHIEVEMENT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markAchievementSeen() {
  try {
    window.localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, 'true')
  } catch {
    // 成就提示只是演示反馈，存储失败时不影响页面使用。
  }
}

const confettiPieces = [
  { left: '12%', top: '44%', x: '-64px', y: '-42px', color: '#22c55e', delay: '0ms' },
  { left: '22%', top: '28%', x: '-38px', y: '-74px', color: '#38bdf8', delay: '30ms' },
  { left: '36%', top: '18%', x: '-12px', y: '-88px', color: '#facc15', delay: '60ms' },
  { left: '50%', top: '16%', x: '18px', y: '-82px', color: '#a78bfa', delay: '90ms' },
  { left: '64%', top: '22%', x: '44px', y: '-70px', color: '#fb7185', delay: '120ms' },
  { left: '78%', top: '38%', x: '68px', y: '-46px', color: '#34d399', delay: '150ms' },
  { left: '18%', top: '66%', x: '-54px', y: '34px', color: '#60a5fa', delay: '180ms' },
  { left: '38%', top: '74%', x: '-18px', y: '52px', color: '#f97316', delay: '210ms' },
  { left: '58%', top: '72%', x: '24px', y: '48px', color: '#bef264', delay: '240ms' },
  { left: '82%', top: '60%', x: '62px', y: '28px', color: '#f472b6', delay: '270ms' },
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
          <h2 className="mt-3 break-all text-3xl font-semibold text-slate-950 sm:break-words sm:text-4xl">
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

function UsageGuide() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [hasSeenAchievement, setHasSeenAchievement] = useState(readAchievementSeen)
  const [showAchievement, setShowAchievement] = useState(false)
  const achievementTimerRef = useRef<number | undefined>(undefined)
  const hideAchievementTimerRef = useRef<number | undefined>(undefined)
  const activeStep = guideSteps[activeIndex]
  const groups = [...new Set(guideSteps.map((step) => step.group))]
  const progress = ((activeIndex + 1) / guideSteps.length) * 100

  useEffect(() => {
    return () => {
      if (achievementTimerRef.current) window.clearTimeout(achievementTimerRef.current)
      if (hideAchievementTimerRef.current) window.clearTimeout(hideAchievementTimerRef.current)
    }
  }, [])

  const triggerAchievement = () => {
    if (hasSeenAchievement) return

    if (achievementTimerRef.current) window.clearTimeout(achievementTimerRef.current)
    if (hideAchievementTimerRef.current) window.clearTimeout(hideAchievementTimerRef.current)

    achievementTimerRef.current = window.setTimeout(() => {
      markAchievementSeen()
      setHasSeenAchievement(true)
      setShowAchievement(true)

      hideAchievementTimerRef.current = window.setTimeout(() => {
        setShowAchievement(false)
      }, 5000)
    }, 2000)
  }

  const handleSelectStep = (index: number) => {
    setActiveIndex(index)

    if (index === guideSteps.length - 1) {
      triggerAchievement()
      return
    }

    if (achievementTimerRef.current) {
      window.clearTimeout(achievementTimerRef.current)
      achievementTimerRef.current = undefined
    }
  }

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard?.writeText(prompt)
    } catch {
      // 复制只是辅助能力，失败时不影响教程阅读。
    }
  }

  return (
    <section id="how-it-works" className="bg-[#f6f8fb]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
            <div className="border-b border-slate-200 bg-gradient-to-br from-white via-sky-50/45 to-emerald-50/35 p-5 sm:p-7">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold text-sky-700">开始使用</p>
                  <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                    用 5 分钟学会通过 AI 管理任务
                  </h2>
                  <p className="mt-4 leading-7 text-slate-600">
                    这是一份可以照着操作的页面内教程。选择一个步骤，复制提示词到支持 MCP 的 AI 工具里；AI 负责调用工具推进任务，网页负责展示当前状态。
                  </p>
                </div>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-500">学习进度</span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
                      {activeIndex + 1} / {guideSteps.length}
                    </span>
                  </div>
                  <div className="mt-4 h-2 w-56 max-w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-950 transition-all duration-500"
                      style={{ width: progress + '%' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid min-h-[620px] lg:grid-cols-[0.95fr_1.05fr]">
              <aside className="min-w-0 border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <div className="flex flex-wrap gap-2">
                  {groups.map((group) => {
                    const firstIndex = guideSteps.findIndex((step) => step.group === group)
                    const isActive = activeStep.group === group
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => handleSelectStep(firstIndex)}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-sm font-semibold transition',
                          isActive
                            ? 'bg-slate-950 text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100',
                        )}
                      >
                        {group}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 grid gap-2">
                  {guideSteps.map((step, index) => (
                    <button
                      key={`${step.group}-${step.title}`}
                      type="button"
                      onClick={() => handleSelectStep(index)}
                      className={cn(
                        'guide-step-card grid min-w-0 grid-cols-[auto_1fr] gap-3 rounded-2xl border p-4 text-left transition',
                        index === activeIndex
                          ? 'border-sky-300 bg-white shadow-lg shadow-sky-100'
                          : 'border-slate-200 bg-white/65 hover:border-slate-300 hover:bg-white',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          index === activeIndex ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-sky-700">{step.group}</span>
                        <span className="mt-1 block text-base font-semibold text-slate-950">{step.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-slate-600">{step.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              <article className="flex min-w-0 flex-col bg-white p-4 sm:p-5">
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white">
                  <div className="border-b border-white/10 bg-white/5 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-sky-300">{activeStep.group}</p>
                        <h3 className="mt-1 text-2xl font-semibold">{activeStep.title}</h3>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">
                        Step {activeIndex + 1}
                      </span>
                    </div>
                    <p className="mt-3 leading-7 text-slate-300">{activeStep.description}</p>
                  </div>

                  <div className="grid flex-1 gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="min-w-0 p-5">
                      <p className="text-sm font-semibold text-slate-300">可以直接复制的提示词</p>
                      <div className="mt-3 space-y-3">
                        {activeStep.prompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => copyPrompt(prompt)}
                            className="group flex w-full min-w-0 items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 p-4 text-left transition hover:border-sky-300/50 hover:bg-sky-300/10"
                          >
                            <span className="min-w-0 text-sm leading-6 text-slate-100">{prompt}</span>
                            <Copy className="mt-1 size-4 shrink-0 text-slate-400 transition group-hover:text-sky-200" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0 border-t border-white/10 p-5 lg:border-l lg:border-t-0">
                      <p className="text-sm font-semibold text-slate-300">AI 会调用的 MCP 工具</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeStep.tools.map((tool) => (
                          <code key={tool} className="rounded-full bg-sky-300/12 px-3 py-1 text-sm text-sky-100">
                            {tool}
                          </code>
                        ))}
                      </div>
                      <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                        <p className="text-sm font-semibold text-emerald-100">网页上能看到</p>
                        <p className="mt-2 text-sm leading-6 text-emerald-50/90">{activeStep.result}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 bg-white/5 p-4">
                    <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white/6 p-3">
                        <span className="font-semibold text-white">1. 对 AI 说</span>
                        <p className="mt-1 leading-6">用自然语言描述目标。</p>
                      </div>
                      <div className="rounded-2xl bg-white/6 p-3">
                        <span className="font-semibold text-white">2. MCP 执行</span>
                        <p className="mt-1 leading-6">AI 调工具写入任务系统。</p>
                      </div>
                      <div className="rounded-2xl bg-white/6 p-3">
                        <span className="font-semibold text-white">3. 网页查看</span>
                        <p className="mt-1 leading-6">回到网页确认状态变化。</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </Reveal>
        {showAchievement && (
          <div className="achievement-toast" role="status" aria-live="polite">
            <div className="achievement-confetti" aria-hidden="true">
              {confettiPieces.map((piece, index) => (
                <span
                  key={`${piece.left}-${piece.top}-${index}`}
                  style={{
                    left: piece.left,
                    top: piece.top,
                    '--confetti-x': piece.x,
                    '--confetti-y': piece.y,
                    '--confetti-color': piece.color,
                    animationDelay: piece.delay,
                  } as CSSProperties}
                />
              ))}
            </div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/35">
                <Trophy className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  成就已解锁
                </p>
                <p className="mt-1 text-lg font-semibold text-white">个人任务流入门</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  你已经学会用 AI + MCP 完成一次任务闭环。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default function LandingPage() {
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace('#', '')
      if (!id) return
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ block: 'start' })
      }, 0)
    }

    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)
    return () => window.removeEventListener('hashchange', scrollToHash)
  }, [])

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-[#f6f8fb] text-[#111827]">
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
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
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
              <h2 className="mt-3 break-all text-3xl font-semibold text-slate-950 sm:break-words">个人管理为主，AI 交互为核心</h2>
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

        <UsageGuide />

        <section id="deploy" className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <Reveal>
              <div>
                <p className="text-sm font-semibold text-sky-300">公共服务 + 开源自托管</p>
                <h2 className="mt-3 break-all text-3xl font-semibold sm:break-words">先按个人工作流使用，再按需要扩展</h2>
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
                <h2 className="mt-3 break-all text-3xl font-semibold text-slate-950 sm:break-words">现在就把个人任务空间建起来</h2>
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

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

/**
 * 绝区零式 MG 路由转场：覆盖 → 换页 → 揭开。
 * 样式见同目录 ribbon-transition.css，原生 JS 参考实现见 demo.html。
 *
 * 与框架解耦：不 import 任何路由库。调用方通过 `swap` 回调自己完成换页，
 * 返回的 Promise 在新页面 commit 后 resolve（超时会自行放行）。
 *
 *   <RibbonProvider>          // 放在应用根部，遮罩根节点从此常驻 body
 *     <App />
 *   </RibbonProvider>
 *
 *   const { transitionTo, running } = useRibbon()
 *   transitionTo({
 *     card: { word: "DANMAKU", jp: "弾幕の壁", cn: "弹幕墙", no: "02", mark: "△" },
 *     dir: "next",
 *     swap: async () => { router.push("/live") },
 *   })
 *
 * 【为什么换页由 animationend 驱动而不是定时器】
 * 主线程繁忙时（连续快滑、新页面正在水合）CSS 动画的实际起跑会晚于 JS 定时器。
 * 定时器准点换页会在屏幕还没遮严时露出换页瞬间 → 概率性闪屏，安卓最明显。
 * 定时器只作 animationend 丢失（切后台等）的兜底，且必须带代际校验。
 */

/* ── 时序常量（ms）──────────────────────────────────────────────────────
 * ⚠️ COVER_MS / REVEAL_MS 与 CSS 强绑定：三层扫屏 = 单层 0.28s +
 * 级联延迟 0/0.06/0.12s，末层结束即 0.4s。改 CSS 必须同步这里。 */
const COVER_MS = 400
const COVER_FALLBACK_MS = COVER_MS + 500
/** 满屏后最短停留。注意它从「满屏」起算，而装饰动画的 delay 从「挂载」起算，
 *  所以留给装饰的总预算是 COVER_MS + MIN_HOLD_MS ≈ 0.84s，不是 440ms。 */
const MIN_HOLD_MS = 440
const REVEAL_MS = 400
const REVEAL_FALLBACK_MS = REVEAL_MS + 500
/** 等 swap() 的上限。低端安卓上重页面 commit 可超 1s，放宽避免揭开时
 *  露出「换到一半」的旧页面；遮罩上动画常驻，多停留不显卡死。 */
const COMMIT_TIMEOUT_MS = 1500

/* ── 每页文案卡 ────────────────────────────────────────────────────────── */
export interface RibbonCard {
  /** 英文主标题，同时出现在标题卡、巨字行、绶带里 */
  word: string
  /** 日文副标签 */
  jp: string
  /** 中文副标签 */
  cn: string
  /** 右上角编号。传 "EX" 会隐藏 "/ NN" 后缀 */
  no: string
  /** 水印符号，也混进绶带与巨字行 */
  mark: string
  /** 角标里 "NN / total" 的分母，默认 "04" */
  total?: string
}

export type RibbonDirection = "next" | "prev"

export interface TransitionRequest {
  card: RibbonCard
  /** next = 去下一页（从右扫入、向左扫出），prev 镜像 */
  dir: RibbonDirection
  /** 在遮罩背后执行真正的换页。resolve 表示新页面已 commit；
   *  不 resolve 也没关系，COMMIT_TIMEOUT_MS 后自行放行 */
  swap: () => void | Promise<void>
}

const THEMES = ["pink", "purple", "green", "yellow"] as const
export type RibbonTheme = (typeof THEMES)[number]

/** 主板上的巨型文字行数与速度线条数，与 CSS 的 .ptr-row-N / .ptr-streak-N 对应 */
const ROW_COUNT = 6
const STREAK_COUNT = 6

/** 安卓/鸿蒙判定。⚠️ 模块级同步取值 —— 要在首次渲染遮罩时就决定渲染分支，
 *  放进 effect 会先渲一帧完整版再切降级版，而那一帧正是最容易花屏的一帧。 */
export const isAndroidLike =
  typeof navigator !== "undefined" && /android|harmony/i.test(navigator.userAgent)

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

interface ActiveState {
  dir: RibbonDirection
  /** idle = 揭开完毕后的「已隐藏待卸载」态：层已全部扫出屏外，
   *  根节点先藏起来，内容的真正卸载推迟到冷却期中段 */
  phase: "cover" | "reveal" | "idle"
  card: RibbonCard
  theme: RibbonTheme
}

interface RibbonContextValue {
  transitionTo: (req: TransitionRequest) => void
  /** 转场进行中（含冷却）。调用方可据此禁用交互 */
  running: boolean
}

const RibbonContext = createContext<RibbonContextValue | null>(null)

export function useRibbon(): RibbonContextValue {
  const ctx = useContext(RibbonContext)
  if (!ctx) throw new Error("useRibbon 必须在 <RibbonProvider> 内使用")
  return ctx
}

export function RibbonProvider({
  children,
  /** 转场结束后的冷却，期内的新触发静默忽略（不排队 —— 排队会让用户
   *  连点三下后看着三段转场依次播完，比丢掉更糟）。
   *  安卓 WebView 合成器回收慢，默认拉长。 */
  cooldownMs = isAndroidLike ? 480 : 260,
  /** 揭开后先只隐藏，真正卸载推迟这么久 —— 不和揭开收尾/新页安顿抢同一批帧 */
  teardownMs = 180,
  /** 强制走安卓精简渲染（调试用） */
  forceAndroid = false,
}: {
  children?: ReactNode
  cooldownMs?: number
  teardownMs?: number
  forceAndroid?: boolean
}) {
  const android = forceAndroid || isAndroidLike

  const [active, setActive] = useState<ActiveState | null>(null)
  const [running, setRunning] = useState(false)
  /** portal 需要 document，等客户端挂载后才渲染 */
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  /** 安卓专用：装饰分两波错峰挂载（0 = 未挂，1 = 轻装饰，2 = 全量）。
   *  巨型文字行/水印是遮罩里最重的纹理来源，和绶带/标题一起挂会在同一批帧
   *  打出光栅化高峰 → 瓦片缺失花屏。非安卓恒为 2。 */
  const [decorStage, setDecorStage] = useState(0)

  const runningRef = useRef(false)
  /** 各阶段只执行一次（animationend 与兜底定时器谁先到谁推进） */
  const coveredRef = useRef(false)
  const revealedRef = useRef(false)
  /** 转场代际：兜底定时器可能比「动画正常结束 + 冷却」更晚触发，
   *  过期定时器若打进下一次转场会把新覆盖层中途卸载，按代际作废 */
  const genRef = useRef(0)
  const lastThemeRef = useRef<RibbonTheme | null>(null)
  const swapRef = useRef<TransitionRequest["swap"] | null>(null)
  const timersRef = useRef<number[]>([])

  const pushTimer = (id: number) => {
    timersRef.current.push(id)
  }

  /** 揭开收尾：先只隐藏（此刻所有层已扫出屏外，视觉零变化），
   *  图层树的真正卸载推迟到冷却期中段。 */
  const finishReveal = useCallback(() => {
    if (revealedRef.current || !runningRef.current) return
    revealedRef.current = true
    setActive((cur) => (cur ? { ...cur, phase: "idle" } : cur))
    pushTimer(window.setTimeout(() => setActive(null), teardownMs))
    pushTimer(
      window.setTimeout(() => {
        runningRef.current = false
        setRunning(false)
      }, cooldownMs),
    )
  }, [cooldownMs, teardownMs])

  /** 满屏后：换页 → 等「swap + 最短停留」→ 双 rAF 等首绘 → 进入揭开 */
  const proceedCover = useCallback(() => {
    if (coveredRef.current || !runningRef.current) return
    coveredRef.current = true

    const swap = swapRef.current
    const swapped = new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      // 超时兜底：慢网/异常时不至于卡死转场
      pushTimer(window.setTimeout(finish, COMMIT_TIMEOUT_MS))
      try {
        const r = swap?.()
        if (r && typeof (r as Promise<void>).then === "function") {
          void (r as Promise<void>).then(finish, finish)
        } else {
          finish()
        }
      } catch {
        finish()
      }
    })
    const held = new Promise<void>((resolve) => {
      pushTimer(window.setTimeout(resolve, MIN_HOLD_MS))
    })

    const gen = genRef.current
    void Promise.all([swapped, held]).then(() => {
      // 再等两帧，让新页面在遮罩背后完成首绘，避免揭开时露出未绘制的底
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (gen !== genRef.current) return
          setActive((cur) => (cur ? { ...cur, phase: "reveal" } : cur))
          pushTimer(
            window.setTimeout(() => {
              if (gen === genRef.current) finishReveal()
            }, REVEAL_FALLBACK_MS),
          )
        }),
      )
    })
  }, [finishReveal])

  const transitionTo = useCallback(
    (req: TransitionRequest) => {
      // 偏好减少动效 / 页面不可见 → 不播转场，直接换页
      if (prefersReducedMotion() || document.visibilityState === "hidden") {
        void req.swap()
        return
      }
      if (runningRef.current) return
      runningRef.current = true
      setRunning(true)
      coveredRef.current = false
      revealedRef.current = false
      swapRef.current = req.swap
      const gen = ++genRef.current

      // 安卓先把装饰压住，和 setActive 同批提交 → 遮罩首帧只挂 3 层扫屏（轻）
      if (android) setDecorStage(0)

      const pool = THEMES.filter((t) => t !== lastThemeRef.current)
      const theme = pool[Math.floor(Math.random() * pool.length)]
      lastThemeRef.current = theme

      setActive({ dir: req.dir, phase: "cover", card: req.card, theme })
      pushTimer(
        window.setTimeout(() => {
          if (gen === genRef.current) proceedCover()
        }, COVER_FALLBACK_MS),
      )
    },
    [android, proceedCover],
  )

  /** 安卓装饰错峰：第一波（+2 帧）绶带/标题/角标，第二波（再 ~110ms）
   *  巨型文字行 + 水印。此刻主板还在盖屏途中（0.4s 才盖严），光栅化高峰
   *  被摊进扫入过程。
   *  ⚠️ 必须带 phase === "cover" 守卫：active 每次 phase 切换都换新引用，
   *     不加守卫 reveal 阶段会重跑并把 stage 打回 1 → 重装饰中途卸载。 */
  useEffect(() => {
    if (!active || active.phase !== "cover" || !android) return
    let r2 = 0
    let t = 0
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setDecorStage(1)
        t = window.setTimeout(() => setDecorStage(2), 110)
      })
    })
    return () => {
      cancelAnimationFrame(r1)
      if (r2) cancelAnimationFrame(r2)
      if (t) clearTimeout(t)
    }
  }, [active, android])

  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((t) => clearTimeout(t))
  }, [])

  const ctxValue = useMemo(() => ({ transitionTo, running }), [transitionTo, running])

  return (
    <RibbonContext.Provider value={ctxValue}>
      {children}
      {mounted &&
        createPortal(
          <Overlay active={active} android={android} decorStage={decorStage} onCovered={proceedCover} onRevealed={finishReveal} />,
          document.body,
        )}
    </RibbonContext.Provider>
  )
}

function Overlay({
  active,
  android,
  decorStage,
  onCovered,
  onRevealed,
}: {
  active: ActiveState | null
  android: boolean
  decorStage: number
  onCovered: () => void
  onRevealed: () => void
}) {
  // 空闲态：根节点常驻但整层隐藏，内容不挂载 → 零渲染开销
  if (!active) {
    return <div className={`ptr-root ptr-idle${android ? " ptr-android" : ""}`} aria-hidden />
  }

  const { card, dir, phase, theme } = active
  const stage = android ? decorStage : 2
  const showDecor = stage >= 1
  const showHeavyDecor = stage >= 2

  /** 转场存活 <1.3s，滚动跑不完一圈，只需够铺满首屏 + 这点位移即可。
   *  安卓用较短重复串（省布局开销）；大字行重复数要盖住行宽
   *  （安卓下行收窄到 288vw），太短会在左滑行的右端露出空档。 */
  const phraseRepeat = android ? 6 : 14
  const bigRepeat = android ? 5 : 12
  const bandRepeat = android ? 5 : 10

  const phrase = `${card.word}  ${card.mark}  ${card.jp}  •  ${card.word}  ${card.mark}  ${card.cn}  •  `.repeat(phraseRepeat)
  const bigPhrase = `${card.word}  ${card.mark}  `.repeat(bigRepeat)
  const bandPhrase = `${card.mark}  ${card.word}  ★  ${card.no}  ◆  ${card.jp}  ✦  `.repeat(bandRepeat)

  /** 逐字砸入：字母 i 的延迟 = 0.3s + i*0.04s，单字时长 0.16s。
   *  --ptr-land = 末字落位时刻，RGB 残影闪 / 镂空回声盖章都从这一刻起跑。
   *  ⚠️ 这三个数值与 CSS 的 .ptr-letter 动画参数强同步，改动须两边一起。 */
  const letters = Array.from(card.word)
  const landDelay = 0.3 + (letters.length - 1) * 0.04 + 0.16

  return (
    <div
      className={`ptr-root ptr-theme-${theme}${android ? " ptr-android" : ""}${phase === "idle" ? " ptr-idle" : ""}`}
      data-phase={phase}
      style={{ "--ptr-x": dir === "next" ? 1 : -1 } as CSSProperties}
      aria-hidden
    >
      {/* 三层交错扫屏：DOM 顺序即叠放顺序。
          粉层扫出最晚结束（0.12s delay）= 整组揭开完成 */}
      <div
        className="ptr-wipe ptr-wipe-a"
        onAnimationEnd={(e) => {
          if (e.animationName === "ptr-wipe-out") onRevealed()
        }}
      >
        <div className="ptr-wipe-fill" />
      </div>
      <div className="ptr-wipe ptr-wipe-b">
        <div className="ptr-wipe-fill" />
      </div>
      {/* 黑主板扫入最晚结束（0.12s delay）= 屏幕真正遮严，此刻才换页。
          ⚠️ 子元素动画（标题弹入等）会冒泡上来，必须按 animationName 过滤 */}
      <div
        className="ptr-wipe ptr-wipe-main"
        onAnimationEnd={(e) => {
          if (e.animationName === "ptr-wipe-in") onCovered()
        }}
      >
        <div className="ptr-panel">
          {showDecor && (
            <>
              <div className="ptr-halftone" />
              <div className="ptr-band ptr-band-1">
                <span className="ptr-band-text">{bandPhrase}</span>
              </div>
              <div className="ptr-band ptr-band-2">
                <span className="ptr-band-text">{bandPhrase}</span>
              </div>
              <div className="ptr-band ptr-band-3">
                <span className="ptr-band-text">{bandPhrase}</span>
              </div>
              {/* 巨型文字行 = 遮罩最重的文字纹理，安卓第二波才挂（带淡入） */}
              {showHeavyDecor && (
                <div className="ptr-rows">
                  {Array.from({ length: ROW_COUNT }, (_, i) => i + 1).map((n) => (
                    <div key={n} className={`ptr-row ptr-row-${n}`}>
                      <span>{n % 2 === 1 ? bigPhrase : phrase}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="ptr-scanlines" />
            </>
          )}
        </div>

        {/* 以下元素不进 .ptr-panel：避开 skew（否则字形变形），直接乘主板的平移 */}
        {showHeavyDecor && <div className="ptr-mark">{card.mark}</div>}
        {showDecor && (
          <>
            <div className="ptr-title" style={{ "--ptr-land": `${landDelay}s` } as CSSProperties}>
              <div className="ptr-title-word">
                {/* DOM 顺序即叠放：回声/残影垫底，实心主字最后绘制盖在中间 */}
                <span className="ptr-title-echo">{card.word}</span>
                <span className="ptr-title-ghost ptr-title-ghost-c">{card.word}</span>
                <span className="ptr-title-ghost ptr-title-ghost-m">{card.word}</span>
                <span className="ptr-title-main">
                  {letters.map((ch, i) => (
                    <span key={i} className="ptr-letter" style={{ "--ptr-i": i } as CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
              </div>
              <div className="ptr-title-hazard" />
              <div className="ptr-title-chip">
                <span>{card.jp}</span>
                <i />
                <span>{card.cn}</span>
              </div>
            </div>
            <div className="ptr-corner-no">
              {card.no}
              {card.no !== "EX" && <em>/ {card.total ?? "04"}</em>}
            </div>
            <div className="ptr-corner-loading">NOW LOADING ▸▸▸</div>
            <div className="ptr-edge ptr-edge-left" />
            <div className="ptr-edge ptr-edge-right" />
          </>
        )}
      </div>

      {/* 速度线：压在一切之上横飞。
          安卓上这是常驻无限动画的重灾区（6 条独立合成图层持续光栅化），
          连续快滑时最易引发鬼影/卡顿，故安卓整组不挂载。 */}
      {!android && (
        <div className="ptr-streaks">
          {Array.from({ length: STREAK_COUNT }, (_, i) => i + 1).map((n) => (
            <span key={n} className={`ptr-streak ptr-streak-${n}`} />
          ))}
        </div>
      )}

      {/* 满屏瞬间的冲击闪光（挂载后只跑一次，phase 切换不重启） */}
      <div className="ptr-flash" />
    </div>
  )
}

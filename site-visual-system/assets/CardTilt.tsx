"use client"

import { type MouseEvent, type ReactNode, useEffect, useRef } from "react"

/**
 * 卡片 3D 跟手倾斜包装层（glass-kit.css 第 6 节的 JS 驱动）。
 *
 * 鼠标在卡面上移动时整卡绕 X/Y 轴倾斜、投影反向偏移，封面图以不同速率随鼠标平移，
 * 视觉上图片与卡体「分层浮动」。零依赖，只需 React。
 *
 * 用法：
 *   <div className="card-shell">
 *     <CardTilt>
 *       <div className="glass-card">
 *         <div className="card-media"><img src="..." /></div>
 *         <div className="frosted-glass">标题等内容</div>
 *       </div>
 *       {/* 可选：主体越框弹出层，必须是 .glass-card 的兄弟 *\/}
 *       <div className="card-pop" style={{ aspectRatio: "3 / 4" }}>
 *         <img src="封面" style={{ maskImage: `url(${maskUrl})`, maskMode: "luminance" }} />
 *       </div>
 *     </CardTilt>
 *   </div>
 *
 * 实现约束（与 glass-kit.css 的注释呼应，别自作聪明简化）：
 * · 旋转不能挂 .glass-card：入场动画 `animation ... forwards` 会把它的 transform 钉死；
 *   也不能并入 .card-shell:hover：那里 0.45s 的缓动是为上浮/缩放准备的，
 *   跟手旋转需要 ~0.12s 快速跟随，节奏冲突。故插入本层独立承担 perspective + rotate。
 * · mousemove 只直写 CSS 变量、不走 React state：高频触发走 state 会击穿父级 memo
 *   令整卡重渲染。变量由 glass-kit.css 的 .card-tilt.is-tilting 规则消费。
 * · 本层绝不能加任何 filter（如 brightness）：它是 .glass-card 的祖先，
 *   祖先 filter 会破坏子级 backdrop-filter 的背景采样（毛玻璃直接失效）。
 *   亮度反馈交给 .glass-card:hover 的提亮规则。
 */

// 最大倾角（度）。内容卡远大于小尺寸卡牌，角度取小避免夸张变形
const MAX_TILT_X = 6
const MAX_TILT_Y = 8
// 封面图最大视差位移（px）。上限受倾斜态图片 scale(1.1) 的出血量约束
// —— 再大会在图边露出卡底
const PARALLAX_X = 10
const PARALLAX_Y = 6
// 投影反向偏移幅度（px），营造「卡面倾斜、光源固定」的立体感
const SHADOW_SHIFT = 12

const TILT_VARS = [
  "--tilt-x",
  "--tilt-y",
  "--card-par-x",
  "--card-par-y",
  "--tilt-shadow-x",
  "--tilt-shadow-y",
] as const

export default function CardTilt({
  children,
  autoTilt = false,
  className = "",
}: {
  children: ReactNode
  /**
   * 触屏「刷到即弹」期间：挂 .tilt-auto，让卡体跟着弹出的主体同步倾斜。
   * 关键帧在 glass-kit.css，与主体的 .pop-auto 同节奏参数 → 同一次渲染挂类即永久锁相，
   * 不需要 JS 逐帧驱动。桌面走 hover 分支、不用它。
   */
  autoTilt?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const lastPosRef = useRef({ x: 0, y: 0 })
  // hover 进入时缓存几何中心：倾斜中 getBoundingClientRect 会把自身 transform
  // 算进去，逐帧取会拿到「已旋转」的矩形导致抖动
  const centerRef = useRef<{ cx: number; cy: number; w: number; h: number } | null>(null)
  const enabledRef = useRef(false)

  useEffect(() => {
    // 与 CSS 门控保持一致：仅桌面精确指针 + 未开启「减少动态效果」
    enabledRef.current =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  const handleEnter = () => {
    const el = ref.current
    if (!el || !enabledRef.current) return
    const rect = el.getBoundingClientRect()
    centerRef.current = {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      w: rect.width,
      h: rect.height,
    }
    el.classList.add("is-tilting")
  }

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    if (!ref.current || !centerRef.current || frameRef.current) return
    // rAF 节流：每帧最多写一次样式，回调里取「最新」坐标
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      const el = ref.current
      const c = centerRef.current
      if (!el || !c) return
      // 相对中心的归一化偏移，clamp 到 [-0.5, 0.5]
      const px = Math.max(-0.5, Math.min(0.5, (lastPosRef.current.x - c.cx) / c.w))
      const py = Math.max(-0.5, Math.min(0.5, (lastPosRef.current.y - c.cy) / c.h))
      el.style.setProperty("--tilt-x", `${(-py * 2 * MAX_TILT_X).toFixed(2)}deg`)
      el.style.setProperty("--tilt-y", `${(px * 2 * MAX_TILT_Y).toFixed(2)}deg`)
      el.style.setProperty("--card-par-x", `${(px * 2 * PARALLAX_X).toFixed(1)}px`)
      el.style.setProperty("--card-par-y", `${(py * 2 * PARALLAX_Y).toFixed(1)}px`)
      el.style.setProperty("--tilt-shadow-x", `${(-px * 2 * SHADOW_SHIFT).toFixed(1)}px`)
      el.style.setProperty("--tilt-shadow-y", `${(-py * 2 * SHADOW_SHIFT).toFixed(1)}px`)
    })
  }

  const handleLeave = () => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
    centerRef.current = null
    // 清掉变量 + 摘 is-tilting：transform 回落到 none，
    // 由基础态 0.45s 过渡平滑回正（transform: none 与旋转态之间可插值）
    for (const v of TILT_VARS) el.style.removeProperty(v)
    el.classList.remove("is-tilting")
  }

  return (
    <div
      ref={ref}
      className={`card-tilt${autoTilt ? " tilt-auto" : ""}${className ? ` ${className}` : ""}`}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  )
}

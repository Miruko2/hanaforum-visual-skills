"use client"

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

/**
 * 滑动高亮导航（glass-kit.css 第 10 节的 JS 驱动）。
 *
 * 两块互不替代的滑动块：
 * · .jelly-nav-indicator 凹陷块 —— 指针反馈，跟着 hover / 焦点弹性滑移（触屏不挂监听）
 * · .jelly-nav-active 发光胶囊 —— 选中状态，跟着 active 选项滑移（触屏也跟随点击）
 * 零依赖：位置靠 getBoundingClientRect 量取，弹性靠 CSS 的过冲贝塞尔，不需要动画库。
 *
 * 用法：
 *   <JellyNav
 *     items={[
 *       { key: "fav",  label: "收藏", icon: <Heart size={12} /> },
 *       { key: "recent", label: "最近" },
 *       { key: "all",  label: "全部" },
 *     ]}
 *     active={tab}
 *     onSelect={setTab}
 *   />
 *
 * 实现要点：
 * · 高亮块位置量的是「按钮左边缘相对容器左边缘」的距离，所以容器必须 position:relative
 *   （.jelly-nav 已经带了）。用相对量而非视口绝对量，页面滚动时无需重算。
 * · 只写 CSS 变量与内联 width，不改 React state 之外的东西；高亮块本身不参与
 *   布局（absolute），改 width 不会引起兄弟节点重排。
 * · 选中胶囊为什么不用 .is-active::before：伪元素长在各选项自己身上，切换选中只能
 *   「这边灭、那边亮」瞬移，不可能有移动动效；独立滑动块才能滑过去。
 * · 首帧与尺寸变化后的归位必须瞬移（no-anim + 强制 reflow），不能带着弹性从旧位置滑。
 * · 容器 onMouseLeave 时摘掉凹陷块的 .is-on → 淡出，但**不重置位置**，
 *   这样下次进入是从上次停留处滑过去，而不是从最左边跳一下。
 */
export type JellyNavItem = {
  key: string
  label: ReactNode
  icon?: ReactNode
}

export default function JellyNav({
  items,
  active,
  onSelect,
  className = "",
  ariaLabel,
}: {
  items: JellyNavItem[]
  active?: string
  onSelect?: (key: string) => void
  className?: string
  ariaLabel?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const activeInitializedRef = useRef(false)
  const [hoverEnabled, setHoverEnabled] = useState(false)

  useEffect(() => {
    setHoverEnabled(window.matchMedia("(hover: hover) and (pointer: fine)").matches)
  }, [])

  const moveTo = useCallback((btn: HTMLElement | null) => {
    const c = containerRef.current
    const ind = indicatorRef.current
    if (!c || !ind || !btn) return
    // 相对容器的偏移：页面滚动不影响，无需在 scroll 里重算
    const x = btn.getBoundingClientRect().left - c.getBoundingClientRect().left
    ind.style.setProperty("--jn-x", `${x.toFixed(1)}px`)
    ind.style.width = `${btn.getBoundingClientRect().width.toFixed(1)}px`
    ind.classList.add("is-on")
  }, [])

  /* 选中胶囊定位。animate=false 用于首帧与尺寸变化后的归位：必须瞬移，
     否则会带着弹性从一个错误位置滑过来。no-anim + 强制 reflow 是标准手法 */
  const moveActiveTo = useCallback((animate: boolean) => {
    const c = containerRef.current
    const ind = activeRef.current
    if (!c || !ind) return
    const btn = c.querySelector<HTMLElement>(".jelly-nav-item.is-active")
    if (!btn) {
      ind.classList.remove("is-on")
      return
    }
    if (!animate) ind.classList.add("no-anim")
    const x = btn.getBoundingClientRect().left - c.getBoundingClientRect().left
    ind.style.setProperty("--jn-ax", `${x.toFixed(1)}px`)
    ind.style.width = `${btn.getBoundingClientRect().width.toFixed(1)}px`
    ind.classList.add("is-on")
    if (!animate) {
      void ind.offsetWidth // 强制 reflow：无过渡归位先生效
      ind.classList.remove("no-anim") // 再还给弹性，下次切换才有滑移
    }
  }, [])

  // 选中变化 → 发光胶囊滑过去（effect 在 DOM 提交后跑，.is-active 已在新按钮上）。
  // 触屏也走这条路：选中是状态不是指针反馈，不门控 hover
  useEffect(() => {
    moveActiveTo(activeInitializedRef.current)
    activeInitializedRef.current = true
  }, [active, moveActiveTo])

  // 字体加载、断点切换、label 变长都会改变选项宽度 —— 尺寸变化时无动画重定位。
  // ResizeObserver 对新观察的元素会立即回调一次，顺带覆盖了 items 重渲染后的校准
  useEffect(() => {
    const c = containerRef.current
    if (!c || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => moveActiveTo(false))
    ro.observe(c)
    c.querySelectorAll(".jelly-nav-item").forEach((b) => ro.observe(b))
    return () => ro.disconnect()
  }, [items, moveActiveTo])

  const handleLeave = useCallback(() => {
    // 只淡出、不归零：下次进入从上次停留处滑过去，避免「跳回最左再滑出来」
    indicatorRef.current?.classList.remove("is-on")
  }, [])

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`jelly-nav${className ? ` ${className}` : ""}`}
      onMouseLeave={hoverEnabled ? handleLeave : undefined}
    >
      <div ref={indicatorRef} aria-hidden className="jelly-nav-indicator" />
      <div ref={activeRef} aria-hidden className="jelly-nav-active" />
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={active === item.key}
          className={`jelly-nav-item${active === item.key ? " is-active" : ""}`}
          onMouseEnter={hoverEnabled ? (e) => moveTo(e.currentTarget) : undefined}
          // 键盘用户：聚焦时高亮块也跟过去，行为与鼠标一致
          onFocus={hoverEnabled ? (e) => moveTo(e.currentTarget) : undefined}
          onClick={() => onSelect?.(item.key)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

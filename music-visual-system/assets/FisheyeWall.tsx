"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  computeInstances,
  fisheye,
  packItems,
  FISHEYE_RADIUS_FACTOR,
  type FisheyeItem,
  type FisheyeOptions,
  type Instance,
} from "./fisheye-wall"

/**
 * 3D 鱼眼卡片墙（配套 fisheye-wall.css）。
 *
 * 无限平铺的卡片网格 + 球面透视：靠近屏幕中心的卡片向观众隆起放大，
 * 四周的卡片转过去朝向中心并后退。可拖拽 / 滚轮平移，松手有惯性。
 *
 * 用法：
 *   <FisheyeWall
 *     items={tracks}                       // 需要 { id, span? }
 *     renderCard={(item) => <MyCard .../>}
 *     onSelect={(item, rect) => openDetail(item, rect)}
 *   />
 *
 * 设计要点（都是踩过坑换来的，改之前先读 SKILL.md 的四条铁律）：
 * · 逐帧变换由 rAF 通过 ref 直写 DOM，**不走 React state** —— 卡片只在自身数据
 *   变化时重渲染。renderCard 的返回值请自行 memo。
 * · 三道省算闸：pan 没动不重算可见集 / 静止整段跳过逐卡循环 / 每条样式写入前脏检查。
 * · 卡片上绝不能加 `filter`（会废掉自己的 backdrop-filter，毛玻璃失效）。
 * · 要隐藏卡片层只能用 `visibility`，不能用 `opacity`（opacity<1 会把
 *   transform-style 扁平化，整面墙跳位）。
 */

type Props<T extends FisheyeItem> = {
  items: T[]
  renderCard: (item: T, size: { width: number; height: number }) => React.ReactNode
  /** 点击（非拖动）某张卡。rect 是它当时的屏幕矩形，可用来做「从卡片飞出」的转场 */
  onSelect?: (item: T, rect: DOMRect) => void
  /** 打包列数，默认 8 */
  columns?: number
  /** 列宽（含间距），默认桌面 180 / 窄屏 140 */
  unitWidth?: number
  mobileUnitWidth?: number
  /** 切换列宽的布局断点（与性能降级的 lite 无关），默认 768 */
  mobileBreakpoint?: number
  gap?: number
  /** 卡片高/宽，默认 1.3 */
  ratio?: number
  /** 舞台透视距离，默认 1450。越小越「凸」，但太小会在四角露出空带 */
  perspective?: number
  /** 视口外预绘边距，默认 80 */
  margin?: number
  /** 降级档：关掉指针视差（手机没有鼠标，视差毫无意义） */
  lite?: boolean
  /** 整层隐藏（安卓弹层打开时用）。只走 visibility，不会扁平化 3D */
  hidden?: boolean
  fisheyeOptions?: FisheyeOptions
  /** 卡片层之下的背景（会跟随指针做轻微反向视差） */
  background?: React.ReactNode
  className?: string
}

const PARALLAX_AMOUNT = 24 // 背景反向位移的最大 px
const PAN_LERP = 0.15      // 可见位置每帧向目标逼近的比例
const DRAG_INERTIA = 0.92  // 松手后速度的每帧衰减
const CLICK_MAX_MOVE = 5   // px，超过视为拖动
const CLICK_MAX_MS = 500   // ms，超过视为长按

type Vec2 = { x: number; y: number }

export default function FisheyeWall<T extends FisheyeItem>({
  items,
  renderCard,
  onSelect,
  columns = 8,
  unitWidth = 180,
  mobileUnitWidth = 140,
  mobileBreakpoint = 768,
  gap = 6,
  ratio = 1.3,
  perspective = 1450,
  margin = 80,
  lite = false,
  hidden = false,
  fisheyeOptions,
  background,
  className = "",
}: Props<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const parallaxRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // panTarget = 用户输入累积到的位置（瞬时）；pan = 实际渲染位置，每帧向 target 逼近
  const panTargetRef = useRef<Vec2>({ x: 0, y: 0 })
  const panRef = useRef<Vec2>({ x: 0, y: 0 })
  const panVelRef = useRef<Vec2>({ x: 0, y: 0 })
  const pointerRef = useRef<Vec2>({ x: 0, y: 0 })
  const dragRef = useRef<{ active: boolean; pointerId: number | null; last: Vec2; lastT: number }>({
    active: false,
    pointerId: null,
    last: { x: 0, y: 0 },
    lastT: 0,
  })
  // rAF 闭包依赖为空、不重建，用 ref 让它每帧读到最新的 hidden
  const hiddenRef = useRef(hidden)
  hiddenRef.current = hidden

  const [viewSize, setViewSize] = useState({ w: 0, h: 0 })
  const unit = viewSize.w && viewSize.w < mobileBreakpoint ? mobileUnitWidth : unitWidth

  const pack = useMemo(
    () => packItems(items, columns, unit, gap, ratio),
    [items, columns, unit, gap, ratio],
  )

  const [instances, setInstances] = useState<Instance<T>[]>([])
  const instanceKeysRef = useRef("")

  // ---- 视口尺寸 ----
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setViewSize({ w: r.width, h: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---- 首帧把 tile 中心对到视口中心 ----
  const centered = useRef(false)
  useEffect(() => {
    if (!viewSize.w || !viewSize.h || centered.current) return
    const cx = -pack.tileW / 2 + viewSize.w / 2
    const cy = -pack.tileH / 2 + viewSize.h / 2
    panTargetRef.current = { x: cx, y: cy }
    panRef.current = { x: cx, y: cy }
    pointerRef.current = { x: viewSize.w / 2, y: viewSize.h / 2 }
    centered.current = true
  }, [viewSize, pack.tileW, pack.tileH])

  // ---- 指针 ----
  // 按下瞬间把 target 钉到当前可见位置：否则滑行中的卡片会在 down 与 up 之间
  // 滑走，浏览器判定「按下与抬起不在同一元素」而吞掉 click。
  const killDriftOnPress = useCallback(() => {
    panTargetRef.current = { x: panRef.current.x, y: panRef.current.y }
    panVelRef.current = { x: 0, y: 0 }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // 落在卡片内的按钮上就不要开始平移（按钮自己也应 stopPropagation，这是兜底）
    if ((e.target as HTMLElement).closest("button")) return
    if (e.button !== 0 && e.pointerType === "mouse") return
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      last: { x: e.clientX, y: e.clientY },
      lastT: performance.now(),
    }
    panVelRef.current = { x: 0, y: 0 }
  }, [])

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    panTargetRef.current.y -= e.deltaY
    panTargetRef.current.x -= e.deltaX
  }, [])

  // 拖动挂在 window 上，不用 setPointerCapture —— 捕获会把后续事件全锁到卡片上，
  // 卡片里的按钮就点不动了。
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = viewportRef.current?.getBoundingClientRect()
      if (r) {
        pointerRef.current.x = e.clientX - r.left
        pointerRef.current.y = e.clientY - r.top
      }
      const d = dragRef.current
      if (d.active && d.pointerId === e.pointerId) {
        const dx = e.clientX - d.last.x
        const dy = e.clientY - d.last.y
        d.last = { x: e.clientX, y: e.clientY }
        panTargetRef.current.x += dx
        panTargetRef.current.y += dy
        const now = performance.now()
        const dt = Math.max(1, now - d.lastT)
        panVelRef.current.x = dx / dt
        panVelRef.current.y = dy / dt
        d.lastT = now
      }
    }
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current
      if (d.active && d.pointerId === e.pointerId) {
        d.active = false
        d.pointerId = null
        // px/ms → px/帧（60fps ≈ 16.7ms）
        panVelRef.current.x *= 16
        panVelRef.current.y *= 16
      }
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [])

  // ---- 主 rAF 循环 ----
  useEffect(() => {
    if (!viewSize.w || !viewSize.h) return

    let mounted = true
    let rafId = 0

    const focusX = viewSize.w / 2
    const focusY = viewSize.h / 2
    const radius = Math.min(viewSize.w, viewSize.h) * FISHEYE_RADIUS_FACTOR

    let prevPanX = NaN
    let prevPanY = NaN
    let prevParallax = ""
    let cached: Instance<T>[] = []
    // paintSeq/lastPainted：可见集变化时自增，只有「本帧把每张卡都写到了」才追平。
    // setInstances 是异步的，新卡可能晚一帧才挂上；没挂全就不追平，下一帧继续补画。
    let paintSeq = 0
    let lastPainted = -1
    let prevHidden = false
    const prevStyle = new Map<string, { t: string; o: string; v: string }>()

    const loop = () => {
      if (!mounted) return

      // 惯性加在 target 上（不是可见位置），lerp 仍会把它抹平、末尾自然收住
      if (!dragRef.current.active) {
        const v = panVelRef.current
        if (Math.abs(v.x) > 0.05 || Math.abs(v.y) > 0.05) {
          panTargetRef.current.x += v.x
          panTargetRef.current.y += v.y
          v.x *= DRAG_INERTIA
          v.y *= DRAG_INERTIA
        }
      }

      panRef.current.x += (panTargetRef.current.x - panRef.current.x) * PAN_LERP
      panRef.current.y += (panTargetRef.current.y - panRef.current.y) * PAN_LERP

      if (parallaxRef.current && !lite) {
        const nx = (pointerRef.current.x / viewSize.w) * 2 - 1
        const ny = (pointerRef.current.y / viewSize.h) * 2 - 1
        const ptf = `translate3d(${(-nx * PARALLAX_AMOUNT).toFixed(2)}px, ${(-ny * PARALLAX_AMOUNT).toFixed(2)}px, 0)`
        if (ptf !== prevParallax) {
          parallaxRef.current.style.transform = ptf
          prevParallax = ptf
        }
      }

      const panX = panRef.current.x
      const panY = panRef.current.y
      const panMoved = Math.abs(panX - prevPanX) > 0.01 || Math.abs(panY - prevPanY) > 0.01

      // pan 没动就不重算可见集：静止时省掉每帧的数组分配与签名拼接
      if (panMoved || cached.length === 0) {
        cached = computeInstances(pack, panX, panY, viewSize.w, viewSize.h, margin)
        const sig = cached.map((i) => i.key).join("|")
        if (sig !== instanceKeysRef.current) {
          instanceKeysRef.current = sig
          paintSeq++
          const live = new Set(cached.map((i) => i.key))
          for (const k of prevStyle.keys()) if (!live.has(k)) prevStyle.delete(k)
          const next = cached
          // 不在 rAF 里同步触发渲染
          queueMicrotask(() => {
            if (mounted) setInstances(next)
          })
        }
      }

      const hideNow = hiddenRef.current
      // 静止停渲：三者皆否 = 墙面没动，本帧整段跳过逐卡循环
      if (panMoved || paintSeq !== lastPainted || hideNow !== prevHidden) {
        let allFound = true
        for (const inst of cached) {
          const node = cardRefs.current.get(inst.key)
          if (!node) {
            allFound = false
            continue
          }
          const sx = inst.worldX + panX
          const sy = inst.worldY + panY
          const f = fisheye(
            sx + inst.card.width / 2,
            sy + inst.card.height / 2,
            focusX,
            focusY,
            radius,
            fisheyeOptions,
          )
          // 顺序不能换：先平移（屏幕坐标）→ 再绕中心旋转 → 最后缩放
          const transform =
            `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, ${f.z.toFixed(1)}px) ` +
            `rotateX(${f.rotX.toFixed(2)}deg) rotateY(${f.rotY.toFixed(2)}deg) ` +
            `scale(${f.scale.toFixed(3)})`
          const opacity = f.opacity.toFixed(3)
          const visibility = hideNow ? "hidden" : "visible"

          // 脏检查：只有真的变了才碰 DOM
          const prev = prevStyle.get(inst.key)
          if (!prev) {
            node.style.transform = transform
            node.style.opacity = opacity
            node.style.visibility = visibility
            prevStyle.set(inst.key, { t: transform, o: opacity, v: visibility })
          } else {
            if (prev.t !== transform) {
              node.style.transform = transform
              prev.t = transform
            }
            if (prev.o !== opacity) {
              node.style.opacity = opacity
              prev.o = opacity
            }
            if (prev.v !== visibility) {
              node.style.visibility = visibility
              prev.v = visibility
            }
          }
        }
        if (allFound) lastPainted = paintSeq
        prevHidden = hideNow
      }

      prevPanX = panX
      prevPanY = panY
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      mounted = false
      cancelAnimationFrame(rafId)
    }
  }, [viewSize.w, viewSize.h, pack, lite, margin, fisheyeOptions])

  return (
    <div
      ref={viewportRef}
      className={`fw-viewport${className ? ` ${className}` : ""}`}
      style={{ perspective, perspectiveOrigin: "50% 50%" }}
      onPointerDownCapture={killDriftOnPress}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      // 不拦的话，鼠标在封面图上拖会触发系统「拖拽图片」幽灵图，和平移打架
      onDragStart={(e) => e.preventDefault()}
    >
      {background != null && (
        <div ref={parallaxRef} className="fw-parallax" aria-hidden>
          {background}
        </div>
      )}

      {/* 卡片层：pointer-events:none，否则这张 z=0 的平面会挡住 z<0 的卡片 */}
      <div className="fw-stage" style={{ visibility: hidden ? "hidden" : "visible" }}>
        {instances.map((inst) => (
          <Card
            key={inst.key}
            instKey={inst.key}
            refs={cardRefs}
            width={inst.card.width}
            height={inst.card.height}
            onSelect={onSelect ? (rect) => onSelect(inst.card.item, rect) : undefined}
          >
            {renderCard(inst.card.item, { width: inst.card.width, height: inst.card.height })}
          </Card>
        ))}
      </div>
    </div>
  )
}

function Card({
  instKey,
  refs,
  width,
  height,
  onSelect,
  children,
}: {
  instKey: string
  refs: React.MutableRefObject<Map<string, HTMLDivElement>>
  width: number
  height: number
  onSelect?: (rect: DOMRect) => void
  children: React.ReactNode
}) {
  const downRef = useRef<{ x: number; y: number; t: number } | null>(null)
  return (
    <div
      ref={(el) => {
        if (el) refs.current.set(instKey, el)
        else refs.current.delete(instKey)
      }}
      className="fw-card"
      style={{ width, height }}
      onPointerDown={(e) => {
        downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
      }}
      onClick={(e) => {
        const d = downRef.current
        downRef.current = null
        if (!d || !onSelect) return
        // 位移过大或耗时过长 = 拖动/长按，不算点击
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_MAX_MOVE) return
        if (performance.now() - d.t > CLICK_MAX_MS) return
        onSelect((e.currentTarget as HTMLDivElement).getBoundingClientRect())
      }}
    >
      {children}
    </div>
  )
}

"use client"

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

/**
 * 果冻形变：悬浮按钮 ⇄ 居中弹窗（glass-kit.css 第 11 节的 JS 驱动）。
 *
 * 点击右下角按钮后，弹窗从按钮位「飞行 + 放大」弹入，一层强调色果冻皮在中途溶解、
 * 露出深色面板底继续弹到位，最后才点亮里面的毛玻璃内容。关闭反向收回。
 *
 * 零依赖（只用 React + createPortal），不需要 framer-motion / View Transitions。
 *
 * 用法：
 *   <JellyMorph label="发布新帖子" icon={<Plus />}>
 *     {(close) => <PostForm onDone={close} />}
 *   </JellyMorph>
 *
 * ── 为什么是「假形变」而不是真 FLIP ──
 * 真 FLIP（framer-motion 的 layout / View Transitions）每帧都在重绘剧烈变尺寸的图层
 * （borderRadius 校正 + boxShadow 插值），低端安卓 WebView 实测闪屏、纹理重分配跟不上。
 * 这里让面板一次光栅化后整体做 transform + opacity，全程合成线程、零每帧重绘。
 * 桌面观感几乎无差别，且不引依赖。
 *
 * ── 三个时机必须解耦（踩坑结论，别合并）──
 *   起跑    双 rAF 后才加 .is-flying —— 面板先以透明缩小态挂载 2 帧完成光栅化，消起手卡顿
 *   240ms   果冻皮溶解 —— 弹窗刚冲到最大、还在回弹的动态中就化开，绿色不等站定，过渡更紧凑
 *   480ms   内容点亮 + 毛玻璃淡入 —— scale 贴近 1 才显示。缩放途中绘制 backdrop-filter
 *           会逐帧重采样卡顿（最初病根），必须等到位；其间深色空盒短暂露出约 0.08s。
 *           毛玻璃靠独立内层 .jelly-morph-glass 以 opacity 淡入（本身不能过渡）
 *
 * ── 收回路径 ──
 * 回缩动画实际 380ms，收尾定时器只留 40ms 余量（曾经留 180ms，实测被感知为「停顿」）；
 * 按钮在回缩到位同帧带 .is-back 小弹归位，把收尾缝成连续动作。
 */

// 按钮中心到视口右/下边缘的距离：1.5rem 边距 + 半径 1.75rem = 52px。
// 改了 .jelly-fab 的 bottom/right/尺寸就要同步改这里，否则飞行起点对不上按钮。
const FAB_CENTER_OFFSET = 52

const SKIN_DISSOLVE_MS = 240
const FORM_LIT_MS = 480
// 回缩动画实际时长（transform 0.38s / opacity 0.16s+0.22s 延迟）+ 40ms 余量。
// 滚动解锁推迟到这时候：立即解锁会触发整页 reflow 吃掉退出动画
const CLOSE_DONE_MS = 420
// 按钮归位小弹（jellyFabPop 0.32s）+ 余量，播完摘类
const FAB_BACK_MS = 360

export default function JellyMorph({
  children,
  label,
  icon,
  /** 是否显示按钮（例如详情弹窗打开时让位） */
  visible = true,
  onOpenChange,
}: {
  /** 面板内容。收到 close 回调，业务完成后自行关闭 */
  children: (close: () => void) => ReactNode
  label: string
  icon?: ReactNode
  visible?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [flying, setFlying] = useState(false)
  const [closing, setClosing] = useState(false)
  const [skinDissolved, setSkinDissolved] = useState(false)
  const [formLit, setFormLit] = useState(false)
  const [fabBack, setFabBack] = useState(false)

  const openRef = useRef(false)
  const lockedRef = useRef(false)
  const prevOverflowRef = useRef("")
  const timersRef = useRef<number[]>([])
  // 飞行向量：视口中心 → 按钮中心。打开瞬间采样（视口尺寸可能变过）
  const flightRef = useRef({ x: 0, y: 0 })

  useEffect(() => setMounted(true), [])

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms))
  }

  const unlockScroll = useCallback(() => {
    if (!lockedRef.current) return
    lockedRef.current = false
    document.body.style.overflow = prevOverflowRef.current
    document.body.style.touchAction = ""
  }, [])

  const lockScroll = useCallback(() => {
    if (lockedRef.current) return
    lockedRef.current = true
    prevOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.body.style.touchAction = "none"
  }, [])

  const close = useCallback(() => {
    if (!openRef.current) return
    openRef.current = false
    clearTimers()
    // 先收内容：果冻皮渐入回绿的过程中是半透明的，内容若仍 visible 会随面板缩放扭曲透出。
    // 提前隐藏，让面板以深色空盒缩回、由回绿的果冻皮盖住。
    // formLit=false 会同步摘掉面板的 is-glass：毛玻璃内层在 .is-closing 下不过渡直接消失
    // （回缩途中带着 backdrop-filter 缩放会逐帧重采样，abrupt 的一帧由回绿的果冻皮盖住）
    setFormLit(false)
    setSkinDissolved(false)
    setFlying(false)
    setClosing(true)
    onOpenChange?.(false)
    later(() => {
      setOpen(false)
      setClosing(false)
      // 回缩到位与按钮重现同帧衔接 + 小弹一下，消掉「收完了按钮还没回来」的空窗
      setFabBack(true)
      later(() => setFabBack(false), FAB_BACK_MS)
      unlockScroll()
    }, CLOSE_DONE_MS)
  }, [onOpenChange, unlockScroll])

  const handleOpen = () => {
    if (openRef.current) return
    clearTimers()
    flightRef.current = {
      x: window.innerWidth / 2 - FAB_CENTER_OFFSET,
      y: window.innerHeight / 2 - FAB_CENTER_OFFSET,
    }
    lockScroll()
    openRef.current = true
    setClosing(false)
    setSkinDissolved(false)
    setFormLit(false)
    setFabBack(false)
    setOpen(true)
    onOpenChange?.(true)

    // 双 rAF：等面板以缩小态挂载并完成首帧光栅化后再起跑
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (openRef.current) setFlying(true)
      })
    })
    later(() => openRef.current && setSkinDissolved(true), SKIN_DISSOLVE_MS)
    later(() => openRef.current && setFormLit(true), FORM_LIT_MS)
  }

  // Escape 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, close])

  // 卸载（如路由跳转）时兜底解锁 + 清定时器
  useEffect(
    () => () => {
      clearTimers()
      unlockScroll()
    },
    [unlockScroll],
  )

  if (!mounted) return null

  const flightStyle = {
    "--jm-x": `${flightRef.current.x}px`,
    "--jm-y": `${flightRef.current.y}px`,
  } as React.CSSProperties

  return createPortal(
    <>
      {open && (
        <div
          className={`jelly-morph-overlay${flying ? " is-open" : ""}`}
          onClick={close}
          aria-hidden
        />
      )}

      <div className="jelly-morph-layer" style={{ zIndex: open ? 50 : 999 }}>
        {/* 打开时按钮瞬撤（is-gone → display:none）而不是淡出：否则角落这团强调色与
            飞向中心的果冻皮会形成「两团绿」连闪 */}
        <button
          type="button"
          aria-label={label}
          onClick={handleOpen}
          className={`jelly-fab${open || !visible ? " is-gone" : ""}${fabBack ? " is-back" : ""}`}
          style={{ pointerEvents: "auto" }}
        >
          {icon ? <span className="jelly-fab-icon">{icon}</span> : <span className="jelly-fab-icon">＋</span>}
          <span className="jelly-fab-ping" aria-hidden />
        </button>

        {open && (
          <div
            role="dialog"
            aria-modal
            aria-label={label}
            style={flightStyle}
            className={`jelly-morph-panel${flying ? " is-flying" : ""}${closing ? " is-closing" : ""}${formLit ? " is-glass" : ""}`}
          >
            {/* 毛玻璃内层：与点亮内容同帧淡入（formLit → is-glass），回缩时随 is-closing 瞬摘 */}
            <div className="jelly-morph-glass" aria-hidden />
            <div className={`jelly-morph-skin${skinDissolved ? " is-dissolved" : ""}`} aria-hidden />
            <div className={`jelly-morph-form${formLit ? " is-lit" : ""}`}>{children(close)}</div>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

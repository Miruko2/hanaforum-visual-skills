"use client"

import { useEffect, useRef, useState } from "react"
import { MOOD_FACES, MOOD_FACE_ROWS, type MoodName } from "./mood-faces"

/**
 * 颜文字 LED 点阵（心情脸）：把一整条颜文字点阵铺成发光珠网格。
 * 数据在 mood-faces.ts（'1'=亮 '0'=灭，9 行高），样式在 glass-kit.css 第 12 节。
 *
 * 用法：
 *   <MoodFace mood="happy" />                          // 内置八条之一
 *   <MoodFace rows={composeFace(["LP", "HEART", "RP"])} color="#a3e635" label="" />
 *
 * 实现要点：
 * · 各条颜文字宽度不同（短的 6 个零件、长的 17 个）：灯珠尺寸按容器宽度内联算出
 *   （封顶 6px 不让短条过大、保底 2px 仍可见），容器尺寸变化时用 ResizeObserver 重算。
 * · 发光色走 CSS 变量 --led-color，换色只改一处；灭珠是固定极淡白衬底（不用
 *   color-mix，老 WebView 也稳）。
 * · 「坏灯珠」闪烁用确定性哈希（r*31+c*17）挑约 1/5 的亮珠，并错开延迟/时长 ——
 *   不用 Math.random，SSR 与 hydration 安全。
 * · 整条浮动（ledFaceBob）与坏灯珠（ledFaceFlick）在 prefers-reduced-motion 下
 *   由 CSS 整组关闭，这里不需要判断。
 */
export default function MoodFace({
  mood = "neutral",
  color = "#f9a8d4",
  label = "MOOD",
  rows,
  className = "",
}: {
  /** 内置八条之一；传了 rows 则忽略此项 */
  mood?: MoodName
  /** 发光色，写进 --led-color */
  color?: string
  /** 底部小字标签；传空字符串则不渲染 */
  label?: string
  /** 直接给点阵数据（'1'/'0' 的 9 行字符串数组），优先于 mood */
  rows?: string[]
  className?: string
}) {
  const data = rows ?? MOOD_FACES[mood] ?? MOOD_FACES.neutral
  const cols = data[0]?.length ?? 1
  const fitRef = useRef<HTMLDivElement>(null)
  const [dot, setDot] = useState(5)

  // 按容器宽度算灯珠尺寸，保证整条颜文字完整显示
  useEffect(() => {
    const el = fitRef.current
    if (!el) return
    const GAP = 1
    const recompute = () => {
      const w = el.clientWidth || 1
      setDot(Math.max(2, Math.min(6, (w - (cols - 1) * GAP) / cols)))
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cols])

  return (
    <div
      className={`led-face${className ? ` ${className}` : ""}`}
      style={{ "--led-color": color } as React.CSSProperties}
      aria-hidden
    >
      <div className="led-face-fit" ref={fitRef}>
        <div
          className="led-face-grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${dot}px)`,
            gridTemplateRows: `repeat(${MOOD_FACE_ROWS}, ${dot}px)`,
          }}
        >
          {data.flatMap((line, r) =>
            line.split("").map((ch, c) => {
              const on = ch === "1"
              const seed = (r * 31 + c * 17) & 0xff
              const flick = on && seed % 5 === 0
              return (
                <span
                  key={`${r}-${c}`}
                  className={`led-face-dot${on ? " on" : ""}${flick ? " flick" : ""}`}
                  style={
                    flick
                      ? {
                          animationDelay: `${(seed % 50) / 10}s`,
                          animationDuration: `${2.4 + (seed % 7) * 0.3}s`,
                        }
                      : undefined
                  }
                />
              )
            }),
          )}
        </div>
      </div>
      {label !== "" && <span className="led-face-label">{label}</span>}
    </div>
  )
}

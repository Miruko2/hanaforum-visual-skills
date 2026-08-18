"use client"

import { useEffect, useMemo, useState } from "react"

/**
 * 影院海报墙（glass-kit.css 第 13 节的组件封装）。
 *
 * 多列海报斜着排列、奇偶列反方向来回滚动、每列速度不同（节奏才有机）；
 * 悬停某列整列停滚；悬停某张卡时聚光灯——它上抬放大发光、其余卡降亮降饱和
 * （CSS 的 :has() 实现，老浏览器自动退化为只有单卡发光，布局不坏）。
 *
 * 用法：
 *   <CinemaWall
 *     items={[{ id: "1", src: "/cover.jpg", title: "标题", subtitle: "作者" }, ...]}
 *     onSelect={(item) => openDetail(item)}
 *   />
 *
 * 要点：
 * · items 至少要够每列分到 1 张，否则渲染占位提示（原站同理）；列内不足 minPerColumn
 *   张时循环补齐 —— 卡片是 3:4，列窄卡就矮，一列没几张的话「一份」内容撑不满舞台高，
 *   滚到循环点前会先露出一截空白。
 * · 无缝循环：每列内容复制两份拼在自身之后，translateY 0↔-50% 循环点自然对齐。
 * · 列数桌面默认 7、移动端 4（内部 matchMedia 判定，也可用 props 覆盖）。
 * · 图片加载失败自动落到渐变 + 扫描线的「海报兜底」，保留海报感而非空白。
 * · prefers-reduced-motion 下 CSS 停掉列滚动与卡片位移，聚光灯亮度变化保留。
 */

export interface CinemaItem {
  id: string
  /** 海报图地址；缺失时直接渲染兜底海报 */
  src?: string
  title: string
  subtitle?: string
}

// 每列的滚动时长（秒），按列序取用 —— 互不相同，滚动节奏才有「有机感」
const COL_DURATIONS = [55, 62, 50, 68, 58, 64, 52]

export default function CinemaWall({
  items,
  columns = 7,
  mobileColumns = 4,
  minPerColumn = 4,
  onSelect,
  className = "",
}: {
  items: CinemaItem[]
  /** 桌面列数 */
  columns?: number
  /** 移动端列数（窄屏空间挤，降档） */
  mobileColumns?: number
  /**
   * 每列最少铺几张（不足则在列内循环补齐）。
   * 下限约为 3 × 列数 × 舞台高 / (4 × 舞台宽)：舞台越高越窄、列数越多，就要越大。
   */
  minPerColumn?: number
  onSelect?: (item: CinemaItem) => void
  className?: string
}) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const cols = isMobile ? mobileColumns : columns

  // 均分成 N 列（round-robin）后按 minPerColumn 补齐，每列稍后再复制一份做无缝循环
  const columnsData = useMemo(() => {
    const buckets: CinemaItem[][] = Array.from({ length: cols }, () => [])
    items.forEach((item, i) => buckets[i % cols].push(item))
    return buckets.map(col =>
      col.length === 0 || col.length >= minPerColumn
        ? col
        : Array.from({ length: minPerColumn }, (_, i) => col[i % col.length]),
    )
  }, [items, cols, minPerColumn])

  if (items.length < cols) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6rem 0", color: "rgba(255,255,255,0.6)" }}>
        内容太少，暂时无法启动影院模式
      </div>
    )
  }

  return (
    <div
      className={`cinema-stage${className ? ` ${className}` : ""}`}
      style={{ height: "min(72vh, 640px)" }}
    >
      <div className="cinema-tilted">
        <div className="cinema-cols">
          {columnsData.map((col, colIdx) => {
            // 偶数列向下滚、奇数列向上滚（一来一回）
            const goingDown = colIdx % 2 === 0
            const duration = COL_DURATIONS[colIdx % COL_DURATIONS.length]
            return (
              <div key={colIdx} className="cinema-col">
                <div
                  className={`cinema-col-track ${goingDown ? "scroll-down" : "scroll-up"}`}
                  style={{ animationDuration: `${duration}s` }}
                >
                  {[...col, ...col].map((item, i) => (
                    <CinemaCard
                      key={`${item.id}-${i}`}
                      item={item}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CinemaCard({ item, onSelect }: { item: CinemaItem; onSelect?: (item: CinemaItem) => void }) {
  const [imgError, setImgError] = useState(false)
  const showFallback = !item.src || imgError

  return (
    <button
      type="button"
      className="cinema-card"
      onClick={() => onSelect?.(item)}
      aria-label={item.title}
    >
      {!showFallback ? (
        <img
          src={item.src}
          alt={item.title}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="cinema-card-fallback">
          <span>{item.title || "无标题"}</span>
        </div>
      )}
      {(item.title || item.subtitle) && (
        <div className="cinema-card-caption">
          {item.title && <h4>{item.title}</h4>}
          {item.subtitle && <p>{item.subtitle}</p>}
        </div>
      )}
    </button>
  )
}

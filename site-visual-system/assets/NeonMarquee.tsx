"use client"

import type { CSSProperties } from "react"

/**
 * LED 霓虹广告牌风格的跑马灯（glass-kit.css 第 14 节的组件封装）。
 * 纯 CSS 动画、零依赖：没有真像素点阵，但用「粗等宽字 + 多层 text-shadow 光晕 +
 * LED 灯珠纹理瓦片 + 上下灯管高光缝」拼出广告牌观感。
 *
 * 用法：
 *   <NeonMarquee direction="left" duration={42} />                    // 影院模式顶条
 *   <NeonMarquee direction="right" duration={48} flickerDelay={-2.3} /> // 底条（错峰闪烁）
 *   <NeonMarquee variant="soft" color="lime" phrase="..." duration={60} /> // 氛围条
 *
 * 要点：
 * · 无缝循环靠「track 里两份相同内容 + translateX 0↔-50%」。phrase 会被重复 4 次
 *   拼成长串，太短的 phrase 撑不满一屏就多传几段文字。
 * · 多条同屏时用 flickerDelay 给其中一条负值（-2 ~ -3s）错峰闪烁，
 *   否则两条同步闪会形成视觉同频干扰。
 * · variant="soft" 明确不闪（CSS 里 animation:none），适合登录页等安静场景。
 */
export default function NeonMarquee({
  direction = "left",
  phrase = "ホタル・シアター  •  FIREFLY CINEMA  •  NOW PLAYING  •  映画祭  •  NIGHT SHOW  •  夜の劇場",
  duration = 40,
  variant = "bold",
  color = "pink",
  height,
  flickerDelay = 0,
  className = "",
}: {
  /** 滚动方向：left 向左滚、right 向右滚 */
  direction?: "left" | "right"
  /** 重复的文本条（会被拼接成 4 份长串） */
  phrase?: string
  /** 滚动一圈的秒数 */
  duration?: number
  /** bold：高饱和会闪烁的招牌风；soft：淡雅不闪、适合氛围场景 */
  variant?: "bold" | "soft"
  /** 色调：pink 影院粉（默认）、lime 绿色主题 */
  color?: "pink" | "lime"
  /** 覆盖条带高度（px）；不传用各 variant 默认值 */
  height?: number
  /** 闪烁延迟（秒）。多条同屏时给一条负值错峰 */
  flickerDelay?: number
  className?: string
}) {
  const full = Array(4).fill(phrase).join("  ·  ")

  const rootStyle: CSSProperties = {
    ...(height ? { height: `${height}px` } : null),
    ...(flickerDelay !== 0
      ? ({ "--neon-flicker-delay": `${flickerDelay}s` } as CSSProperties)
      : null),
  }

  return (
    <div
      className={`neon-marquee neon-marquee-${variant} neon-marquee-${color}${className ? ` ${className}` : ""}`}
      style={Object.keys(rootStyle).length > 0 ? rootStyle : undefined}
    >
      <div className="neon-marquee-leds" aria-hidden />
      <div
        className={`neon-marquee-track ${direction === "right" ? "to-right" : "to-left"}`}
        style={{ animationDuration: `${duration}s` }}
      >
        <span className="neon-marquee-text">{full}</span>
        <span className="neon-marquee-text">{full}</span>
      </div>
      <div className="neon-marquee-highlight-top" aria-hidden />
      <div className="neon-marquee-highlight-bottom" aria-hidden />
    </div>
  )
}

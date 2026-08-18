"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"

/**
 * 视口触发的「雾中浮现」入场包装层（glass-kit.css 第 5 节 B 套机制的 JS 驱动）。
 * 零依赖（原生 IntersectionObserver，不需要 react-intersection-observer）。
 *
 * 两段式机制 —— 为什么不是简单地「进视口加个类」：
 *   · 未进入视口时只保持雾态、**不挂任何 animation 声明**。这样下一次加
 *     .enter-visible 时 animation 是全新声明，浏览器必然从 0% 开始播放；
 *   · 离开视口摘类 → animation 声明消失 → 回到雾态，为下次重播做好准备。
 *   无论用户滚多快，第一眼看到的都是「从雾中浮现」的完整过程。
 *
 * 低端安卓分支：首次入场仍走 filter:blur 的雾中浮现；此后「滚出再滚回」的重播
 * 改用纯 transform+opacity 的廉价动画（.enter-replay），避免滚动时反复重算
 * 高斯模糊拖垮 GPU。同时按需打降耗类：
 *   .cv-auto  content-visibility 跳绘 + 毛玻璃降级
 *   .cv-lite  只降毛玻璃 —— 卡内有 .card-pop 越框主体时必须用这个，因为
 *             content-visibility 自带 paint containment 会把主体裁在容器盒内。
 *
 * 用法：
 *   const isAndroid = useIsAndroidLike()          // 见文件底部导出
 *   <EnterOnView cheapReplay={isAndroid} hasOverflowPop={!!post.maskUrl}>
 *     <CardTilt><div className="glass-card">…</div></CardTilt>
 *   </EnterOnView>
 */
export default function EnterOnView({
  children,
  /** 低端安卓：允许滚动重播，但重播用廉价 transform 动画、不重算 filter:blur */
  cheapReplay = false,
  /** 卡内是否有 .card-pop 越框主体（决定 cv-auto / cv-lite） */
  hasOverflowPop = false,
  /** 未渲染时的占位高度提示，喂给 contain-intrinsic-size */
  className = "",
}: {
  children: ReactNode
  cheapReplay?: boolean
  hasOverflowPop?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  // 是否已播过一次（渲染期直接判定，避免「先 blur 一帧再切廉价」的闪烁）
  const playedOnceRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 降级：不支持 IntersectionObserver 就直接显示，别把内容永久留在雾态
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      {
        threshold: 0.05,
        // 提前一点触发，动画不会等到元素完全进入视口
        rootMargin: "100px 0px",
      },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (cheapReplay && visible) playedOnceRef.current = true
  }, [cheapReplay, visible])

  const isReplay = cheapReplay && visible && playedOnceRef.current
  const perfClass = cheapReplay ? (hasOverflowPop ? "cv-lite" : "cv-auto") : ""

  return (
    <div
      ref={ref}
      className={[
        "card-shell",
        "enter-onview",
        perfClass,
        visible ? "enter-visible" : "",
        isReplay ? "enter-replay" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  )
}

/**
 * 低端安卓 / 鸿蒙探测。
 *
 * ⚠️ 客户端挂载后才置真，SSR 首帧按 false 渲染 —— 否则水合不一致。
 * ⚠️ 若把这个值喂给动画库（framer-motion 等）的 initial 变体，则必须保证
 *    首帧就准确，否则中途才出现的 filter 变体会让动画库撒手不管 filter
 *    → blur 卡死、内容永久模糊（原站踩过，桌面复现不到）。这种场景请改成
 *    读同步的 UA 判定常量，而不是用这个 hook。
 */
export function useIsAndroidLike(): boolean {
  const [is, setIs] = useState(false)
  useEffect(() => {
    if (typeof navigator !== "undefined" && /Android|Harmony/i.test(navigator.userAgent)) {
      setIs(true)
    }
  }, [])
  return is
}

/** 同步版：需要首帧即准确时用这个（模块级求值，SSR 下恒为 false） */
export const IS_ANDROID_LIKE =
  typeof navigator !== "undefined" && /Android|Harmony/i.test(navigator.userAgent)

/**
 * 鱼眼卡片墙 · 纯数学三件套（零依赖，可在任何框架 / 原生 JS 里用）
 *
 *   packItems        把条目打成「最短列」网格，产出可无缝平铺的一块 tile
 *   computeInstances 按当前平移量算出与视口相交的所有 tile 副本
 *   fisheye          球面（穹顶）变换：卡片离屏幕中心越远越转过去、越后退
 *
 * 三者互不依赖，可单独取用。渲染层只要做一件事：把 fisheye() 的结果拼成
 * transform 字符串写到卡片上（顺序见 fisheye 的注释）。
 */

export type FisheyeItem = {
  id: string
  /** 占几列宽，默认 1。2 = 双列大卡 */
  span?: 1 | 2
}

export type PackedCard<T extends FisheyeItem = FisheyeItem> = {
  item: T
  col: number      // 最左列的列号（0..cols-1）
  span: 1 | 2
  worldX: number   // tile 内坐标系里的左上角
  worldY: number
  width: number
  height: number
}

export type PackResult<T extends FisheyeItem = FisheyeItem> = {
  cards: PackedCard<T>[]
  cols: number
  unitWidth: number
  gap: number
  tileW: number    // 水平重复周期
  tileH: number    // 垂直重复周期（= 最高那列的高度）
}

/**
 * 最短列打包（支持双列跨列）。
 *
 *   span=1：落到当前最矮的那一列
 *   span=2：落到「相邻两列中 max(高度) 最小」的那一对，落位后两列高度一起抬平
 *
 * 打包完把 tileH 取成所有列高的最大值 —— 整块 tile 作为一个单位循环，
 * 每列在同一个 Y 回绕，不会出现逐列失步的锯齿接缝。这是无缝平铺的前提。
 *
 * ratio = 高 / 宽。统一比例会把错落瀑布流变成规整等高网格；想要错落就
 * 按条目自带比例改这里（但那样每列的回绕点会更难对齐，慎改）。
 */
export function packItems<T extends FisheyeItem>(
  items: T[],
  cols: number,
  unitWidth: number,
  gap: number,
  ratio = 1.3,
): PackResult<T> {
  const colHeights: number[] = new Array(cols).fill(0)
  const cards: PackedCard<T>[] = []

  for (const item of items) {
    const span = item.span === 2 && cols >= 2 ? 2 : 1

    if (span === 1) {
      let bestCol = 0
      let bestH = colHeights[0]
      for (let c = 1; c < cols; c++) {
        if (colHeights[c] < bestH) {
          bestH = colHeights[c]
          bestCol = c
        }
      }
      const width = unitWidth - gap
      const height = Math.round(width * ratio)
      cards.push({ item, col: bestCol, span: 1, worldX: bestCol * unitWidth, worldY: bestH, width, height })
      colHeights[bestCol] = bestH + height + gap
    } else {
      let bestStart = 0
      let bestMax = Math.max(colHeights[0], colHeights[1])
      for (let c = 1; c < cols - 1; c++) {
        const m = Math.max(colHeights[c], colHeights[c + 1])
        if (m < bestMax) {
          bestMax = m
          bestStart = c
        }
      }
      const width = unitWidth * 2 - gap
      const height = Math.round(width * ratio)
      cards.push({ item, col: bestStart, span: 2, worldX: bestStart * unitWidth, worldY: bestMax, width, height })
      const newH = bestMax + height + gap
      colHeights[bestStart] = newH
      colHeights[bestStart + 1] = newH
    }
  }

  return {
    cards,
    cols,
    unitWidth,
    gap,
    tileW: cols * unitWidth,
    tileH: Math.max(1, ...colHeights),
  }
}

export type Instance<T extends FisheyeItem = FisheyeItem> = {
  /** `${id}_${kx}_${ky}` —— 同一条目的不同 tile 副本是不同实例 */
  key: string
  card: PackedCard<T>
  worldX: number
  worldY: number
}

/**
 * 算出所有与视口相交的 tile 副本。两轴都循环，tile 作为整体回绕。
 *
 * margin：视口外额外预绘的像素，防止拖动时卡片「弹入」被看见。
 * 默认 80 是原站 A/B 实测的结论：80 与 280 相比，在真实拖动速度下弹入
 * 几乎不可察觉（移动端与桌面都是），但预绘卡片数少一大截 —— 这是该页
 * 单笔收益最大的性能改动。加大之前先确认真的看得见。
 */
export function computeInstances<T extends FisheyeItem>(
  pack: PackResult<T>,
  panX: number,
  panY: number,
  viewW: number,
  viewH: number,
  margin = 80,
): Instance<T>[] {
  const { cards, tileW, tileH } = pack
  const out: Instance<T>[] = []

  for (const card of cards) {
    const baseX = card.worldX + panX
    const kxMin = Math.floor((-baseX - card.width - margin) / tileW)
    const kxMax = Math.floor((viewW - baseX + margin) / tileW)

    const baseY = card.worldY + panY
    const kyMin = Math.floor((-baseY - card.height - margin) / tileH)
    const kyMax = Math.floor((viewH - baseY + margin) / tileH)

    for (let kx = kxMin; kx <= kxMax; kx++) {
      for (let ky = kyMin; ky <= kyMax; ky++) {
        out.push({
          key: `${card.item.id}_${kx}_${ky}`,
          card,
          worldX: card.worldX + kx * tileW,
          worldY: card.worldY + ky * tileH,
        })
      }
    }
  }

  return out
}

export type FisheyeTransform = {
  scale: number
  z: number
  rotX: number   // deg
  rotY: number   // deg
  opacity: number
}

export type FisheyeOptions = {
  /** 每偏离一个 radius 的倾角度数 */
  tiltCoefDeg?: number
  /** 倾角上限，防止卡片翻过 90° 露背面 */
  maxTiltDeg?: number
  /** z 区间：边缘后退到 zBase，中心隆起到 zBase + zRange */
  zBase?: number
  zRange?: number
  /** scale 区间：边缘 scaleMin，中心 scaleMin + scaleRange（合计不应 > 1） */
  scaleMin?: number
  scaleRange?: number
  /** 透明度专用的半径放大倍数（越大，中央「明亮区」越宽） */
  opacityRadiusFactor?: number
  opacityMin?: number
}

const DEFAULTS: Required<FisheyeOptions> = {
  tiltCoefDeg: 44,
  maxTiltDeg: 46,
  zBase: -330,
  zRange: 580,
  scaleMin: 0.45,
  scaleRange: 0.55,
  opacityRadiusFactor: 2.5,
  opacityMin: 0.35,
}

/**
 * 球面（穹顶）鱼眼。卡片贴在一个看不见的球面上，球极点＝焦点（通常是屏幕中心）：
 * 离焦点越远，卡片越「转过去朝向焦点」并向 Z 后退；焦点附近则向观众隆起。
 *
 *   d = 卡片中心到焦点的距离
 *   k = exp(-(d / radius)²)        // 极点为 1，d=radius 处 = 1/e
 *   rotY = -(dx / radius) × 44°    // 焦点右侧的卡片向左转
 *   rotX =  (dy / radius) × 44°    // 焦点下方的卡片向上抬
 *   z    = -330 + k × 580          // 中心 +250 隆起、边缘 -330 后退
 *   scale = 0.45 + k × 0.55
 *
 * ⚠️ 中心必须 z > 0（向观众隆起）：透视投影会把焦点区的卡片**连同它们之间的
 *    间距**一起放大，这才是「局部放大镜」。用 scale 放大做不到 —— scale 只放大
 *    卡片本体、间距不变，放大到一定程度邻卡就撞上了。所以 scale 上限锁在 1.0。
 *
 * ⚠️ 高斯衰减（指数里带平方）而非纯指数：平方把曲线在焦点附近压平，中央
 *    「近乎等大」的区域更宽，而 d=radius 处的值不变（仍是 1/e），远处观感不变。
 *    想要更宽的平顶把幂改成 3，想回到旧的尖峰改成 1。
 *
 * ⚠️ 透明度单独用放宽 2.5 倍的半径：其余属性用紧半径才有清晰的纵深，
 *    但亮度若也用紧半径，屏幕大部分区域会灰掉。
 *
 * 用法（顺序不能换：先按屏幕坐标平移，再绕自身中心旋转，最后缩放）：
 *   translate3d(sx, sy, f.z) rotateX(f.rotX) rotateY(f.rotY) scale(f.scale)
 *
 * ⚠️ 千万不要在卡片上再加 `filter: blur()` 做景深 —— 元素自身的 filter 会
 *    废掉它自己的 backdrop-filter，毛玻璃直接失效（现象：只有正中心那张糊）。
 *    远近感交给 z 与 scale。
 */
export function fisheye(
  cardCx: number,
  cardCy: number,
  focusX: number,
  focusY: number,
  radius: number,
  options?: FisheyeOptions,
): FisheyeTransform {
  const o = options ? { ...DEFAULTS, ...options } : DEFAULTS

  const dx = cardCx - focusX
  const dy = cardCy - focusY
  const d = Math.hypot(dx, dy)

  const k = Math.exp(-Math.pow(d / radius, 2))
  const kOpacity = Math.exp(-Math.pow(d / (radius * o.opacityRadiusFactor), 2))

  const rawY = -(dx / radius) * o.tiltCoefDeg
  const rawX = (dy / radius) * o.tiltCoefDeg

  return {
    scale: o.scaleMin + k * o.scaleRange,
    z: o.zBase + k * o.zRange,
    rotX: Math.max(-o.maxTiltDeg, Math.min(o.maxTiltDeg, rawX)),
    rotY: Math.max(-o.maxTiltDeg, Math.min(o.maxTiltDeg, rawY)),
    opacity: o.opacityMin + kOpacity * (1 - o.opacityMin),
  }
}

/** 衰减半径的推荐取法：min(视口宽, 视口高) × 0.42 */
export const FISHEYE_RADIUS_FACTOR = 0.42

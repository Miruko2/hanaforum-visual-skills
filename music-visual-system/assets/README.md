# fisheye-wall · 3D 鱼眼卡片墙

无限平铺的卡片网格 + 球面透视：靠近屏幕中心的卡片向观众隆起放大、四周的卡片
转过去朝向中心并后退。可拖拽 / 滚轮平移，松手有惯性。零第三方依赖。

先双击 `demo.html` 看效果（无构建、无依赖、不联网）。

## 文件

| 文件 | 内容 | 依赖 |
| --- | --- | --- |
| `fisheye-wall.ts` | 纯函数三件套：`packItems` / `computeInstances` / `fisheye` | 无 |
| `FisheyeWall.tsx` | React 封装：rAF 循环 + 拖动惯性 + 指针视差 + 脏检查直写 + 静止停渲 | React |
| `fisheye-wall.css` | 舞台 / 卡片 / 两档毛玻璃 / 降级分支 | 无 |
| `demo.html` | 自包含演示，也是 vanilla JS 参考实现 | 无 |

## 五分钟接入（React）

```tsx
import FisheyeWall from "./FisheyeWall"
import "./fisheye-wall.css"

<div style={{ position: "fixed", inset: 0 }}>
  <FisheyeWall
    items={tracks}                 // 需要 { id: string; span?: 1 | 2 }
    lite={isPhone}                 // 手机档：关掉指针视差
    background={<img src="/bg.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    renderCard={(item, { width }) => <MyCard item={item} width={width} />}
    onSelect={(item, rect) => openDetail(item, rect)}
  />
</div>
```

卡片内容自己写，只要**根元素铺满**给定的 width/height 即可。想要毛玻璃就在自己的
卡片根上加 `fw-glass`（或 `fw-glass-lite`）。`renderCard` 的返回值请自行 `memo`，
它每次可见集变化都会被调用。

不用 React 的话，直接照抄 `demo.html` 里的 `loop()`：那是同一套逻辑的原生实现。

## 调参

| 想要 | 改哪里 |
| --- | --- |
| 更强的凸透镜感 | 调小 `perspective`（默认 1450）。**太小会在屏幕四角露出空带**，改完要核对边缘覆盖 |
| 放大区更宽 | `fisheye()` 里把高斯的幂从 2 提到 3（曲线在焦点附近更平） |
| 中心更突出 | 加大 `zRange`（默认 580）。别改 `scaleMin/scaleRange` 去放大中心 —— 见下 |
| 边缘更小更远 | 调 `scaleMin`（0.45）与 `zBase`（-330）。zBase 变化很大时要一并调大 `margin` |
| 整体更亮 | `opacityMin`（0.35）或 `opacityRadiusFactor`（2.5） |
| 卡片更方 | `ratio`（默认 1.3 = 高/宽） |
| 更密 / 更疏 | `columns`（8）、`unitWidth`（180 / 140）、`gap`（6） |

## 验收清单

1. 屏幕中心的卡片向观众隆起放大，四周的卡片转过去朝向中心并后退。
2. 放大是**连间距一起放大**的，邻卡不会叠在一起。
3. 拖到任意方向都无限循环，看不到接缝。
4. 松手后有惯性滑行，末尾自然收住（不是硬停）。
5. 点卡片能触发 `onSelect`；拖动结束时**不会**误触发。
6. 卡片内的按钮可以点，且按住按钮拖不会带动墙面。
7. 静止时不再有样式写入（demo 右上角 `paint` 归 0）。

## 三条别踩的坑

1. **卡片上绝不能加 `filter`**（包括想当然的 `filter: blur()` 景深）。
   元素自身的 filter 会废掉它自己的 `backdrop-filter`，毛玻璃直接失效 ——
   现象是「只有正中心那张糊」（因为中心卡的模糊量恰好是 0）。远近感交给 z 与 scale。
2. **要整层隐藏卡片只能用 `visibility`，不能用 `opacity`**。
   `opacity < 1` 是 CSS grouping property，会把 `transform-style` 强制扁平化，
   透视投影瞬间塌陷 = 整面墙跳位（安卓上尤其明显）。
3. **背景不要预先模糊**。玻璃糊的就是背景那点细节，背景先糊过，玻璃就白做了。
   背景越清晰、细节越密（细线、纹理），玻璃越显。

## 性能

- 逐帧变换全部由 rAF 直写 DOM，不走框架的状态更新。
- 三道省算闸：pan 没动不重算可见集 / 静止整段跳过逐卡循环 / 每条样式写入前脏检查。
- `margin`（视口外预绘边距）默认 80。原站从 280 降到 80 是单笔收益最大的改动，
  实测在真实拖动速度下看不出卡片弹入。加大之前先确认真的看得见。
- 真机若仍卡，按这个顺序砍：指针视差 → 顶边内高光 → 玻璃降到 `fw-glass-lite`
  → 换 `fw-glass-solid`（彻底不采样背景，数量级的省法，也是最后一张牌）。

## License

MIT。

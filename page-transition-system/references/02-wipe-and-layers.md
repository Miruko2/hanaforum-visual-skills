# 02 · 三层扫屏、方向变量与主题色

## 1. 三层是什么

DOM 顺序即叠放顺序，**粉底层 → 白中层 → 黑主板顶层**：

| 层 | 类 | 内容 | 扫入 delay | 扫出 delay |
| --- | --- | --- | --- | --- |
| 底 | `.ptr-wipe-a` | 主题色渐变块 | `0s` | `0.12s` |
| 中 | `.ptr-wipe-b` | 白纸色块 `--ptr-paper` | `0.06s` | `0.06s` |
| 顶 | `.ptr-wipe-main` | 黑主板（所有装饰都长在它上面） | `0.12s` | `0s` |

单层 `0.28s cubic-bezier(0.7, 0, 0.2, 1)`。

**扫入是粉领跑、黑主板殿后**，所以黑主板落位 = 屏幕真正遮严（0.4s）。
**扫出反序**：黑板先走，粉白两条在它身后依次露脸再追走 —— 视觉上是一条拖尾彩条，
而不是三块一起消失。

## 2. 位移与斜切必须分层

```css
/* 外层：只动 translateX，唯一的合成属性 */
.ptr-wipe { position: absolute; inset: 0; will-change: transform; }

@keyframes ptr-wipe-in {
  from { transform: translate3d(calc(140% * var(--ptr-x)), 0, 0); }
  to   { transform: translate3d(0, 0, 0); }
}
@keyframes ptr-wipe-out {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(calc(-140% * var(--ptr-x)), 0, 0); }
}

/* 内层：静态斜切，永不参与动画。四周出血保证斜边转角不漏底 */
.ptr-wipe-fill,
.ptr-panel {
  position: absolute;
  top: -12%; bottom: -12%;
  left: -25%; right: -25%;
  transform: skewX(-10deg);
}
```

**不要把 skew 合进关键帧。** 合并后每帧都要重算复合矩阵，而拆开时斜切只在
首次光栅化算一次、之后每帧只是平移一张现成纹理。这是全套转场性能的地基。

出血值 `-12% / -25%` 是配合 `skewX(-10deg)` 算的：斜边在屏幕上下缘会横向偏移
约 `tan(10°) × 高度`，左右各留 25% 才不会在转角露底。**改斜角就要重算出血**。

## 3. `--ptr-x` 方向变量

根节点上由组件下发：

```tsx
style={{ "--ptr-x": dir === "next" ? 1 : -1 }}
```

`1` = 去导航环上的下一页（从右扫入、向左扫出），`-1` 镜像。
它同时被 `ptr-wipe-in/out`、`.ptr-streak`（速度线飞行方向）、
`ptr-chip-in`（副标签滑入方向）三处消费，一处改全体跟着改。

## 4. 四套主题配色

每次转场由组件随机挑一色，**排除上一次用过的**（连续转场必换色）：

```ts
const THEMES = ["pink", "purple", "green", "yellow"] as const
const pool = THEMES.filter(t => t !== lastThemeRef.current)
const theme = pool[Math.floor(Math.random() * pool.length)]
```

颜色本体全在 CSS 变量组里，组件只挂 `.ptr-theme-*` 类名，**换色零额外渲染开销**
（颜色在遮罩挂载光栅化时一次定死）。

变量组共 8 个：

| 变量 | 含义 |
| --- | --- |
| `--ptr-accent` | 主色（十六进制） |
| `--ptr-accent-rgb` | 主色的 RGB 三元组 |
| `--ptr-soft-rgb` | 浅色三元组 |
| `--ptr-paper` | 白中层纸色 |
| `--ptr-flash-c` | 满屏冲击闪的颜色 |
| `--ptr-split` | RGB 残影的冷色（与主色互补） |
| `--ptr-panel-a/b/c` | 黑主板径向渐变的三档（亮→暗） |

**为什么同时存十六进制和 `-rgb` 三元组**：需要调透明度的地方写
`rgba(var(--ptr-accent-rgb), 0.4)`，不依赖 `color-mix()` —— 旧 WebView 不支持。

四套值（`.ptr-root` 默认即 pink）：

```css
pink   accent #ff2d78  soft 255,109,168  paper #fff3f9  flash #ffe1ef  split #29e0ff  panel #221019/#120712/#09040a
purple accent #a85cff  soft 199,148,255  paper #f7f2ff  flash #ecdfff  split #2dffc8  panel #1c1026/#110a1c/#08040f
green  accent #2ee36b  soft 122,240,166  paper #f0fdf4  flash #dcffe8  split #29b6ff  panel #0f2017/#08150e/#030a06
yellow accent #ffd428  soft 255,231,122  paper #fffbeb  flash #fff3c4  split #ff4fd8  panel #221d0e/#161106/#0a0703
```

**加第五套主题**：复制一组变量 + 把名字加进 `THEMES` 数组即可，CSS 其余部分全部由变量驱动。

## 5. 根节点

```css
.ptr-root {
  position: fixed;
  inset: 0;
  z-index: 20000;   /* 盖过聊天(9999) / 公告(10000)，转场期间拦截全部交互 */
  overflow: hidden;
  pointer-events: auto;
  contain: strict;  /* 布局/绘制自包含 */
}
.ptr-root.ptr-idle { visibility: hidden; pointer-events: none; }
```

`contain: strict` 的作用是双向隔离：遮罩背后新页面挂载引发的布局失效不会波及覆盖层，
覆盖层自己的持续动画也不回头打扰页面。低端安卓收益明显。

`.ptr-idle` 见 `SKILL.md` 铁律 3 —— 根节点常驻不增删。

## 6. 完整 DOM 结构

```
.ptr-root.ptr-theme-{pink|purple|green|yellow}[.ptr-android][.ptr-idle]
         [data-phase="cover|reveal|idle"]  style="--ptr-x: 1|-1"
│
├── .ptr-wipe.ptr-wipe-a          ← onAnimationEnd("ptr-wipe-out") → finishReveal
│   └── .ptr-wipe-fill
├── .ptr-wipe.ptr-wipe-b
│   └── .ptr-wipe-fill
├── .ptr-wipe.ptr-wipe-main       ← onAnimationEnd("ptr-wipe-in") → proceedCover
│   ├── .ptr-panel                ← 唯一带 skew 的装饰容器，overflow:hidden
│   │   ├── .ptr-halftone
│   │   ├── .ptr-band.ptr-band-1  > .ptr-band-text
│   │   ├── .ptr-band.ptr-band-2  > .ptr-band-text
│   │   ├── .ptr-band.ptr-band-3  > .ptr-band-text
│   │   ├── .ptr-rows             > .ptr-row.ptr-row-1..6 > span
│   │   └── .ptr-scanlines
│   │
│   │   ↓ 以下不进 .ptr-panel：避开 skew，直接乘主板的平移
│   ├── .ptr-mark
│   ├── .ptr-title                style="--ptr-land: {n}s"
│   │   ├── .ptr-title-word
│   │   │   ├── .ptr-title-echo
│   │   │   ├── .ptr-title-ghost.ptr-title-ghost-c
│   │   │   ├── .ptr-title-ghost.ptr-title-ghost-m
│   │   │   └── .ptr-title-main   > .ptr-letter style="--ptr-i: {i}" ×N
│   │   ├── .ptr-title-hazard
│   │   └── .ptr-title-chip       > span, i, span
│   ├── .ptr-corner-no            > em("/ 04")
│   ├── .ptr-corner-loading
│   ├── .ptr-edge.ptr-edge-left
│   └── .ptr-edge.ptr-edge-right
│
├── .ptr-streaks > .ptr-streak.ptr-streak-1..6   ← 安卓不挂载
└── .ptr-flash
```

**「进不进 `.ptr-panel`」是一条硬分界**：进去的会跟着吃 `skewX(-10deg)`（网点、绶带、
文字行都要这个斜切感），标题卡/水印/角标必须**不**被斜切（否则字形变形），
所以它们是主板的直接子节点，只继承平移。

`.ptr-rows` 是个例外：它在 panel 里，但自己先 `skewX(10deg)` 把父级的斜切抵消掉，
再 `rotate(-12deg)` —— 两者乘积是纯旋转，字形不被剪切。

## 7. 合成稳定性声明

```css
.ptr-wipe, .ptr-row, .ptr-band, .ptr-mark,
.ptr-letter, .ptr-title-echo, .ptr-title-chip, .ptr-streak {
  backface-visibility: hidden;
  transform-style: flat;
}
```

只列**跑 transform 动画**的层。安卓 WebView 在位移动画下若图层不是稳定 3D 合成层，
会出现子像素重影、上一帧纹理残留、起始瞬间闪一下；配合关键帧里的 `translate3d`，
`backface-visibility: hidden` 是标准解。纯合成提示、视觉零变化，iOS 同样受益。

⚠️ **仅 opacity 动画或静态元素不要加**（加了无益，反而可能多裂图层）。
所以 `.ptr-flash`、`.ptr-halftone`、`.ptr-scanlines`、`.ptr-title-ghost` 都不在列表里。

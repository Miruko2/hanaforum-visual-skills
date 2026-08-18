# 05 · 导航、菜单、弹层、悬浮按钮

## 1. 导航栏（`components/navigation.tsx`，800 行）

```css
.navbar-blur     background: rgba(0,0,0,0.2); backdrop-filter: blur(20px) saturate(180%)
                 border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.3)
.navbar-scrolled box-shadow: 0 12px 40px rgba(0,0,0,0.4)     /* 滚动后加深 */
.smart-navbar    will-change: transform; backface-visibility: hidden
  .hidden  → transform: translateY(-120%)
  .visible → transform: translateY(0)
.page-content    padding-top: 5rem                            /* 给浮动导航栏留位 */
```
导航是**浮动**的（不占文档流），页面内容用 `.page-content` 或 `.page-container` 顶部留白。

### 导航环（`lib/view-transition-nav.ts`）
左右滑页与定向导航共用一个「环」：首页 ⇄ 弹幕墙 ⇄ 影院 ⇄ 个人中心。
`PAGE_RING` / `CINEMA_RING_PATH` / `effectiveRingPath()` / `ringDirection()` 决定方向，
`navigateWithTransition()` 给 `html` 置 `data-pt="next"|"prev"` 并调 `startViewTransition`（见 `04`）。
`/music` **不在环上**（整面画布是横向拖拽交互，在它上面滑动只归画布）。

### 移动端下拉
`.mobile-nav-bounce` **完全复用头像菜单的进/退场关键帧**（`glassDropdownIn/Out`），1:1 一致。
通过 `data-state` 切换；退场动画播放期间组件保持挂载（`onAnimationEnd` 延迟卸载）。

## 2. 通用毛玻璃下拉 `.glass-dropdown`（Radix DropdownMenu）

Radix 用 Portal 挂到 body → `backdrop-filter` 不会被祖先截断，可以放心用。

```css
background: rgba(20,20,28,0.55); backdrop-filter: blur(24px) saturate(150%)
border: 1px solid rgba(255,255,255,0.15)
box-shadow: 0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.1)
[data-state="open"]   → glassDropdownIn  0.28s cubic-bezier(0.34,1.56,0.64,1) both
[data-state="closed"] → glassDropdownOut 0.15s ease-out both
transform-origin: top center
```
`glassDropdownIn` 是弹跳式：`translateY(-8px) scale(0.92)` → 过冲 `translateY(2px) scale(1.02)` → 归位。

菜单项：`[role="menuitem"]` 等统一 `color: rgba(255,255,255,0.85)`，
`:focus` / `[data-highlighted]` 时 `background: rgba(255,255,255,0.08)` + 纯白字（**不用 popover 默认色**，
那会和站点粉/绿调打架）。`[role="separator"]` 改 `rgba(255,255,255,0.1)`。

## 3. 分类菜单（`components/category-menu.tsx`）

按钮点击弹出毛玻璃面板（Portal 定位）。打开时测量按钮视口位置，窗口变化时重测；
**`scroll` 监听用 rAF 节流 + `passive`**，高频滚动时每帧最多量一次，不阻塞合成器。
列表项点击后更新 URL 并派发 `category-changed` 事件。
`compact` prop 控制移动端宽度；`onSearchClick` 在菜单顶部显示「搜索帖子」入口。

## 4. 手机端 galgame 卡片菜单（方案 B）

```css
.menu-card-pop   menuCardPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both
                 （scale(0.8) translateY(10px) → 归位），will-change: transform, opacity
.menu-scrim-in   menuFadeIn 0.3s ease both
.menu-title-in   menuTitleIn 0.45s ease both（translateY(-8px) → 0）
```
卡片入场刻意用**纯 CSS animation（仅 transform/opacity）**而不是 framer-motion 的 JS spring
—— 后者在 Android WebView 里主线程逐帧计算会掉帧、发涩。曲线与挑选用的 demo 完全一致。

## 5. 用户社交悬浮卡 `.glass-user-card`
见 `07` 第 2 节。

## 6. 全站搜索弹层（`components/search-overlay.tsx`）

命令面板式：导航栏放大镜 / `Ctrl+K` 唤起。300ms 防抖走 `searchPostsByKeyword`
（标题/简介/正文 ILIKE）。结果行点击**直接在弹层上方打开帖子详情弹窗**（与通知页同款接线），
不跳路由 —— Capacitor 静态导出下 `/post/[id]` 动态路由不可用，弹窗方案全端一致。

面板/遮罩的进出场由 framer-motion 负责；globals.css 里是两个纯 CSS 点缀（只用 transform/opacity，
安卓 WebView 合成器安全）：

| 类 | 效果 |
| --- | --- |
| `.search-sweep` | 面板落定时输入行底边的柠檬光扫掠。1.5px 高、`bottom:-1px` 压在 `border-b` 上，`searchSweep 0.7s cubic-bezier(0.4,0,0.2,1) 0.12s forwards`（`translateX(-100% → 100%)`，一次性） |
| `.search-row-in` | 结果行错峰滑入，`searchRowIn 0.34s cubic-bezier(0.22,0.7,0.18,1) both`，`animationDelay` 由行内 style 按 index 递延 |
| `.search-row-sweep` | 结果行「打开中」进度：同款柠檬光在被点行顶边**循环**扫掠（复用 `searchSweep`，首尾都在屏外故循环无跳变），直到详情弹窗就绪 |

`resultGen` 计数器：每批新结果 +1，作为结果容器 `key` 强制重挂 → 行级入场动画每次搜索都重播。

`prefers-reduced-motion`：`.search-sweep` 关闭并 `opacity:0`；`.search-row-in` 关闭；
`.search-row-sweep` 退化为静置细线 `opacity:0.7`（仍有「在加载」的指示）。

**安卓 WebView**：遮罩/面板不上 `backdrop-filter`（改实底），与帖子详情弹窗同策略。

## 7. 模态框体系

| 类 | 用途 |
| --- | --- |
| `.modal-backdrop` | `rgba(0,0,0,0.7)` + `blur(25px) saturate(180%)`。触屏区 `transition` 只留 `background-color` |
| `.modal-backdrop-strong` | fixed 满屏 `z-index:50`，`blur(15px)` + `rgba(0,0,0,0.4)`，`modalBackdropFadeIn 0.3s forwards`（同时动 `backdrop-filter` 与底色）。**触屏改用 `touchBackdropFadeIn` 纯 opacity** |
| `.modal-content` | `blur(25px)` 玻璃 + 24px 圆角 + `isolation: isolate`；`::before` 用 `mask-composite: exclude` 做 1.5px 渐变描边环；滚动条 thumb lime 竖向渐变 |
| `body.modal-open` | `overflow:hidden; touch-action:none`（滚动锁定，位置记在 `--original-scroll`） |

## 8. 悬浮发帖按钮（`components/floating-action-button.tsx`）

```css
.floating-action-button  fixed bottom-2rem right-2rem, 3.5rem 圆
  background: linear-gradient(135deg, rgba(132,204,22,0.95), rgba(163,230,53,0.85))
  backdrop-filter: blur(20px) saturate(120%)
  box-shadow: 0 8px 32px rgba(132,204,22,0.5), 0 0 20px rgba(132,204,22,0.3),
              inset 0 1px 0 rgba(255,255,255,0.3)
  transition: 0.4s cubic-bezier(0.23,1,0.32,1)（触屏区排除 backdrop-filter）
  :hover  → translateY(-5px) scale(1.05) + 投影加强；::before 白色径向高光 opacity 0.4
            svg → rotate(90deg) scale(1.15)
  :active → translateY(-2px) scale(1.02)
```

**按钮与发帖面板是同一个常驻元素**：点击后按钮经 framer-motion 的 layout FLIP
「果冻形变」成居中面板，关闭时反向缩回按钮位。lime 按钮壳是一层 opacity 交叉淡出的内层。

```
OPEN_SPRING  = { stiffness: 290, damping: 21, mass: 1 }    // 低阻尼过冲回弹
CLOSE_SPRING = { stiffness: 380, damping: 28, mass: 0.9 }  // 高阻尼干脆利落
FAB_CENTER_OFFSET = 52  // 按钮中心到视口右/下边缘的距离（24px 边距 + 半径 28）
```

### 安卓分支（踩坑记录，别回退）
layout FLIP 在安卓 WebView 实测闪屏（每帧 `borderRadius` 校正 + `boxShadow` 插值都在重绘剧烈变尺寸的图层，
纹理重分配跟不上）。安卓改走纯 `transform`/`opacity` 假形变：面板一次光栅化后整体从按钮位飞行+缩放弹入，
果冻壳交叉淡出，全程合成线程、零每帧重绘。

再优化（消果冻弹入卡顿 + 绿色中途让位）：飞行/缩放阶段给表单整树 `visibility:hidden`，
只让纯色面板 + lime 果冻壳做弹簧，`backdrop-filter` 子树零绘制。两个时机解耦：
- 果冻壳 **240ms**（弹窗冲到最大、回弹动态中）就溶解、露出深色面板底（绿色中途让位，不等弹窗站定）
- 毛玻璃表单约 **480ms**（`scale` 贴近 1）才点亮 —— 缩放途中绘制 `backdrop-filter` 会逐帧重采样卡顿
  （最初病根），必须等到位；其间深色空盒短暂露出（约 0.08s）再浮现内容。

**毛玻璃样式本身不变**，只改时序。安卓还有「延帧起跑」：面板先以透明态挂载 2 帧完成光栅化再放弹簧。

## 9. 通知铃铛（`components/notification-bell.tsx`）

未读数徽标（数字滚层动画版）：
- 出现/消失：spring 弹入（带过冲回弹）、缩小淡出，替代原来的硬切
- 数字变化：旧数字向上滑出、新数字从下滑入，像里程表翻一样
- 常驻呼吸（`animate-pulse`）保留在**底色层**，不与 framer 的透明度动画打架
- `count > 99` 显示 `99+`

`PostDetailModal`（1087 行）走 `dynamic(..., { ssr: false })` 动态导入
—— 通知铃在 Navigation 里常驻，不能让它把详情弹窗静态链拉进首屏。

## 10. 归档/分类切换条（`components/archive-tabs.tsx`）

复用首页排序 pill 的 framer-motion `layoutId` 滑块 + 同一条 spring，视感与首页一致。

**与首页唯一不同是「切换即换页」**：每个 tab 是不同路由（全部 → `/posts/page/1`，
各分类 → `/c/{分类}`），而 `layoutId` 跨路由不保留（页面卸载重建，滑块会直接出现在新位置、不会滑）。

所以顺序反过来：**点击时先滑，滑完再导航。**
```
点击 → preventDefault → 本地 state 换选中项（组件还挂着，layoutId 正常滑）
     → SLIDE_MS (260ms) 后 router.push → 新页面帖子模糊渐入（.archive-enter）
```
⚠️ 曾试过「新页面挂载时从 `sessionStorage` 记的旧位置滑过来」，在 StrictMode 下 effect 双跑
会把记忆提前写成当前 tab，滑块卡在旧位置不动。**别再走那条路。**

⚠️ 链接是真实 `<a>`（`Link`）：Ctrl/中键点击照常开新标签（不拦），爬虫也能顺着走
—— 分类落地页此前只能从页脚进入。

## 11. 滚动入场包装器（`components/animate-on-scroll.tsx`）

framer-motion `useInView` 驱动，`animation` 五选一：
`fade` / `slide-up`（y 50→0）/ `slide-right`（x -50→0）/ `scale`（0.8→1）/ `bounce`（`backOut` 缓动）。
默认 `threshold 0.2`、`duration 0.5`、`once true`。
**帖子卡不用它**（有自己的两段式雾中浮现，见 `03`）。

## 12. 左右滑页手势（`components/page-swipe.tsx`）

仅触屏。阈值：
```
MIN_DX = 72      // 最小横向位移 px
MAX_DT = 600     // 最长手势时长 ms
DOMINANCE = 1.6  // 横向位移须为纵向的 1.6 倍以上
```
起点若落在可横向滚动的容器内（图片横滑条等）则让位给容器自身滚动
（`insideHorizontalScrollable()` 向上遍历查 `scrollWidth > clientWidth` 且 `overflow-x: auto|scroll`）。
手指左滑 = 去环上右侧的下一页，配合撕纸遮罩转场。

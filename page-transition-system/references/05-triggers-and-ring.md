# 05 · 触发方式、导航环与入口分发

全在 `lib/view-transition-nav.ts` 与 `components/page-swipe.tsx`。

## 1. 两个顺序表

```ts
// 滑动切页环：首尾循环
export const PAGE_RING = ["/", "/live", CINEMA_RING_PATH, "/profile"] as const

// 方向判定序：比环多了 music 与 home
const NAV_ORDER = ["/", "/live", CINEMA_RING_PATH, "/music", "/profile", "/home"] as const
```

**为什么是两张表**：`music` 与 `home` 不能滑动切页——music 整面画布是横向拖拽交互，
home 是 3D 场景要吃拖拽/旋转，在它们上面滑动只归各自的画布。但从导航栏点进出时
仍然要有方向感，所以它们进 `NAV_ORDER` 不进 `PAGE_RING`。

`home` 排在 `NAV_ORDER` 末位：从任何页面进家园 = 向前翻，家园回去 = 向后翻。

```ts
export function ringDirection(fromPath, toPath): "next" | "prev" | null {
  // 两个路径都在 NAV_ORDER 上且不同 → 返回方向；否则 null（调用方退化为普通 push）
}
```

**加新页面能被滑到**：往 `PAGE_RING` 和 `NAV_ORDER` 都加，位置决定方向语义；
只想有转场不想能滑 → 只加 `NAV_ORDER`。别忘了同时往 `CARDS` 加文案（`03` §10）。

## 2. 滑页手势的四道闸门

`page-swipe.tsx`，仅触屏（`HAS_TOUCH` 模块级同步取值）。

**闸门一 · 起点过滤**（`touchstart`）：

```
多指           → 忽略（e.touches.length !== 1）
弹窗锁滚动中   → 忽略（body.modal-open 或 body.style.overflow === "hidden"）
不在页面内容区 → 忽略（!target.closest("[data-page-transition-root]")）
                 ← portal 到 body 的浮层（聊天/菜单/Toast）天然排除
表单与媒体元素 → 忽略（input/textarea/select/contenteditable/audio/video）
显式退出标记   → 忽略（[data-page-swipe-ignore]）
横向可滚容器内 → 忽略（向上遍历祖先找 scrollWidth > clientWidth 且 overflowX auto/scroll）
```

**闸门二 · 手势判定**（`touchend`）：

```ts
MIN_DX    = 72    // 最小横向位移 px
MAX_DT    = 600   // 最长手势时长 ms —— 慢拖不算，必须是"轻扫"
DOMINANCE = 1.6   // |dx| 必须是 |dy| 的 1.6 倍以上，避免和纵向滚动混淆
```

**闸门三 · 环位有效**：未登录时环里过滤掉 `/profile`；当前路径不在环上直接 return。

**闸门四 · 转场锁**：`navigateWithTransition` → 遮罩组件的 `runningRef`，
冷却期内静默忽略（`01` §7）。

首尾循环：`(idx + (dx < 0 ? 1 : -1) + ring.length) % ring.length`。
手指左滑 = 去环上右侧的下一页。

监听器只绑一次，路径 / 登录态 / 影院态 / router 全部通过 ref 取最新值 —— 
避免每次状态变化都重绑三个全局 touch 监听。三个监听器都是 `{ passive: true }`。

## 3. 影院虚拟环位

`"/cinema"` 不是真路由，是「首页 + 影院模式开」的虚拟环位：

```ts
export const CINEMA_RING_PATH = "/cinema"

// 当前所在环位
effectiveRingPath(pathname, cinemaOn) = pathname === "/" && cinemaOn ? "/cinema" : pathname

// 转场不可用时的兜底翻译
toRealHref("/cinema") = "/?cinema=1"     // CinemaModeProvider 消费这个深链
```

转场执行器负责把它落成 `push("/") + setCinemaMode(true)`。
**已在首页时进出影院没有路由变化**，所以 `proceedCover` 里会检测 `sameRoute`
并跳过 commit 等待（否则白等 1.5s 超时）——视图切换由 React 状态驱动，
`MIN_HOLD` + 双 rAF 足以覆盖首绘。

## 4. 入口分发与三条退路

唯一入口是 `navigateWithTransition(router, href, dir)`：

```ts
if (reduced-motion || document.visibilityState === "hidden") {
  router.push(toRealHref(href)); return          // ① 无转场
}
if (TRANSITION_MODE === "ribbon" && ribbonNavigator) {
  ribbonNavigator(href, dir); return             // ② 撕纸转场 ← 实际总是走这里
}
navigateWithFlip(router, toRealHref(href), dir)  // ③ 立方体（内部再退化为普通 push）
```

**执行器注册**：遮罩组件挂载时调 `registerRibbonNavigator(start)` 把自己的 `start`
注册进模块级变量，卸载时注销。这是一个极简的命令式桥 —— 让纯逻辑模块
（`view-transition-nav.ts`）能调用 React 组件内部的函数，而不需要 context。

调用方：
- `page-swipe.tsx` —— 触屏轻扫
- `navigation.tsx` —— 导航栏点击（先 `ringDirection` 求方向）
- `home-cameo.tsx`、`HomeEventOverlay.tsx`、`HomeTutorial.tsx` —— 走
  `navigateWithTransitionFrom(router, fromPath, href)`，目标不在导航序上时
  统一按「向前翻」出场（方向只影响扫屏朝向，有转场总比直接闪切好）

## 5. 休眠的立方体备选（View Transitions API）

**当前看不到效果**，因为：

```ts
export const TRANSITION_MODE = "ribbon" as TransitionMode
```

`PageRibbonTransition` 在 `providers.tsx` 里常驻挂载 → `ribbonNavigator` 永远非空 →
上一节的分支 ② 永远命中，分支 ③ 够不到。**排查「转场不对劲」时不要从这里找原因。**

改成 `"cube"` 即可切回。它的实现（CSS 在 `globals.css` 的 `html[data-pt]` 段 +
4 条 `pt-cube-*` 关键帧）：

```css
html[data-pt]::view-transition                    /* 兜底壁纸，填充旋转露出的边角 */
html[data-pt]::view-transition-image-pair(root)   { perspective: 1400px; }  /* 共享相机 */
html[data-pt]::view-transition-old(root),
html[data-pt]::view-transition-new(root) {
  transform-origin: 50% 50% -50vw;                /* 旋转轴在屏幕中心后方半个屏宽 */
  animation-duration: 0.5s;
  animation-timing-function: cubic-bezier(0.45, 0.05, 0.25, 1);
}
```

要点（若将来切回去用得上）：
- 旋转轴放在屏幕中心**后方半个屏宽** = 立方体中心，两面共享同一消失点才不散架。
- **不用 `preserve-3d`**：安卓上有扁平化跳位坑。`perspective` 挂在 image-pair 容器上即可。
- 旋转露出的边角由 `::view-transition` 的静止壁纸填充，看到的是壁纸而非已就位的新页，
  保住转体错觉。
- `navigateWithFlip` 在 `startViewTransition` 的回调里等 `waitForRouteCommit(800)`，
  新路由 commit 后才放行旧页快照冻结。
- 浏览器支持判定 `supportsViewTransition` 也是模块级同步取值（Chrome/Edge/
  安卓 WebView 111+、Safari 18+），不支持直接 `router.push`。

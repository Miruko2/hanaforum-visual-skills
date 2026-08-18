---
name: page-transition-system
description: 绝区零式 MG 路由转场系统：覆盖→换页→揭开的三层斜切扫屏遮罩，主板上叠胶片绶带、巨型镂空描边文字、半调网点、速度线、逐字砸入的标题卡与 RGB 残影；含四套主题配色、由 animationend 驱动的时序状态机、滑动手势与导航环、以及一整套安卓 WebView 花屏对策。当需要改动/排查页面切换转场、给新页面加转场卡、调时序或主题色、修「切页闪屏/花屏/卡住」、或在别的项目里复刻这套转场时使用。正文开头有按需读取路由表，可精确定位到某一册的某一节。附带可直接复制的自包含套件（assets/ribbon-transition.css + RibbonTransition.tsx + demo.html）。
---

# 路由转场系统（绝区零式 MG 遮罩）

## 这是什么

站点切换页面时全屏播放的那套二次元游戏风转场：三层斜切色块交错扫过屏幕把旧页盖住 →
在遮罩背后换页 → 三层反序扫出露出新页。遮罩满屏的那 0.44 秒里是一整幅动态海报：
胶片绶带斜穿、巨型镂空描边文字交错滚动、标题逐字砸入并炸出 RGB 残影。

**代码分布**：CSS 全在 `app/globals.css` 的 `.ptr-*` 段（约 730 行、53 个类、17 条关键帧），
组件是 `components/page-ribbon-transition.tsx`（347 行），触发与导航环在
`components/page-swipe.tsx` 与 `lib/view-transition-nav.ts`。

**范围**：只管**路由级**转场（整页 A → 整页 B）。元素级的共享转场不在这里：
- 帖子卡飞到详情弹窗的 hero 转场 → skill `site-visual-system` 的 `03` §7、`08` §1
- 悬浮按钮变居中弹窗的果冻形变 → skill `site-visual-system` 的 `05` §8

## 按需读取路由（先看这张表，命中即停）

**分册加起来约 50KB，绝大多数任务只需要其中一册。** 命中某一行就只读那一行，
其余分册与 `assets/` 一律不要读。

| 我想做的事 | 只读这些 |
| --- | --- |
| 转场卡住 / 提前露出新页 / 换页瞬间闪一下 | `references/01` |
| 改时长、停留、冷却等任何时序常量 | `references/01`（**改一处要同步 CSS 和组件两边**） |
| 改扫屏方向、斜角、层数、主题配色 | `references/02` |
| 加 / 改主板上的装饰（绶带、巨字行、水印、标题卡、角标、速度线） | `references/03` |
| 给新页面加一张转场卡（文案 / 编号 / 符号） | `references/03` §5 + `references/05` §1 |
| 安卓花屏 / 白块 / 鬼影 / 连续快滑掉帧 | `references/04` |
| 改触发方式：手势阈值、导航环顺序、哪些页面能滑 | `references/05` |
| 在别的项目里复刻这套转场 | `SKILL.md` 的「可复制成品」节 + `assets/` |
| 立方体翻页（View Transitions）为什么看不到 | `references/05` §4 |

## 分册索引

| 文件 | 内容 |
| --- | --- |
| `references/01-timeline-and-state-machine.md` | 七个时序常量、cover→reveal→idle 状态机、为什么用 `animationend` 而不是定时器、代际作废、路由 commit 等待、三层兜底 |
| `references/02-wipe-and-layers.md` | 三层斜切扫屏的分工（外层平移 / 内层斜切）、级联延迟、`--ptr-x` 方向变量、四套主题色变量组、完整 DOM 结构树 |
| `references/03-decor-layers.md` | 主板上每一层装饰的实现：半调网点、胶片绶带、巨型文字行、水印、标题卡入场链（逐字砸入 + 回声 + RGB 残影 + hazard + chip）、角标、速度线、冲击闪、每页文案表 |
| `references/04-android-and-perf.md` | 安卓花屏的真机形态与三路对策（兜底色 / 削峰 / 错峰）、逐项降级清单、合成器纪律、加新装饰的检查表 |
| `references/05-triggers-and-ring.md` | 导航环模型、滑页手势的四道闸门、影院虚拟环位、入口分发与三条退路、休眠的立方体备选 |

## 可复制成品（`assets/`）

| 文件 | 内容 |
| --- | --- |
| `assets/ribbon-transition.css` | 全套 CSS：主题变量组、三层扫屏、全部装饰层、安卓降级段。纯 CSS 无依赖 |
| `assets/RibbonTransition.tsx` | React 驱动：状态机、`animationend` 推进、代际作废、安卓装饰错峰、命令式 `useRibbonTransition()` 接口。不绑定 Next.js |
| `assets/demo.html` | 自包含演示页，浏览器双击即开（无构建、无依赖、不联网），也是 vanilla JS 参考实现 |

## 四条不可违背的铁律

1. **换页时机由 `animationend` 驱动，绝不用定时器准点换页。**
   主线程繁忙时（连续快滑、新页面正在水合）CSS 动画会比 JS 定时器晚开跑，
   定时器到点换页时屏幕可能还没遮严 → 概率性闪屏，安卓最明显。
   定时器只作 `animationend` 丢失（切后台等）的兜底，且必须带代际校验。

2. **全程只动 `transform` / `opacity`。**
   无 `backdrop-filter`、无 `filter`、无 `preserve-3d`、无 `clip-path` —— 安卓 WebView 安全。
   斜切由内层**静态** `skewX(-10deg)` 承担，位移由外层 `translateX` 承担，
   **两层不能合并**：合并后每帧都要重算斜切矩阵。

3. **遮罩根节点常驻 `body`，不随转场增删。**
   反复增删 fixed 满屏节点会让 body 子节点与层叠上下文来回变动 → 整树重新分层，
   这是安卓闪屏的诱因之一。空闲态用 `visibility:hidden` + `pointer-events:none`
   （`.ptr-idle`），内容不挂载，零渲染开销。

4. **每个大面积色层都要单独声明不透明的 `background-color`**，渐变用 `background-image` 叠在其上。
   不透明底色让合成器记住本层兜底色：光栅化跟不上时缺失的瓦片按底色填充，
   而不是透出下层白纸层。安卓「整块露白」花屏的直接解法就是这一条。

## 上手顺序

改这套转场前先读 `references/01`——**时序是它的骨架**，任何视觉改动都可能撞上
时序假设（比如加一个 0.6s 的入场动画会超出 `MIN_HOLD_MS` 的 440ms 停留窗口，
动画没播完遮罩就开始扫出）。

加新装饰层则先读 `references/04` 末尾的检查表，那里列了新层必须满足的合成器条件。

## 相关源码定位

- CSS：`app/globals.css` 的 `.ptr-*` 段（搜 `.ptr-root {` 定位起点，搜 `.ptr-android` 定位降级段）
- 遮罩组件：`components/page-ribbon-transition.tsx`
- 触发：`components/page-swipe.tsx`（触屏轻扫）、`components/navigation.tsx`（导航栏点击）
- 导航环与入口分发：`lib/view-transition-nav.ts`
- 路由 commit 通知：`components/page-transition.tsx`
- 挂载点：`components/providers.tsx`

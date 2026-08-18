# 09 · 其它页面 + 性能与平台降级总则

## 1. 全站背景层（`app/layout.tsx` + `components/app-background.tsx`）

```
layout 默认底图 /mos-background-1920.webp（fixed, z-index:-1）
  └─ AppBackground：用户自设的首页背景，fixed z-index:-1，叠在默认底图之上
       未设置/还原后渲染空 → 露出默认底图（故不传 baseUrl）
       切换走 CrossfadeBackground（高斯模糊渐入交叉淡入，与 /music 同款）
```
⚠️ `AppBackground` 挂在 `providers` 的 `SimpleAuthProvider` **内**、`PageTransition` **外**
—— 避免被切页动画的 `opacity` 波及。

**这层固定底图是全站所有 `backdrop-filter` 的采样源。** 任何新增玻璃面板只要祖先链上没有
`filter`/`opacity`，就能采到它。字体 `Inter`（`next/font`，仅 latin subset）。

## 2. 友链页 `/links`

⚠️ **服务端组件**（无 `"use client"`）：友链必须作为真实 `<a>` 渲染进初始 HTML
（导航站收录检查程序和搜索引擎才读得到）。因此**无法做平台判定，动效只能纯 CSS**。

### 卡片 hover（复刻帖子卡，见 `03`）
结构同帖子卡：transform 挂 wrapper `.friend-card-wrap`、毛玻璃 + 流光挂内层 `.friend-card`。
仅 `@media (hover:hover) and (pointer:fine)`：
```css
.friend-card-wrap:hover                            transform: translateY(-6px) scale(1.05); z-index:20
.friend-grid:hover .friend-card-wrap:not(:hover)   transform: scale(0.96)      /* 邻卡后退 */
.friend-card-wrap:hover .friend-card::before       animation: cardSheenSweep 0.9s   /* 复用帖子卡流光 */
```
`.friend-card::before` 流光层与帖子卡完全同参（115° 白 0.16 + lime 0.12，`translateX(-130%)` 起手）。
`prefers-reduced-motion` 下 `transform: none !important` + 流光关闭。

### 入场 `.links-enter`
`blurFadeIn 1s cubic-bezier(0.23,1,0.32,1) both`，逐元素 `animation-delay` 由 `page.tsx` 内联给出，
营造自上而下「雾中浮现」。
⚠️ 只挂在**非毛玻璃块**（标题/小标题/说明）或**毛玻璃块本体**（本站信息 section、各 `.friend-card`），
**绝不能挂 `.friend-card-wrap` 或网格 `<section>`** —— 祖先 filter 会废掉子级 `backdrop-filter`。

数据来自 `friend_links` 表（不再硬编码），后台 `/admin/friend-links` 可视化增删改，
`force-dynamic` 保证改完下次访问即生效。表单组件 `_components/friend-link-apply-form.tsx`。

## 3. 归档 / 分类聚合页 `/posts/page/[n]`、`/c/[category]`

视图与元数据构造收敛在 `app/c/_components/category-view.tsx`（两个路由只在「第几页」上不同）。

入场 `.archive-enter` = `blurFadeIn 0.55s`（同曲线，比友链快 —— 一页 24 条，1s + 长错落会拖）。
⚠️ 只挂**卡片本体 `<article>`**（它自己就是那个毛玻璃块），挂到 `<section>` 列表容器上
会让整页卡片的毛玻璃失效。错落延迟内联给出，**上限压在第 8 条**，之后同时出现。

切换条见 `05` 第 10 节（`ArchiveTabs`，先滑后换页）。
页脚 `SiteFooter`：`bg-black/30 backdrop-blur-xl` + `border-t border-white/10`，
栏目标题 `text-xs tracking-[0.25em] text-lime-300/70`。
⚠️ **页脚只挂「有底」的页面**（帖子详情、分类页、归档页、作者页）。首页是虚拟化无限滚动，
页脚会被不断往下推、读者永远滚不到 —— 首页顶部链接行方案试过，视感不合已回退。

## 4. 下载页 `/download`

按设备类型分流：iOS → 引导添加到主屏幕（Safari 不支持 `beforeinstallprompt`，只能手动）；
安卓 → 直接下载 APK（Supabase Storage `downloads` public bucket 的 `app-release.apk`）；
桌面 → 引导安装 PWA。`isStandaloneDisplay()` 判定与 `navigation.tsx` 保持一致
（`display-mode: standalone` 或 iOS 的 `navigator.standalone`）。

## 5. 后台面板 `/admin`

相关文件：`app/admin/page.tsx`（2183 行）、`components/admin/moderation-panel.tsx`（754 行）、
`friend-links-panel.tsx`、`mengmegzi-agent-panel.tsx`、`platform-quota-panel.tsx`

把原本死板的 `bg-gray-900` 实底卡片换成「糊身后站点底图」的磨砂玻璃。
**分两档，避免嵌套 `backdrop-filter` 反复采样浪费 GPU**：

| 类 | 说明 |
| --- | --- |
| `.admin-panel-glass` | 顶层卡片/对话框：`rgba(22,24,32,0.5)` + `blur(22px) saturate(140%)`，`border-radius: 1.1rem`（覆盖 shadcn Card 的 `rounded-lg`），真 `backdrop-filter` |
| `.admin-tabs-glass` | tab 容器：更通透（`0.45` + `blur(18px)`），`border-radius: 1rem`，像挂在卡片之上的玻璃导航条 |
| `.admin-inset-glass` | 卡片内部子块（配置回显/开关行/列表外框）：**纯半透明实底 `rgba(0,0,0,0.22)`，不再叠模糊** —— 嵌套模糊既贵又会采样到父卡片内容而非页面底图，观感反而脏。`border-radius: 0.85rem` |

⚠️ 这三个类**必须放在 `globals.css` 文件末尾**，靠 CSS 源码顺序盖过 Tailwind 的 `.bg-card` 基类。

触屏 / 安卓（`@media (hover: none)`）：降级为高不透明度纯实底
`rgba(20,22,30,0.92)` + `backdrop-filter: none`。

入场 `.admin-tab-enter` = `blurFadeIn 1.2s cubic-bezier(0.23,1,0.32,1) both`
（在 `.profile-glass` 的 1.6s 基础上缩短，切页更跟手）。Radix 切 tab 会重挂内容，动画自然重放。
⚠️ 必须挂在**和 `.admin-panel-glass` 同一个元素**上，不能挂 `TabsContent` 包裹层。

## 6. 通知页 / 搜索页 / 封禁页

- `/notifications` → `components/notifications-content.tsx` + `notification-card.tsx`
- `/search` → `app/search/page.tsx`（弹层版见 `05` 第 6 节）
- `components/banned-screen.tsx`：全站封禁页，`position:fixed; inset:0; z-index:99999`，
  `rgba(5,5,7,0.96)` + `backdropFilter: blur(2px)`，红色描边卡片（`rgba(248,113,113,0.35)`），
  只留「退出登录」出口。样式**内联写死**（不依赖任何全局类，确保被封时也能正常显示）。
- `components/email-verify-gate.tsx`（605 行）：邮箱验证闸门。

## 7. 首页每日客串（`components/home-cameo.tsx` + `.module.css`）

论坛首页「每天碰一次」的角色客串：一段 ~7 秒无声电影
（从左侧走到中间 → 转身面向用户 → 挥手打招呼 + 对话气泡 + 语音 → 停一会 → 淡出卸载）。

视觉实现要点（**别改成「看起来更直接」的写法**）：
- 人物是**离线预渲染的透明精灵图逐帧**，不是现场 3D —— 现场渲染要拖 three.js + 6~11MB VRM，
  低端安卓解析那一下就能冻住主线程。
- 横向位移用 CSS `transform` 驱动，精灵图里只有「原地走路循环」→ 适配任意屏宽。
- **一个 rAF 循环同时算位移和帧号**（都用 `elapsed` 推导），不用 `setInterval`
  —— 切到后台时浏览器自然暂停，回来接着走，不会「帧号跳一大截」。
- `.root` 是 body 下的**固定定位兄弟节点**（`z-index: 60`，低于弹窗 9990+ 与导航下拉，
  高于帖子墙与 FAB 50），`height: 0` 自身不占空间、`pointer-events: none` 只有人物本身可点。
  **不包住帖子墙** —— 首页帖子卡是 `backdrop-filter` 毛玻璃，祖先一旦成为 backdrop root 玻璃就废了（踩过）。
- `.figure` `transform-origin: left bottom`（脚底），`transform: translate3d(var(--cameo-x),0,0) scale(var(--cameo-scale))`，
  避免逐帧触发布局；缩放倍数由 JS 按屏宽给（精灵图是 1 倍尺寸绘制的，**只论缩不许放**，放大会糊）。
  淡入淡出的 `opacity`/`transition` 只作用在自己身上。
- 气泡复用家园的 `PersonaBubble`（纯 DOM + CSS module，零 3D 依赖），语音复用 `voicePlayer`，
  台词复用 `lines.ts`。门控（每设备每天一次 / 省流量 / `reduced-motion`）在
  `lib/companion/cameo.ts`，有测试。调用方 `app/home-page-client.tsx` 先过门控再 `dynamic import`，首屏零成本。

## 8. 性能与平台降级总则

### 判定入口
| 方法 | 位置 |
| --- | --- |
| `isAndroidRuntime` | `lib/view-transition-nav.ts` |
| `/Android\|Harmony/i.test(navigator.userAgent)` | `virtual-post-list.tsx`（帖子卡降级） |
| `useIsAndroid` / `useIsAndroidApp` | `app/music/_lib/useIsAndroid.ts` —— **必须首帧即准确**（见下） |
| `useIsMobile` / `useReducedMotion` | `app/music/_lib/`、`hooks/use-mobile.tsx` |
| `postHasSubjectPop(post)` | `lib/post-images.ts`（决定 `.cv-auto` vs `.cv-lite`） |

⚠️ `useIsAndroid` 首帧必须为真值：它驱动列表 `motion.div` 的 `initial` filter，
若切到时 `filter` 变体才出现，framer-motion 会撒手不管 filter → blur 卡死、列表永久模糊
（已踩坑，桌面复现不到）。

⚠️ 用 UA 判定的降级类要在客户端挂载后再打，SSR/首帧按「非安卓」渲染，避免 hydration 不一致。

### 降级手法清单（按性价比排序）
1. **纯色底替代 `backdrop-filter`** —— 数量级省。`backdrop-filter: none` + 提高 `background`
   不透明度。适用于不透明内容卡（首页帖子、后台面板）。
2. **缩小高斯核** —— 约省一半。`blur(20px) → blur(6px)`。仍每帧实时采样，
   「复制背景 + 合成」的大头还在。
3. **`content-visibility: auto`** + `contain-intrinsic-size: auto <h>` —— 跳过视口外元素的
   布局/绘制/合成。⚠️ 自带 paint containment，会裁掉越框的绝对定位子元素。
4. **满屏渐变改实色** —— 纯色层走 Chromium solid-color 快路径，不分配纹理。
5. **描边文字改实心填充** —— `-webkit-text-stroke` 要为每个字形生成独立描边路径纹理。
6. **不透明 `background-color` 兜底** —— 缺瓦片时按图层底色填充，白花屏变「暗色一闪」。
7. **动画错峰挂载** —— 重纹理层延后 ~110ms 上并配淡入，把光栅化高峰摊开。
8. **静态化循环动画** —— 保留姿态与淡入，去掉无限位移 → 图层并回父层。
9. **收窄图层尺寸** —— 出血 `-25% → -10%`，纹理面积直接下降。
10. **`will-change` 及时释放** —— 不要常驻。安卓合成器内存吃紧会丢瓦片 = 闪屏。

### 铁律复述
- `backdrop-filter` 永不进 `transition`/`animation`；带它的元素 `transition` 显式列属性不用 `all`。
- `filter` 与 `backdrop-filter` 只能同元素，绝不祖孙。
- hover 效果一律包 `@media (hover:hover) and (pointer:fine)`。
- 循环动画只动 `transform`/`opacity`；`filter: blur()` 只用于一次性入场。
- 跑位移动画的层加 `backface-visibility: hidden` + `transform-style: flat`（安卓防子像素重影/残留）；
  纯 opacity 层和静态层**不加**。

### 测量
`/music?perf` 的 `PerfHUD`（详见 skill `music-visual-system` 的 `08`）是站内唯一实时性能面板：
`fps · avg 帧时 · max 帧时 · 掉帧率`。**优化卡顿前先拿数字，不要盲改。**

## 9. 需要清理的死路径（改动时留意）
- `app/music/_components/` 下四个未挂载的死文件：`AudioTopography.tsx`（初版地形波，已被 V2 取代）、
  `AudioSpectrum.tsx`、`CoverBackdrop.tsx`、`VideoBackdrop.tsx`。详见 `music-visual-system` 的 `05`。
- `post.image_ratio` → `useWideTemplate`：`GlassMorph` 的 `wideTemplate` 需配 `adaptiveHeight`
  才生效，而无调用方传 `adaptiveHeight`，当前是 dead path。
- `.light-effect` / `@keyframes lightPulse` 已移除（渲染它的 `BackgroundEffects` 是死组件），
  但 `prefers-reduced-motion` 段里还残留一条 `.light-effect` 规则。

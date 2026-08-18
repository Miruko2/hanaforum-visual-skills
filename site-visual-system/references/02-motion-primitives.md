# 02 · 动效原语：缓动语言、关键帧库、入场机制、门控

## 1. 四条缓动曲线的语义分工

| 曲线 | 语义 | 典型用途 |
| --- | --- | --- |
| `cubic-bezier(0.23, 1, 0.32, 1)` | **主力曲线**（快出慢收，无过冲） | 卡片 hover 位移、毛玻璃入场、`blurFadeIn`、流光扫过、hero 回飞 |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` | **回弹**（末段过冲） | 下拉菜单/悬浮卡弹入、头像 hover 放大、菜单卡 pop、主体弹出入场 |
| `cubic-bezier(0.22, 0.7, 0.18, 1)` | 轻快滑入（比主力更急） | 搜索结果行滑入、hero 回飞后逐行登场 |
| `linear` | 匀速无缝循环 | 跑马灯、影院海报墙、彩带滚动、CRT 扫描 |
| `ease-out` `0.1~0.15s` | 跟手 | 3D 倾斜跟随鼠标、退场动画 |

**时长档位**：跟手 `0.12~0.15s` / 交互反馈 `0.25~0.35s` / 入场 `0.45~0.6s` /
重量级入场 `1~1.6s`（毛玻璃雾中浮现）/ 循环 `3~32s`。

## 2. 关键帧总表（`app/globals.css`）

按归属分组。改动效前先在这里找有没有能复用的。

### 通用 / 基底
| 关键帧 | 作用 |
| --- | --- |
| `float` | 背景粒子上浮飘移，`20s infinite` |
| `avatarGlow` | 头像粉色光环呼吸，`3s infinite` |
| `fadeIn` / `zoomIn` | Tailwind `@layer utilities` 里的 `.fade-in` / `.zoom-in`，配 `.animate-in`（300ms，`cubic-bezier(0.16,1,0.3,1)`） |
| `spin` | `.loader` / `.image-loading-spinner`，`1s linear infinite` |
| `blurFadeIn` | **最常复用的入场**：`opacity 0→1 + translateY(20px)→0 + blur(24px)→0` |
| `modalBackdropFadeIn` | 模态遮罩 `blur(0)→15px` + 底色渐入（触屏改用 `touchBackdropFadeIn` 纯 opacity） |
| `mpb-eq` | 音乐卡「正在播放」均衡器条 `scaleY(0.32↔1)`，`0.9s infinite`，纯 transform |

### 帖子卡（详见 `03`）
`cardSheenSweep`（斜向流光扫过）、`postEnterBlurReveal`（雾中浮现 1.1s）、
`postEnterCheapReveal`（安卓廉价版 0.55s，纯 transform）、`popAutoIn` / `popAutoSway`（主体弹出与待机晃动）、
`popCardTiltIn` / `popCardTiltSway`（卡体同相倾斜）、`heroReturnHold` / `heroReturnRowReveal`（hero 回飞后逐行登场）

### 菜单 / 弹层（详见 `05`）
`glassDropdownIn` / `glassDropdownOut`、`glassUserCardIn` / `glassUserCardOut`、
`menuCardPop` / `menuFadeIn` / `menuTitleIn`、`searchSweep` / `searchRowIn`

### 环境氛围（详见 `08`）
`heroBandSlide` / `heroBandSlideReverse`（彩带）、`cinemaScrollDown` / `cinemaScrollUp`（海报墙）、
`neonScrollLeft` / `neonScrollRight` / `neonFlicker`（霓虹跑马灯）

### 路由转场（详见 `04`）
`pt-cube-out-next` / `pt-cube-in-next` / `pt-cube-out-prev` / `pt-cube-in-prev`（立方体翻页）、
`ptr-wipe-in` / `ptr-wipe-out`、`ptr-band-fade` / `ptr-band-drift` / `ptr-band-drift-rev`、
`ptr-row-slide` / `ptr-row-slide-rev`、`ptr-mark-drift`、`ptr-letter-slam`、`ptr-echo-stamp`、
`ptr-ghost-flick`、`ptr-hazard-in`、`ptr-chip-in`、`ptr-fade-in`、`ptr-blink`、`ptr-streak-fly`、`ptr-flash`

### 直播页（详见 `06`）
`liveWallDotPulse`、`liveWallOnlinePulse`、`liveWallLineIn`、`liveWallBlink`、`liveWallFlicker`、
`liveWallNewMsgIn`、`liveHostOrbFloat`、`liveHostParticleFloat`、`liveHostDotBounce`、
`liveHostGlitchShake`、`liveMoodFlick`、`liveMoodBob`

### 个人页 / 用户页 / 登录（详见 `07`）
`mp-banner-in`、`mp-sheen-sweep`、`mp-watermark-in`、`mp-hazard-in`、`mp-title-in`、`mp-fade-up`、`mp-blink`、
`mh-blur-in` / `mh-blur-out` / `mh-fade-in` / `mh-fade-out`（萌萌子面板）、
`dmxCellBlink` / `dmxAvatarIn`（点阵输入框）、
`sa-bob`（邮票册漂浮）、`zzz-stripes` / `zzz-sweep` / `zzz-pulse`（绝区零条纹）、
`mhStripe`、`hsxStripe` / `hsxTwinkle` / `hsxGain`、`ikbdDriftL` / `ikbdDriftR`

## 3. 三套入场机制（选哪套）

### A. 纯 CSS 错落延迟（服务端组件用）
页面是 SSR 服务端组件（`/links`、`/c/[category]` 归档页）时无法做平台判定，直接内联
`animation-delay` 制造自上而下错落。
- `.links-enter` = `blurFadeIn 1s cubic-bezier(0.23,1,0.32,1) both`
- `.archive-enter` = 同曲线但 `0.55s`（一页 24 条，1s + 长错落会拖）；延迟上限压在第 8 条
- **只能挂玻璃块本体或非玻璃元素**（见 `01` 第 5 节铁律）

### B. 视口触发两段式（帖子卡）
`.post-enter`（雾态、不挂动画）→ 进入视口加 `.post-enter-visible`（挂 `postEnterBlurReveal ... forwards`）。
离开视口摘类 → animation 声明消失 → 回到雾态，下次必然从 0% 重播。
安卓第二次进入视口改打 `.post-enter-replay`，走纯 `transform` 的 `postEnterCheapReveal`。

### C. Radix `data-state` 驱动（弹层）
`[data-state="open"]` / `[data-state="closed"]` 各挂进/退场关键帧，退场期间组件保持挂载
（`onAnimationEnd` 延迟卸载，见 `navigation.tsx`）。

## 4. `prefers-reduced-motion` 约定

**每个新动效都要补这一段。** 现有处理方式分三类：

1. **完全关闭**：`animation: none`（`.links-enter`、`.archive-enter`、点阵闪烁、`mp-*` 全套）
2. **只去位移/缩放，保留颜色与发光**（信息层级不能丢）：帖子卡 hover、影院模式聚光灯
   —— `transform: none !important`，但保留 `filter: brightness()` 变化
3. **退化为静置指示**：`.search-row-sweep` 的加载扫掠改成静态细线 `opacity:0.7`

全局段还额外：粒子停动、`.grid-texture` 降到 `opacity:0.2`、`.reduced-motion` 元素 `display:none`。

## 5. 平台门控矩阵

| 门控 | 作用 |
| --- | --- |
| `@media (hover: hover) and (pointer: fine)` | **所有 hover 动效必须包在这里**。手机无 hover，手指滑动会误触发 :hover 导致掉帧，且会干扰 hero 转场的起点矩形测量 |
| `@media (hover: none) and (pointer: coarse)` | 触屏专属降级块：`backdrop-filter` 从所有 `transition` 列表里摘掉（滑动时误触 hover 会让 GPU 每帧重采样背景 → 花屏卡顿）；模态遮罩改纯 opacity 动画 |
| `@media (max-width: 640px)` | 令牌下调、字号缩档、倾斜角与 scale 减小、跑马灯高度降档 |
| `@supports (mask-mode: luminance)` | 主体弹出层（`.post-card-pop`）总开关，不支持的浏览器会把灰度图当 alpha 蒙版糊脸 |
| `.cv-auto` / `.cv-lite`（JS 按 UA 打类） | 安卓/鸿蒙：`content-visibility:auto` + `backdrop-filter` 降到 `blur(6px)` + `will-change:auto`。`.cv-lite` 用于带主体遮罩的 3D 帖（`content-visibility` 自带 paint containment 会裁掉越框主体） |
| `lite` prop（JS 判定手机/降低动效） | 音乐卡 `.mw-glass` ↔ `.mw-glass-lite` 二选一，编译期决定不做运行时切换（避免视觉跳变） |

## 6. 合成器纪律

- 动效优先只动 `transform` / `opacity`。`filter: blur()` 只用在一次性入场，**不要放进循环动画**。
- `backdrop-filter` **永不进 `transition`/`animation` 列表**。凡是带 `backdrop-filter` 的元素，
  `transition` 都要显式列出属性而不是 `all`（`.glass-card`、`.card-action-btn`、`.frosted-glass`、
  `.floating-action-button`、`.modal-backdrop` 都已按此处理）。
- `will-change` 不要常驻。曾因 `.post-enter .glass-card` 的 `will-change` 永不摘除，
  安卓每张卡长期占 GPU 纹理 → 合成器内存吃紧丢瓦片 = 闪屏。安卓分支里显式改回 `will-change: auto`。
- 需要跨列/跨卡的 z 序时，wrapper 加 `position: relative` 才能让 `z-index` 生效（瀑布流列是普通块）。
- 性能工具类：`.contain-layout/style/paint/strict`、`.optimize-gpu`（`translateZ(0)` + `perspective`）、
  `.will-change-transform/opacity/scroll`、`.performance-grid`（`contain: layout style`）。

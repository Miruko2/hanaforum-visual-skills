# 08 · 帖子详情弹窗与氛围模块

## 1. 帖子详情弹窗（`components/post-detail-modal.tsx`，1087 行）

层次自下而上：
```
遮罩 .modal-backdrop-strong（bg-black/40 + backdrop-filter: blur(15px)）
  └─ IkBackdrop（极淡背景巨字漂移，遮罩的兄弟层）
       └─ 帖子面板 .modal-content（blur(25px) 玻璃 + mask-composite 渐变描边环）
```

### 背景巨字漂移 `.ikbd-*`（`components/ik-backdrop.tsx`）
`absolute inset-0`，自己不铺满屏、不压暗背景，也没有排线/百叶窗/点阵
—— 只有极淡巨字。服务端组件（无 `"use client"`），只出 HTML 不下发 JS。

```css
.ikbd           position:absolute; inset:0; overflow:hidden; pointer-events:none
                --ikbd-text: 0.06        /* 唯一浓度旋钮，可用 className 就地覆盖 */
.ikbd-textwrap  padding-block: 7vh; opacity: var(--ikbd-text)
                transform: rotate(-4deg) scale(1.08)
.ikbd-row:nth-child(2) .ikbd-word   第 2 行改实心白 0.5（其余是镂空描边）
```
奇数行左飘 `ikbdDriftL 80s linear infinite`、偶数行右飘 `ikbdDriftR 104s`（速度不同 = 轻微视差）。
两条同样轨道并排、整体位移 `-50%` 正好接回起点 = 无缝循环；每条轨道 8 份词
（单词按最大字号约 420px 宽算，8 份 ≈ 3400px，宽屏也填满）。
标题只取前 36 个 **Unicode code point**（`Array.from` 切，不会把 emoji 代理对劈开），
避免重复轨道宽到数万像素。

**门控**：漂移动画只在 `@media (hover:hover) and (pointer:fine)` 生效（移动端静帧）；
`prefers-reduced-motion` 下 `animation: none !important`。

### 相关组件
`post-image-carousel.tsx`（图片轮播）、`image-lightbox.tsx`（灯箱）、
`comment/comment-list.tsx` + `comment-item.tsx` + `comment-form.tsx`、
`music-detail-player.tsx`、`music-post-body.tsx`、`share/share-poster-modal.tsx`、
`subject-parallax.tsx`（详情页主体视差）

## 2. 无图帖子的「文字 Hero」（粉色带文字彩带）

无图帖子详情页左侧的动效。**倾斜容器 + 彩带内文字 `translateX`** = 视觉上沿斜向流动。

```css
.hero-bands-tilted  transform: rotate(-18deg)   /* 容器比屏幕大，旋转后不露边缘空白 */
.hero-band          position:absolute; left:-50%; right:-50%; display:flex
                    white-space:nowrap; overflow:hidden; font-weight:700
                    letter-spacing:0.08em; will-change:transform
```
6 条彩带各自的位置/高度/字号/配色/方向/速度：

| 条 | top | height | font-size | 底色 | 动画 |
| --- | --- | --- | --- | --- | --- |
| 1 | 2% | 18% | `clamp(22px,3vw,32px)` | 粉渐变 `#ec4899→#db2777` | `heroBandSlide 22s` |
| 2 | 21% | 8% | `clamp(14px,1.6vw,18px)` | 粉 0.55 | `heroBandSlideReverse 30s` |
| 3 | 30% | 20% | `clamp(28px,4vw,44px)` | 深玫 `#be185d→#9d174d` | `heroBandSlide 28s` |
| 4 | 51% | 6% | `clamp(12px,1.3vw,16px)` | 珊瑚 `#fb7185` 0.7 | `heroBandSlideReverse 24s` |
| 5 | 58% | 20% | `clamp(26px,3.6vw,40px)` | 粉渐变 0.9→0.7 | `heroBandSlide 26s` |
| 6 | 79% | 14% | `clamp(18px,2.2vw,26px)` | `#9d174d` 0.8 | `heroBandSlideReverse 32s` |

彩带之间刻意留 1~2% 缝隙，让底层装饰字隐约透出，形成「贴纸层」错落感。
无缝循环：两份文本拼在一起，向左滚 `-50%` 即完成（`heroBandSlide` / `...Reverse` 互为反向）。

- `.hero-scanlines`：`repeating-linear-gradient` 粗百叶窗（2px 黑 0.22 / 3px 透明），
  覆盖在彩带上增加胶片/印刷感，`opacity: 0.9`。
- `.hero-backdrop` / `.hero-backdrop-grid`：底层 1-4 个超大号装饰字符，
  `font-weight:900; line-height:0.85; color: rgba(200,200,210,0.1)` +
  `mix-blend-mode: luminosity`，像纸张底色上的水印。
  按 `data-count` 排版：1 字 `56vmin` 撑满；2 字左右两半 `40vmin`；
  3 字上一下二（首字 `grid-column: 1/span 2`）`28vmin`；4 字 2×2 方阵 `28vmin`。
  `.hero-backdrop` 自身是极淡暖色椭圆渐变，让灰字不显得发绿。

组件：`components/textual-hero.tsx`

## 3. 影院模式（5 列斜向海报墙，`components/cinema-mode.tsx`）

```css
.cinema-tilted     transform: rotate(-10deg) scale(1.1)   /* ≤640px: rotate(-8deg) scale(1.15) */
.cinema-col-track  animation-timing-function: linear; animation-iteration-count: infinite
                   .scroll-down → cinemaScrollDown (translateY 0 → -50%)
                   .scroll-up   → cinemaScrollUp   (translateY -50% → 0)
```
整体容器 `rotate`，内部 `translateY` 动画在视觉上就沿斜向滚动。无缝循环靠内容复制两份。
`.cinema-stage` 是暗色椭圆渐变衬底，让海报更跳。

### 聚光灯 hover（Apple TV / Netflix 风格，纯 CSS `:has()`）
```css
.cinema-card         transition: transform .35s cubic-bezier(0.2,0.8,0.2,1), box-shadow .35s, filter .35s
                     filter: brightness(1) saturate(1)   /* 显式给默认值，transition 才能平滑 */
.cinema-card:hover   transform: translateY(-4px) scale(1.04); z-index:5
                     box-shadow: 0 0 40px rgba(244,114,182,0.55), 0 12px 40px rgba(0,0,0,0.5)
                     filter: brightness(1.08) saturate(1.1)
.cinema-stage:has(.cinema-card:hover) .cinema-card:not(:hover)
                     filter: brightness(0.45) saturate(0.75)   /* 这条是聚光灯的关键 */
.cinema-col:hover .cinema-col-track  animation-play-state: paused   /* 整列停滚，关键交互 */
```
`prefers-reduced-motion`：**保留亮度变化**（信息层级）、去掉位移与缩放。

**已抽入可移植套件**：`assets/CinemaWall.tsx` + `assets/glass-kit.css` 第 13 节
（类名不变；卡片原用 Tailwind 工具类，套件展开成了等值 CSS 类
`.cinema-card` / `.cinema-card-caption` / `.cinema-card-fallback`；
舞台上下羽化从两个 div 改为 `.cinema-stage` 的伪元素）。原站 7 列/移动 4 列、
每列时长 `[55,62,50,68,58,64,52]` 都在组件里。`:has()` 聚光灯在老浏览器
自动退化为单卡发光（渐进增强）。

套件版多一个 `minPerColumn`（默认 4）：列内不足就循环补齐。因为卡片 3:4、
列宽 ≈ 舞台宽/列数，每列「一份」内容要高过舞台才铺得满，下限约
`3 × 列数 × 舞台高 ÷ (4 × 舞台宽)` 张。原站没有这道补齐，靠有图帖子基数大兜着
—— 注意 `cinema-mode.tsx` 的下限判断是 `withImage.length < 5`，但桌面是 7 列，
5~6 张时最后两列会整列空掉。

## 4. LED 霓虹跑马灯（`components/neon-marquee.tsx`）

影院模式上下用，登录/注册等氛围场景用 soft 变体。

```css
.neon-marquee        height:72px（≤640px: 54px）
                     background: linear-gradient(180deg, #1a0612, #0f0409 50%, #1a0612)
                     上下 1px 粉描边 + 内外双光晕
.neon-marquee-leds   radial-gradient 灯珠瓦片 8×8px, mix-blend-mode: screen, opacity .8
.neon-marquee-track  .to-left → neonScrollLeft (0 → -50%) / .to-right → neonScrollRight
.neon-marquee-text   等宽字 800/clamp(22px,3.2vh,36px)/letter-spacing .18em
                     5 层 text-shadow 霓虹光晕（近处亮白 2/6px → 远处粉色扩散 14/28/48px）
                     animation: neonFlicker 4.5s ease-in-out infinite
                     animation-delay: var(--neon-flicker-delay, 0s)   /* 多条同屏错峰 */
.neon-marquee-highlight-top/-bottom   1px 细高光，模拟灯管与金属外壳间的反光
```
`neonFlicker` 在 47-49% 和 72-74% 处各闪一下（`opacity` 掉到 0.75 / 0.85）。

### 三个变体（可叠加）
| 变体 | 差异 |
| --- | --- |
| `.neon-marquee-soft` | 更薄（56px，≤640px 44px）、背景半透明、灯珠稀疏到几乎看不见、字小一号（`clamp(14px,2vh,22px)`）、光晕收敛、**`animation: none` 明确禁掉闪烁** |
| `.neon-marquee-lime` | 换站点绿色调：底 `#0a1608→#060d04`、描边/光晕/灯珠改 lime、文字 `#eaffd0` |
| `.neon-marquee-lime.neon-marquee-soft` | 组合态另给一条更内敛的 `text-shadow` |

**已抽入可移植套件**：`assets/NeonMarquee.tsx` + `assets/glass-kit.css` 第 14 节。
（原站闪烁关键帧名 `neonFlicker`，套件里叫 `neonSignFlicker`，为与第 12 节弹幕的
`.neon-flicker` / `neonPartFlicker` 区分开。）

## 5. 通用弹层组件清单

| 组件 | 视觉要点 |
| --- | --- |
| `components/announcement-popup.tsx`（876 行）/ `announcement-modal.tsx` | 公告弹层，`z-index: 10000` |
| `components/floating-chat.tsx` + `floating-chat.module.css`（862 行） | 悬浮聊天，`z-index: 9999`，独立 CSS Module |
| `components/create-post-modal.tsx`（851 行） | 发帖弹窗 |
| `components/delete-confirm-dialog.tsx` / `friend-link-detail-modal.tsx` | 确认/详情弹窗 |
| `components/slide-to-accept.tsx` | 滑动确认条 |
| `components/ui/loading-animation.tsx` | `PulseLoading` 等加载动画 |
| `components/crossfade-background.tsx` | 背景交叉淡入（首页与音乐页共用） |
| `components/hover-card-effect.tsx` / `subject-parallax.tsx` | 通用 hover 与视差包装 |
| `components/stickers/*` | 贴纸选择器与渲染 |

`z-index` 秩序（改浮层前必看）：
```
帖子卡 hover 20  →  FAB / 模态遮罩 50  →  /live 页 80
→ 悬浮聊天 9999  →  公告 10000  →  撕纸转场 20000（盖过一切）
```

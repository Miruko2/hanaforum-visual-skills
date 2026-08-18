# 03 · 帖子卡（首页瀑布流核心，站内最复杂的一处）

改这里之前请通读全文。这套效果是被多个 bug 逼出来的三层结构，随手合并层级会直接失效。

## 1. DOM 三层结构（不可合并）

```
.post-card-container            ← 位移 / 缩放 / z-index / contain / 安卓降耗类
  └─ .post-card-tilt            ← perspective + rotateX/Y（跟手倾斜）+ box-shadow
       ├─ .post-card(.glass-card)  ← 毛玻璃 + 入场动画 + 流光 ::before + 顶高光 ::after
       │    └─ .image-glow > img    ← Ken-Burns 放大 / 视差平移
       └─ .post-card-pop > img    ← 主体越框弹出层（.glass-card 的兄弟，不被裁切）
```

**为什么必须分层**：
- `.glass-card` 的入场动画是 `animation: ... forwards`，会把 `transform`/`opacity`/`filter`
  钉死在 100% 关键帧，层叠优先级高于普通 `:hover` → 任何写在 `.glass-card:hover` 里的
  `transform` 都不生效（这正是历史上「hover 变化不大」的真因）。位移必须挂 wrapper。
- 倾斜也不能并入 `.post-card-container:hover`：那里 `0.45s` 的缓动是上浮/缩放的节奏，
  而跟手旋转需要 `~0.12s` 快速跟随，两者无法共存于同一元素。
- `.post-card-tilt` 必须 `position: relative`（静止态本层无 transform，
  否则 `.post-card-pop` 会越级去 `.post-card-container` 定位）。

相关文件：`components/post-card.tsx`、`post-card-tilt.tsx`、`post-card-image.tsx`、
`post-card-content.tsx`、`post-card-actions.tsx`、`virtual-post-list.tsx`、`glass-morph.tsx`

## 2. 静态外观

`.glass-card` / `.post-card`：`rgba(25,25,35,0.38)` + `blur(20px) saturate(140%)` + 白 15% 描边 +
`border-radius: 24px`，`box-shadow` 三段（外投影 + 微白发光 + 顶部内高光）。

内部子块：
- `.image-glow`：`overflow:hidden` + 上圆角，`::before` 是中心向外的黑色暗角（`opacity:0.4`）
- `.frosted-glass`：底部文字区，`blur(24px)`，下圆角 20px，`::after` 顶部细高光线
- `.card-meta` / `.card-category` / `.card-action-btn`：各自带小号 `blur(10~12px)` 毛玻璃胶囊
- `.admin-badge`（左上红色徽章）/ `.menu-button`（右上，hover 转红）
- `.card-title` 两行截断 + `::after` 30% 宽渐变下划线，hover 展到 50%

hover 时的文字层级微调：标题转纯白 + 阴影加深、描述 0.8→0.9、页脚描边提亮、暗角
**减弱** 0.4→0.25（让图片更鲜亮）。

## 3. hover 增强（仅 `@media (hover:hover) and (pointer:fine)`）

| 效果 | 实现 |
| --- | --- |
| 聚焦上浮 | `.post-card-container:hover { transform: translateY(-10px) scale(1.05); z-index:20 }`，`0.45s` 主力曲线 |
| 邻卡后退（景深） | `.masonry-grid:hover .post-card-container:not(:hover) { transform: scale(0.975) }`。**只用 transform** —— 用 `opacity`/`filter` 调暗要么被入场动画覆盖，要么破坏毛玻璃 |
| Ken-Burns | `.glass-card:hover .image-glow img { transform: scale(1.08) }`，`0.6s`。img 自身无入场动画，scale 不会被覆盖 |
| 斜向流光 | `.glass-card::before` 是 115° 高光条（白 0.16 + lime 0.12），基础态 `translateX(-130%)` + `opacity:0`；hover 触发 `cardSheenSweep 0.9s`。`z-index:2` 夹在图片暗角(z1)与头像角标(z10/z20)之间 |
| 玻璃加强 | 背景 `0.38→0.48`、`blur(20→26px) saturate(140→160%)`、描边白 `0.15→0.2`。**桌面独有**：触屏区把 `:hover` 的 `backdrop-filter` 锁回 `blur(20px)` |

## 4. 3D 跟手倾斜（`post-card-tilt.tsx` + `.post-card-tilt.is-tilting`）

复刻 operator-card.html 干员皮肤卡手感。JS 常量：

```
MAX_TILT_X = 6°   MAX_TILT_Y = 8°      // 最大倾角
PARALLAX_X = 10px PARALLAX_Y = 6px     // 封面图视差位移上限
SHADOW_SHIFT = 12px                    // 投影反向偏移
```

- `mousemove` 经 `requestAnimationFrame` 节流，**只直写 CSS 变量**
  （`--tilt-x/-y`、`--card-par-x/-y`、`--tilt-shadow-x/-y`），不走 React state
  —— 高频 state 会击穿 `PostCard` 的 `memo` 让整卡重渲染。
- `mouseenter` 时缓存几何中心：倾斜中 `getBoundingClientRect()` 会把自身 transform
  算进去，逐帧取会拿到「已旋转」的矩形导致抖动。
- 启用条件与 CSS 门控一致：`(hover:hover) and (pointer:fine)` 且非 `prefers-reduced-motion`。
- 本层**绝不能加 `filter`**（如 operator-card 的 `brightness`）：它是 `.glass-card` 的祖先，
  祖先 filter 会废掉子级 `backdrop-filter`。亮度反馈交给 `.glass-card:hover`。
- 投影用 `box-shadow: var(--tilt-shadow-x) var(--tilt-shadow-y) 22px rgba(0,0,20,0.3)`，
  并补 `border-radius: 24px` 防直角阴影穿帮。**不能用 `drop-shadow`**（同上）。
- 倾斜时封面图 `translate3d(var(--card-par-x), var(--card-par-y), 0) scale(1.1)`，
  `scale(1.1)` 提供出血量；本条源码序晚于 Ken-Burns 的 `scale(1.08)`，故倾斜时覆盖之。
- `mouseleave` 清变量 + 摘 `is-tilting` → `transform` 回落 `none`，由基础态 `0.45s` 平滑回正。

## 5. 主体越框弹出（`.post-card-pop`，`@supports (mask-mode: luminance)`）

「立绘越出卡框」的分层复刻。层内是同一张封面图，用 CSS **luminance mask**
（`image_mask_url`：主体≈白 / 背景≈黑的灰度 webp）抠出主体。

- 默认 `display:none`，仅在支持 `mask-mode: luminance` 时启用
  —— 不支持的浏览器会把不透明灰度图当 alpha 蒙版、整张矩形图糊脸。
- 静止态 `opacity:0` 且几何与底图重合；高度由 inline `aspect-ratio` 给出（与图片区同源计算）。
- **桌面 hover**：位移 = 底图视差的 **2 倍**、`scale(1.18)` vs 底图 `1.1`
  —— 主体与背景的速度差就是「弹出感」的来源。加 `drop-shadow`（本层在 `.glass-card` 之外，
  filter 不干扰毛玻璃）强化悬浮层次。
- **触屏「刷到即弹」**：`post-card.tsx` 的 IntersectionObserver 在卡片过大半屏时打上 `.pop-auto`
  （仅触屏 + 未减少动效）。两段串行动画：
  `popAutoIn 0.55s cubic-bezier(0.34,1.45,0.64,1) both` → `popAutoSway 3.2s ease-in-out 0.55s infinite`。
  `popAutoSway` 是左右摆 9px + 上下浮 3→12px + 摇头 ±1.3° + 呼吸缩放 1.16→1.2，首尾同帧无缝。
- **卡体同相倾斜** `.tilt-auto`：与 `.pop-auto` 用完全相同的节奏参数，同一次渲染挂类 → 永久锁相，
  不需要 JS 逐帧驱动。旋转量按桌面的「位移↔倾角」耦合系数反推
  （`rotateY = +0.4°/px × 主体X位移`，`rotateX = -0.5°/px × 主体Y位移`）。
- `.tilt-freeze`：hero 转场量取起点矩形时临时冻结旋转。CSS 动画优先级高于 inline style，
  JS 写 `style.transform="none"` 压不住动画，必须靠这个带 `!important` 的类。量完即摘（同 tick 不闪）。

## 6. 入场：雾中浮现（两段式）

```
.post-enter .glass-card          → opacity:0; filter:blur(24px); translateY(20px)   （雾态，不挂动画）
.post-enter-visible .glass-card  → animation: postEnterBlurReveal 1.1s ... forwards
```
- `filter: blur()` 挂在**卡片本体**（与 `backdrop-filter` 同元素，规范允许共存）。
  动画期间 = 「更雾的玻璃」，结束后只剩 `backdrop-filter` = 真毛玻璃，平滑不突变。
- wrapper 不做 opacity/filter 动画，避免合成层破坏子元素。
- 离开视口摘 `.post-enter-visible` → animation 声明消失 → 回到雾态 → 下次必然从 0% 重播。
- 触发：`react-intersection-observer`，`threshold: 0.05`、`rootMargin: "100px 0px"`、`triggerOnce: false`。

**安卓廉价重播**：`.post-enter-replay` 用纯 `transform+opacity` 的
`postEnterCheapReveal 0.55s`（`translateY(14px) scale(0.985)` → 归位）替代 `filter:blur`。
首次入场仍走 blur 版；由 `virtual-post-list.tsx` 在第二次进入视口时打类（UA 匹配 `Android|Harmony`）。
选择器多带一个类，特异性高于 blur 规则。

## 7. hero 转场回落后的内容登场

关帖回飞落地后，图片区由回飞图像素级接管，下方文字卡各行「从上到下带高斯模糊」浮现：

```
.hero-return-content            → heroReturnHold 1.2s both（无视觉变化，仅作总时长锚点）
.hero-return-content > div > *  → heroReturnRowReveal 1s cubic-bezier(0.22,0.7,0.18,1) both
                                   nth-child(1/2/3) delay = 0.02s / 0.1s / 0.18s
```
`onAnimationEnd`（监听 `heroReturnHold`）统一清除状态，见 `post-card.tsx`。

## 8. 瀑布流布局（`react-masonry-css`）

```
.masonry-grid         display:flex; margin-left:-1rem
.masonry-grid-column  padding-left:1rem
> .post-card-container margin-bottom:1rem      （≤640px 全部收到 0.5rem）
```

响应式列数（`virtual-post-list.tsx` 的 `breakpointColumns`，容器 `max-w-[2200px]`，
目标单卡宽 ~220-260px）：

| 视口 | 列数 |
| --- | --- |
| >2200 / 1900-2200 | 8 |
| 1680-1899 | 7 |
| 1500-1679 | 6 |
| 1280-1499 | 5 |
| 1024-1279 | 4（平板横屏） |
| 768-1023 | 3（平板竖屏） |
| <768 | **2**（手机固定 2 列，减少同屏毛玻璃卡拖累安卓） |

⚠️ 别试图让首页 SSR 帖子「不等 JS 就显示」：列数靠 `window.innerWidth` 测量，SSR 只能按
`default` 渲染（列宽恒 12.5%），水合后换列数 → 内容一露脸就集体重排。首页容器那层
framer `initial={{opacity:0}}` 挡的正是这次重排。2026-07-28 试过改造已回退。

## 9. 安卓降耗类（JS 按 UA 打在 `.post-card-container` 上）

| 类 | 效果 |
| --- | --- |
| `.cv-auto` | `content-visibility: auto` + `contain-intrinsic-size: auto 420px`（跳过视口外卡片的布局/绘制/毛玻璃合成）+ `backdrop-filter` 降到 `blur(6px) saturate(1.4)` + `will-change: auto` |
| `.cv-lite` | 只降毛玻璃、**不加** `content-visibility` —— 后者自带 paint containment 会把 `.post-card-pop` 裁在容器盒内、主体弹不出去。带主体遮罩的 3D 帖用这个 |

判定入口：`postHasSubjectPop(post)`（`lib/post-images.ts`）。
`blur(6px)` 仍是实时采样，只缩小了高斯核（约省一半）。若仍卡，下一步是改
`backdrop-filter: none` + 提高 `background` 不透明度（纯色底 = 数量级省，
首页帖子是不透明内容卡，视觉损失可接受）。

## 10. 帖子模板变体

`.wide-template` / `.tall-template`（`glass-morph.tsx` 的 `wideTemplate`）：
圆角 18px / 24px，移动端 `.wide-template` 宽度 104% + `margin-left:-2%` 出血，
标题字号 1.1rem / 1.2rem，描述截断 2 行 / 3 行。
⚠️ `post.image_ratio` 驱动的 `useWideTemplate` 目前是 dead path（`wideTemplate` 需配
`adaptiveHeight` 才生效，而无调用方传它）。

## 11. `GlassMorph` 组件（`components/glass-morph.tsx`）

CSS 变量驱动的通用玻璃卡，供帖子卡与其它卡复用：

```
--gm-border-radius: 24px   --gm-blur: 20px      --gm-opacity: 0.05
--gm-border-width: 1px     --gm-border-color: rgba(255,255,255,0.08)
--gm-shadow: 0 8px 32px rgba(0,0,0,0.2)
--gm-transition: all 0.4s cubic-bezier(0.23,1,0.32,1)
```
`.glassmorphism-card:hover` → `translateY(-8px) scale(1.02)`，`--gm-blur:24px`、
`--gm-opacity:0.08`、描边白 0.15、投影加重。触屏区把 `--gm-transition` 换成不含
`backdrop-filter` 的显式列表，且 hover 只把 `--gm-blur` 设回 `20px`。
`.frosted-content` 是它的底部文字区（`blur(45px)`）。

## 12. 音乐卡片墙（`/music` 的卡，与帖子卡同族）

`.mw-glass`（桌面）= `rgba(18,20,26,0.22)` + `blur(18px) saturate(1.5)`，全程不降级
（曾试「拖动时摘磨砂」省性能被否：视觉跳变明显）。
`.mw-glass-lite`（手机 / 降低动效）= `rgba(18,20,26,0.26)` + `blur(6px)`。
按 `lite` prop 在 `MusicCard` 上二选一，编译期决定，不做运行时切换。

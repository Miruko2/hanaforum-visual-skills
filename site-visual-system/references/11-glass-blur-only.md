# 11 · 只要毛玻璃 + 雾中浮现（自包含配方）

**这一册是自包含的。** 只想要「毛玻璃面板」和「高斯模糊入场（雾中浮现）」这两样东西时，
读完本册就够了 —— **不要再读 01-10 任何一册，也不要读 `assets/glass-kit.css`**。
本册里的 CSS 可直接粘贴，数值与本仓库 `app/globals.css` 一致。

需要卡片 3D 倾斜、主体越框弹出、瀑布流、果冻形变、霓虹/LED、影院海报墙、路由转场的，
才回到 `SKILL.md` 的分册索引。

---

## 1. 前置条件：先铺采样源（漏了这步，玻璃一定是假的）

`backdrop-filter` 模糊的是**它背后已经画出来的东西**。页面背景若是纯色，模糊纯色还是纯色，
玻璃就退化成一块半透明色块。**「玻璃看起来是假的」九成是漏了这一步。**

在根布局里铺一层固定背景，`position:fixed; z-index:-1`：

```html
<div class="bg-texture"></div>
<div class="grid-texture"></div>
```

```css
/* 背景光晕：4 个强调色径向渐变叠一层近黑线性渐变 */
.bg-texture {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(circle at 20% 20%, rgba(132, 204, 22, 0.25), transparent 45%),
    radial-gradient(circle at 80% 80%, rgba(163, 230, 53, 0.20), transparent 40%),
    radial-gradient(circle at 60% 30%, rgba(101, 163, 13, 0.15), transparent 35%),
    radial-gradient(circle at 30% 70%, rgba(132, 204, 22, 0.12), transparent 50%),
    linear-gradient(135deg,
      rgba(0, 0, 0, 1) 0%, rgba(5, 10, 5, 0.95) 25%, rgba(10, 15, 10, 0.9) 50%,
      rgba(15, 20, 15, 0.95) 75%, rgba(5, 5, 5, 1) 100%);
}

/* 网格纹理：60px 网格，中心实四周虚。给玻璃提供「可辨认的形状」，模糊后更像玻璃 */
.grid-texture {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  opacity: 0.04;
  background-image:
    linear-gradient(rgba(163, 230, 53, 0.4) 1px, transparent 1px),
    linear-gradient(90deg, rgba(163, 230, 53, 0.4) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 70%);
}
```

换成一张 `position:fixed; z-index:-1; object-fit:cover` 的图片也行，只要背后**有形状变化**。

`body` 需要 `background-color: transparent`，否则会盖住上面两层。

## 2. 令牌（只有这几个是本配方要用的）

```css
:root {
  --accent-color: 132, 204, 22;   /* lime-500，换主题色改这行 */
  --accent-glow: 163, 230, 53;    /* lime-300，发光/高光用 */
  --blur-strength: 20px;
  /* 主力缓动：快出慢收、无过冲。位移与入场都用它 */
  --ease-main: cubic-bezier(0.23, 1, 0.32, 1);
}
```

## 3. 毛玻璃：按场景选一档，不要新造

| 类 | 背景 | 模糊 | 场景 |
| --- | --- | --- | --- |
| `.glass` | 白 8% | `blur(20px) saturate(120%)` | 通用浅色玻璃 |
| `.glass-dark` | 黑 25% | `blur(20px) saturate(120%)` | 暗色玻璃，带强调色内高光 |
| `.glass-card` | `rgba(25,25,35,0.38)` | `blur(20px) saturate(140%)` | **内容卡本体，主力档** |
| `.panel-glass` | `rgba(25,25,35,0.42)` | `blur(22px) saturate(140%)` | 侧栏 / 设置卡 / 个人中心面板，自带入场 |
| `.frosted-glass` | 黑 20% | `blur(24px) saturate(100%)` | 卡片底部文字区，只有下圆角 |
| `.modal-content` | 黑 75% | `blur(25px) saturate(100%)` | 模态面板 |

**共同签名**（新增玻璃面板照抄这三条，观感才统一）：

1. `box-shadow` 两段式 = 外投影 + `inset 0 1px 0` 顶部内高光。
2. `::before` 一条顶部细高光线，模拟玻璃上边缘反光。
3. 背景不透明度压在 **0.2 ~ 0.45**。压得太低玻璃没质感，太高就没东西可模糊了。

```css
/* 主力档：内容卡本体 */
.glass-card {
  position: relative;
  overflow: hidden;
  background: rgba(25, 25, 35, 0.38);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 10px rgba(255, 255, 255, 0.05),
    0 1px 0 rgba(255, 255, 255, 0.1) inset;
  /* ⚠️ 显式列属性，绝不写 all —— 见第 6 节铁律 3 */
  transition:
    background-color 0.4s var(--ease-main),
    border-color 0.4s var(--ease-main),
    box-shadow 0.4s var(--ease-main);
}

/* 顶部细高光线，做成独立类：给哪块玻璃加就在它上面挂 class="glass-card glass-top-sheen"。
   ⚠️ 不要直接写 .glass-card::before —— 本仓库和 assets/glass-kit.css 里那个伪元素
   已经被 hover 流光扫过占用了，写上去会互相覆盖。 */
.glass-top-sheen { position: relative; }
.glass-top-sheen::before {
  content: "";
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
  pointer-events: none;
}

/* 面板档：比卡片更厚，自带 1.6s 重量级雾中浮现 */
.panel-glass {
  position: relative;
  overflow: hidden;
  background: rgba(25, 25, 35, 0.42);
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  animation: blurFadeIn 1.6s var(--ease-main) both;
}
.panel-glass:nth-child(2) { animation-delay: 0.15s; } /* 相邻面板错落 */
```

## 4. 雾中浮现：三条关键帧

```css
/* 【核心】高斯模糊渐入 —— 「雾中浮现」的本体，最常复用 */
@keyframes blurFadeIn {
  from { opacity: 0; transform: translateY(20px); filter: blur(24px); }
  to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
}

/* 两段式：60% 处先补满透明度，收尾专注化开模糊。
   视觉上「先从雾里显形、再对上焦」，比单段更有层次，用于滚动列表 */
@keyframes postEnterBlurReveal {
  0%   { opacity: 0; filter: blur(24px); transform: translateY(20px); }
  60%  { opacity: 1; }
  100% { opacity: 1; filter: blur(0);    transform: translateY(0); }
}

/* 廉价版：纯 transform + opacity，不含 filter。给低端安卓滚动重播用 */
@keyframes postEnterCheapReveal {
  0%   { opacity: 0; transform: translateY(14px) scale(0.985); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
```

**时长档位**：稀疏内容 `1s` / 切标签页 `1.2s` / 密集列表（>20 条）`0.55s` /
重量级面板 `1.6s`。一律配 `var(--ease-main)`。

## 5. 三套挂法：按场景选一套

### A. 纯 CSS 错落延迟 —— 服务端渲染页面用

页面是 SSR 服务端组件、拿不到平台判定时用这套。`animation-delay` 由内联 style 逐元素给出，
造出自上而下依次浮现的感觉。

```css
.enter-slow { animation: blurFadeIn 1s   var(--ease-main) both; }
.enter-mid  { animation: blurFadeIn 1.2s var(--ease-main) both; }
.enter-fast { animation: blurFadeIn 0.55s var(--ease-main) both; }
```

```tsx
{items.map((item, i) => (
  // 延迟上限压在第 8 条，否则一页 24 条最后一条要等 2 秒才出来
  <div key={item.id} className="enter-fast" style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}>
    …
  </div>
))}
```

### B. 视口触发两段式 —— 滚动列表用（会重播）

关键机制：**未进入视口时只保持雾态、不挂任何 `animation` 声明**。这样下次加
`.enter-visible` 时 `animation` 是一条全新声明，浏览器必然从 0% 开始播；离开视口摘类
就回到雾态，为下次重播做好准备。无论用户滚多快，第一眼看到的都是完整的浮现过程。

```css
.enter-onview { position: relative; }
/* 雾态：只有静态属性，没有 animation */
.enter-onview .glass-card {
  opacity: 0;
  filter: blur(24px);
  transform: translateY(20px);
}
/* 进入视口才挂动画 */
.enter-onview.enter-visible .glass-card {
  animation: postEnterBlurReveal 1.1s var(--ease-main) forwards;
}
```

JS 侧用原生 `IntersectionObserver` 即可（`threshold: 0.05`、`rootMargin: "100px 0px"` 提前触发），
成品见 `../assets/EnterOnView.tsx`（零依赖，约 110 行，**只有需要这套时才去读它**）。

⚠️ 上面选择器里的 `.glass-card` 是「玻璃块本体」的占位。换成你自己的类名，但**必须是
玻璃块本体，不能是它的容器** —— 见下一节铁律 1。

### C. `data-state` 驱动 —— Radix 弹层用

`[data-state="open"]` / `[data-state="closed"]` 各挂一条关键帧，退场动画播放期间组件必须
保持挂载（`onAnimationEnd` 里再延迟卸载）。

## 6. 三条铁律（违反必炸，且现象都很像「玄学」）

1. **`filter` 与 `backdrop-filter` 只能同元素共存，绝不能祖孙共存。**
   祖先只要有 `filter`（哪怕 `blur(0)`），子级 `backdrop-filter` 的背景采样立刻失效
   → 毛玻璃变纯色块。
   → 所有带 `filter` 的入场类（`.enter-slow` / `.enter-onview` 一族）**只能挂玻璃块本体
     或纯非玻璃元素**，不能挂到玻璃块的容器（网格 `<section>`、wrapper `<div>`）上。
   → 同理，玻璃块外围的投影只能用 `box-shadow`，**不能用 `drop-shadow`**（那是 `filter`）。
   *同元素共存是允许的，而且正是本配方的基础：先 `backdrop-filter` 采样背景，再 `filter`
   作用于合成结果 =「一块更雾的玻璃」慢慢对上焦。*

2. **`animation: ... forwards` 会钉死元素的 `transform`**，写在同元素 `:hover` 上的
   `transform` 不生效（层叠优先级：动画 > 普通 `:hover`）。
   → 入场动画和 hover 位移**不要挂同一个元素**。位移挂外层 wrapper、玻璃与入场挂本体。

3. **`backdrop-filter` 永不进 `transition` / `animation` 列表。** 带它的元素 `transition`
   必须显式列属性、不能写 `all`。手指滑动会误触 `:hover`，若 `backdrop-filter` 在过渡列表里，
   GPU 每帧都要重新采样并光栅化整块背景 → 掉帧、花屏。

## 7. 平台降级（不是可选项）

```css
/* —— 触屏：把 backdrop-filter 锁回基础值，不让它参与任何过渡 —— */
@media (hover: none) and (pointer: coarse) {
  .glass-card {
    transition:
      transform 0.4s var(--ease-main),
      box-shadow 0.4s var(--ease-main),
      border-color 0.4s var(--ease-main),
      background-color 0.4s var(--ease-main);
  }
  .glass-card:hover {
    backdrop-filter: blur(20px) saturate(140%);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
  }
}

/* —— 安卓 / 鸿蒙：JS 按 UA 打 .cv-auto 类，高斯核 20px → 6px（约省一半）——
   ⚠️ will-change 显式改回 auto。入场类上的 will-change 若永不摘除，每张卡长期占一块
   GPU 纹理，滚动累积几十上百层后 WebView 合成器内存吃紧、开始丢瓦片 = 闪屏花屏。 */
.cv-auto .glass-card {
  backdrop-filter: blur(6px) saturate(1.4);
  -webkit-backdrop-filter: blur(6px) saturate(1.4);
  will-change: auto;
}

/* 安卓滚动重播改走廉价动画：首次入场仍是 blur 雾中浮现，只有「滚出视口再滚回」
   命中这里（JS 在第二次进入视口时打 .enter-replay）。多带一个类，特异性更高。 */
.enter-replay.enter-onview .glass-card {
  filter: none;
  transform: translateY(14px) scale(0.985);
  will-change: transform, opacity;
}
.enter-replay.enter-visible .glass-card {
  animation: postEnterCheapReveal 0.55s var(--ease-main) forwards;
}

/* —— 无障碍：入场类整组关掉，玻璃本身保留 ——
   ⚠️ 视口触发那两条（.enter-onview 一族）本仓库目前没有做这个降级，滚动列表在
   「减少动态效果」下仍会播 1.1s 的模糊浮现。新项目建议照下面补上：基础态是
   opacity:0，只关 animation 会让内容永久留在雾里，所以四个属性必须一起复位。 */
@media (prefers-reduced-motion: reduce) {
  .enter-slow, .enter-mid, .enter-fast, .panel-glass { animation: none; }
  .enter-onview .glass-card,
  .enter-onview.enter-visible .glass-card {
    animation: none;
    opacity: 1;
    filter: none;
    transform: none;
  }
}
```

若安卓上 `blur(6px)` 仍卡，下一步是 `backdrop-filter: none` + 提高 `background` 不透明度
（纯色底是数量级级别的省，不透明内容卡的视觉损失可接受）。

## 8. 在本仓库改的话，去哪儿找

全部在 `app/globals.css`（唯一大表）。**这里给的是选择器而不是行号** —— 行号会随每次编辑
漂移，选择器名不会。一条命令定位全部：

```bash
rg -n "^\.(bg-texture|grid-texture|glass|glass-dark|glass-card|profile-glass|frosted-glass|modal-content|links-enter|archive-enter|admin-tab-enter|post-enter)[\s,{:.]|^@keyframes (blurFadeIn|postEnterBlurReveal|postEnterCheapReveal)" app/globals.css
```

| 找什么 | 搜这个 |
| --- | --- |
| 采样源背景 | `.bg-texture` / `.grid-texture` |
| 玻璃档位 | `.glass` / `.glass-dark` / `.glass-card` / `.profile-glass` / `.frosted-glass` / `.modal-content` |
| 三条关键帧 | `@keyframes blurFadeIn` / `postEnterBlurReveal` / `postEnterCheapReveal` |
| 纯 CSS 错落入场 | `.links-enter` / `.archive-enter` / `.admin-tab-enter` |
| 视口触发两段式 | `.post-enter` 起连续一段（含 `-visible` / `-replay` 两个变体） |
| 安卓降级 | `.cv-auto .glass-card` |

注意本仓库的类名前缀是 `.post-enter-*`，本册示例里写的 `.enter-*` 是可移植套件
（`assets/glass-kit.css`）的命名，两者是同一套机制的两种叫法。

JS 驱动在 `components/virtual-post-list.tsx`：它在卡片 wrapper 上打
`post-card-container post-enter` + 视口内加 `post-enter-visible` + 安卓二次进入加
`post-enter-replay`，并按帖子有无越框主体在 `cv-auto` / `cv-lite` 之间二选一。

## 9. 只想复制成品，不想手抄

`../assets/glass-kit.css` 共 14 节，本配方对应其中的：

- 第 1 节 设计令牌
- 第 2 节 页面基底（`.bg-texture` / `.grid-texture`）
- 第 3 节 毛玻璃层级
- 第 4 节 关键帧库里的 `blurFadeIn` / `postEnterBlurReveal` / `postEnterCheapReveal` 三条
- 第 5 节 入场机制
- 第 9 节 平台门控与降级

其余九节（卡片三层结构、瀑布流、常用点缀、滑动高亮、果冻形变、霓虹与 LED 点阵、
影院海报墙、跑马灯）与本配方无关，可以整节删掉。节标题都是 ` * N. 名称` 的形式，
一条命令就能拿到全部节的行号，按区间取即可，不必通读这个 73KB 的文件：

```bash
# ⚠️ 必须带 --no-ignore：.kiro/ 在本仓库 .gitignore 里，默认会被 rg 跳过
rg -n --no-ignore "^ \* [0-9]+\. " .kiro/skills/site-visual-system/assets/glass-kit.css
```

配套 JS 只需要 `../assets/EnterOnView.tsx`（第 5 节 B 套机制的驱动）。
`CardTilt.tsx` / `JellyNav.tsx` / `JellyMorph.tsx` / `MoodFace.tsx` / `CinemaWall.tsx` /
`NeonMarquee.tsx` **都不需要**。

## 10. 验收清单

- [ ] 玻璃面板背后能看见背景的**形状与颜色变化**，不只是均匀半透明 → 否则第 1 节漏了
- [ ] 入场是「从雾里化开、逐渐对焦」而不是单纯淡入 → 否则 `filter` 被挂到了祖先（铁律 1）
- [ ] 入场动画播完后，玻璃**没有**变成纯色块 → 同上，检查祖先链上有没有 `filter`
- [ ] 滚出视口再滚回，入场会重播 → 否则是离开视口没摘类
- [ ] 手机上滑动列表不花屏、不掉帧 → 检查 `backdrop-filter` 是否进了 `transition`
- [ ] 系统开启「减少动态效果」后：动画全停，但玻璃与颜色仍在

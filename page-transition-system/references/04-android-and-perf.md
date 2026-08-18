# 04 · 安卓花屏对策与合成器纪律

这一段不是可选项。删掉任何一条，低端安卓连续快滑就会花屏。

## 1. 真机花屏长什么样

主板大图层的瓦片光栅化跟不上 → **缺瓦片透出下层白纸层（整块露白）**，
而独立合成层的绶带 / 大字反而画出来了 → 错位叠画：白底上飘着几条绿带和半个标题。

判断依据：花的是"块"不是"点"，且露出的颜色恰好是 `.ptr-wipe-b` 的 `--ptr-paper`。

## 2. 三路对策

### 兜底色 —— 让"缺瓦片"退化成"暗色一闪"

每个大面积色层都单独声明**不透明** `background-color`，渐变用 `background-image` 叠上去：

```css
.ptr-panel          { background-color: var(--ptr-panel-b); background-image: radial-gradient(...); }
.ptr-wipe-a .ptr-wipe-fill { background-color: var(--ptr-accent); background-image: linear-gradient(...); }
.ptr-band           { background-color: rgb(var(--ptr-accent-rgb)); background-image: ...; }
```

合成器会记住图层底色，缺失瓦片按底色填充。**白花屏在视觉上直接消失**，
最坏情况变成一次暗色闪烁。这一条对所有平台生效，不只安卓。

### 削峰 —— 满屏渐变改实色

```css
.ptr-root.ptr-android .ptr-panel            { background-image: none; }
.ptr-root.ptr-android .ptr-wipe-a .ptr-wipe-fill { background-image: none; }
```

主板的径向渐变在 `150vw × 124vh` 的出血面积上逐瓦片光栅化，是主板图层最大的一笔开销。
改实色后 Chromium 走 solid-color 快路径（**无需分配纹理**）。装饰照常叠在上面，
取的又是渐变中间档色，观感几乎无差别。

### 错峰 —— 装饰分两波挂载

组件侧的 `decorStage`（非安卓恒为 2，即同步全量）：

```
stage 0  起手：遮罩首帧只挂三层扫屏（轻）
stage 1  +2 帧（~32ms）：绶带 / 网点 / 标题 / 角标 / 边条 —— 观感骨架，纹理较轻
stage 2  再 +110ms：巨型文字行 + 水印 —— 最重的文字纹理
```

此刻主板还在盖屏途中（0.4s 才盖严），**光栅化高峰被摊进扫入过程**，
起手帧只剩合成线程的扫屏位移 → 不掉帧。CSS 侧配合给第二波加 0.22s 淡入
（`ptr-band-fade`），一来把"晚到"包装成入场节奏，二来行纹理若再晚一两帧，
淡入尚未结束、缺字不可察觉。

⚠️ 这个 effect **必须带 `phase === "cover"` 守卫**：`active` 对象每次 phase 切换
都会换新引用，不加守卫的话 reveal 阶段会重跑并把 stage 打回 1 → 重装饰中途卸载。

## 3. 逐项降级清单（`.ptr-android`）

| 项 | 降级 | 理由 |
| --- | --- | --- |
| 速度线 `.ptr-streaks` | **整组不挂载**（组件侧） | 6 条独立合成层持续光栅化，鬼影/卡顿重灾区 |
| 胶片绶带漂移 | 静态化，只留淡入 | 3 条约 195vw 宽的常驻合成层；静态后并回主板图层 |
| 绶带斜角 | 手工补 `transform: rotate(-12deg)` | 漂移关键帧里带着这个角度，去掉动画会变水平 |
| 偶数小字行 2/4/6 | 静态化，只留淡入 | 内容是均匀重复短语，定格视觉无差别，省 3 条位移合成层 |
| 奇数大字行 1/3/5 | **保留滚动** | 动感主体，不能全静 |
| 文字行宽度 | `left/right: -25%` → `-10%`（360vw → 288vw） | 行越宽合成层纹理越大 |
| 镂空描边 | `-webkit-text-stroke: 0` + 半透明实心 | 描边要为每个字形生成独立路径纹理，成本远高于实心 |
| 水印 `.ptr-mark` | 字号上限 640px → `clamp(180px,42vh,380px)`，改实心 16% | 单元素最大纹理 |
| 霓虹边发光 | `box-shadow` 半径 32px → 12px | 模糊半径越大光栅化越贵 |
| 文字渲染 | `text-rendering: optimizeSpeed` | — |
| 冷却 | 260ms → 480ms | WebView 合成器回收慢 |
| 图层树销毁 | 推迟到冷却期中段（`TEARDOWN_MS`） | 不和揭开收尾/新页安顿抢同一批帧 |
| 重复串长度 | `phraseRepeat` 14→6、`bigRepeat` 12→5、绶带 10→5 | 配合收窄后的行宽，省布局开销 |

⚠️ `bigRepeat = 5` 是**按 288vw 行宽校准**的。若改回原始行宽或改字号，
要重新校准 —— 太短会在左滑行的右端露出空档。

**核心三层扫屏（`.ptr-wipe`）的 `will-change` 与动画一律保留** —— 它才是位移主体，
降它就没转场了。

## 4. 运行时判定

```ts
export const isAndroidRuntime =
  typeof navigator !== "undefined" && /android|harmony/i.test(navigator.userAgent)
```

**模块级同步取值，不能放进 effect** —— 要在首次渲染遮罩时就决定渲染分支，
放 effect 里会先渲一帧完整版再切降级版，那一帧正是最容易花屏的一帧。

鸿蒙一并算入：同源 WebView、同样的弱点。（历史教训：此前只有帖子列表匹配
`Android|Harmony` 而转场只匹配 `Android`，口径不一致导致鸿蒙机型转场仍然花屏。）

## 5. 合成器纪律

- **只动 `transform` / `opacity`**。全套无 `backdrop-filter` / `filter` /
  `preserve-3d` / `clip-path`。
- **位移与形变分层**：斜切是静态的内层，平移是动画的外层（`02` §2）。
- **`will-change` 只给真正跑位移动画的层**，且降级时显式改回 `auto`
  （见安卓分支里的 `.ptr-band` / `.ptr-row-2/4/6`）。
- **`backface-visibility: hidden` 只给跑 transform 动画的层**，纯 opacity 动画
  和静态元素不加（`02` §7）。
- **一次性动画不挂 `will-change`**（如 `.ptr-letter`），动画期间浏览器会自行临时提升。
- **transform 动画与 opacity 动画拆成并行的两条 `animation`**，不要塞进同一条关键帧
  —— 绶带的淡入与漂移就是这么分的，两者互不抢。

## 6. 加新装饰层的检查表

- [ ] 只用 `transform` / `opacity` 做动画了吗？
- [ ] 是大面积色块吗 → 单独声明不透明 `background-color`
- [ ] 能不能做成静态 `repeating-linear-gradient` 而不是逐帧绘制？
- [ ] 要斜切吗 → 放进 `.ptr-panel`；不能斜切（含文字）→ 放主板直接子节点，或自行抵消
- [ ] 跑位移动画 → 加进 `backface-visibility: hidden` 那组选择器
- [ ] 纹理重吗（大字号 / 描边 / 大面积）→ 挂在 `showHeavyDecor` 上，并补安卓降级分支
- [ ] `delay + duration` 落在 0.84s 总预算内吗？（`01` §1）
- [ ] 常驻无限动画 → 认真考虑安卓上是否直接不挂载

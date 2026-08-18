# 04 · 路由转场

站内有两套并行的转场：**View Transitions 立方体翻页**（轻量，浏览器原生）与
**绝区零式撕纸遮罩**（重量，自绘 MG）。两者都由左右滑页手势触发。

相关文件：`components/page-transition.tsx`、`components/page-swipe.tsx`、
`components/page-ribbon-transition.tsx`

## 1. 立方体翻页（View Transitions API）

由 `html[data-pt="next"|"prev"]` 驱动 `::view-transition-*` 伪元素。

```css
html[data-pt]::view-transition            → 兜底壁纸 #0a0a0a + /mos-background-1920.webp cover
html[data-pt]::view-transition-image-pair(root) → perspective: 1400px   /* 共享相机 */
old/new(root) → transform-origin: 50% 50% -50vw;  0.5s cubic-bezier(0.45,0.05,0.25,1) both
```

- 旋转轴放在屏幕中心**后方半个屏宽** = 立方体中心，两面共享同一消失点才不散架。
- `next`：`pt-cube-out-next`（旧页 `rotateY 0→-90°`）+ `pt-cube-in-next`（新页 `90°→0`）；
  `prev` 方向镜像。
- **不用 `preserve-3d`**：安卓上有扁平化跳位坑。`perspective` 挂在 image-pair 容器上即可。
- 旋转露出的边角由 `::view-transition` 的静止壁纸填充，看到的是壁纸而非已就位的新页，保住转体错觉。
- `page-transition.tsx` 在新路由 commit 后才放行旧页快照冻结（`notifyRouteCommitted`）。

## 2. 绝区零式撕纸遮罩（`.ptr-*`）

**流程**：覆盖（cover）→ 换页 → 揭开（reveal）。三层斜切色块交错扫屏。

### 时序（组件常量，改 CSS 必须同步）
```
COVER_MS  = 400   // 黑主板 0.12s delay + 0.28s 动画
MIN_HOLD_MS = 440 // 满屏后最短停留（给标题逐字砸入 + 落位残影闪露脸时间）
REVEAL_MS = 400   // 三层依次扫出
COOLDOWN_MS = 安卓 480 / 其它 260
```
换页时机由 `animationend` 驱动，**不用定时器准点换页**（没遮严就换会概率性闪屏，安卓最明显）；
定时器只做 `animationend` 丢失（切后台等）的兜底（`COVER_FALLBACK_MS = COVER_MS + 500`）。

### 根层 `.ptr-root`
`position:fixed; inset:0; z-index:20000`（盖过聊天 9999 / 公告 10000，转场期间拦截全部交互）、
`contain: strict`（布局/绘制自包含，遮罩后面新页面挂载的失效不波及覆盖层）。
空闲态 `.ptr-idle` = `visibility:hidden; pointer-events:none` —— **根节点常驻 body 不增删**，
避免 body 子节点/层叠上下文反复变动引发整树重新分层（安卓闪屏诱因之一）。

### 主题色（每次转场随机换色，排除上一次）
`.ptr-theme-pink|purple|green|yellow`，变量组：
```
--ptr-accent / --ptr-accent-rgb   主色
--ptr-soft-rgb                    浅色
--ptr-paper                       白层纸色
--ptr-flash-c                     满屏闪色
--ptr-split                       RGB 残影冷色
--ptr-panel-a/b/c                 黑主板径向渐变三档
```
`-rgb` 三元组是为了 `rgba(var(), a)` 调透明度（兼容旧 WebView，不依赖 `color-mix`）。
颜色在遮罩挂载光栅化时一次定死，换色零额外开销。

### 三层扫屏
```
cover:  .ptr-wipe-a(粉) 0s → .ptr-wipe-b(白) 0.06s → .ptr-wipe-main(黑主板) 0.12s
reveal: 反序（黑板先走，粉白在它身后依次露脸再追走 → 拖尾彩条）
每层 0.28s cubic-bezier(0.7,0,0.2,1) both
ptr-wipe-in:  translate3d(140% * var(--ptr-x)) → 0
ptr-wipe-out: 0 → translate3d(-140% * var(--ptr-x))
```
`--ptr-x`：`1` = 去下一页（右扫入、左扫出），`-1` 镜像。
**外层只动 `translateX`（唯一合成属性），斜切由内层静态 `skewX(-10deg)` 承担。**
色块四周出血（`top/bottom -12%`、`left/right -25%`）保证斜边转角不漏底。

### 黑主板上的装饰层（自下而上）
| 层 | 内容 |
| --- | --- |
| `.ptr-panel` | 近黑底 + 径向渐变（`background-color` 单独声明作合成器兜底色，见下） |
| `.ptr-halftone` | 半调网点 + `-55deg` 斜向百叶窗，两层静态背景，零逐帧开销 |
| `.ptr-band-1/2/3` | 胶片绶带：实色带身 + 上下两排黑冲孔（`::before`/`::after` 重复渐变）+ 等距帧分隔线 + 带内黑字。`rotate(-12deg)` 斜穿，1/3 向左、2 向右交错滚动（`ptr-band-drift` / `-rev`，3~3.6s linear infinite，振幅 ±6%），淡入是并行的第二条 opacity 动画 |
| `.ptr-scanlines` | 粗百叶窗扫描线，压在文字上增加胶片感 |
| `.ptr-rows` / `.ptr-row-1..6` | 巨型镂空文字行。容器先 `skewX(10deg)` 抵消主板 skew 再 `rotate(-12deg)`（乘积 = 纯 rotate，字形不被剪切）。奇数行 = 镂空描边巨字（`-webkit-text-stroke`，最大 190px），偶数行 = 实心小字短语，方向交错，5~7.5s linear infinite |
| `.ptr-mark` | 巨型水印符号，`clamp(260px, 68vh, 640px)` 镂空描边，`ptr-mark-drift 2.6s`（`rotate(-10°→8°)` + `scale(0.9→1.05)`） |
| `.ptr-title` | 标题卡，静态定格 `-2°`（冲击全交子元素，见下） |
| `.ptr-edge-left/right` | 主板两侧霓虹描边条，只在扫动途中露脸 |
| `.ptr-streaks` / `.ptr-streak-1..6` | 速度线横飞，`ptr-streak-fly 0.5~0.74s linear infinite`，各自 delay 错峰；基线 transform = 飞行起点（delay 期间停屏外） |
| `.ptr-flash` | 黑主板落位瞬间一次低透明度满屏闪（`0.26s ease-out 0.38s`，峰值 `opacity:0.22`） |
| `.ptr-corner-no` / `.ptr-corner-loading` | 右上编号（贴纸投影）/ 左下 `ptr-blink 0.8s infinite` 闪烁加载字 |

### 标题卡入场链（强同步，改一处要动两处）
```
.ptr-letter      逐字砸入  0.16s，delay = 0.3s + var(--ptr-i) * 0.04s
                 上方放大斜插 scale(1.7) rotate(7°) → 过冲压扁 scale(0.94) → 回正
.ptr-title-echo  镂空回声盖章 0.24s，delay = var(--ptr-land)（组件按字数算好下发）
.ptr-title-ghost RGB 错位残影（青 --ptr-split / 品红 --ptr-accent 双拷贝）硬闪两下，纯 opacity
.ptr-title-main  实心主字 + 贴纸式硬偏移双重 text-shadow（随字形走，逐字动画天然跟随）
.ptr-title-hazard 斜纹条 scaleX(0→1) 0.26s delay 0.52s（静态条纹背景，拉开自带扫掠感）
.ptr-title-chip  副标签粉底黑字斜切小条，0.3s delay 0.46s 顺滑动方向滑入
```

### 全程约束
**只用 `transform` / `opacity`。无 `backdrop-filter`、无 `filter`、无 `preserve-3d`、无 `clip-path`**
—— 安卓 WebView 安全。所有跑位移动画的层显式 `backface-visibility: hidden` +
`transform-style: flat`（安卓在位移动画下若图层不是稳定 3D 合成层会出子像素重影/上帧纹理残留）。
纯 opacity 动画和静态元素**不加**（加了无益，反而可能多裂图层）。

## 3. 安卓精简渲染 `.ptr-android`（装饰全保留，只降成本）

真机花屏形态：主板大图层瓦片光栅化跟不上 → 缺瓦片透出下层白纸层（整块露白），
而独立合成层的丝带/大字反而画出来了 → 错位叠画。三路对策：

1. **兜底色**：主板/扫屏/胶片带都声明不透明 `background-color`
   → 缺瓦片时按图层底色填充，白花屏变成「暗色一闪」。
2. **削峰**：满屏渐变改实色（`.ptr-panel` / `.ptr-wipe-a .ptr-wipe-fill` 的 `background-image: none`）
   → 纯色层走 Chromium solid-color 快路径，不分配纹理。
3. **错峰**：装饰分两波挂载（组件 `decorStage`）。起手 +2 帧上轻装饰（丝带/标题），
   再过 ~110ms 上重装饰（巨型文字行/水印）并配 `ptr-band-fade 0.22s` 淡入
   → 光栅化高峰摊进 0.4s 盖屏过程，且行纹理晚一两帧也看不出缺字。

其余降级：
- 胶片绶带静态化（保留斜角与淡入，补 `transform: rotate(-12deg)` 因为漂移 keyframes 自带该角度）
- 偶数小字行静态化（内容是均匀重复短语，定格无差别），奇数大字行保留滚动
- 文字行收窄 `left/right: -10%`（≈360vw → 288vw），组件侧 `bigRepeat` 5（非安卓 12）已校准
- 镂空描边改半透明实心（`-webkit-text-stroke: 0`）—— 描边要为每字形生成独立路径纹理，成本远高于实心
- 水印字号上限降到 `clamp(180px, 42vh, 380px)` + 实心低透明
- `.ptr-edge` 发光半径 32px → 12px
- 速度线不挂载；`text-rendering: optimizeSpeed`
- 冷却 480ms，图层树销毁推迟到冷却期中段（不和揭开收尾/新页安顿抢同一批帧）

## 4. 左右滑页手势（`components/page-swipe.tsx`）

手势触发上述转场，`--ptr-x` 由滑动方向给出。冷却期内的滑动**静默忽略**
（比排队叠加恶化要好）。转场进行中锁 `runningRef` + 覆盖层自身拦截指针事件双保险。

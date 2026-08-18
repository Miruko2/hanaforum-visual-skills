# 04 · 播放器一家

三个播放器，长得像但职责不同：

| 组件 | 在哪 | 说明 |
| --- | --- | --- |
| `MusicPlayer.tsx` | `/music` 页底部 | 本页的主播放器，功能最全（进度条 / 播放模式 / 背景特效 / 音量 / 收藏 / 历史） |
| `ExpandedCard.tsx` | 全屏弹层 | 「正在播放」大卡：黑胶 + 环形进度 + 歌词回声 + 背景特效 |
| `GlobalMiniPlayer.tsx` | 站内其余页面右下角 | 后台续播的迷你卡片，`/music` 页内不显示（见 `01`） |

三者共用 `MusicPlayButton`（白色实心三角，见 `03`）与 `useDominantHue`。

---

## 1. 封面主色 `hue` 是一切彩色的来源

```ts
const extracted = useDominantHue(track.cover)
const hue = extracted ?? track.hue ?? 0
```

进度条渐变、环形进度、播放模式图标、歌词开关的高亮全部由它派生
（`hsl(${hue} 75~80% 65%)`）。取色中（`undefined`）或失败（`null`）时回退
`track.hue`（`playlist.json` 里的种子色 / 用户曲目的 id 哈希色），**UI 永远不会变灰**。

> 用户自定义封面也取色：网易导入的封面走 `/api/img-proxy`，自有 CDN 的上传带 CORS
> 客户端直取（无 SSRF 面）。这比旧的 id-hash 取色好得多 —— 后者和封面毫无关系。

---

## 2. `/music` 底部播放器（`MusicPlayer.tsx`）

### 外壳

```
外层  pointer-events-none fixed bottom-5 left-1/2 z-[60]
      w-[min(640px,calc(100vw-32px))] -translate-x-1/2
面板  pointer-events-auto rounded-2xl p-2 sm:p-3，整块可点 → 展开大卡
      background      rgba(255,255,255,0.05)
      backdrop-filter blur(32px) saturate(140%)
      box-shadow      0 20px 60px -10px rgba(0,0,0,0.55),
                      0 0 0 1px rgba(255,255,255,0.12),
                      inset 0 1px 0 rgba(255,255,255,0.08)
```

**外层 `pointer-events-none` + 面板 `auto`** 是必须的：外层是一条横跨 640px 的
定位容器，不放行的话它会挡住下面墙上的卡片。

### 安卓 App 分支（`useIsAndroidApp()`）

```
background      rgba(40,40,40,0.92)    // 去 blur 后加深补偿
backdrop-filter 无
transform       translateZ(0)          // 强制独立合成层，隔离渲染
contain         layout paint           // 把绘制关在盒子里，防鬼影外溢
```

> 理由（注释原意）：它本来就是 85% 实底灰、背后的卡片又被遮挡（只剩暗化的封面背景），
> blur 的视觉贡献趋近于 0；但代价是真实的 —— **背景呼吸脉冲每变一次，整块面板都要
> 重模糊一遍**，还给本就脆弱的 WebView 合成器（鬼影史）多压一层。
> 安卓 Chrome / iOS / 桌面不受影响，保留完整毛玻璃。

注意这里用 `useIsAndroidApp`（只认 Capacitor App），**不是** `useIsAndroid`；
它只驱动静态底色，不碰 framer-motion 的 `initial`。

### 动效

| 对象 | 参数 |
| --- | --- |
| 面板进出场 | `opacity 0→1` + `y 20→0`，`duration 0.55`，`ease [0.2, 0.8, 0.2, 1]`；`AnimatePresence mode="popLayout"` |
| 切歌时的标题行 | `AnimatePresence mode="wait"`，`y -8 → 0 → 8`，`duration 0.3`，key 为 `track.id`（旧标题上移淡出、新标题从上方落入） |

### 进度条（`ProgressBar` 子组件）

**单独成组件是为了跨切歌保持稳定的组件标识**，父级重渲染时 ref 不失效。

```
轨道  h-2 rounded-full bg-white/10  touch-none
缓冲  bg-white/25，transition-[width] 300ms ease-out
已播  linear-gradient(90deg, hsl(H 75% 65%), hsl(H+30 80% 70%))
      未拖动时 transition-[width] 300ms ease-linear；拖动时**去掉过渡**（要跟手）
滑块  h-3 w-3 白色圆 + shadow-md，静止 opacity .85、拖动时 1
```

- 拖动用 `setPointerCapture`（与卡片墙相反 —— 这里就是要独占后续事件）。
- 拖动中的时间存在 `scrubRef`（ref，不是 state），配一个 `setScrubTick` 强制重渲染。
- 松手才 `seek()`，拖动过程只改显示。
- 时间文字 `tabular-nums`，两端各 `w-9` 定宽，数字跳动不会推动进度条。

### 控件行（从左到右）

`prev` / `MusicPlayButton size=40` / `next` / 播放模式 / 背景特效 / 水波底图 /
`VolumeControl` / 收藏 / 历史。

- 播放模式图标：`Repeat`（列表循环）/ `Repeat1`（单曲）/ `Square`（播完就停），
  着色 `hsl(H 75% 65%)`，点击弹 `PlayModeMenu`。切歌时菜单自动关闭。
- **背景特效**按钮循环 `rain → center → off → topography`，**仅桌面/iPad 显示**
  （移动端没有液面，见 `06`）。
- **水波底图**按钮循环 `gradient → cover → background`，同样仅桌面/iPad。
  > 它在任意特效模式下都保留，是为了避免切模式时工具栏少一个按钮导致布局跳动；
  > 底图只对水面模式有可见效果，其它模式下点击只改持久化设置。
- 收藏键 `hidden ... sm:grid` —— 窄屏不显示（空间让给核心控件）。

---

## 3. 展开大卡（`ExpandedCard.tsx`）

`createPortal` 到 `document.body`，`AnimatePresence` + 以 `track.id` 为 key，
Escape 关闭。默认 `overlayZ = 60`（弹幕墙那种高层级页面要调高）。

### 尺寸

```
COMPACT_VW = 480          低于此宽度进入紧凑档
RING_PADDING = 8   STROKE = 3

           紧凑                标准
PANEL_W    max(280, vw-24)     560
PANEL_H    180                 260
DISK_SIZE  130                 200
RING_R     DISK_SIZE / 2 + 8
SVG_SIZE   RING_R * 2 + STROKE * 2      SVG_OFFSET  -(RING_PADDING + STROKE)
```

### 面板与入场

```
borderRadius 28
background      rgba(255,255,255,0.05)    // 安卓：rgba(28,28,30,0.92) 实底
backdrop-filter blur(32px) saturate(140%) // 安卓：无
box-shadow      0 30px 90px -15px rgba(0,0,0,0.6),
                0 0 0 1px rgba(255,255,255,0.12),
                inset 0 1px 0 rgba(255,255,255,0.10)

入场  opacity 0→1, scale 0.96→1, filter blur(20px)→blur(0px)
      duration 1s, ease [0.2, 0.8, 0.2, 1]
```

> **高斯凝结入场**：面板从一团模糊里「凝」出来，与磨砂背景是同一套放大镜语言。
> 用三次缓动而不是弹簧，**落地要安静、不要回弹**。

- **遮罩只压暗不模糊**（`bg-black/55`），好让后面的卡片墙保持清晰。
- 安卓走无 `filter` 的变体（`panelAnim`），理由见 `08` 第 5.4 / 5.5 节。
  附带好处：安卓上弹层打开时墙已经整层隐藏，面板背后本就是纯黑，
  模糊看不出效果 —— **去掉零视觉损失还省合成**。
- ⚠️ **`ExpandRect` 目前是死参数**。类型注释与组件头注释都说「从被点卡片的屏幕矩形
  飞入（记录 rect，把 x/y/scale/rotateY 动画回单位矩阵）」，但 `ExpandedInner` 里
  **从未读取 `target.rect`** —— 现在的入场是居中的缩放 + 模糊凝结。
  要恢复飞入效果，得自己把 rect 接回 `initial`。

### 黑胶自转

```ts
TARGET_SPEED_DEG_PER_FRAME = 360 / (30 * 60)   // 30 秒一圈 @60fps = 0.2°/帧
speed += (wanted - speed) * k                  // k：播放中 0.06，停止时 0.018
```

**不用 CSS `animation: spin infinite`** —— CSS 的无限旋转停得很硬。
这里用 rAF 累加角度 + 速度向目标 lerp，暂停时会**滑行一小段再停**（k 更小 = 更长的滑行）。
`prefers-reduced-motion` 下永不转（封面仍然显示，只是静止）。
逐帧只写 `diskRef.current.style.transform`，不走 state。

碟片本体：`rounded-full overflow-hidden`，
`box-shadow: 0 14px 30px -6px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.06)`，
`will-change: transform`。

### 环形进度与角度拖动

两个同心 `<circle>`：底环 `rgba(255,255,255,0.10)`，进度环 `hsl(H 80% 65%)`。

```
strokeDasharray  = 2πR
strokeDashoffset = 2πR × (1 - pct)
transform        = rotate(-90 cx cy)        // 起点转到 12 点方向
transition       = stroke-dashoffset 0.18s linear（拖动时 none）
filter           = drop-shadow(0 0 6px hsl(H 80% 60% / 0.55))
strokeLinecap    = round
```

拖动 = 按角度换算时间：`atan2(y-cy, x-cx)` → 归一到「12 点起、顺时针 0..2π」
→ 乘时长。**拖动时才显示白色滑块**（`r = 5.5`，位置由 `pct` 反算）。
SVG 用 `setPointerCapture`，并且尺寸比碟片大一圈（`SVG_OFFSET` 负偏移），
让整条环带都是可拖的命中区。

### 点空白处关不关？

```
isMobile || liquidFx === "off" || liquidFx === "topography"  → 点空白关闭
其余（桌面液面模式 rain / center）                            → 不关闭
```

因为桌面液面模式下，点空白是用来**跟水面交互起涟漪**的；这时只有 ✕ 或 Esc 能关。

### 右列内容

标题（`text-base sm:text-xl`）/ 艺术家（`text-white/65`）/ ✕ →
时间行（`tabular-nums`，`当前 / 总长`）→ 传输控件行
（prev · `MusicPlayButton size 40|48` · next｜分享 · 歌词开关）。
`无音源` 徽章：`bg-white/12` 圆角小标签，`isFallback` 时出现。

歌词开关点亮时着 `hsl(H 80% 65%)`，熄灭时 `rgba(255,255,255,0.55)` —— 这是本页
所有「开关型图标」的统一表达（背景特效、水波底图按钮同款）。

---

## 4. 站外迷你播放器（`GlobalMiniPlayer.tsx`，921 行）

后台续播的可见入口，挂在全站（见 `01`），`/music` 页内隐藏。它是这三个里最复杂的
一个：**同一张卡片要在「展开 / 收起 / 半嵌边缘」三态之间连续形变**。

### 尺寸

```
COVER = 44          封面边长
FULL_H = 76         展开态高度 = p-2(8×2) + 封面 44 + mt-2(8) + 进度条 8
COLLAPSED = 60      收起态 = 封面 44 + p-2(8×2)
RING_PAD = 4  RING_STROKE = 3  RING_R = 26  RING_SVG = 58
SPIN_PER_FRAME = 360 / (30 * 60)   // 30 秒一圈，与 ExpandedCard 一致
```

### 三态形变的做法

整卡的 `width` / `height` / `borderRadius` / `backgroundColor` / `boxShadow`
全部交给 framer-motion 一起动（`duration 0.42`，`ease [0.2, 0.8, 0.2, 1]`）：

- **收起态把玻璃「淡掉」而不是硬切**：`backgroundColor` 动到 `rgba(255,255,255,0)`、
  `boxShadow` 的三段 alpha 全动到 0。`backdrop-filter` 无法参与动画，
  所以随收起态直接关掉 —— 底色同时淡到透明，肉眼无感。
- **内层是固定宽度的内容容器**（宽度恒为展开态宽），被外层 `overflow-hidden` 裁切，
  收缩时内容自然「从右侧卷掉」，不是被挤压变形。
- 收起态封面裁成圆形（`borderRadius: COVER/2`）并露出环形进度。
  ⚠️ 圆形态**只留一条 `inset` 描边、不要外阴影** —— 外阴影会被卡片的圆形裁切
  切成同心暗环，糊在圆盘与进度环之间的空隙里（那正是要去掉的「圆环背景」）。
- 触屏端还有**半嵌边缘**态：`x` 推到 `-(16 + COLLAPSED/2)`，圆盘只留右半个在屏内；
  任何触摸都会重置自动缩回计时。

### 展开态下方的「叠层预览」

接下来要播的 5 首（`upcoming`），做成一叠磨砂玻璃片。这一段的注释是本仓库里
关于「玻璃层次感」最完整的一份决策记录：

```
MAX_LAYERS = 5   LAYER_DX = 6   LAYER_DY = 30   LAYER_GLASS_BLUR = 16
WHEEL_STEP = 28（滚轮）   SWIPE_STEP = 42（触屏）   MAIN_SCROLL_STEP = LAYER_DY
LAYER_CONTENT_OPACITY = [1, 0.92, 0.8, 0.7, 0.6]
LAYER_TINT            = [0, 0.06, 0.11, 0.15, 0.18]
LAYER_SHADOW          = 五档，越上层越浓、扩散越大
STACK_COVER = 36   STACK_H = 52
```

四条硬规矩：

1. **所有可见卡片保持同一档 `backdrop-filter`**（`blur(16px) saturate(150%)`）。
   逐层给不同 blur 值会在滚动时重采样导致闪烁。
2. **只衰减卡片内部内容的 opacity，绝不降玻璃外壳本身的 opacity**。
   降外壳 = 把玻璃一起稀释掉。主卡同理：滚动时主卡跟着上移但 **opacity 恒为 1**。
3. **纵深靠「顶部亮边 + 层间投影 + 极轻分隔色」表达，不靠压暗整卡**。
   > 旧方案用重暗色覆层做纵深，等于把玻璃糊成褐灰泥，观感和「降 opacity 丢玻璃」
   > 是同一个病。
   顶部亮边 `inset 0 1px 0 rgba(255,255,255, 0.32 | 0.26-depth*0.035)` 是区分层次的主力。
4. **选中卡用真实宽高放大，不用 `transform: scale`** —— 缩放含毛玻璃的合成层会重采样。

其它细节：
- 已看过的卡（past）不淡出消失，而是**向上堆进主卡背后**，滚回去时再弹出；
  未来卡在下方展开。两者共用同一套深度样式，用 `Math.abs(relativeIndex)` 取样。
- 主卡同步上滚 `-focusedIndex × LAYER_DY`，整叠读起来像一个连续滚动的列表，
  而不是「固定头 + 滑动尾」。
- 未选中卡收成**封面方块贴片**（只有封面，宽 `STACK_H - depth*2`），
  只有选中卡展开成整宽并显示曲名/歌手 —— 队列因此是一叠干净的封面。
- 选中卡用弹簧 `{stiffness: 420, damping: 32, mass: 0.8}`「啵」地弹出；
  进出栈的其它卡用 `{duration: 0.34, ease: [0.2, 0.8, 0.2, 1]}` 平滑缓动。
- 选中卡的描边与光晕取 `track.hue`：
  `0 0 0 1px hsl(H 85% 78% / .5), 0 0 16px -2px hsl(H 85% 70% / .28)`。

### 滚轮 / 触摸翻卡的三个坑

1. **滚轮监听必须是原生 + `{ passive: false }` + 捕获阶段**。
   React 的 wheel 合成事件在部分浏览器会落到被动监听上，`preventDefault` 拦不住页面滚动；
   而冒泡阶段 window 最后才收到 wheel，**家园 3D 画布自带的滚轮监听会先把相机推拉一遍**，
   之后再 `stopPropagation` 已经没意义。所以是 `capture: true` + `stopImmediatePropagation`。
2. **触摸接管要用「当前手指位置」实时命中，不能只判起点**。
   旧实现凭起点判定，起点落在区域边缘外（pad 之外）时整段手势都放行页面滚动，
   造成「滑歌曲却把页面一起拖走」的概率性 bug。现在是 `touchmove` 里持续命中测试（±10px pad），
   一进入区域就锁住页面滚动；本手势一旦接管，即使划出区域仍继续 `preventDefault`。
3. **叠层空白处要有一层命中层**（`inset-0` + `pointerEvents: auto` + `touchAction: none` + `zIndex: 0`），
   否则指针会穿透到家园 canvas 触发视角控制。
   另外叠层根节点**不做 opacity/filter 动画** —— 那会让它变成子卡片的 backdrop root。

翻卡门槛：滚轮累计 `|delta| >= 28`（`WHEEL_STEP`），触屏 `|dy| >= 42`（`SWIPE_STEP`）；
翻卡后 120ms 内的触控板尾波只续锁、不累加。

### 封面自转的 rAF 会停帧（与展开卡不同）

迷你播放器收起态才转封面，且**转速衰减到阈值以下就停 rAF**：

> 旧实现无条件每帧空转（挂着歌就全站 60fps），视觉零变化，纯省电/省合成压力。

展开态则一次性清掉残留 `transform` 就收工。

⚠️ 对照：`ExpandedCard` 的黑胶 rAF **没有**这个停帧 —— 它的 `requestAnimationFrame(loop)`
写在 if 之外，弹层打开期间即使碟片停转也一直在跑。弹层是短命的、且同时还有 WebGL 在跑，
所以没做；但如果哪天要抠这一页的 idle 功耗，这是个现成的口子。

### `/live` 页的层级例外

弹幕墙是一整块 `position: fixed; inset: 0; z-index: 80` 的不透明全屏面板，会盖住
普通 `z-[45]` 的迷你卡片。所以在 `/live` 上 wrapper 抬到 `z-[85]`、展开卡的
`overlayZ` 传 `90`。改这两个页面的层级时要一起看。

---

## 5. 音量：一个 HUD，两个入口

### `GlobalVolumeHud.tsx`（全站常驻）

右侧「音量胶囊」，仿手机系统音量条。

```
CAP_W = 50   CAP_H = 156   ICON_SIZE = 20   ICON_BOX = 30   ICON_BOTTOM = 12
WAVE_H = 9（水面波浪高）   HUD_LINGER = 1000ms（停止调节后淡出）

胶囊  rounded-full，background rgba(255,255,255,0.10)
      backdrop-filter blur(32px) saturate(160%)
      box-shadow 0 16px 48px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.16),
                 inset 0 1px 0 rgba(255,255,255,0.14)
进出场 opacity + x 44→0，spring {stiffness: 420, damping: 34}
```

- **水位用 `translateY` 而不是 `height`**：避免重排，安卓友好。填充块是满高的，
  靠 `y = (1 - volume) × CAP_H` 把它推下去，底部圆角由胶囊自己裁出。
- 水位的 spring 是**低阻尼**的 `{stiffness: 220, damping: 18}` —— 涨落时像液体晃动。
- 水面还叠一条**流动波浪**：SVG 画两个波长、宽 200%，`x: 0% → -50%` 线性循环
  1.4s，半幅平移即无缝。
- 着色取当前封面主色，无歌时回落 `hue = 210`（蓝）。
- 两个入口共用它：安卓 App 的机身音量键（原生 `volumebuttons` 事件，±0.1）与
  播放器里的 `VolumeControl`（派发 `volume-hud-show` 事件）。
  > 这套逻辑原本内嵌在 `VolumeControl` 里，只有音乐页/迷你卡挂载时才生效 ——
  > 抽出来之后全站任何页面按音量键都能拦截。

### `VolumeControl.tsx`（播放器里的按钮 + 弹层）

`POP_W = 44`、`TRACK_H = 110` 的竖滑条弹层，玻璃配方与 `PlayModeMenu` 同款
（`rgba(255,255,255,0.08)` + `blur(32px) saturate(160%)`）。
滑条填充是 `hsl(H 75% 65%) → hsl(H+30 80% 70%)` 的竖向渐变，白色圆滑块。

⚠️ 弹层上的 `wheel` 监听必须 `{ passive: false }` + `preventDefault()` + `stopPropagation()`
—— 否则滚轮会同时被 `MusicCanvas` 的 wheel 处理器接走，**调音量的同时整面墙在滚**。

## 6. 播放模式菜单（`PlayModeMenu.tsx`）

上拉的竖排纯图标菜单，`MENU_W = 44`，三项：列表循环 / 单曲循环 / 播完就暂停。

- **portal 到 body**：避开播放器面板的 `overflow-hidden` 裁切，以及
  `backdrop-filter` 的层叠陷阱（玻璃嵌玻璃会采样到父级的玻璃结果）。
- 位置由锚点按钮实测：`bottom = innerHeight - anchor.top + 10`，
  水平居中并夹在视口内（左右各留 8px），`resize` 时重算。
- 全屏透明遮罩兜底点外部关闭（同时避免误触发面板展开）。
- 入场 `opacity + y 8→0 + scale 0.95→1`，`duration 0.18`，`ease [0.2, 0.9, 0.3, 1]`，
  `transformOrigin: bottom center`。
- 选中项 `bg-white/[0.15]`，其余 `text-white/55` + hover `bg-white/[0.08]`。

> `VolumeControl` 的弹层与它是同一套配方 —— 本页的「小弹层」标准件：
> `rgba(255,255,255,0.08)` 底 + `blur(32px) saturate(160%)` + 三段 box-shadow
> + portal + 透明遮罩。新增小弹层照抄这套。

# 02 · 3D 鱼眼卡片墙

源码：`app/music/_components/MusicCanvas.tsx`（594 行，rAF 循环）+
`app/music/_lib/canvas.ts`（236 行，纯数学）。

一句话：**卡片贴在一个看不见的球面（穹顶）上，球极点就是屏幕中心**。
越远离中心的卡片越「转过去朝向中心」并向后退，中心那批则向观众隆起。
拖动改变的是球面下方那张无限大的墙，球面本身不动 —— 所以放大镜永远在屏幕正中。

---

## 1. 参数总表

`MusicCanvas.tsx` 顶部（布局与手感）：

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `UNIT_W_DESKTOP` | 180 | 桌面单列宽（px） |
| `UNIT_W_MOBILE` | 140 | 移动端单列宽，`viewSize.w < 768` 时启用 |
| `GAP` | 6 | 卡片间距 |
| `COLS` | 8 | 打包列数（固定，不随屏幕变） |
| `FISHEYE_RADIUS_FACTOR` | 0.42 | 衰减半径 = `min(视口宽, 视口高) × 0.42` |
| `PARALLAX_AMOUNT` | 24 | 背景层随指针反向位移的最大 px |
| `PAN_LERP` | 0.15 | 可见位置每帧向目标位置逼近的比例 |
| `DRAG_INERTIA` | 0.92 | 松手后速度每帧的衰减系数 |

`canvas.ts` 顶部（形状与角度）：

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `MUSIC_CARD_RATIO` | 1.3 | 卡片高/宽。**统一比例，忽略各曲自带的 ratio**（`userTracks` 里是 0.85–1.35）。代价是从错落瀑布流变成规整等高网格 |
| `MAX_TILT_DEG` | 46 | 倾角上限，防止卡片翻过 90° 露出背面 |
| `TILT_COEF_DEG` | 44 | 每偏离一个 `radius` 的距离对应的倾角度数 |

舞台透视（写在 viewport 的 inline style）：

```
perspective: 1450        perspectiveOrigin: 50% 50%
```

> 1450 是从 1600 调下来的：透视更近 → 同样的 z 差异产生更强的近大远小与拖动视差，
> 穹顶感更明显。**再往小调之前必须核对屏幕边缘的卡片覆盖** —— z 后退的卡片会被
> 透视往中心拉，透视太近会在四边露出空带。

由参数推出的实际卡片尺寸（`w = 列宽 × span - GAP`，`h = round(w × 1.3)`）：

| | 单列 | 双列 |
| --- | --- | --- |
| 桌面 | 174 × 226 | 354 × 460 |
| 移动 | 134 × 174 | 274 × 356 |

⚠️ `MusicCard.tsx` 里那句注释写的是「~126(手机) ~165(桌面单) ~345(桌面双)」，
是旧 `GAP` 时代的残留，**以上面算出来的为准**（差 8~9px，不影响它按宽度派生尺寸的逻辑）。

---

## 2. 球面变换（`fisheye()`）

输入卡片中心 `(cx, cy)`、焦点 `(focusX, focusY)`（恒为视口中心）、衰减半径 `radius`：

```
d        = hypot(cx - focusX, cy - focusY)
k        = exp(-(d / radius)²)          // 1 在极点，d=radius 处 = 1/e ≈ 0.368
kOpacity = exp(-(d / (radius × 2.5))²)  // 透明度专用、放宽 2.5 倍的半径

rotY  = clamp(-(dx / radius) × 44°, ±46°)   // 焦点右侧的卡片向左转，去朝向焦点
rotX  = clamp( (dy / radius) × 44°, ±46°)   // 焦点下方的卡片向上抬
z     = -330 + k × 580                      // 中心 +250 隆起、边缘 -330 后退
scale = 0.45 + k × 0.55                     // 0.45 .. 1.0
opacity = 0.35 + kOpacity × 0.65            // 0.35 .. 1.0
blur  = (1 - k) × 3.5                       // 仍在算，但已无人消费，见第 6 节
```

几个关键的**为什么**：

- **高斯衰减（平方）而不是纯指数（一次方）**：平方把曲线在焦点附近压平，
  中央「近乎清晰/等大」的区域更宽，而 `d = radius` 处的值不变（仍是 `1/e`），
  所以远处卡片的观感与旧版一致。想要更宽的平顶把指数改成 3，想回到旧的尖峰改成 1。
- **中心必须 `z > 0`（向观众隆起），这是「凸透镜」体感的关键**。
  透视投影会把焦点区的卡片**连同它们之间的间距**一起等比放大 —— 这是局部放大镜，
  网格随之扩张、不会撞到邻卡。用 `scale` 放大做不到这点：`scale` 只放大卡片本体，
  间距不变，放大到一定程度就叠在一起了。所以 `scale` 上限锁死在 1.0，
  「变大」全部交给正向 z。
- 同时，拖动时中心卡片的视差速度天然大于远处卡片（透视除法），产生真实纵深运动感。
- **边缘 z 保持在 -330**（与旧版 -300 同量级），屏幕边缘的可见覆盖范围基本不变，
  于是视口裁剪 margin 不用加大、性能不回退。改 z 区间时要一并检查这点。
- **透明度单独用 2.5 倍半径**：其余属性（scale / z / 倾角）用紧半径才有清晰的鱼眼纵深，
  但亮度若也用紧半径，屏幕大部分区域会灰掉。分开给半径，中央「明亮区」覆盖大半个视口。

### 参考数值

| 距离 | k | scale | z | 倾角 | opacity |
| --- | --- | --- | --- | --- | --- |
| `d = 0` | 1.000 | 1.000 | +250 | 0° | 1.00 |
| `d = radius` | 0.368 | 0.652 | −117 | 44°（未夹） | 0.90 |
| `d = 2×radius` | 0.018 | 0.460 | −319 | 88°→夹到 46° | 0.69 |

### 变换字符串的顺序不能改

```js
translate3d(sx, sy, z) rotateX(...) rotateY(...) scale(...)
```

先按屏幕坐标平移，再绕自身中心旋转，最后缩放。顺序换了，旋转会绕错的原点、
卡片会沿弧线甩出去。

---

## 3. 打包与无缝平铺（`packTracks` / `computeInstances`）

### 最短列打包，支持双列跨列

- `span = 1`：选当前**最矮的那一列**。
- `span = 2`：选相邻两列中 `max(高度)` 最小的一对，落位后两列高度同时抬到新值。
- 打包完 `tileH = max(所有列高)`、`tileW = COLS × 列宽`。

**所有列共用同一个 `tileH` 是无缝的前提**：整块 tile 作为一个单位在两轴上循环，
每列在同一个 Y 回绕，不会出现逐列失步的锯齿接缝。

### 平铺实例化

`computeInstances(pack, panX, panY, viewW, viewH, margin = 80)` 对每张卡片算出
它的哪些 tile 副本 `(kx, ky)` 与视口相交，key 为 `${trackId}_${kx}_${ky}`。

> `margin` 默认 **80**（原为 280）。这是本页**单笔收益最大的性能改动**：A/B 实测下，
> 80 与 280 在本页真实拖动速度下，「卡片弹入」的瑕疵近乎不可察觉（移动端与桌面都是），
> 但预绘制的卡片数量少了一大截。改大之前先想清楚是不是真看得见。

墙的初始位置：首帧把 tile 中心对到视口中心（`-tileW/2 + viewW/2`，纵向同理），
`initialPanSet` 只做一次。

---

## 4. 平移、惯性与视差

三个位置量，职责分明：

```
panTargetRef  用户输入累积到这里（瞬时、无平滑）
panRef        实际渲染用的位置，每帧向 target 逼近 PAN_LERP(0.15)
panVelRef     松手瞬间的速度，用于惯性
```

- **惯性加在 target 上**（不是直接加在可见位置上），这样 lerp 仍会把它抹平，
  滑行末尾自然收住而不是硬停。速度低于 `0.05` 就停。
- 指针抬起时 `v *= 16` —— 把「px/毫秒」换算成「px/帧」（60fps ≈ 16.7ms/帧）。
- 拖动走 **window 级 `pointermove` / `pointerup`**，不用 `setPointerCapture`：
  捕获会把后续事件全锁到卡片上，卡片内的按钮就点不动了。
- `killDriftOnPress`（挂在 `onPointerDownCapture`）：按下瞬间把 target 钉到当前可见位置、
  速度清零。否则滑行中的卡片会在 pointerdown 与 pointerup 之间滑走，浏览器判定
  「按下与抬起不在同一元素」而**吞掉 click**。
- `onDragStart` 一律 `preventDefault()`：否则鼠标在封面图上拖会触发系统的
  「拖拽图片」幽灵图，和自己的平移逻辑打架。
- **视差**：背景层按指针位置反向平移最多 24px，`lite` 档整个跳过
  （手机没有鼠标，指针位置只是最后一次点按的位置，位移毫无意义）。

### 点击与拖动的区分（在 `MusicCard` 里）

`pointerdown` 记下位置与时间，`click` 时校验：位移 `> 5px` 或耗时 `> 500ms`
就不算点击（是拖动/长按）。通过则先 `togglePlay`，再把卡片的
`getBoundingClientRect()` 交给 `onExpand` —— 展开卡就是从这个矩形飞出来的。

---

## 5. rAF 循环的六条纪律

每帧顺序：惯性 → lerp → 视差 → 判断是否需要重算 → 逐卡直写。

1. **逐帧变换全部由 rAF 通过 ref 直写 DOM**，不经 React。卡片只在
   track / playing / favourite 变化时重渲染（`MusicCard` 是 `memo` + `forwardRef`）。
2. **pan 没动就不重算可见集**（阈值 0.01px）。静止时省掉每帧的数组分配与签名字符串拼接。
3. **可见集变化才 `setInstances`**：先把 key 拼成签名串比对，变了才在 `queueMicrotask`
   里 setState（避免在 rAF 中同步触发渲染）。同时按新 key 集清理样式缓存 Map，防止泄漏。
4. **静止停渲（代码里叫 A1）**：`panMoved || paintSeq !== lastPainted || 遮挡态翻转 || 隐藏态翻转`
   四者皆否时，整段逐卡循环跳过。rAF 仍在转，但不再空算 fisheye。
   - `paintSeq` 在可见集变化时自增；
   - `lastPainted` 只有在某一帧**把当前可见集的每张卡都写到了 DOM** 时才追平 ——
     `setInstances` 是异步的，新卡可能晚一帧才挂上，没挂全就不追平，下一帧继续补画，保证不漏卡。
5. **每条样式写入前脏检查**：`prevStyle` Map 存上一帧的 `{transform, opacity, filter, visibility, far}`，
   逐条比对，只有变了才写。
6. **背景视差的字符串也脏检查**（`prevParallax`），指针不动时一个字符都不写。

---

## 6. 那些「留着但不用」的东西

- **`fisheye().blur`** 仍在计算，但每帧写入的 `filter` 恒为空串。
  原因见 SKILL.md 铁律 1：卡片要用 `backdrop-filter` 做真毛玻璃，
  而元素自身的 `filter` 会废掉它自己的 `backdrop-filter`。
  历史现象是「只有正中心一张卡有磨砂」——因为中心卡的 blur 恰好是 0。
- **`data-far` 属性**（`blur > 2.0` 记 `1`，否则 `0`）仍在写。
  它原本配合一条 CSS 规则，关掉远处卡片那层「整卡已糊、看不见却仍在烧 GPU」的
  `backdrop-filter`；那条规则已删，目前**没有消费者**，保留只为将来
  「按远近切换卡片视觉」时复用。
- ⚠️ `MusicCanvas.tsx` 里 `data-far` 上方那段注释说「现卡片改为整张实底、全程无
  `backdrop-filter`」——**这句已过期**。卡片当前挂的是 `.mw-glass` / `.mw-glass-lite`，
  是真毛玻璃（见 `03`）。以 `MusicCard.tsx` 顶部注释与 CSS 为准。

---

## 7. 安卓：两处「隐藏卡片」的补丁

安卓 WebView / Chromium 的合成器有 `preserve-3d` 的 z-index 排序 bug：
3D 上下文里的卡片会**逃出 stacking context**，画在 z-index 更高的覆盖层上面，
表现为「透过不透明面板能看到卡片鬼影」。纯 CSS（不透明背景 / 提层 / 封层）都压不住，
唯一可靠手段是让卡片本身不渲染。

| 场景 | 触发条件 | 做法 |
| --- | --- | --- |
| 弹层打开 | `isAndroid && overlayOpen`（展开卡 / 抽屉 / 编辑器任一） | 整个 3D Stage 层 `visibility: hidden` |
| 底部播放器鬼影 | 安卓 **app** + 正在播放 | rAF 每帧把落入播放器矩形区的卡片单独 `visibility: hidden` |

- 播放器遮挡区：`PLAYER_ZONE_H = 120`（覆盖 `bottom-5` 边距 + 面板高度并留余量），
  **宽度取整屏宽而非播放器宽**。播放器有 `max-width: 640` 居中，宽屏（安卓平板）上
  两侧留大片空白，而鬼影是沿**整条底边**出现的；旧版只盖中间约 664px，平板上两侧角落
  仍有大量闪动 —— 这正是用户反馈「把窗口缩小就不出现」的根因（窄屏时播放器近乎占满宽度）。
- 判定用**未变换前**的基础矩形 `[sx, sy, w, h]`，鱼眼在边缘是缩小的，所以判定偏保守、
  利于完全遮住。
- Stage 父级写 `visibility: hidden` 不够：rAF 每帧给子级写的 `visibility: visible`
  会把它逆转（visibility 可被子级覆盖），所以隐藏职责必须也落到 rAF 里。
- 隐藏只能用 `visibility`，不能用 `opacity` —— 见 SKILL.md 铁律 2。
- 桌面 / iOS / iPad 上这两个开关恒为 false，墙面完整不受影响。

---

## 8. 其他容易踩的点

- **Stage 层 `pointer-events: none`**：它是 z=0 的平面，不关掉命中测试的话会挡住
  z<0 的卡片（在 preserve-3d 空间里卡片在它后面）。每张卡自己再开 `pointer-events: auto`。
- **卡片内的按钮必须 `stopPropagation`**（prev / play / next / ♡ 都做了），
  否则按下就开始平移。`onPointerDown` 里还有一道 `closest("button")` 的兜底。
- **关闭按钮走 SPA 导航**：`navigateWithTransition(router, "/", "prev")`，
  不能用 `<a href="/">` —— 整页硬刷新会把全站常驻的 `PlaybackProvider` 一并销毁
  （音乐停、迷你卡片消失），也看不到转场、加载更慢。
- **`PlaybackPresenceProbe`**：一个返回 `null` 的探针组件，专门订阅播放上下文并把
  「当前是否有曲目」回调上报。把 `timeupdate` 引发的高频重渲染隔离在这个空组件里，
  不波及重量级的 `MusicCanvas` 本体（它只读 ref、不订阅播放状态）。
  这是本页处理「重组件需要一点高频状态」的标准手法。

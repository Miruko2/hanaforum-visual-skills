# 05 · 背景层叠与氛围

## 1. 卡片墙的背景（自下而上）

`MusicCanvas` 里实际挂载的只有四层，**别再往里加层**（每一层都是全屏合成）：

| z | 层 | 内容 |
| --- | --- | --- |
| 底 | 环境光晕（在视差层内） | `radial-gradient(120% 90% at 50% 40%, rgba(40,80,160,0.18), rgba(0,0,0,0.95) 70%)`。它是「没有歌在放」时的兜底底色 |
| 底 | `ImageBackdrop` | 站点底图 / 用户自定义首页背景 + 律动暗化遮罩 |
| `z-[2]` | `Grain` | 胶片颗粒，`lite` 档不挂 |
| `z-[1]` | 暗角 | `radial-gradient(70% 60% at 50% 50%, transparent 36%, rgba(0,0,0,0.62) 100%)` |

前两层都在 `parallaxRef` 容器里（`inset: -40px` 出血），随指针最多反向平移 24px。

> **背景本身保持清晰，绝不预先模糊** —— 毛玻璃是卡片自己的 `backdrop-filter`
> 糊它身后那一块完成的。背景先糊过，玻璃就没有可糊的细节了。
>
> 同理，这里**不用视频背景、也不给每张卡加更多滤镜**：两者都会每帧重新模糊全屏 /
> 几十张卡，直接卡死渲染。

### `ImageBackdrop`（`_components/ImageBackdrop.tsx`）

```
底图  用户在个人页设过首页背景就用它，否则站点默认 /mos-background-1920.webp
切换  走 CrossfadeBackground（与首页同款高斯模糊交叉淡入），extraFilter="saturate(1.08)"
遮罩  纯色 #070910，初始 opacity 0.3
```

**播放时的「呼吸」律动**在这层完成：一个 rAF 按音频强度改遮罩的 `opacity`。

```ts
dim = (0.22 + (1 - intensity) * 0.44).toFixed(2)
// intensity=1（强拍 / 暂停）→ 0.22 背景正常
// intensity=0（弱）        → 0.66 明显变暗
```

四条要点，都是可复用的手法：

1. **改的是 `opacity`** —— 合成属性，不触发重绘 / 重模糊，开销极小。
2. **量化到两位小数（2% 步进）+ 脏检查**：避免每帧都拼一个新字符串写进 DOM。
3. **单点 rAF，不用每卡订阅** —— 零额外重渲染。
4. **暂停时 `getAudioIntensity()` 恒返回 1**，遮罩因此稳定不闪。

### `Grain`（`_components/Grain.tsx`）

纯 CSS，运行时成本≈0：

```
背景  内联 SVG data URI：feTurbulence(fractalNoise, baseFrequency 0.9, numOctaves 2,
      stitchTiles=stitch) + feColorMatrix 转成白色 alpha 0.6，220×220 平铺
opacity 0.12   mix-blend-mode: overlay
animation grainShimmer 0.9s steps(10) infinite
容器  inset: -25%
```

- **`mix-blend-mode: overlay`** 让噪声在亮处加光、在暗处压深，而不是整片糊一层灰。
- **`steps(10)` 离散跳位而不是平滑补间** —— 每一「帧」的噪声都是一次不同的采样，
  这才是真胶片颗粒的样子。平滑过渡会变成「一张噪点图在滑动」。
- 容器四周 `-25%` 出血，平移时不会在视口边缘露出接缝。
- `lite` 档不挂：小屏上几乎看不见，却是弱 GPU 上真实的开销。

---

## 2. 详情页（`ExpandedCard`）的氛围层

自下而上：`bg-black/55` 暗化遮罩（**只压暗不模糊**，保持后面的墙清晰）→
液面 / 地形（见 `06`）→ 雪花 → 面板 → 歌词回声。

### `SnowOverlay`（雪花）

- 引擎是自托管的 `public/vendor/snowflakes1.min.js`（threejs-components，
  three 已烤进去，~764KB），动态 import 懒加载。
- 透明渲染（`alpha: true` + `setClearColor(0x000000, 0)` + `scene.background = null`），
  独立 canvas 叠在液面之上、卡片之下。`snowflakes: { count: 250 }`。
- **贴图要自己画**：库不自带，不调 `loadMap()` 雪花根本不显示。
  这里用 canvas 现画一张 64×64 白色六角雪花（六次 `rotate(π/3)` + 三级分叉）转 dataURL。
- ⚠️ **雪花不与水面交互**：`snowflakes1` 和 `liquid1` 是两套互不相通的 WebGL 场景，
  雪花落下不会拨动水波。要「落水起涟漪」得自绘飘落物 + 调 liquid 的 `addDrop`。
- 只在 `rain` 模式挂（`center` 是中间涟漪、不下雪），且仅桌面/iPad。
- 引擎 / WebGL 不可用时静默降级（无雪花，液面照常）。

### `LyricsEcho`（歌词回声）

当前行贴着面板边缘，旧行向外推开 —— 上方一堆往上、下方一堆往下，
两侧是**同一份历史的镜像**。

```
DEPTH = 5              每侧可见行数（含当前行）
ENTER_EASE = [0.2, 0.8, 0.2, 1]
gap = compact ? 26 : 34
每加深一层：opacity -0.22   scaleX -0.06   scaleY -0.16   y += side * gap
入场/退场 duration 0.5
```

纵深靠三样叠加：**透明度 + 压扁（scaleY 掉得比 scaleX 快）+ 模糊**。
模糊是静态的 `blur(d * 0.8px)`，安卓不挂。

**桌面独有的流动水波**（`water = !isMobile`）：

```
滤镜  feTurbulence(fractalNoise, baseFrequency "0.014 0.020", numOctaves 2, seed 2)
      → feColorMatrix 整形 → feDisplacementMap(scale, x:R, y:G)
WATER_SCALE  = [6, 11, 17]     // d=1..3，越远越强
WATER_LEVELS = 3
滤镜串联顺序：blur → url(#lyric-water-d)   // 先按纵深糊，再扭这份已糊的文字
```

三个非显然的决定：

1. **`feColorMatrix` 把 R 通道的方差压到 ~25%（`R' = 0.25R + 0.375`）**。
   因为 `feDisplacementMap` 的 x/y 共用一个 `scale`，噪声在一行文字范围内的净偏移
   会把整行**横向推离中心**，scale 越大推得越狠 = 「越远的行越偏」。
   压扁 R 之后水波以纵向起伏为主、横向只剩微光，歌词行被钉回中线；
   G 通道（纵向位移）保持满量，水面感不变。
2. **只给 `d = 1..3` 挂水波**：`d = 0` 要清晰，`d >= 4` 透明度只剩 ~0.12 —— 而那一档
   恰好是 scale 最大、区域最大、最看不见的，省掉它最划算。
3. **动画化 SVG 滤镜的真正开销是「`baseFrequency` 一变，浏览器就为每个用该滤镜的
   元素重算一遍 fractalNoise」**，所以：写入节流到 ~30fps（重算次数减半，慢流动看不出
   差别），且**暂停且水面已静时彻底停写** → 滤镜变静态、浏览器缓存结果，idle 近零开销。

播放中水流满速、暂停渐静（`intensity` 向 0.15 缓动，相位推进与帧率无关）。
移动端与安卓不挂水波（安卓 WebView 动画化 `filter` 有合成器撕裂前科），退回纯
transform + opacity 残影。

歌词行时间用 `currentTime + 0.12` 取活动行 —— `currentTime` 节流 ~240ms，
**补半个周期让换行的体感更准**。

---

## 3. 已死的背景组件（文件还在，没人挂载）

全仓检索确认**从未被 import**，读旧文档时注意：

| 文件 | 状态 |
| --- | --- |
| `CoverBackdrop.tsx` | 死代码。当前墙的背景是 `ImageBackdrop`，不是封面放大模糊 |
| `VideoBackdrop.tsx` | 死代码（`useIsMobile` 的注释里仍提到它，那是历史残留） |
| `AudioSpectrum.tsx` | 死代码，条形频谱已弃用（见 `06`） |
| `AudioTopography.tsx` | 死代码，被 V2 取代（它自己的注释也这么写） |

要删的话先全仓 grep 确认零引用（本 skill 与旧 `site-visual-system/references/06`
里都提到过它们，删了记得同步改文档）。

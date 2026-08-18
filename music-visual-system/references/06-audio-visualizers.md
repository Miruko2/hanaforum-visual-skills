# 06 · 音频可视化

详情页（`ExpandedCard`）的全屏背景特效，由底部播放器的按钮切换、持久化在
`music-liquidfx-v1`。四个模式互斥：

| `liquidFx` | 组件 | 挂载条件 |
| --- | --- | --- |
| `rain` | `LiquidRefraction` + `SnowOverlay` | 桌面/iPad |
| `center` | `LiquidRefraction` | 桌面/iPad |
| `off` | 无 | —— 只保留真实鼠标与水面交互的入口（实际不挂组件） |
| `topography` | `AudioTopographyV2` | 桌面/iPad **且当前是本地上传歌** |

三条共同约束：

1. **仅桌面 / iPad 挂载**（调用方按 `useIsMobile` 门控）。全屏 WebGL 对低配安卓
   WebView 太重，且没有低配机可测 —— 安卓/手机的详情页只有暗化遮罩 + 卡片。
2. **地形波仅本地上传歌**：本地歌是同源 blob、接得上 `AnalyserNode` 才有真实 FFT；
   在线歌拿不到频谱，调用方直接不挂载 → 自动回退默认暗背景。
   本地歌开始播放时会自动默认切到地形模式。
3. **引擎全部动态 import**，切独立 chunk，首屏零成本；挂载即建场景 + rAF，
   卸载即 `dispose()`（停 rAF、释放 WebGL 上下文）。
   React StrictMode 下 dev 会双调 effect —— 用 `cancelled` 标志确保第一份在 import
   落地后立刻自我 dispose，不泄漏第二个 GL 上下文。

---

## 1. 液面折射（`LiquidRefraction.tsx`）

### 引擎与自托管

`public/vendor/liquid1.min.js` —— threejs-components@0.0.30 的 liquid1 预构建包
（three r181 已烤进去，~513KB）。

> **自托管而非 CDN**：原作从 jsdelivr 远程 import，国内会被墙 / 超时。
> 改成从本站同源 `/vendor/` 懒加载，运行时不碰外网（已核实该文件无任何外部资源拉取）。

import 用变量做 specifier + `/* webpackIgnore: true */`：① 让 TS 不去解析这个运行时
才存在的模块，② 让 webpack 原样保留为浏览器原生动态 import（不把 three 打进包）。

材质参数：`metalness 0.35`、`roughness 0.45`、`displacementScale 2`。

### 两种自动律动

一个 rAF 轮询，按运行时 `mode` 单选驱动。所有高频输入（playing / volume /
getIntensity / mode / bgMode / coverUrl）**全部走 ref**，换歌换源都不重建 WebGL 上下文。

```ts
drive = (0.4 + 0.6 * volume) * (0.55 + 0.45 * pulse)   // ≈0.22..1
```

**`rain`（下雨）** —— 用引擎内部的雨滴系统：

```
RAIN_MIN = 4    静音：细雨（不死寂）
RAIN_MAX = 30   满音量：倾盆
rate = clamp(base × (0.7 + 0.6 × pulse))   base = RAIN_MIN + (RAIN_MAX-RAIN_MIN) × volume
setRainTime(1 / rate)                      // 滴间隔（秒），越小越密
```
呼吸律动在基线上再 ±30% 涨落，峰值 ≈39 滴/秒。切走模式或暂停即 `setRain(false)`。

**`center`（中间涟漪）** —— 直接调 `liquidPlane.addDrop()`，**不经合成 pointer**
（那样会被卡片挡住看不见）：

```
一次只一滴，等它扩散淡去再撒下一滴
间隔 = 1 / (0.4 + 0.2 × drive)     // 0.4~0.6 滴/秒 → 间隔 ~2.5~1.7s
位置 = 画面正中小范围内（半径 0~0.2），角度按黄金角 2.399963 递增 → 每滴落点不同
addDrop(x, y, radius=0.05, strength=0.01 + 0.018 × drive)
```
卡片是半透毛玻璃，中心涟漪透过玻璃柔显、扩散到卡片外的部分清晰可见。

### 折射底图（`liquidBg`，三选一）

| 模式 | 来源 |
| --- | --- |
| `gradient`（默认） | 按当前 `hue` 现画的深色渐变，同源 dataURL |
| `cover` | 当前曲目封面 |
| `background` | 个人首页背景图 |

**`makeGradient(hue)`** 的画法：`#06070b` 深色基底 + `globalCompositeOperation = "lighter"`
叠三团柔光（主色 / +40° / -30°），刻意偏离中心，**让画面正中（卡片处）更暗**。
输出 `toDataURL("image/jpeg", 0.9)`（不透明底，jpeg 更小）。

**跨域纹理污染的处理链**（这一段是通用知识，别的地方要用 WebGL 贴图也照抄）：

```
跨域图片直接当 WebGL 纹理 → 污染画布 / 抛安全错
↓
统一「先合成到自家同源 canvas（压暗 + 高斯模糊 + 同色相柔光）→ toDataURL → loadImage」
```

- 取图的 CORS：网易封面（`music.126.net`，无 CORS）走同源 `/api/img-proxy`
  （取 `param=1024y1024`，底图铺满全屏、小图会糊；代理结果缓存 1 天，
  且 cover 模式是 opt-in + 仅桌面，增量 egress 有限）；
  自有 CDN 封面 / 首页背景（`ACAO: *`）带 `crossOrigin` 直取。
- **任一步失败 → 回落渐变，水波永不空白。**
- 换歌 / 换源用**版本号 token** 作废过期的异步合成结果，防止旧图盖新图。
- 图片模式**首帧先铺渐变**避免空白，之后保留当前画面（不闪回渐变），
  等新图合成就绪再整张替换。

---

## 2. 声波地形（`AudioTopographyV2.tsx`）

移植自开源项目 `yin-yizhen/sonic-topography` 的着色器地形，已正式取代初版。
imperative Three.js（`three@0.160` 动态 import）。

```
BINS = 256        必须等于 PlaybackContext 里 analyser.frequencyBinCount（fftSize 512）
GRID = 150        每边方块数，GRID² ≈ 22500 个实例
SPACING = 1.05    单元间距
CUBE_W = 0.9      方块横截面（留 0.15 的缝 = 棋盘感）

CAM_FOV = 52   ORBIT_RADIUS = 35   ORBIT_HEIGHT = 27   LOOK_Y = 2
ORBIT_SPEED = 0.04 rad/s           // 绕中心缓慢自转的 3/4 俯视
```

⚠️ **着色器里的距离常量是按 `GRID` / `SPACING` 调校的，别随意改这两个。**

### 视觉全在 GLSL 里算

这是它比「基础材质逐方块上色」有质感的原因 —— 顶点着色器里做地形起伏与涟漪，
片元着色器里做色板、描边、渐隐与闪光：

- 多频段各画不同的地形图案（`uSubBass` / `uBass` / `uLowMid` / `uMid` / `uHighMid`
  等 uniform），外加 `uSmoothness` / `uDensity` / `uEnergy` 三个音色指标；
- 内置 simplex 噪声（`snoise`）做基底起伏 —— **无声时也有海浪般的底噪保持流动**，
  不会变成一块死平面；
- `uRipples[10]` 结构体数组做涟漪覆盖（位置 / 起始时间 / 强度 / 是否激活 / 类型）；
- 按高度的色板渐变、顶面描边发光、边缘渐隐成透明、顶面闪烁 / 火花。

### 色板

主题色板（不是 `hue`）——`hue` prop 保留只为兼容调用方，**实际不使用**：

```
baseColor1  [0.04, 0.01, 0.03]  暗底：带粉的近黑，让发光更跳
baseColor2  [0.10, 0.04, 0.08]  暗底2 / 雾色：深梅紫
coolCore    [1.00, 0.35, 0.62]  冷区核：较浓玫粉
coolEdge    [1.00, 0.78, 0.88]  冷区缘：接近白的浅粉
warmCore    [1.00, 0.50, 0.60]  暖区核：偏珊瑚的粉
warmEdge    [1.00, 0.88, 0.92]  暖区缘：粉白
rippleColor [1.00, 0.80, 0.92]  涟漪：亮粉白波峰
```

冷区暖区**都设成粉系**，这样无论音色冷暖，整片都读作「粉 → 白」。
想换回原作的 Nocturnal 蓝紫，改这一张表即可。

**没有后期 bloom**（原作也没有），辉光全靠着色器加色 —— 所以只需要动态 import
three 本体，不用 postprocessing，首屏零成本。

### 「白块撕裂」是走样，不是 z-fighting

这一段是排查记录，遇到同类现象直接照抄结论：

> 实测「白块撕裂」并非 z-fighting（方块互不重叠）而是**远处高亮小目标的走样**，
> 真正的解在超采样 + 压暗闪白。

三处对应改动：

```
pixelRatio = min(2, devicePixelRatio × 1.5)   // 1x 屏也按 1.5 倍内部分辨率渲染
```
> 给远处小方块上的高对比亮点足够像素、抑制撕裂走样（**MSAA 只管几何边缘、管不了
> 着色器内部高亮**）。桌面专属，可承受。

- **闪白随距离更早熄灭**，且高方块不再豁免 —— 远处小方块上的纯白点正是撕裂来源。
- **远景雾加重、范围拉近**（`smoothstep(26, 58, dist)`），把残留在中远处的高亮碎点
  融进雾里；近景不受影响、零性能成本。

另外近/远裁面收紧到 `2 / 220`（原 `0.1 / 400` 比例过悬殊、深度精度被浪费），
`frustumCulled = false`（实例铺满全场、自带包围球不可靠，关掉防误剔），
`toneMapping = NoToneMapping`。

### 两个小坑

- `uSpectralCentroid` 每帧算好并写进 uniform，但 **VERT / FRAG 都没读它**。想加音色驱动的
  效果时它是现成的入口；想省一点就删掉。
- 频段 EMA 是**升快降慢**（升 `×0.5`、降 `×0.12`），所以地形起得利落、落得绵软。

### ⚠️ 这一页有两份 Three.js

| 用途 | 来源 | 版本 |
| --- | --- | --- |
| 地形波 | npm `three@^0.160.1`，`import("three")`（webpack 打包成独立 chunk） | r160 |
| 液面 / 雪花 | `public/vendor/*.min.js`，`/* webpackIgnore */` 原生动态 import | **r181**（已烤进包里） |

两者互不共享，切换特效模式会分别加载。这是自托管预构建包的代价，改版本时别以为动一处就够。
`public/vendor/liquid1.min.js` 实测 0.50MB、`snowflakes1.min.js` 0.75MB，与注释吻合。

---

## 3. 已弃用的条形频谱

`AudioSpectrum.tsx`（Canvas 底部全宽条形，带 AGC 自动增益 / 噪声门 / 对比度整形）
**已弃用、文件保留、未挂载**。旧文档里把它当作「三种可视化之一」是过期信息。

要复活它的话，注意它与 V2 共享同一个约束：`BINS` 必须等于
`analyser.frequencyBinCount`，否则频谱会错位。

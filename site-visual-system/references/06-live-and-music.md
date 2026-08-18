# 06 · 直播页 `/live`（音乐页已迁出）

> **音乐页 `/music` 已独立成 skill `music-visual-system`**，本册只保留直播页。
> 见本文件末尾的指路表。

直播页是站内视觉最重的页面之一，有一套独立美学，**不要把它的类名/色板往别处复用**。

---

# A. 直播页 `/live`

美学定位：**全屏终端**。纯深底 `#070a1d` + 极淡扫描线 + 多色霓虹字 + 粉色主调 `#f5a6d1`。
字体 `"Share Tech Mono", ui-monospace, "SF Mono", "Consolas", monospace`。
相关文件：`components/live-wall-content.tsx`（881 行）、`components/live-host-stage.tsx`、
`components/chat-date-rail.tsx`、`app/live/page.tsx`

## A1. 页面壳与卷帘进出场

```css
.live-wall-page  position:fixed; inset:0; z-index:80; background:#070a1d; color:#dff7ff
                 transform: translateY(-100%);
                 transition: transform 0.55s cubic-bezier(0.4,0,0.2,1)
.live-wall-page.live-wall-shown  transform: translateY(0)
```
像卷帘一样从屏幕顶部拉下/收起。`::after` 是卷帘底边发光线（粉色渐变 + 光晕），
`transition-delay: 0.5s` 让它在卷帘落定后才亮起。

背景三层：`.live-wall-bg-scanlines`（CRT 扫描线，`repeating-linear-gradient` 2px/3px 极淡粉）、
`.live-wall-bg-vignette`（四周暗角，中心透明 40% → 边缘黑 0.7）。

## A2. 头部
`grid-template-columns: auto 1fr auto`。左返回键（hover 加粉光）、中标题（`letter-spacing: 0.28em`
大写 + 文字发光）、右在线数。两个脉冲点：
- `.live-wall-dot`（粉）`liveWallDotPulse 2.2s`：`opacity 1→0.5` + `scale 1→0.85`
- `.live-wall-online-dot`（`#0f8` 绿）`liveWallOnlinePulse 2s`：同款
在线数字用 `font-variant-numeric: tabular-nums` 防跳动。

## A3. 弹幕流
- `.live-wall-feed`：`mask-image: linear-gradient(180deg, transparent 0, black 3%, black 100%)`
  顶部渐隐；滚动条 thumb 粉色半透明，hover 加光晕。
- `.live-wall-line`：`liveWallLineIn 0.4s ease`（`translateX(-8px)` + 淡入）。
  桌面单行 `nowrap + ellipsis`，hover 底色粉 0.04。
- `.live-wall-line-ai`：粉底 0.05 + 左侧 2px 粉描边 + 左向投影，且 **强制 `white-space: normal`**
  —— hanako 的 AI 回复可能很长，桌面端也必须换行，否则被父级 `nowrap + ellipsis` 截成省略号。
- 打字机光标 `.live-wall-cursor`：`currentColor` 实心块 + 双层同色光晕，
  `liveWallBlink 1s step-end infinite`（`.typing` 时加速到 0.6s）。
- **8 色霓虹**（三层 `text-shadow`，8/18/36px）：`neon-cyan #0ff`、`neon-green #0f8`、
  `neon-pink #f5a6d1`、`neon-yellow #ff0`、`neon-red #f55`、`neon-purple #c084fc`、
  `neon-orange #fb923c`、`neon-lime #a3e635`。
- `.flicker-part`：`liveWallFlicker 7s infinite`（96-98% 处微抖一下），
  `animation-delay: calc(var(--flicker-delay) * 1s)` 让多条错峰。
- 霓虹八色 + 闪烁 + 打字机光标**已抽入可移植套件**：`assets/glass-kit.css` 第 12 节
  （去掉了 `.live-wall-page` 作用域；`.flicker-part` 改名 `.neon-flicker`、
  `.live-wall-cursor` 改名 `.neon-cursor`），`assets/demo.html` 有等价 vanilla 实现。
- `.live-wall-newmsg`：上滑看历史时的「新消息」回底按钮，`liveWallNewMsgIn 0.28s`
  **只用 transform**（`translate(-50%, 8px) → 0`），避开安卓对 opacity/filter 的坑。

## A4. 输入区
`.live-wall-input-wrap` 深底 + 1.5px 粉描边 + 内外双光晕；
`.is-focused` 时描边提到 0.6、底色转冷 `rgba(5,15,25,0.92)`、三层强发光。
前缀符号、输入文字、placeholder 全带 `text-shadow` 粉光。

## A5. 舞台折叠（桌面收宽 / 移动收高，同一条曲线）

```css
.live-wall-stage  width:320px；transition: height .34s cubic-bezier(0.22,1,0.36,1),
                                          width  .34s cubic-bezier(0.22,1,0.36,1)
.live-stage-collapsed .live-wall-stage                    → width: 132px（留住开关的窄条）
.live-stage-collapsed .live-wall-stage > .live-host-stage  → transform: translateX(-100%)
```
移动端（≤768px）改列布局，`order:-1` 舞台置顶，高度 `clamp(260px, 42vh, 360px)`，
收起态 `height: 46px` + `translateY(-100%)`。

⚠️ 用 `clamp()` 内联上下限，**不要用 `min-height`/`max-height`** —— 后者每帧夹紧会打断 `height` 过渡。
⚠️ 移动端视频 `position:absolute` + 固定高度，容器收矮时只被裁切/上滑，不会被压扁。
`prefers-reduced-motion` 下 `transition: none` 直接切换（晕动症 / 省电）。

## A6. 主播舞台内部（`.live-host-*`）
- 三层径向渐变底（粉 + 紫）、`.live-host-bg-grid` 40px 粉网格
- `.live-host-bg-orb-1..4`：`filter: blur(40px)` 光晕圆，`liveHostOrbFloat 8~12s`
  （四段位移 + `scale 0.95~1.1`），用 `reverse` + 负 delay 错峰
- `.live-host-bg-particle-1..6`：2~4px 粉点，`liveHostParticleFloat 6~11s`，同样负 delay 错峰
- `.live-host-nameplate` / `.live-host-bubble`：`backdrop-filter: blur(12px)` 粉描边玻璃。
  气泡 `max-height: 38vh` + 内部滚动，长回复不撑爆舞台
- 思考态 `.live-host-thinking-glitch` / `.live-host-glitch-char`：
  `liveHostGlitchShake 0.08s infinite`（±1px 横抖）
- `.live-host-image` / `.live-host-video`：`drop-shadow` 青色微光

### hanako 心情脸（颜文字 LED 点阵）
舞台底部状态区三态之一（思考=乱码气泡 / 回复=文字气泡 / 其余=这条点阵）。
- `.live-host-mood-grid`：`display:grid; gap:1px`，`liveMoodBob 3.8s`（上下浮 2.5px）
- `.live-host-mood-dot`：灭珠固定极淡白 `rgba(255,255,255,0.05)`
  （**不用 `color-mix`**，老 WebView 也稳）；`.on` 用 `var(--mood-color)` + 双层同色光晕
- `.flick.on`：`liveMoodFlick` 周期性短暂熄灭再亮（坏灯/呼吸感），延迟与时长由组件错开
- 灯珠尺寸由组件读 `.live-host-mood-fit` 容器宽度内联算出（各条颜文字宽度不同，保证整条显示）
- `--mood-color` 由组件按 `EMOTION_COLORS` 注入；`prefers-reduced-motion` 关掉两条动画
- **已抽入可移植套件**：`assets/MoodFace.tsx`（渲染 + 自适应灯珠尺寸）+
  `assets/mood-faces.ts`（点阵零件库，36 个符号任意拼装）+ `assets/glass-kit.css` 第 12 节
  （类名前缀换成中性的 `.led-face-*`、`--mood-color` 换成 `--led-color`）。

## A7. 移动端（≤768px）
断点与左右布局切换保持一致（避免 640~768 中间态）：标题副文案隐藏、字数计数隐藏、
`.live-wall-prefix` 隐藏、弹幕字号反而**加大**到 15px、
`.live-wall-line` 整段覆盖为 `white-space: normal; flex-wrap: wrap; overflow-wrap: anywhere`
（窄屏长弹幕/AI 回复必须换行，用户名在第一行、内容接下一行）。

---

# B. 音乐页 `/music` —— 已迁出

音乐页的全部内容（鱼眼卡片墙、两档毛玻璃、播放器一家、背景层叠、音频可视化、
歌词回声、面板弹层、性能预算与安卓踩坑）现在在独立 skill **`music-visual-system`**。

| 要找什么 | 去哪 |
| --- | --- |
| 3D 鱼眼卡片墙、球面变换公式、rAF 纪律 | `music-visual-system/references/02-fisheye-wall.md` |
| 卡片尺寸、`.mw-glass` / `.mw-glass-lite` | `.../03-cards-and-glass.md` |
| 底部播放器 / 展开大卡 / 迷你播放器 / 音量 HUD | `.../04-player-family.md` |
| 背景层叠、胶片颗粒、歌词水波 | `.../05-backdrops-and-ambience.md` |
| 液面折射 / 声波地形 / 已弃用的条形频谱 | `.../06-audio-visualizers.md` |
| 曲库抽屉、分享卡组、`PerfHUD` | `.../07-panels-and-overlays.md` |
| 每帧成本排序、门控矩阵、安卓合成器坑 | `.../08-performance-and-android.md` |
| 可复制的鱼眼墙套件 | `music-visual-system/assets/` |

⚠️ 旧版本的本册对音乐页有几处**已过期**的描述，若在别处看到请以新 skill 为准：
`CoverBackdrop` / `VideoBackdrop` / `AudioSpectrum` 都已不再挂载（死代码）；
`ExpandedCard` 的「从卡片矩形飞入」也已不再实现。

两页仅有的交集：`components/crossfade-background.tsx`（背景交叉淡入，首页 / 音乐页共用）。

---
name: music-visual-system
description: 音乐页 /music 的视觉与动效系统总纲：3D 鱼眼卡片墙（球面变换 + 无缝平铺 + rAF 直写纪律）、音乐卡片与两档毛玻璃、播放器一家（底部迷你播放器 / 展开卡 / 音量 HUD）、背景层叠与胶片颗粒、音频可视化（WebGL 液面 / 地形波）、歌词回声、面板弹层，以及这一页专有的性能预算与安卓合成器踩坑清单。当需要新增/修改 /music 任何 UI、调鱼眼参数、改卡片或播放器样式、加背景特效，或排查「音乐页掉帧 / 毛玻璃失效 / 安卓鬼影 / 整面墙跳位」时使用。
---

# 音乐页视觉系统（`/music`）

## 这是什么

`/music` 是全站唯一一个**自建 3D 渲染循环**的页面：卡片墙的每帧变换由 rAF 通过 ref
直写 DOM，不走 React state。它的视觉几乎全在 `app/music/_components/**` 组件内
（Canvas / WebGL / framer-motion），`app/globals.css` 里只有 `.mw-glass` 与
`.mw-glass-lite` 两条。

因此**它与站点其余部分的视觉体系是两套东西**：
- 站内其余页面（帖子卡、导航、弹层、转场、直播页……）→ 看 skill **`site-visual-system`**
- `/music` 页 → 看本 skill

两边的类名、色板、动效纪律**不要互相复用**：站点那套是「毛玻璃 + 高斯模糊入场」，
这一页是「球面透视 + 逐帧直写 + GPU 预算紧张」，很多在别处正确的写法
（给元素加 `filter`、用 `opacity` 淡出容器、用 framer-motion 驱动位移）
在这一页是明确的错误，理由见 `02` 与 `08`。

**范围**：`app/music/**` 全部 + `components/music-play-button.tsx`（全站统一的播放主键）。
全站常驻的 `PlaybackProvider` 也在本 skill 内（它的 context 拆分直接决定墙的帧率，见 `01`）。

**不在范围内**：帖子里的音乐分享卡（`components/music-post-body.tsx`、
`music-detail-player.tsx`）与它们用的 `.mpb-eq-bar` 均衡器条 —— 那属于帖子详情，
归 `site-visual-system`。两边只共用 `MusicPlayButton` 这一个组件。

## 分册索引

| 文件 | 内容 |
| --- | --- |
| `references/01-architecture-and-state.md` | 页面装配与动态 import、四层 Context 拆分（为什么音量滑块会拖垮墙）、曲目源与打包、`Track` 字段 |
| `references/02-fisheye-wall.md` | **3D 鱼眼卡片墙**：球面变换公式与全部参数、最短列打包、无缝平铺、拖动惯性/视差、rAF 六条纪律、静止停渲 |
| `references/03-cards-and-glass.md` | 音乐卡片：宽度派生的等比尺寸、两档毛玻璃 `.mw-glass` / `.mw-glass-lite`、描边与投影配方、播放圆钮、点击与拖动的区分 |
| `references/04-player-family.md` | 播放器一家：底部迷你播放器（环形进度 / 封面自转 / 叠层预览）、展开卡飞入、音量 HUD、播放模式菜单、哑光进度条 |
| `references/05-backdrops-and-ambience.md` | 背景层叠自下而上、胶片颗粒、暗角、封面背景、飘雪、歌词回声与水波位移 |
| `references/06-audio-visualizers.md` | 音频可视化：WebGL 液面折射（自托管引擎）、Three.js 地形波 GLSL、已弃用的条形频谱、跨域纹理污染的处理链 |
| `references/07-panels-and-overlays.md` | 历史/曲库抽屉、我的音乐编辑器、分享卡、PerfHUD |
| `references/08-performance-and-android.md` | **性能预算与安卓踩坑总表**：每帧成本排序、门控矩阵、preserve-3d 三连坑、测量方法 |

## 可复制成品（`assets/`）

`assets/` 是从本页抽出来的**框架无关鱼眼墙套件**，可直接复制到别的项目：

| 文件 | 内容 |
| --- | --- |
| `assets/fisheye-wall.ts` | 纯函数三件套：`packTracks`（最短列打包 + 双列跨列）、`computeInstances`（无缝平铺 + 视口裁剪）、`fisheye`（球面变换）。零依赖、可在任何框架/原生 JS 里用 |
| `assets/FisheyeWall.tsx` | React 封装：rAF 循环、拖动惯性、指针视差、脏检查直写、静止停渲，全部纪律都在里面 |
| `assets/fisheye-wall.css` | 舞台与卡片样式、两档毛玻璃、降级分支 |
| `assets/demo.html` | 自包含演示页，浏览器双击即开（无构建、无依赖、不联网），也是 vanilla JS 参考实现 |
| `assets/README.md` | 对外分发用的说明：五分钟接入、调参表、验收清单、三条别踩的坑 |

本 skill 与 `site-visual-system` 同属独立仓库 **hanako visual skills**（见上级 `README.md`），
和站点仓库分开管理。文档引用的组件路径与类名由 `scripts/check-refs.mjs` 定期核实，
改完站点记得跑一次。

## 上手顺序

**改这一页的 UI**：
1. 先读 `08` 的「每帧成本排序」——先知道预算花在哪，再决定加什么。
2. 再读对应分册；新效果必须挂在已有的 `lite` / `isAndroid` / `reducedMotion` 门控上。
3. 改完用 `/music?perf` 拿数字（见 `08`），**不要凭感觉判断卡不卡**。

**在别的项目复刻鱼眼墙**：读 `02` + 复制 `assets/`。

## 四条不可违背的铁律

1. **卡片上绝不能写 `filter`。**
   元素自身的 `filter` 会废掉它自己的 `backdrop-filter`，毛玻璃直接失效
   （历史现象：只有正中心那张卡糊、其余全是平板）。鱼眼原本的景深模糊就是因此被删的，
   远近改由 3D 透视缩放表达。要加景深，只能改 `z` / `scale`，不能加模糊。
2. **隐藏 3D 层只能用 `visibility`，绝不能用 `opacity`。**
   `opacity < 1` 是 CSS grouping property，按规范会把该元素的 `transform-style`
   强制扁平化为 `flat` —— 安卓上淡出那一瞬整个卡片层被拍平、透视投影塌陷，
   表现为「整面墙一起跳位」。`visibility` 不触发扁平化，瞬切即可。
3. **每帧写 DOM 前必须脏检查，能不写就不写。**
   墙上同时有几十张卡，每张每帧要写 `transform` / `opacity` / `visibility`。
   全量无脑写 = 主线程被字符串拼接和样式失效吃满。现有实现有三道闸：
   pan 没动就不重算可见集、静止即整段跳过逐卡循环、每条样式写入前比对上一帧值。
4. **高频播放状态不能进卡片的订阅面。**
   `PlaybackContext` 拆成四层就是为这个：音量滑块每次 `pointermove` 一次 setState，
   若卡片订阅了完整 context，一次拖动 = 几十张卡全量重渲染（安卓主线程直接被拖垮）。
   卡片只订阅 `usePlaybackWall`（切歌 / 播放暂停 / 收藏 才变），墙只订阅 `useTracks`。

## 相关源码定位

- 卡片墙：`app/music/_components/MusicCanvas.tsx`、`MusicCard.tsx`、`_lib/canvas.ts`
- 播放器：`_components/GlobalMiniPlayer.tsx`、`MusicPlayer.tsx`、`ExpandedCard.tsx`
- 状态：`app/music/_context/PlaybackContext.tsx`（全站常驻，挂在 `components/providers.tsx`）
- 玻璃类：`app/globals.css` 的 `.mw-glass` / `.mw-glass-lite`（≈2350 行）
- 平台门控：`_lib/useIsAndroid.ts`、`useIsMobile.ts`、`useReducedMotion.ts`

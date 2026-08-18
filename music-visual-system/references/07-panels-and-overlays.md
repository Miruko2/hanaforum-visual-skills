# 07 · 面板与弹层

本页的弹层分两档：

- **抽屉 / 大面板**（`HistoryPanel`、`MusicLibraryEditor`、`ExpandedCard`）：
  `blur(32px) saturate(140%)` + `rgba(255,255,255,0.05)`，安卓换实底。
- **小弹层**（`PlayModeMenu`、`VolumeControl` 弹层）：
  `blur(32px) saturate(160%)` + `rgba(255,255,255,0.08)` + portal + 透明遮罩，见 `04` 第 6 节。

新增弹层照抄对应那一档，不要再发明第三种配方。

---

## 1. 曲库抽屉（`HistoryPanel.tsx`）

右侧抽屉，`w-[360px] max-w-[88vw]`，`z-[55]`。

```
开合  transform: translateX(0 | 100%)，transition 300ms ease-out（纯 CSS，不用 framer）
底    rgba(255,255,255,0.05) + blur(32px) saturate(140%)   // 安卓：rgba(24,24,27,0.94) 实底
描边  box-shadow: 0 0 80px -10px rgba(0,0,0,0.5), inset 1px 0 0 rgba(255,255,255,0.12)
```

⚠️ 抽屉必须 `onPointerDown` 与 `onWheel` 都 `stopPropagation()` —— 否则在抽屉里
滚动/拖动会穿透到 `MusicCanvas`，整面墙跟着动。

### Mac Dock 式滑动高亮（收藏 / 最近 / 全部）

**实测矩形**而不是 `layoutId`：

```ts
onTabHover(idx) {
  const cRect = 容器.getBoundingClientRect()
  const bRect = 按钮.getBoundingClientRect()
  setHoverRect({ x: bRect.left - cRect.left, w: bRect.width })
}
```

高亮块是一个 `absolute top-1 bottom-1 rounded-full bg-black/20` 的 `motion.div`，
`x` 与 `width` 同时动：

```
x / width  spring { stiffness: 420, damping: 28, mass: 0.55 }   // 弹性滑移，「灵动」
opacity    duration 0.14                                        // 快速淡入淡出
```

> 透明度故意用很短的补间：高亮要显得「活」，而不是慢慢显形。
> 鼠标移出整条时 `hoverRect` 置 null → 只淡出，不归位到 0（宽度保持）。

（站内其它地方的滑动高亮见 `site-visual-system` 的 `JellyNav`，那套是凹陷块 +
选中胶囊双轨，比这里复杂。）

### 列表切换 = 高斯凝结

```
key = filtered ? "search" : tab      // 搜索态覆盖 tab
initial/animate/exit: opacity + filter blur(20px) ↔ blur(0px)
transition { duration: 1, ease: [0.2, 0.8, 0.2, 1] }
```

换 key 即触发 exit + enter，与 `ExpandedCard` 面板入场是**同一套凝结语言**。
安卓走无 `filter` 的变体（只淡入淡出），理由见 `08` 第 5.4/5.5 节。
搜索激活时整条 tab 隐藏（搜索是全局的）。

---

## 2. 分享卡组（`ShareDeck.tsx`）

把「分享海报」与「发到论坛」叠成两张可切换的卡片：前卡正常可用，后卡斜着探在身后；
hover（触屏点一下）后卡 → 它滑到前面、另一张退到身后。

```
CARD_W = min(340px, 86vw)     自适应宽度，小屏不切边
CARD_H = min(600px, 74vh)     两张卡固定等高 → 后卡探出来是满高一条、更显眼
TILT_DEG = 24
FRONT_POSE = { x: 0,   y: 0,  rotate: 0,  scale: 1,    opacity: 1 }
BACK_POSE  = { x: 104, y: 44, rotate: 24, scale: 0.9,  opacity: 0.82 }
```

> 想让后卡更突显就调大 `BACK_POSE.x`（往外探）/ `y`（探出高度）/ `TILT_DEG`
> （**别超 ~35°，否则像要倒**）/ `opacity`。

玻璃：非安卓 `rgba(24,25,32,0.55)` + `blur(40px) saturate(160%)`，遮罩 `rgba(0,0,0,0.5)` + `blur(8px)`；
安卓换实底 `rgba(19,20,26,0.98)`、遮罩 `rgba(6,8,10,0.82)`，两处都去掉 blur。
`z-[120]`，由 `ExpandedCard` **静态 import**（不是 dynamic，随展开卡的 chunk 一起走）。

**安卓上的降级比别处更狠 —— 卡片切换连缩放和透明度都不做**：

| | 非安卓 | 安卓 |
| --- | --- | --- |
| 卡片切换 | `x / y / rotate / scale / opacity` 全动 | **`scale` 与 `opacity` 恒为 1**，只动位移 + 倾斜 + 层级 |
| `whileHover` | `scale × 1.05` | **禁用** |
| 卡片入场/退场 | 各自 opacity + 轻微缩放 | 交给最外层统一 opacity |
| 海报图揭示 | 立即 | 延后 `240ms`，等入场淡入结束 |

原因（注释原话）：安卓上缩放 `0.9↔1` 叠透明度 `0.82↔1` 会**逐帧重光栅化大圆角 + 大阴影**，
撕裂合成层显存缓冲（「本项目反复踩的安卓老坑」），表现为切换卡片闪屏；
海报是重 PNG，解码与入场同帧也会撕。

另外卡片上**恒写 `willChange: "transform"`**，而不是让 framer-motion 自动加：

> framer-motion 只在动画进行中自动加 will-change，动画头尾的「合成层创建/销毁」
> 正是安卓 WebView 撕裂/闪屏的触发点（本项目反复验证过）。

这条是通用结论 —— 本页任何「频繁进出动画的毛玻璃层」都该常驻 `will-change`，别等框架加。

其它：
- 海报卡复用 `lib/share/poster.ts` 的 `generatePoster`（与帖子分享同一套，不动原弹窗）；
  论坛卡走 `lib/supabase` 的 `createPost`。
- 触屏端 `<a download>` 不一定进相册，所以提示长按保存（`IS_TOUCH` 判定）。
- 本地歌封面是小 JPEG data URL，发布时要 `dataUrlToBlob` 托管一份给别人看。
- `useIsMobile()` 在这里只用来给整个卡组 `scale(0.84)`，不改玻璃。

---

## 3. 我的音乐编辑器（`MusicLibraryEditor.tsx`，781 行）

「我的音乐」入口（左上角，登录可见）打开的全屏编辑器：本地上传（IndexedDB）+
链接歌（Supabase `user_music_tracks`）的增删改。

```
z-[70] 全屏遮罩（bg-black/55，点空白关）→ z-[71] 面板
面板  background rgba(18,18,24,0.64) + blur(40px) saturate(170%)   ← 比抽屉更浓的一档
      box-shadow 0 30px 90px -15px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.14),
                 inset 0 1px 0 rgba(255,255,255,0.12)
入场  opacity + scale 0.96→1 + filter blur(20px)→0，duration 0.4，ease [0.2,0.8,0.2,1]
```

⚠️ **它是唯一一个没有安卓分支的大面板** —— 始终 `blur(40px)` + 入场 `filter: blur`。
按 `08` 第 5.4 节的规律，这在安卓 WebView 上属于「已知会撕裂」的组合，只是这个面板打开频率低、
至今没被报过。如果哪天要修，照抄 `HistoryPanel` 的 `isAndroid` 双变体即可。

业务逻辑（导入解析、jsmediatags 读 ID3、meting 链接解析）不属于视觉系统，改 UI 时只需知道：

- 它也参与 `overlayOpen` 聚合 → 安卓上打开时墙会整层隐藏。
- 增删改完要调 `refreshTracks()` 重新拉曲目并刷新墙（`PlaybackTracksCtx` 更新 →
  `MusicCanvas` 重新 `packItems`）。
- 输入框配色是**写死的**，注释原话：「绕过移动端 WebView 原生 input 白底、不依赖 Tailwind JIT」。
  导入数量滑块也是自定义视觉 + 透明原生 `range`，「避开各 WebView 原生 range 样式差异」。

## 4. 曲源切换（`SourceToggle.tsx`）

左上角「我的 / 精选」小胶囊，只在 `hasMine`（本地歌或链接歌任一存在）时出现。
读 `useTrackSource()`，切换写 `music-source-v1`。

玻璃是**第三档**（比小弹层更薄）：`rgba(255,255,255,0.08)` + `blur(20px) saturate(140%)`，
且描边只有 `inset 0 0 0 1px rgba(255,255,255,0.12)`（没有外层那道 `0 0 0 1px`）。
选中段 `bg-white text-black`，未选中 `text-white/70`。

## 5. 性能浮层（`PerfHUD.tsx`）

见 `08` 第 1 节。`fixed top-16 left-4 z-[70]`、`bg-black/70`、`font-mono tabular-nums text-lime-300`。

---

## 6. z-index 秩序（改浮层前必看）

```
卡片墙 viewport            z-50
抽屉拉手                   z-54
抽屉 HistoryPanel          z-55
底部播放器 / 左上控件区      z-60
展开卡 ExpandedCard        overlayZ 默认 60，面板本体 z-[61]（/live 页传 90）
小弹层遮罩 / 弹层           z-68 / z-69（PlayModeMenu、VolumeControl）
音量 HUD GlobalVolumeHud   z-69
编辑器 MusicLibraryEditor  z-70 / 面板 z-[71]
PerfHUD                    z-70
分享卡组 ShareDeck         z-120（盖过一切，它是展开卡之上的二级弹层）
```

站外：迷你播放器 `z-[45]`，在 `/live` 页抬到 `z-[85]`（弹幕墙是 z-80 的不透明全屏面板）。

站外的迷你播放器另有一套（见 `site-visual-system` 的全站 z-index 秩序：
悬浮聊天 9999、公告 10000、撕纸转场 20000）。

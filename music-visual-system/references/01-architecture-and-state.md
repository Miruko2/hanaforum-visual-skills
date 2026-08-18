# 01 · 页面装配与状态分层

改这一页之前先搞清楚两件事：**谁在什么时候被挂载**，以及**谁订阅了什么状态**。
这一页 90% 的性能事故不是效果本身太贵，而是把高频状态接到了不该接的组件上。

---

## 1. `/music` 的装配（`app/music/page.tsx`）

页面本体只有 123 行，几乎全是编排：

```
<link rel="preconnect" href={meting 各实例 origin} />   ← 预热 DNS + TLS
<MusicCanvas onExpand overlayOpen />                    ← 鱼眼卡片墙（fixed inset-0 z-50）
<MusicPlayer onToggleHistory onExpand />                ← 本页底部播放器
<HistoryPanel open onOpen onClose />                    ← 曲库/历史抽屉
<ExpandedCard target onClose />                         ← 展开的「正在播放」大卡
左上角控件区（我的音乐入口 + 我的/精选切换）
<MusicLibraryEditor open onClose />
<PerfHUD />                                             ← 不带 ?perf 时返回 null
```

### 全部走 `dynamic(..., { ssr: false })`

`MusicCanvas` / `MusicPlayer` / `HistoryPanel` / `ExpandedCard` / `MusicLibraryEditor` /
`SourceToggle` 六个组件都是 `ssr: false` 的动态导入。这不只是为了拆包 —— 它是
**平台判定能同步取值的前提**（见第 4 节）：没有服务端渲染，就没有 hydration 不匹配，
hook 可以在 render 期间直接读 `navigator`。

`MusicCanvas` 额外带 `loading:` 兜底（黑底 + `Loading…`），因为它是整页的视觉主体。

### `overlayOpen` 的聚合

```ts
const overlayOpen = libraryOpen || expand !== null || editorOpen
```

只有安卓会消费它（墙退出渲染，见 `02` 第 7 节）；桌面 / iOS 忽略。

### 展开卡的开关是「同一首再点 = 收起」

`handleExpand` 里若当前展开的就是这首，则置 `null`，否则记录 `{track, rect}`。
`rect` 是被点卡片的屏幕矩形，展开卡从这个矩形飞出来（见 `04`）。

---

## 2. `PlaybackProvider` 是全站常驻的

挂在 `components/providers.tsx` 里（`ChatUIProvider` 内、`ListenTogetherProvider` 外）：

```
<PlaybackProvider>            音频元素 + 播放状态随 app 常驻，切页歌不断
  <ListenTogetherProvider>    「一起听歌」总线，用到播放器所以包在内层
```

同一层还挂了两个**站外**的常驻件（都用 `LazyMount timeout={1500}` 空闲挂载）：

- `GlobalMiniPlayer` —— 后台续播的迷你卡片，**仅在有曲目且不在 `/music` 页时显示**。
  放在 `PageTransition` 外，切页不消失。
- `GlobalVolumeHud` —— 全站音量胶囊 HUD。常驻与是否有歌、在哪一页无关，
  因为安卓 App 要在任意页面拦截机身音量键。

> 由此得出 `02` 里那条：`/music` 的关闭按钮必须走 SPA 导航。整页硬刷新会销毁
> `PlaybackProvider`，音乐停、迷你卡片消失。

---

## 3. 四层 Context（本页最重要的性能设计）

`PlaybackContext.tsx` 一共导出四个 context，**不是重构洁癖，是被安卓卡死逼出来的**：

| Context / hook | 内容 | 变化频率 | 谁订阅 |
| --- | --- | --- | --- |
| `usePlayback()` | 完整状态：音量 / 历史 / 播放模式 / `isFallback` / 曲库操作…… | 高（音量拖动时每个 `pointermove` 一次） | 播放器、面板、编辑器 |
| `usePlaybackTime()` | `currentTime` / `duration` / `buffered` | 每 240ms | **只有进度条**（`MusicPlayer` / `ExpandedCard`） |
| `usePlaybackWall()` | `currentTrack` / `isPlaying` / `togglePlay` / `prev` / `next` / `isFavorite` / `toggleFavorite` / `getAudioIntensity` / `getAudioFrequencies` | 低：切歌 / 播放暂停 / 收藏增减 | **每一张 `MusicCard`** |
| `useTracks()`（`PlaybackTracksCtx`） | `tracks` / `source` / `setSource` / `hasMine` | 极低：曲目加载或切源 | `MusicCanvas`、`ExpandedCard`、`SourceToggle` |

原始注释里的算账很直白：

> 音量滑块拖动是「每个 pointermove 一次 setState」，若卡片直接订阅 `usePlayback`，
> 一次拖动 = 几十张 MusicCard × 每 move 全量重渲染（安卓主线程直接被拖垮）。

配套手法（见 `02` 第 8 节）：重组件若确实需要一点高频状态，**不要自己订阅**，
而是塞一个返回 `null` 的探针子组件去订阅并回调上报（`PlaybackPresenceProbe`）。

### 音频强度 / 频谱是 getter，不是 state

`getAudioIntensity()` / `getAudioFrequencies(out)` 是函数，由消费方在自己的 rAF 里**轮询**，
不触发任何重渲染。这是所有背景特效跟拍的统一入口。

- 本地上传歌（同源 blob，接得上 `AnalyserNode`）：取频谱**低频 1/4 段**（鼓 / 贝斯）
  的均值 → `min(1, raw × 1.8)` 整形（多数歌低频均值偏低，略放大更悦目）
  → 一阶平滑 `0.6 × 旧 + 0.4 × 新`。
- 在线 / 跨域歌：拿不到频谱，退化为模拟正弦呼吸。
- **暂停时恒返回 1**，保证依赖它的遮罩稳定不闪。

---

## 4. 平台判定：必须首帧就准

`_lib/useIsAndroid.ts` / `useIsMobile.ts` 都是**同步初始化**（`useState(计算函数)`），
不是经典的 `useState(false) + useEffect` 翻转。原注释把代价说得很清楚：

> 这些标志会喂给 framer-motion 的 `initial`，而 `initial` 只在挂载那一帧读一次。
> 首帧给错值 → 先按非安卓变体渲染 → 之后再换成安卓变体时，**framer-motion 会撒手
> 不再管 `filter`** → blur 卡死 → 面板/列表在安卓上永久模糊。**桌面复现不到**。

`useIsMobile` 那边的代价则是：首帧算成非 lite 会先挂一帧 1080p 视频背景 + 颗粒再拆掉，
在最弱的设备上冷启动 `/music` 白白抖一下。

| Hook | 判定 | 首帧准确？ | 备注 |
| --- | --- | --- | --- |
| `useIsAndroid()` | `/Android/i` UA | ✅ 同步 | 一切安卓设备（含平板与 WebView）。lazy init 后只读 `[0]`，后续帧不再更新 |
| `useIsAndroidApp()` | Capacitor 全局 `getPlatform() === "android"`，回退 UA 里的 `; wv)` | ✅ 同步 | 只认 Capacitor App。远程加载页在全局注入前有空窗，故 UA token 兜底 + 挂载后再查一次 |
| `useIsMobile()` | `(pointer: coarse) and (max-width: 1024px)` **或** 安卓 UA | ✅ 同步 | 即 `lite` 档的设备侧来源，并订阅 MQ 变化 |
| `useReducedMotion()` | `prefers-reduced-motion: reduce` | ❌ **首帧恒 false** | `useState(false)` + `useEffect` 翻转，见下 |

⚠️ **`useReducedMotion` 是个例外，它没有做首帧同步**。后果：桌面用户开着系统「减少动态效果」时，
`lite = reducedMotion || mobileTier` 的**第一帧仍是 false**，effect 之后才翻成 true ——
会先挂一帧 `Grain`、开一帧指针视差再拆掉。安卓上因为 `mobileTier` 已经是 true，不会有这个闪。
所以：**不要把 `useReducedMotion` 的值喂给 framer-motion 的 `initial`**（那正是 `useIsAndroid`
要同步取值的原因）。它目前只驱动 `lite` 与黑胶转速，都是可以晚一帧的地方。

`useIsMobile` 的分档理由值得记住：

- 桌面 / 笔记本（鼠标）→ 满效果，两条规则都不命中。
- **iPad / iPad Pro → 满效果**（Apple GPU + Metal 扛得住）。
- 安卓手机 → 规则 1 命中。
- **安卓平板（哪怕 11"/12"+）→ 规则 2 强制 lite**：安卓平板 GPU 远弱于 iPad Pro，
  Chromium 在安卓上处理本页的 `backdrop-filter` + `preserve-3d` 组合已经很吃力，
  给 iPad 的尺寸豁免不能延伸过去。

调试：**`?force=mobile`** 可在任意设备强制 lite 档（桌面验证 lite 路径用）。

### `lite` 的合成

```ts
const lite = reducedMotion || mobileTier
```

`lite` 关掉的是：视频背景、胶片颗粒、指针视差、卡片顶边内高光，并把卡片玻璃降到
`.mw-glass-lite`。**鱼眼 / 3D 本身永远保留 —— 那是这一页的身份**。

⚠️ 注意区分同名的两个「移动端」：
- `useIsMobile()` = **设备档位**，驱动性能降级。
- `MusicCanvas` 里的 `isMobile = viewSize.w < 768` = **布局断点**，只用来选列宽
  （140 vs 180）。两者互不相干，不要合并。

---

## 5. 曲目源与持久化

- **「我的」 vs 「精选」**：`MusicSource = "mine" | "featured"`。有自定义曲目时
  左上角出现切换（`SourceToggle`）。
- 曲目来源：本地上传（IndexedDB，`_lib/localTracks.ts`）+ 链接歌
  （Supabase `user_music_tracks`，`_lib/userTracks.ts`）+ 默认精选墙（`_data/playlist.json`）。
- **收藏 = 入库**：`toggleFavorite` 把当前歌收进「我的音乐」（链接歌），不是单独的收藏表。
- localStorage 键（改名会丢用户设置，慎动）：

```
music-history-v1     播放历史（上限 HISTORY_LIMIT = 50）
music-play-mode-v1   列表循环 / 单曲循环 / 播完暂停
music-source-v1      我的 / 精选
music-volume-v1      音量
music-lyrics-v1      歌词开关
music-liquidfx-v1    背景特效模式（见 06）
music-liquidbg-v1    液面底图来源
music-meting-base-v2 上次探测到的健康 meting 实例，TTL 6h
```

- 在线解析有节流：`REUSE_TTL = 5min`（窗口内同一首复用、不重置 src）、
  `MIN_GAP = 1500ms`（更快的连点会被防抖合并成只解析最后一首）、
  `MAX_RESOLVES_PER_MIN = 20`（硬安全网）。改 UI 时不要绕过它们直接调解析。

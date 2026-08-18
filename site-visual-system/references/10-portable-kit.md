# 10 · 可移植套件：在新项目里复刻这套观感

前面 01-09 是**本仓库的索引与决策记录**（要配合 `app/globals.css` 源码读）。
本册配套的 `assets/` 是**可直接复制的成品**，脱离本仓库也能用。

给 AI 的一句话指令模板：
> 按 `assets/glass-kit.css` + `assets/CardTilt.tsx` + `assets/EnterOnView.tsx` 复刻这套
> 暗底柠檬绿毛玻璃 UI 与高斯模糊入场动效，遵守文件头的三条铁律与第 9 节的平台降级，
> 不要新造色值与关键帧。

## 1. 套件清单

| 文件 | 内容 | 依赖 |
| --- | --- | --- |
| `assets/glass-kit.css` | 令牌 / 页面基底 / 8 档毛玻璃 / 33 条关键帧 / 三套入场 / 卡片三层结构 + hover + 3D 倾斜 + 主体越框弹出 / 瀑布流 / 常用点缀 / 滑动高亮 / 果冻形变 / 霓虹文字与颜文字 LED 点阵 / 影院海报墙与霓虹跑马灯 / 平台门控与降级 | 无（纯 CSS） |
| `assets/CardTilt.tsx` | 3D 跟手倾斜驱动（rAF 节流直写 CSS 变量） | React |
| `assets/EnterOnView.tsx` | 视口触发的两段式雾中浮现 + 安卓廉价重播 + 降耗类调度 | React（原生 IntersectionObserver） |
| `assets/JellyNav.tsx` | 滑动高亮：凹陷块弹性跟随 hover、选中发光胶囊跟随点击（对应原站 `HistoryPanel.tsx` 的 Mac Dock 高亮） | React |
| `assets/JellyMorph.tsx` | 果冻形变：按钮 ⇄ 弹窗（对应原站 `floating-action-button.tsx`，见 `05` 第 8 节） | React |
| `assets/MoodFace.tsx` | 颜文字 LED 点阵：灯珠自适应 + 坏灯珠 + `--led-color` 换色（对应原站 `live-host-stage.tsx` 的心情脸） | React |
| `assets/mood-faces.ts` | 点阵零件库：36 个符号小像素块 + compose 横拼，内置 8 条心情颜文字（对应原站 `lib/hanako/mood-faces.ts`），不依赖系统字体 | 无 |
| `assets/CinemaWall.tsx` | 影院海报墙：多列斜向来回滚动 + 悬停停列 + `:has()` 聚光灯 + 海报兜底（对应原站 `cinema-mode.tsx`，见 `08` 第 3 节） | React |
| `assets/NeonMarquee.tsx` | LED 霓虹跑马灯：bold/soft × pink/lime、双向滚动、闪烁错峰（对应原站 `neon-marquee.tsx`，见 `08` 第 4 节） | React |
| `assets/demo.html` | 自包含演示页，双击即开。内含与上面七个组件等价的原生 JS 实现，可当 vanilla 版参考 | 无 |
| `assets/README.md` | 对外仓库的 README（接入步骤 / 铁律 / 验收清单 / 浏览器支持），不含本仓库内部信息 | - |
| `assets/LICENSE` | MIT 模板，署名处待填 | - |

`assets/` 目录本身就是**未来那个公开仓库的根目录内容**，整个文件夹拖走即可。
代码部分约 3000 行，无第三方运行时依赖。 瀑布流那节的类名按 `react-masonry-css` 的结构写的，
但换成任意等宽列布局或 CSS columns 都能用。

## 2. 五步接入

1. **引入 CSS**：`import "./glass-kit.css"`（Tailwind 项目放在 `@tailwind utilities` 之后，
   否则 `.glass-card` 的圆角会被 Tailwind 基类盖掉）。
2. **铺背景层**——**这步不能省**。在根布局里加：
   ```html
   <div class="bg-texture"></div>
   <div class="grid-texture"></div>
   ```
   它们是 `position:fixed; z-index:-1`，是**所有 `backdrop-filter` 的采样源**。
   没有它玻璃就没东西可糊、退化成半透明色块——「玻璃看起来是假的」十有八九是这一步漏了。
   想用图片背景就换成一张 `position:fixed; z-index:-1; object-fit:cover` 的图。
3. **搭卡片三层结构**：
   ```tsx
   <EnterOnView cheapReplay={isAndroid} hasOverflowPop={!!maskUrl}>
     <CardTilt autoTilt={touchAutoPop}>
       <div className="glass-card">
         <div className="card-media"><img src={cover} /></div>
         <div className="frosted-glass">{/* 标题 / 元信息 */}</div>
       </div>
       <div className="card-pop" style={{ aspectRatio: "3 / 4" }}>
         <img src={cover} style={{ maskImage: `url(${maskUrl})`, maskMode: "luminance" }} />
       </div>
     </CardTilt>
   </EnterOnView>
   ```
   `EnterOnView` 自己会渲染 `.card-shell` 外壳，不要再手动包一层。
   卡片外层网格容器加 `.card-grid`（邻卡后退景深靠 `.card-grid:hover` 生效）。
4. **换主题色**：只改 `:root` 的 `--accent-color` / `--accent-glow` 两行。
   流光里的 `rgba(190,242,100,0.12)`、菜单光条、`.line-sweep` 三处还硬编码着柠檬绿，
   要彻底换色一起改（全文搜 `163, 230, 53` 与 `190, 242, 100`）。
5. **验收**：跑第 4 节的检查清单。

## 3. 三条铁律（写在 CSS 文件头，这里复述因为最容易违反）

1. **`filter` 与 `backdrop-filter` 只能同元素共存，绝不能祖孙共存。**
   祖先只要有 `filter`（哪怕 `blur(0)`），子级 `backdrop-filter` 的背景采样立刻失效。
   → 所有 `.enter-*` 模糊入场类只能挂**玻璃块本体**或**纯非玻璃元素**，
     不能挂到玻璃块的容器（网格 `<section>`、wrapper `<div>`）上。
   → 倾斜层的投影必须用 `box-shadow`，**不能用 `drop-shadow`**（那是 filter）。
     唯一例外是 `.card-pop`（它在 `.glass-card` 之外，可以安全用）。
2. **`animation: ... forwards` 会钉死元素的 `transform`**，写在同元素 `:hover` 上的
   `transform` 不生效（层叠优先级：动画 > 普通 `:hover`）。
   → 这就是三层结构的成因：位移挂 `.card-shell`、旋转挂 `.card-tilt`、
     玻璃与入场挂 `.glass-card`。**别为了少一层 div 去合并。**
3. **`backdrop-filter` 永不进 `transition` / `animation` 列表**，带它的元素
   `transition` 必须显式列属性、不能写 `all`。

## 4. 验收检查清单

视觉：
- [ ] 玻璃面板背后能看见背景的**形状与颜色变化**（不只是均匀半透明）→ 否则第 2 步漏了
- [ ] 卡片入场是「从雾里化开」而不是单纯淡入 → 否则 `filter` 被挂到了祖先（铁律 1）
- [ ] 桌面 hover 单卡：上浮 + 放大 + 邻卡轻微缩小 + 一道斜光扫过
- [ ] 鼠标在卡面移动时卡片跟手倾斜、封面图以更慢的速度反向错动（图与卡分离感）
- [ ] 滚出视口再滚回，入场动画会重播（不是只播一次）

平台：
- [ ] 手机上完全没有 hover 效果（不是「有但很怪」）
- [ ] 系统开启「减少动态效果」后：位移/缩放/流光全停，但**颜色与发光仍在**
- [ ] 低端安卓滚动不闪屏、不花屏 → 检查是否漏了第 9 节，或 `will-change` 常驻了
- [ ] 老 WebView（Chrome < 108）上高度不塌 → 检查有没有误用 `min-h-[100dvh]`

## 5. 没带走的部分（想要得回本仓库看源码）

套件覆盖的是**通用观感层**。以下是重资产，靠文档无法重建，需要读原实现：

| 效果 | 位置 | 为什么没抽 |
| --- | --- | --- |
| 绝区零式撕纸转场 | skill `page-transition-system` | **已抽成独立 skill**，含文档 + `assets/ribbon-transition.css` / `RibbonTransition.tsx` / `demo.html` |
| View Transitions 立方体翻页 | `page-transition-system` 的 `05` §4 | 休眠备选，`TRANSITION_MODE = "ribbon"` 够不到 |
| 音乐页音频可视化 / 液面折射 / 地形波 / 歌词水波 | skill `music-visual-system` 的 `05` `06` | GLSL/WebGL + 自托管引擎 + SVG 滤镜链。音乐页另有自己的可复制套件（鱼眼卡片墙），见 `music-visual-system/assets/` |
| 直播页终端美学（壳层） | `06` A | 8 色霓虹与心情脸点阵**已抽入套件**（第 12 节 + `MoodFace.tsx` / `mood-faces.ts`）；剩下的 CRT 底噪、卷帘壳、舞台光晕/粒子背景与直播业务耦合深 |
| 集邮册 / 彩带 Hero | `07` `08` | 强主题装饰，通用性低，但文档里数值给全了、可照抄 |
| 霓虹跑马灯 / 影院海报墙 | `08` 3、4 | **已抽入套件**（`NeonMarquee.tsx` / `CinemaWall.tsx` + CSS 第 13、14 节）；详情模态等业务联动部分不在套件内 |

## 6. 与 01-09 的分工

- 想知道**怎么写**、要能跑的代码 → `assets/`（本册）
- 想知道**为什么这么写**、改动会踩什么坑 → `01`-`09`
- 在本仓库内改 UI → 先读 `01` `02` 定位令牌与关键帧，再读对应页面分册
- 在新项目里起步 → 只读本册 + `assets/`，01-09 当延伸阅读
- **只要毛玻璃 + 雾中浮现**、不要卡片三层结构/瀑布流/点缀/霓虹 → 读 `11-glass-blur-only.md`，
  那一册自包含、CSS 可直接粘贴，既不用读本册也不用整包搬 `assets/`

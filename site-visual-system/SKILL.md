---
name: site-visual-system
description: 本站（家园 /home 之外）全部页面的视觉与动效系统总纲：设计令牌、毛玻璃层级、动效关键帧库、缓动语言、逐页效果目录、平台降级门控与踩坑铁律，并附带可直接复制到新项目的毛玻璃+高斯模糊动效套件（assets/glass-kit.css 等）。当需要新增/修改任何页面的 UI 外观、hover 效果、入场动画、转场、玻璃面板、霓虹/胶片质感，或在别的项目里复刻这套观感，或排查「动画不生效 / 毛玻璃失效 / 安卓掉帧」时使用。正文开头有两张按需读取路由表（按任务意图 / 按效果名字），可精确定位到某一册的某一节，不必通读；只要毛玻璃与高斯模糊入场（雾中浮现）的话，读 references/11-glass-blur-only.md 一册即可。
---

# 站点视觉系统（家园页除外）

## 这是什么

本仓库的视觉表现高度集中在 **`app/globals.css`（约 6070 行）** 与少量驱动动效的客户端组件里。
本 skill 把这套东西拆成可检索的分册，目的是：改 UI 时**先查再写**，不要重新发明轮子，也不要
踩已经踩过并写了长注释的坑。

**范围**：`app/` 下除 `app/home/**`（3D 家园）与 `app/music/**`（音乐页）之外的所有页面 + `components/**`。

两个例外各有自己的 skill：
- 家园页有独立的 R3F/Three.js 体系（`app/home/_components/*.module.css`、`_lib/quality.ts` 等）。
  但**家园在站外的投影**（右下角萌萌子状态泡 `.mh-*`、首页客串 `home-cameo`）仍属于本 skill。
- 音乐页 `/music` 有自建的 3D 渲染循环与独立的性能预算 → 看 skill **`music-visual-system`**。
  它在站外的投影（迷你播放器 `GlobalMiniPlayer`、音量 HUD）也归那边；
  但**帖子里的音乐分享卡**（`music-post-body.tsx` / `music-detail-player.tsx` / `.mpb-eq-bar`）属于本 skill。

## 按需读取路由（先看这张表，命中即停）

**分册加起来近 100KB，绝大多数任务只需要其中一到两册。** 下表按「你想做什么」给出
**最小读取集**：命中某一行，就只读那一行列出的文件，**其余分册与 `assets/` 一律不要读**。
表里没有的诉求，往下看**效果索引**（按效果名字查，覆盖全部效果）。

| 我想做的事 | 只读这些 | 说明 |
| --- | --- | --- |
| **只要毛玻璃 + 雾中浮现（高斯模糊入场）** | `references/11-glass-blur-only.md` | 自包含配方，CSS 可直接粘贴。读它一册就够，**不要再开 01/02/03** |
| **只要某一个具体效果**（3D 倾斜 / 果冻形变 / 跑马灯 / 集邮册…） | 查下面的**效果索引**，按行读那一节 | 效果索引是完整的，每个效果都能查到分册、小节与成品 |
| 在新项目里复刻整套观感 | `references/10-portable-kit.md` + `assets/` | 10 是接入指南，`assets/` 是成品代码 |
| 改某个页面已有的 UI | `references/01` + 该页面对应分册 | 01 定位令牌与玻璃档位；页面分册看已有门控 |
| 加一个新动效 | `references/02` + 该页面对应分册 | 02 是关键帧总表，**先查有没有能复用的再写新的** |
| 排查「毛玻璃失效 / 动画不生效」 | `references/01` 第 5 节 + `references/02` 第 6 节 | 九成是 `filter` × `backdrop-filter` 祖孙共存 |
| 排查「安卓掉帧 / 闪屏 / 花屏」 | `references/09` + `references/02` 第 5 节 | 09 末尾有降级手法的性价比排序 |
| 影院海报墙 / 霓虹跑马灯 | `references/08` 第 3 / 第 4 节 + `assets/CinemaWall.tsx` / `NeonMarquee.tsx` | 两者都已抽成独立组件 |
| 路由转场 / 切页闪屏 / 撕纸遮罩 | 换 skill：`page-transition-system` | 不在本 skill 范围内 |
| 音乐页 `/music` 的任何东西 | 换 skill：`music-visual-system` | 不在本 skill 范围内 |

一次读取上限：**除非表里明写，否则不要一次开超过 2 册**。缺什么再补读一册，
比一次性把 01-09 读完便宜得多。

## 效果索引（要某一个具体效果时查这张，覆盖全部）

上面那张按**任务意图**分流，这张按**效果名字**分流。`§` 指该分册的小节号，
`kit §N` 指 `assets/glass-kit.css` 的第 N 节。**照着行去读那一节即可，不要通读整册。**
两张表都没命中，才看再下面的分册索引。

### 玻璃与模糊

| 效果 | 读这里 | 可复制成品 |
| --- | --- | --- |
| 毛玻璃面板（选档 / 新增一档） | `11` §3，深究看 `01` §4 | kit §3 |
| 雾中浮现 / 高斯模糊入场 | `11`（整册就是它）；只想看帖子卡那处的实现看 `03` §6 | kit §4 §5 + `EnterOnView.tsx` |
| 入场机制该选哪一套（错落延迟 / 视口触发 / `data-state`） | `11` §5 或 `02` §3 | kit §5 |
| 玻璃顶部高光线、共同签名 | `11` §3 | kit §3 |
| 「毛玻璃失效 / 变纯色块」排查 | `11` §6 或 `01` §5 | — |
| 模态遮罩、滚动锁定 | `05` §7 + `01` §6 | kit §3 |

### 帖子卡（首页瀑布流）

| 效果 | 读这里 | 可复制成品 |
| --- | --- | --- |
| **3D 跟手倾斜**（鼠标在卡面上卡片跟着转） | `03` §4 | `CardTilt.tsx` + kit §6 |
| hover 聚焦景深（邻卡后退）+ 斜向流光扫过 | `03` §3 | kit §6 |
| 主体越框弹出（蒙版抠像，人物探出卡外） | `03` §5 | kit §6 |
| 触屏「刷到即弹」（无 hover 的替代） | `03` §5 | kit §6 |
| 卡片三层 DOM 结构（为什么不能合并）、静态外观 | `03` §1 §2 | kit §6 |
| 瀑布流列数与间距 | `03` §8 | kit §7 |
| 安卓降耗类 `.cv-auto` / `.cv-lite` | `03` §9 | kit §9 |
| hero 转场回落后的逐行登场 | `03` §7 | — |
| 帖子模板变体 / `GlassMorph` 组件 | `03` §10 §11 | — |

### 导航、菜单、弹层

| 效果 | 读这里 | 可复制成品 |
| --- | --- | --- |
| **果冻形变**：悬浮按钮 ⇄ 居中弹窗（飞行放大 + 果冻皮溶解） | `05` §8 | `JellyMorph.tsx` + kit §11 |
| **果冻跟随 / 滑动高亮**：Mac Dock 凹陷块跟 hover + 发光胶囊跟点击 | 本 skill 只有套件版，看 `10` §1；原站实现在 skill `music-visual-system` 的 `07` | `JellyNav.tsx` + kit §10 |
| 切换条滑块（framer `layoutId`，切换即换页的时序陷阱） | `05` §10 | — |
| 毛玻璃下拉菜单（Radix `data-state` 进退场） | `05` §2 | kit §5 C |
| 导航栏、智能隐藏 `.smart-navbar`、导航环 | `05` §1 | kit §3 |
| 分类菜单 / 手机端 galgame 卡片菜单 | `05` §3 §4 | — |
| 用户社交悬浮卡 | `05` §5 | — |
| 全站搜索弹层（扫掠 + 结果行错峰） | `05` §6 | — |
| 通知铃铛徽标（数字里程表翻滚） | `05` §9 | — |
| 通用滚动入场包装器（五种变体） | `05` §11 | — |
| 弹层清单与 z-index 秩序 | `08` §5 | — |

### 路由转场与手势

| 效果 | 读这里 | 可复制成品 |
| --- | --- | --- |
| 绝区零式撕纸遮罩 / 切页闪屏 / 给新页加转场卡 | 换 skill：`page-transition-system` | `page-transition-system/assets/` |
| View Transitions 立方体翻页（休眠备选，看不到） | `page-transition-system` 的 `05` §4 | 未在跑 |
| 左右滑页手势 | `page-transition-system` 的 `05`（入口仍在 `05` §12） | — |

### 装饰与氛围

| 效果 | 读这里 | 可复制成品 |
| --- | --- | --- |
| 影院模式聚光灯海报墙 | `08` §3 | `CinemaWall.tsx` + kit §13 |
| LED 霓虹跑马灯（bold/soft × pink/lime） | `08` §4 | `NeonMarquee.tsx` + kit §14 |
| 颜文字 LED 点阵（心情脸） | `06` A6 | `MoodFace.tsx` + `mood-faces.ts` + kit §12 |
| 8 色霓虹文字 + 闪烁 + 打字机光标 | `06` A3 | kit §12 |
| 背景巨字漂移 `.ikbd-*` | `08` §1 | — |
| 无图帖的文字 Hero 彩带 | `08` §2 | — |
| 全站背景层（光晕 / 网格 / 粒子）＝所有毛玻璃的采样源 | `11` §1，或 `01` §3 + `09` §1 | kit §2 |
| 头像呼吸光环 + hover 放大 | `01` §7 | kit §8 |
| 绝区零式标题条 `.mp-*` | `07` §1 | — |
| 收藏集邮册（三态机 + 邮票齿孔 mask） | `07` §1 | — |
| 哑光进度条 `.zzz-*`（危险条纹 + 荧光扫掠） | `07` §1 | — |
| 点阵登录输入框 | `07` §3 | — |
| 首页每日客串（家园在站外的投影） | `09` §7 | — |

### 直播页 `/live`

| 效果 | 读这里 | 可复制成品 |
| --- | --- | --- |
| 卷帘壳进出场 / 弹幕流 / 输入区 / 舞台折叠 / 主播舞台 | `06` A1-A7 | 只有心情脸与霓虹抽了，见上一组 |

### 全局规范（写新效果前查）

| 问题 | 读这里 | 可复制成品 |
| --- | --- | --- |
| 该用哪个颜色 / 圆角 / 间距 | `01` §1 §2 §8 | kit §1 |
| 该用哪条缓动曲线 | `02` §1 | kit §1（`--ease-*`） |
| 有没有现成关键帧可以复用 | `02` §2 | kit §4 |
| `prefers-reduced-motion` 该怎么补 | `02` §4 | kit §9 |
| 平台门控矩阵（hover / 触屏 / 安卓 / 老内核） | `02` §5 | kit §9 |
| 合成器纪律（`will-change`、`transition` 写法） | `02` §6 | kit §9 |
| 安卓掉帧闪屏排查 + 降级手法性价比排序 | `09` §8 | kit §9 |
| 已废弃 / 无引用的死路径 | `09` §9 | — |

站内页面本身（友链 / 归档 / 下载 / 后台 / 通知 / 封禁）在 `09` §2-§6，
个人中心与用户主页在 `07` §1 §2，帖子详情弹窗在 `08` §1。

## 分册索引

上面两张表都没命中时才用这张定位。

| 文件 | 内容 |
| --- | --- |
| `references/01-tokens-and-glass.md` | 令牌、色板、Tailwind 主题、十一级毛玻璃体系、`filter` × `backdrop-filter` 铁律 |
| `references/02-motion-primitives.md` | 缓动语言、关键帧总表、三套入场机制、降级约定、平台门控矩阵、合成器纪律 |
| `references/03-post-cards.md` | 帖子卡全套（首页瀑布流核心） |
| `references/04-page-transitions.md` | 路由转场已迁到 `page-transition-system`，这里只留指路 |
| `references/05-navigation-overlays.md` | 导航栏、菜单、弹层、悬浮发帖按钮、切换条 |
| `references/06-live-and-music.md` | 直播页。音乐页已迁出到 `music-visual-system`，这里只留指路 |
| `references/07-profile-and-auth.md` | 个人中心、用户主页、集邮册、登录注册 |
| `references/08-post-detail-and-ambient.md` | 帖子详情弹窗与各类环境氛围装饰 |
| `references/09-misc-and-perf.md` | 其余站内页面 + 性能与安卓降级总则 |
| `references/10-portable-kit.md` | **可移植套件说明**：五步接入、验收清单、换主题色、没带走的部分 |
| `references/11-glass-blur-only.md` | **自包含配方**：只要「毛玻璃 + 雾中浮现」读这一册就够 |

## 可复制成品（`assets/`）

01-09 是本仓库的索引与决策记录（要配合 `app/globals.css` 源码读）；`assets/` 是**能直接
复制走的成品代码**，约 3000 行、无第三方运行时依赖：

| 文件 | 内容 |
| --- | --- |
| `assets/glass-kit.css` | 令牌 / 页面基底 / 8 档毛玻璃 / 33 条关键帧 / 三套入场机制 / 卡片三层结构 + hover + 3D 倾斜 + 主体越框弹出 / 瀑布流 / 常用点缀 / 滑动高亮 / 果冻形变 / 霓虹文字与颜文字 LED 点阵 / 影院海报墙与霓虹跑马灯 / 平台门控与降级 |
| `assets/CardTilt.tsx` | 3D 跟手倾斜驱动（rAF 节流、直写 CSS 变量、不走 state） |
| `assets/EnterOnView.tsx` | 视口触发两段式雾中浮现 + 安卓廉价重播 + 降耗类调度 |
| `assets/JellyNav.tsx` | 滑动高亮：凹陷块弹性跟随 hover（Mac Dock 手感）+ 选中发光胶囊跟随点击滑移 |
| `assets/JellyMorph.tsx` | 果冻形变：悬浮按钮 ⇄ 居中弹窗（飞行放大 + 果冻皮溶解 + 内容延后点亮 + 毛玻璃落地淡入） |
| `assets/MoodFace.tsx` | 颜文字 LED 点阵：灯珠尺寸按容器自适应、确定性哈希挑坏灯珠、`--led-color` 换色 |
| `assets/mood-faces.ts` | 点阵零件库：36 个符号小像素块 + compose 横拼，内置 8 条心情颜文字，不依赖系统字体 |
| `assets/CinemaWall.tsx` | 影院海报墙：多列斜向来回滚动（悬停停列）+ `:has()` 聚光灯 hover + 海报兜底 |
| `assets/NeonMarquee.tsx` | LED 霓虹跑马灯：bold/soft 变体 × pink/lime 色调、双向滚动、闪烁错峰 |
| `assets/demo.html` | 自包含演示页，浏览器双击即开（无构建、无依赖、不联网），也是 vanilla JS 参考实现 |
| `assets/README.md` `assets/LICENSE` | 对外分发用的 README（不含本仓库内部信息）与 MIT 模板 |

`assets/` 目录可整个文件夹拖走，不依赖站点仓库。

本 skill 与 `music-visual-system` 同属独立仓库 **hanako visual skills**（见上级 `README.md`），
和站点仓库分开管理。01-09 引用的组件路径与类名由 `scripts/check-refs.mjs` 定期核实，
**改完站点记得跑一次**，新增的失联项就是待修的文档。

## 上手顺序

先按上面两张表（意图路由 / 效果索引）定位，只有都没覆盖时才走下面的通用流程 ——
且**每步读完够用了就停**，不要为了「读全」而把三册都开。

**在本仓库改 UI**：
1. 读 `01` 确认要用的颜色/圆角/玻璃层级已经存在，**不要新造色值**。
2. 涉及新动效才读 `02`，确认关键帧已经存在并**优先复用**（如 `blurFadeIn`、`cardSheenSweep`）。
   只改颜色/间距的话这一步可以跳过。
3. 读对应页面分册，看清该处已有的门控（`@media (hover:hover)`、`prefers-reduced-motion`、
   安卓 `.cv-auto` 类等），新效果必须挂在同样的门控下。

**在新项目复刻观感**：直接读 `10` + 复制 `assets/`，01-09 当延伸阅读。
**只要玻璃与雾中浮现**：直接读 `11`，到此为止。

## 三条不可违背的铁律

1. **`filter` 与 `backdrop-filter` 只能同元素共存，绝不能祖孙共存。**
   祖先只要有 `filter`（哪怕 `blur(0)`），子级的 `backdrop-filter` 背景采样立刻失效 → 毛玻璃变纯色块。
   所有「模糊渐入」类入场（`.links-enter` / `.archive-enter` / `.admin-tab-enter` / `.post-enter`）都必须
   挂在**玻璃块本体**或**非玻璃块**上，永远不能挂到玻璃块的容器上。
2. **`animation: ... forwards` 会钉死元素的 `transform`，写在同元素 `:hover` 上的 `transform` 不生效。**
   所以位移/缩放挂 wrapper（`.post-card-container`）、旋转挂中间层（`.post-card-tilt`）、
   玻璃与入场动画挂本体（`.glass-card`）—— 这个三层结构是被 bug 逼出来的，不要合并。
3. **移动端 / 安卓一律走降级路径。** hover 类效果整体门控在 `@media (hover:hover) and (pointer:fine)`；
   `backdrop-filter` 在安卓从 `blur(20px)` 降到 `blur(6px)`；滚动重播入场用纯 `transform` 版本
   替换 `filter:blur` 版本。新增效果若含 `filter`/大面积 `backdrop-filter`，必须补降级分支。

## 相关源码定位

- 全站样式：`app/globals.css`（唯一大表）、`styles/globals.css`
- Tailwind 主题：`tailwind.config.ts`（色板走 CSS 变量、4 个自定义关键帧）
- 独立 CSS Module：`components/floating-chat.module.css`、`components/home-cameo.module.css`
- 动效驱动组件：`components/post-card-tilt.tsx`、`components/subject-parallax.tsx`、
  `components/page-ribbon-transition.tsx`、`components/glass-morph.tsx`、
  `components/animate-on-scroll.tsx`、`components/virtual-post-list.tsx`

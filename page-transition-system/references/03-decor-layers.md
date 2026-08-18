# 03 · 主板上的装饰层

黑主板满屏那 0.44 秒里的所有内容。自下而上排列。

**通用手法**：能做成静态背景渐变的绝不逐帧画（网点、冲孔、分隔线、扫描线、hazard 条纹
全是 `repeating-linear-gradient`，一次光栅化后只跟着图层平移）；需要动的只动 transform
或 opacity，两者拆成并行的两条 animation 互不抢。

## 1. 半调网点 + 斜百叶窗 `.ptr-halftone`

两层静态背景叠加，随主板移动，零逐帧开销：

```css
background-image:
  radial-gradient(circle, rgba(var(--ptr-soft-rgb), 0.16) 1.2px, transparent 1.3px),
  repeating-linear-gradient(-55deg,
    rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 30px,
    transparent 30px, transparent 60px);
background-size: 16px 16px, auto;
```

网点靠 `background-size: 16px 16px` 平铺，百叶窗用 `auto` 让它按 `-55deg` 自然重复。

## 2. 胶片绶带 `.ptr-band-1/2/3`

参考绝区零的胶片条。**一条带 = 四层静态背景 + 两条并行动画**。

带身（`background-color` 兜底 + 等距帧分隔线 + 竖向高光）：

```css
background-color: rgb(var(--ptr-accent-rgb));      /* 不透明兜底色，见铁律 4 */
background-image:
  repeating-linear-gradient(90deg,
    rgba(18,6,13,0.55) 0, rgba(18,6,13,0.55) 5px,
    transparent 5px, transparent 150px),           /* 每 150px 一条 5px 帧分隔线 */
  linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 55%);
```

上下两排冲孔用 `::before` / `::after`，各占带高 13%、距边 6%：

```css
background: repeating-linear-gradient(90deg,
  rgba(13,4,9,0.9) 0, rgba(13,4,9,0.9) 14px,
  transparent 14px, transparent 30px);
```

带内文字 `.ptr-band-text`：黑字印在主题色带上，`font-weight:900` 斜体大写、
`letter-spacing: 0.34em`、`clamp(15px, 4.5vh, 30px)`。

三条带的位置与动画：

| 带 | top | height | 淡入 delay | 漂移 |
| --- | --- | --- | --- | --- |
| `.ptr-band-1` | 4% | 16% | 0.12s | `ptr-band-drift` 3s |
| `.ptr-band-2` | 40% | 18% | 0.2s | `ptr-band-drift-rev` 3.6s（从标题背后穿过，反向） |
| `.ptr-band-3` | 76% | 15% | 0.28s | `ptr-band-drift` 3.2s |

```css
@keyframes ptr-band-drift {
  from { transform: translate3d(6%, 0, 0) rotate(-12deg); }
  to   { transform: translate3d(-6%, 0, 0) rotate(-12deg); }
}
```

⚠️ **旋转角写在关键帧里**（不是在基础规则上），所以安卓那边关掉漂移动画后
必须手工补回 `transform: rotate(-12deg)`，否则带会变成水平的。见 `04` §3。

两侧各出血 15%、漂移振幅 ±6%，带边缘永不入画。转场存活 <1.3s、循环跑不完一圈，
所以**不用关心接缝**——这条前提让所有滚动动画都省掉了内容复制两份的开销。

## 3. 巨型镂空描边文字行 `.ptr-row-1..6`

遮罩里最重的纹理来源，也是视觉主角。

容器先抵消主板斜切再旋转：

```css
.ptr-rows { position: absolute; inset: -30%; transform: skewX(10deg) rotate(-12deg); }
```

`skewX(10deg)` 抵消父级的 `skewX(-10deg)`，乘积是纯 `rotate(-12deg)`，**字形不被剪切变形**。

六行奇偶分工，方向交错：

| 行 | top / height | 字号 | 样式 | 滚动 |
| --- | --- | --- | --- | --- |
| 1 | 0% / 18% | `clamp(56px,12vw,130px)` | 白 30% 描边 2px、字心透明 | `ptr-row-slide` 6s |
| 2 | 19% / 7% | `clamp(14px,2.4vw,24px)` | 浅色 60% 实心 | `ptr-row-slide-rev` 5s |
| 3 | 27% / 24% | `clamp(80px,17vw,190px)` | **主题色描边 2.5px**，最大的一行，从标题背后穿过 | `ptr-row-slide-rev` 6.5s |
| 4 | 52% / 7% | `clamp(14px,2.4vw,24px)` | 白 42% 实心 | `ptr-row-slide` 5.5s |
| 5 | 60% / 20% | `clamp(64px,14vw,150px)` | 白 42% 描边 2px | `ptr-row-slide` 7.5s |
| 6 | 82% / 7% | `clamp(14px,2.4vw,24px)` | 浅色 55% 实心 | `ptr-row-slide-rev` 6s |

```css
@keyframes ptr-row-slide     { from { transform: translate3d(0,0,0); }     to { transform: translate3d(-50%,0,0); } }
@keyframes ptr-row-slide-rev { from { transform: translate3d(-50%,0,0); }  to { transform: translate3d(0,0,0); } }
```

行本身 `left/right: -25%`（约 360vw 宽），被主板的 `overflow:hidden` 裁切。
**行越宽 GPU 纹理越大**，这是安卓上要收窄它的原因（`04` §5）。
行是透明文字无底色，所以慢网下极端停留时文字滚到边角也不可见。

内容由组件拼装（奇数行短、偶数行长）：

```ts
const phrase    = `${word}  ${mark}  ${jp}  •  ${word}  ${mark}  ${cn}  •  `.repeat(安卓 6 : 14)
const bigPhrase = `${word}  ${mark}  `.repeat(安卓 5 : 12)
// 奇数行用 bigPhrase，偶数行用 phrase
```

## 4. 巨型水印符号 `.ptr-mark`

单元素最大纹理。居中、`clamp(260px, 68vh, 640px)`、主题色描边 2px、字心透明。

```css
@keyframes ptr-mark-drift {
  from { opacity: 0; transform: translate3d(-50%,-50%,0) rotate(-10deg) scale(0.9); }
  20%  { opacity: 1; }
  to   { opacity: 1; transform: translate3d(-50%,-50%,0) rotate(8deg) scale(1.05); }
}
```

`2.6s` 跑完，但转场只活 ~1.3s —— **故意的**，只取曲线前半段，看到的是持续缓慢的
旋转放大，永远不会停下来（停下来就显得"演完了"）。

## 5. 标题卡入场链 `.ptr-title`

**改一处要动两处**：CSS 的延迟公式与组件的 `landDelay` 计算强同步。

容器静态定格 `rotate(-2deg)`，冲击全部交给子元素。DOM 顺序即叠放：
回声/残影垫底，实心主字最后绘制盖在中间。

```
时刻（从遮罩挂载起算）
0.30s ┬ 逐字砸入开始：.ptr-letter，第 i 个字延迟 0.3 + i*0.04，单字 0.16s
      │   from  opacity 0, translateY(-0.4em) scale(1.7) rotate(7deg)   上方放大斜插
      │   62%   opacity 1, translateY(0.04em) scale(0.94) rotate(-2deg) 过冲压扁
      │   to    归位
0.46s ┼ .ptr-title-chip 副标签滑入（0.3s，回弹曲线，顺 --ptr-x 方向）
0.52s ┼ .ptr-title-hazard 斜纹条 scaleX(0→1)（0.26s）
--ptr-land ┬ = 0.3 + (字数-1)*0.04 + 0.16 ← 末字落位，组件算好下发
           ├ .ptr-title-echo 镂空回声向外盖章（0.24s）
           │    translate(-0.05em,-0.07em) scale(1.06)，白 40% 描边
           └ .ptr-title-ghost RGB 错位残影硬闪两下（0.22s，纯 opacity）
                青色 --ptr-split 偏移 (-0.045em, 0.03em)
                品红 --ptr-accent 偏移 (0.045em, -0.02em)
                关键帧：0/100% 灭 → 10~28% 亮 0.85 → 34~50% 灭 → 56~70% 亮 0.5 → 78% 灭
```

实心主字 `.ptr-title-main` 用贴纸式硬偏移双重投影：

```css
text-shadow:
  0.045em 0.045em 0 var(--ptr-accent),
  0.09em  0.09em  0 rgba(var(--ptr-accent-rgb), 0.35);
```

用 `text-shadow` 而非独立图层，是因为它随字形走 —— 逐字动画时投影天然跟随每个字母。

`.ptr-letter` **不挂 `will-change`**：一次性动画，7 个常驻图层不值得，
动画期间浏览器自行临时提升。

hazard 条的斜纹是静态 `repeating-linear-gradient(-55deg)`，入场只做 `scaleX`，
条纹随之横向展开、自带扫掠感，零逐帧重绘。

## 6. 角标

```css
.ptr-corner-no      右上，top: max(4.5%, env(safe-area-inset-top)); right: 6%
                    clamp(28px,7vw,56px) 900 斜体，白字 + 主题色硬投影 0.08em
                    > em  "/ 04" 0.42em 白 55%，无投影
                    ptr-fade-in 0.25s ease-out 0.4s
.ptr-corner-loading 左下，bottom: max(5%, env(safe-area-inset-bottom)); left: 6%
                    "NOW LOADING ▸▸▸" letter-spacing 0.32em
                    ptr-blink 0.8s linear 0.4s infinite（0~55% 亮 → 56~100% 0.25）
```

`env(safe-area-inset-*)` 配 `max()` 是为了刘海屏 / 手势条不压住角标。
编号为 `"EX"`（环外页面）时组件不渲染 `/ 04` 后缀。

## 7. 主板两侧霓虹描边条 `.ptr-edge`

与主板同高同斜角（`skewX(-10deg)`、`top/bottom: -12%`），宽 `clamp(6px,1.2vw,14px)`，
主题色竖向渐变 + `box-shadow: 0 0 32px` 发光。左右各一，贴在主板出血边缘
（`left: -25%` / `right: -25%`）——**只在扫动途中露脸**，满屏后已经在屏外。

## 8. 速度线 `.ptr-streak-1..6`

压在一切之上横飞。基线 `transform` 就是飞行起点，让 `animation-delay` 期间停在屏外：

```css
.ptr-streak {
  left: -45vw; height: 3px; border-radius: 2px;
  transform: translate3d(calc(180vw * var(--ptr-x)), 0, 0);
  animation: ptr-streak-fly 0.6s linear infinite;
}
```

六条各自的宽度、位置、时长、延迟错峰（0.5~0.74s，delay 0~0.44s），
颜色在白 / 浅色 / 主题色之间轮换。

⚠️ **安卓整组不挂载** —— 6 条独立合成层持续光栅化，是连续快滑时鬼影/卡顿的重灾区。

## 9. 满屏冲击闪 `.ptr-flash`

黑主板落位瞬间一次低透明度满屏闪：

```css
animation: ptr-flash 0.26s ease-out 0.38s both;   /* 0.38s ≈ 主板落位时刻 */
/* 0% 灭 → 35% opacity 0.22 → 100% 灭 */
```

挂载后只跑一次，`phase` 切换不重启（它在 `.ptr-root` 下、不在 `.ptr-wipe` 里，
不受 `[data-phase]` 选择器影响）。

## 10. 每页文案表（`CARDS`）

组件里的常量，按 `href` 取，取不到用 `FALLBACK_CARD`：

| href | word | jp | cn | no | mark |
| --- | --- | --- | --- | --- | --- |
| `/` | HOME | ホーム | 首页 | 01 | ◇ |
| `/live` | DANMAKU | 弾幕の壁 | 弹幕墙 | 02 | △ |
| `/cinema`（虚拟环位） | CINEMA | シアター | 影院模式 | 03 | ▶ |
| `/profile` | PROFILE | プロフィール | 个人中心 | 04 | ○ |
| `/music` | MUSIC | 音楽 | 音乐 | EX | ♪ |
| `/home` | ROOM | マイルーム | 家园 | EX | ❀ |
| *（兜底）* | HANA | ホタル | 萤火虫 | ?? | ✦ |

`no` 用 `EX` 表示"番外位"——不在滑动环上、只能从导航栏进入的页面。

**加新页面**：往 `CARDS` 加一行即可，`word` 会同时出现在标题、巨字行、绶带里。
若还要能滑动到它，见 `05` §1 的导航环。

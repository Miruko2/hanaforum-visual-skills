# 01 · 设计令牌与毛玻璃体系

## 1. 全局 CSS 变量（`app/globals.css` `@layer base :root`）

```css
--font-sans:            系统字体堆栈（-apple-system / Segoe UI / Roboto ...）
--foreground-rgb:       255, 255, 255
--background-start-rgb: 0, 0, 0
--background-end-rgb:   20, 20, 20
--accent-color:         132, 204, 22   /* lime-500，全站主强调色 */
--accent-glow:          163, 230, 53   /* lime-300，发光/高光用 */
--glass-bg:             rgba(255,255,255,0.07)
--glass-border:         rgba(255,255,255,0.1)
--glass-dark-bg:        rgba(0,0,0,0.5)
--glass-dark-border:    rgba(132,204,22,0.2)
--blur-strength:        20px
--card-spacing:         12px   /* ≤640px 降为 8px */
--card-radius:          16px   /* ≤640px 降为 12px */
--card-shadow:          0 4px 20px rgba(0,0,0,0.25)
--animation-speed-slow:   0.5s
--animation-speed-normal: 0.3s
--animation-speed-fast:   0.15s
--original-scroll:      0px    /* 滚动锁定时记录位置 */
```

**色彩语言**：暗底（近黑）+ 柠檬绿（lime-500 `#84cc16` / lime-300 `#a3e635` / lime-200 `#bef264`）
强调 + 白色半透明描边。危险态用 `#f87171` / `#ef4444`。粉色 `rgba(228,154,195,*)` 只用于头像呼吸光环。
**不要引入新色系**，需要新语义色时先看是否能用现有 lime/red/白透明表达。

## 2. Tailwind 主题（`tailwind.config.ts`）

- `darkMode: ["class"]`，色板全部走 shadcn 的 HSL 变量（`hsl(var(--primary))` 等）。
- `borderRadius` 由 `--radius` 派生（`lg` = `var(--radius)`，`md`/`sm` 递减 2px/4px）。
- 断点新增 `xs: 480px`；container 居中、padding `2rem`、`2xl` 上限 `1400px`。
- 插件：`tailwindcss-animate`。
- 自定义 keyframes / animation（**仅这 4 条在 Tailwind 里**，其余全在 globals.css）：

| 名称 | 用途 |
| --- | --- |
| `accordion-down` / `accordion-up` | Radix 手风琴，`0.2s ease-out` |
| `jelly-pulse` | 果冻呼吸：`scale(1)→1.07`，同时底色 lime-500 → yellow-400 并加投影，`1s ease-in-out infinite` |
| `blur-in` | 高斯模糊渐入：`opacity 0→1 + blur(10px)→0 + translateY(6px)→0`，`0.45s ease-out both`。切换标签时名单条目入场用 |

## 3. 页面基底（三层固定背景，全部 `z-index:-1`、`pointer-events:none`）

| 类 | 效果 |
| --- | --- |
| `.bg-texture` | 4 个 radial-gradient 柠檬绿光晕（20%/20%、80%/80%、60%/30%、30%/70%）叠一层 135° 近黑线性渐变 |
| `.grid-texture` | 60×60px 柠檬绿网格线，`opacity:0.04`，用 radial `mask-image` 中心实四周虚 |
| `.particles` / `.particle` | 2px 圆点 + `box-shadow` 光晕，`float 20s infinite ease-in-out`（上浮 20px / 右移 10px、透明度 0.2↔0.9） |

`body` 背景强制 `transparent !important`，高度用 `100vh` 打底再 `100dvh` 覆盖。
**全站 `user-select:none`**（app 化体验），仅 `input/textarea/select/[contenteditable]` 恢复 `text`。
`-webkit-tap-highlight-color: transparent` 去掉移动端点击灰块。

工具类 `.min-h-viewport`：先 `100vh` 再 `100dvh` 两条声明。**不要写 Tailwind 的 `min-h-[100dvh]`**，
老内核（Chrome < 108）认不得会整条丢弃 → 高度塌成 0。也不要 `min-h-screen min-h-[100dvh]` 并写：
同元素两个 Tailwind 类谁赢取决于样式表顺序。曾因此导致某用户 WebView(Chrome/101) 上 3D 家园
canvas 尺寸为 0、R3F 静默不建 root，排查数轮。

## 4. 毛玻璃层级（选哪一层）

| 类 | 背景 | 模糊 | 描边 | 场景 |
| --- | --- | --- | --- | --- |
| `.glass` | `rgba(255,255,255,0.08)` | `blur(var(--blur-strength)) saturate(120%)` | 白 12% | 通用浅色玻璃 |
| `.glass-dark` | `rgba(0,0,0,0.25)` | 同上 | lime 15% | 暗色玻璃，带 lime 内高光 |
| `.glass-card` | `rgba(25,25,35,0.38)` | `blur(20px) saturate(140%)` | 白 15%，`border-radius:24px` | **帖子卡本体**（见 `03`） |
| `.profile-glass` | `rgba(25,25,35,0.42)` | `blur(22px) saturate(140%)` | 白 12% | 个人中心面板（见 `07`） |
| `.content-glass` | 黑 0.3→0.5 渐变 + 一张噪点底图 | `blur(15px) saturate(110%)` | lime 8% | 内容区，`::before` 再叠一层 `blur(10px)` |
| `.frosted-glass` | `rgba(0,0,0,0.2)` | `blur(24px)` | 四边描边不同（上强下弱） | 卡片底部文字区，`0 0 20px 20px` 圆角 |
| `.modal-content` | `rgba(0,0,0,0.75)` | `blur(25px) saturate(100%)` | 白 10%，24px 圆角 | 模态面板 |
| `.modal-backdrop` | `rgba(0,0,0,0.7)` | `blur(25px) saturate(180%)` | — | 模态遮罩 |
| `.modal-backdrop-strong` | `rgba(0,0,0,0.4)` | `blur(15px)` | — | fixed 满屏，`modalBackdropFadeIn 0.3s` |
| `.navbar-blur` | `rgba(0,0,0,0.2)` | `blur(20px) saturate(180%)` | 白 10% | 导航栏 |
| `.page-container` | `rgba(0,0,0,0.5)` | `blur(15px)` | — | 页面外层容器 |

**共同签名**：`box-shadow` 一律「外投影 + `inset 0 1px 0` 顶部内高光」两段式。
多数玻璃块还带 `::before` 顶部细高光线（`left:10% right:10% height:1px`，白 0.22 中间亮两端透明），
模拟玻璃上边缘反光 —— 新增玻璃面板建议照抄这条。

`.modal-content::before` 用 `mask-composite: exclude` 做 1.5px 渐变描边环（135° 白 0.2→0.05）。

## 5. `filter` × `backdrop-filter` 铁律（最容易踩）

- **同元素可共存**：先 `backdrop-filter` 采样背景，再 `filter` 作用于合成结果。
  「毛玻璃 + 整体再模糊 = 一块更雾的玻璃」，这是入场动画的实现基础。
- **祖孙不可共存**：祖先只要有 `filter`（哪怕 `blur(0)`），子级 `backdrop-filter` 的背景采样直接失效。
- 因此：`.links-enter` / `.archive-enter` / `.admin-tab-enter` / `.post-enter` 这类带 `filter` 的入场类，
  **只能挂在玻璃块本体或纯非玻璃元素上**，绝不能挂到玻璃块的容器（网格 `<section>`、wrapper div）上。
- 同理，倾斜卡的投影必须用 `box-shadow` 而**不能**用 `drop-shadow` —— 后者是 `filter`，会废掉子级毛玻璃。
  唯一例外是 `.post-card-pop`（它在 `.glass-card` 之外，可以安全用 `drop-shadow`）。

## 6. 滚动条与滚动锁定

```css
::-webkit-scrollbar { width:6px; height:6px }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius:3px }
::-webkit-scrollbar-track { background: transparent }
```
`.modal-content` 的滚动条 thumb 特别做成 lime 竖向渐变，hover 加深。
模态打开时给 `body` 加 `.modal-open`：`overflow:hidden; touch-action:none`。

## 7. 头像交互

- `.avatar-breathe`：`avatarGlow 3s ease-in-out infinite`，粉色 `rgba(228,154,195,*)` 光环
  在 `0 0 0 3px / 12px` ↔ `0 0 0 5px / 24px` 之间呼吸。
- `.avatar-breathe:hover` / `.avatar-hover-effect:hover`：`scale(1.15) rotate(10deg)`，
  过渡 `0.5s cubic-bezier(0.34,1.56,0.64,1)`（回弹曲线）。

## 8. 移动端令牌下调（`@media (max-width: 640px)`）

`--card-spacing: 8px`、`--card-radius: 12px`；卡片文字整体缩一档
（标题 `1rem→0.75rem`、描述 `0.875rem→0.65rem`、`-webkit-line-clamp` 3→2）；
`.menu-button` 从 2rem 缩到 1.25rem；`.admin-badge` 字号降到 `0.5rem`。

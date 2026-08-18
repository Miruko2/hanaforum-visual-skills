# 07 · 个人中心 / 用户主页 / 收藏册 / 登录注册

## 1. 个人中心 `/profile`

相关文件：`app/profile/page.tsx`、`_components/profile-header.tsx`、`follow-stats.tsx`、
`my-posts.tsx`、`collection-archive.tsx`、`collection-postcard.tsx`、`avatar-crop-modal.tsx`

### `.profile-glass` 面板
```css
background: rgba(25,25,35,0.42); backdrop-filter: blur(22px) saturate(140%)
border: 1px solid rgba(255,255,255,0.12)
box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)
animation: blurFadeIn 1.6s cubic-bezier(0.23,1,0.32,1) both
```
`::before` 顶部细高光线（`left/right 10%`，白 0.22 中亮两端透）。
`:nth-child(2)` 加 `animation-delay: 0.15s` 做错落。
**这是全站「重量级入场」的基准**：1.6s 是站内最长的入场时长，其它地方（后台 1.2s、
友链 1s、归档 0.55s）都是在它基础上按内容密度缩短的。

### `.profile-menu-item` 菜单项 hover
```
默认：padding 1.1rem 2rem；overflow:hidden
hover：background rgba(255,255,255,0.06)；padding-left 2rem → 2.5rem（文字右移让位）
::before 左侧 3px lime 光条（#a3e635 + 12px 光晕），translateX(-100%) → 0
        缓动 0.3s cubic-bezier(0.34,1.56,0.64,1)（回弹）
.profile-menu-arrow：hover 时 translateX(4px) + 变亮
.danger::before：光条转红 #f87171
```

### 「我的帖子」标题条 `.mp-*`（绝区零式静态横幅）
呼应撕纸转场的美术语言，但**全部是「挂载后只跑一次」的入场**，无位移类常驻无限动画
（安卓安全）。玻璃底与 `.profile-glass` 同款。

| 类 | 效果 |
| --- | --- |
| `.mp-banner` | `mp-banner-in 0.6s`（`translateY(14px)` + 淡入）。`::before` 顶边高光线（`left/right 8%`） |
| `.mp-sheen` | 一次性高光扫掠：105° 白 0.13 斜条，`translateX(-130% → 130%)`，`1.1s cubic-bezier(0.4,0,0.2,1)` delay `0.4s` |
| `.mp-watermark` | 右侧镂空巨字水印，`5.5rem/900/italic`，`-webkit-text-stroke: 1.5px rgba(255,255,255,0.08)`，`mp-watermark-in 0.8s` 从右漂入 |
| `.mp-hazard` | 左侧 8px 宽 45° lime 斜纹条（`#a3e635`），`scaleY(0→1)` 纵向拉开，`0.5s` delay `0.25s` |
| `.mp-title` | 贴纸式硬投影（lime 双层 `0.03em`/`0.06em`）+ `clip-path: inset(0 100% 0 0)` 从左裁切滑入，`0.55s` delay `0.15s` |
| `.mp-fade-up` | 副标/角标轻微上移淡入，`0.45s ease-out` delay `0.42s` |
| `.mp-rec-dot` | 闪烁危险点，`mp-blink 1.8s steps(1,end) infinite`（纯 opacity，廉价常驻） |

`prefers-reduced-motion`：全部 `animation: none`，`.mp-sheen` 直接 `display:none`，
`.mp-title` 去 `clip-path`，`.mp-watermark` 保留居中 transform。

### 收藏夹 · 集邮册 `.stamp-archive`（`collection-archive.tsx`）
移植自 `public/stamp-archive-demo.html`（⚠️ 该原型文件已被删除，`collection-archive.tsx`
与 `globals.css` 里指向它的注释也已过期，别再去找）。**作用域全部收敛在 `.stamp-archive` 下**
——通用类名（`.folder` / `.back` / `.stamp` / `.front`）不会污染全局。

三态机：`预览(.open)` → `完全展开(.expanded)` → `焦点(.focused)`。
邮票数量任意，位置全靠内联 CSS 变量驱动：

| 变量 | 含义 |
| --- | --- |
| `--pvx/--pvy/--pvr` | 预览态扇位（仅前 3 张加 `.fan`，`.d1/.d2` 各加 0.05s/0.1s 延迟） |
| `--ex` | 展开态铺排列位（除第一张 `.pinned`） |
| `--fx` | 焦点态位移（落到收藏夹右侧、不被前脸遮挡） |
| `--scroll` | 整排横向滚动量 |
| `--closeP` | 关闭手势进度 0→1 |

尺寸与舞台：`.sa-stage` 固定 `540×530`、`transform-origin: top center` 居中等比缩放
（可放大 >1 倍填满更大弹窗，上限 1.4，见组件 `update()`）；`.sa-scale` 占满列宽并按缩放预留高度。
`touch-action: pan-y` 允许页面竖向滚动穿过展示台（横向浏览靠拖动手势自己接管）。

关键细节：
- `.folder` `perspective: 900px`，主过渡 `0.6s cubic-bezier(.22,1,.36,1)`。
  未展开时 hover 用**更慢更柔**的 `0.8s cubic-bezier(0.25,0.46,0.45,0.94)` 漂浮上去 `translateY(-12px)`
  （刻意不瞬间抬升）。`sa-bob` 是待机上下浮 7px。
- `.sa-shadow` 椭圆投影随状态变宽/消失，`filter: blur(2px)`。
- `.tray-clip`：仅完全展开时 `clip-path: inset(-600px -2000px -200px 0)` 把滚到收藏夹左缘以左的
  邮票裁掉 = 缩回口袋；**预览态不裁**（让邮票往上扇出顶部）。
- `.tray` 关闭手势期间整排往文件夹方向带 90px 并下沉 10px = 橡皮筋反馈
  （解决「推到底滚不动只剩第一张缩回」的发空死感）。
- `.stamp` 邮票齿孔用 **CSS mask**：四边各一条 `radial-gradient(6px ...)` 以 `17px` 步进平铺，
  `mask-composite: intersect`（webkit 用 `source-in`）。
- `.front` 文件夹前脸 = 半透明磨砂玻璃（`backdrop-filter: blur(12px) saturate(135%)`），
  比后背矮一截，邮票从它上沿探出，**固定不动不翻页**。
- 四种配色 `.c-amber/.c-pink/.c-ink/.c-lime`，各自定义 `--face/--dark/--glass/--label/--ink1/--ink2`；
  调色盘 `.sw-*` hover `scale(1.12)`，选中态用三层 `box-shadow` 描环。

### 哑光进度条 `.zzz-*`（`components/matte-progress.tsx`）
绝区零风「抠像进度条」：黑底荧光绿。
- `.zzz-stripes-layer`：45° 危险条纹，比父级各宽 24px，`zzz-stripes 0.6s linear infinite`
  靠 `transform: translateX(17px)`（一个条纹周期 ≈ 12px×√2）无缝循环
  —— **不用 `background-position`**（那会每帧重绘）。
- `.zzz-sweep`：不定态（无字节进度阶段）荧光段扫掠，`translateX(-130% → 300%)`，`1.15s`。
- `.zzz-dots`：省略号呼吸 `opacity 0.3↔1`，`0.9s`。
- `prefers-reduced-motion` 三条全关。

---

## 2. 用户主页 `/u/[username]` 与 `/user`

相关文件：`app/u/[username]/_components/profile-view.tsx`、
`app/user/_components/post-timeline.tsx`（897 行）、`profile-actions.tsx`

### 用户社交悬浮卡 `.glass-user-card`（`components/user-hover-card.tsx`）
Radix HoverCard，Portal 直挂 body → 祖先无 filter/opacity，`backdrop-filter` 能正常采样页面背景，
且入场的 opacity/transform 与毛玻璃在同一元素上（规范允许共存），不会「先透明后上玻璃」闪跳。

```css
background: rgba(20,20,28,0.55); backdrop-filter: blur(24px) saturate(150%)
box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 24px rgba(132,204,22,0.06),
            inset 0 1px 0 rgba(255,255,255,0.12)
[data-state="open"]   → glassUserCardIn  0.28s cubic-bezier(0.34,1.56,0.64,1) both
[data-state="closed"] → glassUserCardOut 0.15s ease-out both
transform-origin: var(--radix-hover-card-content-transform-origin, bottom left)
```
`glassUserCardIn`：`translateY(10px) scale(0.94)` → 过冲 `translateY(-2px) scale(1.01)` → 归位。

`.user-card-banner` 用 `mask-image: linear-gradient(to bottom, black 30%, rgba(0,0,0,0.35) 75%, transparent)`
让 banner 底部渐隐、直接融进玻璃，替代旧的「渐变到实色」硬接缝。

---

## 3. 登录 / 注册 / 忘记密码

相关文件：`app/login/page.tsx`、`app/register/page.tsx`、`app/forgot-password/page.tsx`、
`components/auth/login-card.tsx`、`login-form.tsx`、`register-form.tsx`、`dot-matrix-input.tsx`、
`components/email-verify-gate.tsx`

氛围：用 `.neon-marquee-soft`（更薄的灯箱、稀疏灯珠、小一号字、光晕收敛、**明确 `animation: none`
禁掉闪烁**）。可叠 `.neon-marquee-lime` 换成站点绿色调，`lime + soft` 组合另有一条更内敛的
`text-shadow`。详见 `08`。

### 点阵输入框 `.dmx-*`
5×7 绿色 LED 点阵字符显示（沿用验证码弹窗那套），外壳是站点一致的毛玻璃。
字模数据 `lib/dot-matrix-glyphs.ts`，组件 `components/auth/dot-matrix-input.tsx`。

```css
.dmx-box   min-height:50px; border-radius:12px; background: rgba(0,0,0,0.28)
           border: 1px solid rgba(255,255,255,0.12)
           --dot: 3px; --dotgap: 1px
.dmx-box.is-focus  border lime 0.7 + box-shadow 0 0 0 3px rgba(132,204,22,0.18)
.dmx-cell  grid 5列×7行 of var(--dot)
.dmx-cell span      灭珠 rgba(46,227,107,0.12)
.dmx-cell span.on   亮珠 #2ee36b + 0 0 3px 光晕
.dmx-cell.is-dim span.on   占位词的暗淡态（无光晕）
.dmx-cell.is-active span   光标格：dmxCellBlink 1s steps(1,end) infinite
```

- 真实 `<input>` `color: transparent; caret-color: transparent`，下层点阵实时显示所打字符。
- **尾部对齐**（终端式）：`.dmx-dm` `justify-content: flex-end` + `overflow:hidden`，
  超出窗口裁掉最旧字符（左侧），输入尾部与光标格恒可见。
- **浏览器自动填充必须特别处理**（已踩坑：autofill 后框内同时出现邮箱文字 + 头像）：
  ```css
  .dmx-input:-webkit-autofill { -webkit-text-fill-color: transparent !important;
                                transition: background-color 99999s ease-in-out 0s !important; }
  ```
  `color: transparent` 对 autofill 无效，必须用 `-webkit-text-fill-color`；
  `transition: background-color 99999s` 是经典 hack，拖住 autofill 的背景着色让玻璃底透出（黄底无法用普通 `background` 覆盖）。
- 命中本机账号时点阵替换为头像「欢迎回来」：`.dmx-avatar` + `dmxAvatarIn 0.35s`（`scale(0.7)` → 1），
  头像带绿描边 + 光晕。
- `.dmx-eye` 密码可见切换（lime 0.75，hover `#a3e635`）；`.dmx-cap` 等宽小字提示。
- `prefers-reduced-motion` 关掉光标闪烁与头像入场。

---

## 4. 家园 HUD 不在本 skill 范围

`app/globals.css` 末段的 `.mh-*`（角落开合按钮 / 展开面板 / 分区卡 / 标签页 / 列表行 / 按钮）
与 `.hsx-*`（好感度状态卡、斜纹血条、亮片点缀、等级徽章）**只作用于 `/home` 的 3D 家园 HUD**
（病娇 / 量产型甜酷风：粉 + 黑 + 暗紫），由 `app/home/_components/DecorPanel.tsx`、
`HomeStatus.tsx`、`HomeTutorial.tsx` 使用。它们写在全局静态样式表而非运行时 `<style>`，
是为了避免 `content: ""` 被 React 文本转义导致 hydration 报错。

改站内其它页面时**不要复用这两组前缀**。唯一值得借鉴的是它们的
`mh-blur-in` / `mh-blur-out` 进出场模式：**包壳只做 opacity，模糊动画下发给玻璃面板本体**
（同 `01` 的铁律），以及手机端降模糊半径 + 加深底色的策略。

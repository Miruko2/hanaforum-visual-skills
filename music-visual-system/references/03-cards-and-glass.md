# 03 · 音乐卡片与毛玻璃

源码：`app/music/_components/MusicCard.tsx`、`TrackCover.tsx`、
`components/music-play-button.tsx`、`app/globals.css` ≈2350 行。

卡片是「精简版 iOS 播放器卡」：封面 + 标题/艺术家 + 一行 prev / play / next / ♡，
没有进度条与音量条（完整控件在展开卡和底部播放器里）。

---

## 1. 两档毛玻璃（`/music` 在 globals.css 里的**全部**足迹）

```css
/* 桌面：满磨砂，全程不降级 */
.mw-glass {
  background: rgba(18, 20, 26, 0.22);
  backdrop-filter: blur(18px) saturate(1.5);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
}
/* 手机 / prefers-reduced-motion：浅模糊 */
.mw-glass-lite {
  background: rgba(18, 20, 26, 0.26);
  backdrop-filter: blur(6px) saturate(1.4);
  -webkit-backdrop-filter: blur(6px) saturate(1.4);
}
```

卡片本体是**无色半透明磨砂面板**，真 `backdrop-filter` 糊的是它身后那块**清晰的**
站点底图（`ImageBackdrop`，见 `05`）。按 `lite` 在 `MusicCard` 上二选一，**没有运行时切换**。

几条决策记录：

- **曾试过「拖动时摘掉磨砂」省性能，被否决** —— 视觉跳变太明显。玻璃要么一直在，要么一直不在。
- `.mw-glass-lite` 的浅模糊**仍然是 `backdrop-filter`**，仍每帧实时采样背景，
  省的只是高斯核那一部分（中等收益）。「复制背景 + 合成」的大头还在。
- 所以：**如果手机真机拖动仍然卡，把 `.mw-glass-lite` 改成 `backdrop-filter: none`
  + 提高 `background` 不透明度（纯色底）** —— 那才是数量级的省法，也是这一档唯一还剩的牌。
- 写成 CSS 类而不是 inline，是为了与代码库其他玻璃类保持一致、便于统一调。

⚠️ **`.mpb-eq-bar` 不是这一页的**。它是帖子里音乐分享卡的「正在播放」均衡器条
（`music-post-body.tsx` / `music-detail-player.tsx`），归 `site-visual-system`。
类名里的 `mpb` = music post body，不是 music player bar。

---

## 2. 卡片尺寸全部由宽度派生

卡片宽度随列宽变化（桌面单列 174 / 双列 354，移动 134 / 274，见 `02`），
所以内部一切尺寸都写成「宽度的比例 + clamp 上下限」，而不是固定值或断点：

```ts
pad         = clamp(round(w × 0.055),  8, 14)
coverRadius = clamp(pad + 2,           9, 14)
titleSize   = clamp(round(w × 0.092), 12, 16)
artistSize  = clamp(round(w × 0.072), 10, 13)
playSize    = clamp(round(w × 0.2),   30, 44)
playIcon    = round(playSize × 0.44)          // 闲置态三角
sideIcon    = clamp(round(w × 0.092), 14, 19) // prev / next / ♡
```

外层容器：`borderRadius: 20`、`padding: pad`、内部 `gap: pad - 2`。

## 3. 描边、内高光与投影配方

```ts
rim   = "0 0 0 1px rgba(255,255,255,0.45)"              // 发丝白描边（用 box-shadow 而非 border，不占布局）
gloss = "inset 0 1px 0 rgba(255,255,255,0.28)"          // 顶边内高光，lite 档去掉
boxShadow = 桌面 `0 18px 44px -16px rgba(0,0,0,0.55), ${rim}${gloss}`
            安卓 `0 8px 22px -10px rgba(0,0,0,0.5),  ${rim}${gloss}`

textShadow = "0 1px 3px rgba(0,0,0,0.7)"                 // 标题/艺术家，压任意封面底色
ctrlShadow = "drop-shadow(0 1px 2px rgba(0,0,0,0.6))"    // 三个图标按钮
封面瓦片    boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)"
```

- **安卓用更小的投影**：墙在拖动时投影区是要被反复过绘的，模糊半径越大越贵。
- **描边恒为中性白，正在播放也不染色**（明确的产品决定）。当前曲改由中间的播放主键指示。
- ⚠️ `MusicCard.tsx` 里那句「换成全站统一的毛玻璃描边圆钮，封面主色描边＝在放指示」
  **已过期**：`MusicPlayButton` 现在是**纯白填充三角、无边框无磨砂**（见下），
  `hue` 参数保留只为兼容旧调用，实际不再使用。

## 4. 容器上的几个必要类

```
mw-glass | mw-glass-lite      玻璃档位
absolute top-0 left-0         所有卡片都定位在原点，位置全靠 rAF 写 transform
opacity-0                     初始透明 —— 首帧 rAF 写入真实 opacity 前不要在原点闪一下
will-change-transform         提前提层
overflow-hidden               圆角裁封面
pointer-events-auto           Stage 父层是 none，卡片自己把命中测试打开（见 02 第 8 节）
```

inline 只写 `width` / `height` / `borderRadius` / `boxShadow` / `transform: translate3d(0,0,0)`。

---

## 5. 播放主键 `MusicPlayButton`（`components/music-play-button.tsx`）

全站统一的播放/暂停键，学苹果：**只有一个填充三角**（暂停 = 两条填充竖条），
**不要圆形边框、不要磨砂底**。白色填充 + `drop-shadow(0 1px 3px rgba(0,0,0,0.45))`，
保证在任意封面 / 深色面板上都看得清。

```
size 默认 44，图标 = iconSize ?? round(size × 0.62)
hover:scale-110  active:scale-95   （transition-transform）
```

> 因为它没有 `backdrop-filter`，安卓也没有鬼影顾虑 —— `drop-shadow` 可以放心用。

卡片上的两种状态：
- **当前曲** → `MusicPlayButton`（白色实心三角/暂停条）。
- **非当前曲** → 保持旧样式（半透白圆 `bg-white/20` + 白三角，hover `bg-white/30`、
  `active:scale-95`），`lite` 档去掉 `ctrlShadow`。

♡ 收藏态是 `text-rose-400` + `fill="currentColor"`。

---

## 6. 封面 `TrackCover`

一律**原生 `<img>` 直连封面 CDN**，不走 `next/image`：

- 歌单几百首 = 几百个独立源图，`next/image` 每张都烧一次 Vercel Image Optimization
  transformation（免费额度 5K/月，**已经爆过**）；网易自家 CDN 不限并发，直连零成本。
  顺带绕开 `remotePatterns` 白名单与服务端 fetch（SSRF 面）。
- **`loading="eager"`**：墙上卡片用 3D transform 定位，布局框全在原点，
  浏览器 lazy 的交叉判定在 `preserve-3d` 下不可靠，会漏加载部分封面 —— 一律 eager。
- **`referrerPolicy="no-referrer"`**：网易等 CDN 有防盗链，跨域带 referer 会 403。
- 网易封面把 injahow 跳转换成网易 CDN 直链（`neteaseDirectCover`）。
- 无封面 / 加载失败 → 占位音符 `Music2`（`bg-white/5` + `text-white/40`）。
- `track.cover` 变化时重置错误态，否则换歌后仍显示占位。

---

## 7. 点击 vs 拖动

卡片同时是「墙的一部分（可拖）」和「按钮（可点）」，判定写在 `MusicCard`：

```
pointerdown 记下 {x, y, t}
click 时：位移 > 5px 或 耗时 > 500ms  → 视为拖动/长按，不响应
        否则 → 未在播则 togglePlay，并把 getBoundingClientRect() 交给 onExpand
```

内部四个按钮全部 `onPointerDown={e => e.stopPropagation()}` + `onClick` 里 `stopPropagation`，
否则按在按钮上会同时开始平移墙面。

# 01 · 时序与状态机

转场的骨架。**任何视觉改动都可能撞上这里的时序假设**，改之前先读完本册。

## 1. 七个时序常量（`page-ribbon-transition.tsx` 顶部）

```ts
COVER_MS          = 400                    // 理论覆盖时长（黑主板 0.12s delay + 0.28s 动画）
COVER_FALLBACK_MS = COVER_MS + 500 = 900   // 覆盖阶段的兜底
MIN_HOLD_MS       = 440                    // 满屏后最短停留
REVEAL_MS         = 400                    // 三层依次扫出
REVEAL_FALLBACK_MS= REVEAL_MS + 500 = 900  // 揭开阶段的兜底
COMMIT_TIMEOUT_MS = 1500                   // 等新路由 commit 的上限
COOLDOWN_MS       = 安卓 480 / 其它 260     // 转场结束后的冷却
TEARDOWN_MS       = 180                    // 隐藏后到真正卸载的延迟
```

**`COVER_MS` / `REVEAL_MS` 与 CSS 强绑定**：三层扫屏是单层 `0.28s` + 级联延迟
`0s / 0.06s / 0.12s`，末层结束即 `0.12 + 0.28 = 0.4s`。改 CSS 的 `ptr-wipe-in/out`
时长或 delay，必须同步改这两个常量，否则兜底定时器会在动画没播完时抢跑。

**`MIN_HOLD_MS = 440` 不是装饰动画的预算，容易算错。** 两个时钟起点不同：

- 装饰动画的 `animation-delay` 从**遮罩挂载**（t=0）起算；
- `MIN_HOLD_MS` 从**满屏**（t=0.4s）起算，且是在 `proceedCover()` 里才 `setTimeout` 的。

所以揭开开始于 `t ≈ 0.4 + 0.44 = 0.84s`（还要加双 rAF 的约 2 帧）。
**加新装饰动画时按 0.84s 总预算算，不是 440ms。**

标题卡的逐字砸入落位时刻 `--ptr-land = 0.3 + (字数-1)*0.04 + 0.16`，
RGB 残影与镂空回声都从这一刻起跑（各 0.22s / 0.24s）。实际几张卡：

| 卡 | 字数 | 落位 `--ptr-land` | 回声演完 | 相对 0.84s |
| --- | --- | --- | --- | --- |
| HOME / ROOM | 4 | 0.58s | 0.82s | 刚好演完 |
| MUSIC | 5 | 0.62s | 0.86s | 尾巴压线 |
| CINEMA | 6 | 0.66s | 0.90s | 尾部 60ms 落在扫出期 |
| DANMAKU / PROFILE | 7 | 0.70s | 0.94s | 尾部 100ms 落在扫出期 |

尾部压进扫出期不算 bug——此时主板正在平移出屏，回声跟着一起走，观感是「边撤边收尾」。
但**再长的词就会明显被截断**：超过 8 个字母时应当缩短单字延迟（`0.04s`）而不是拉长
`MIN_HOLD_MS`，后者会让整个转场变拖沓。

## 2. 状态机

`ActiveState.phase` 只有三个值，驱动 `.ptr-root[data-phase]`：

```
null（空闲）
  │  start(href, dir)
  ▼
"cover"  ── 三层扫入 ─→ 黑主板 animationend("ptr-wipe-in") ─→ proceedCover()
  │                        │
  │                        ├─ router.push(目标)
  │                        ├─ 等 Promise.all([路由 commit, MIN_HOLD_MS])
  │                        └─ 双 rAF（等新页面首绘）
  ▼
"reveal" ── 三层扫出 ─→ 粉层 animationend("ptr-wipe-out") ─→ finishReveal()
  ▼
"idle"   ── 层已全部扫出屏外，视觉零变化，此时只隐藏根节点
  │  TEARDOWN_MS(180ms) 后 setActive(null) = 真正卸载内容
  │  COOLDOWN_MS 后 runningRef = false = 接受下一次转场
  ▼
null
```

**为什么 `idle` 要单独存在**：如果在揭开结束的同一帧就整树卸载，会和「新页面安顿」
抢同一批帧。连续快滑时这是安卓闪屏/鬼影的诱因之一。拆成「先隐藏（廉价）→
冷却期中段再卸载（昂贵）」两步，把开销挪出关键帧。

## 3. 为什么用 `animationend` 而不是定时器

**这是本套转场最重要的一条纪律。**

主线程繁忙时（连续快滑、新页面正在水合）CSS 动画的**实际起跑时刻会晚于** JS 定时器
的计时起点。若用 `setTimeout(COVER_MS)` 准点换页，屏幕可能还没被遮严就执行了
`router.push` → 用户直接看到换页瞬间 = 概率性闪屏，安卓最明显。

所以：

```tsx
// 黑主板扫入最晚结束（0.12s delay）= 屏幕真正遮严，此刻才换页
<div className="ptr-wipe ptr-wipe-main"
  onAnimationEnd={(e) => { if (e.animationName === "ptr-wipe-in") proceedCover() }}>

// 粉层扫出最晚结束（0.12s delay）= 整组揭开完成
<div className="ptr-wipe ptr-wipe-a"
  onAnimationEnd={(e) => { if (e.animationName === "ptr-wipe-out") finishReveal() }}>
```

⚠️ **必须按 `e.animationName` 过滤**：子元素（标题字母、绶带淡入…）的
`animationend` 会冒泡到这两个节点上，不过滤会被提前触发几十次。

⚠️ 监听器挂在**级联最末**的那一层：扫入时是黑主板（delay 0.12s），
扫出时是粉层（delay 0.12s）。挂错层会早 120ms 推进。

定时器只做兜底（`COVER_FALLBACK_MS` / `REVEAL_FALLBACK_MS` = 动画时长 + 500ms），
覆盖「页面切后台导致 `animationend` 永不触发」这类情况。

## 4. 幂等与代际作废

三个 ref 各管一件事：

```ts
runningRef   // 转场进行中（含冷却）。start() 开头判它，防重复触发
coveredRef   // proceedCover 只跑一次（animationend 与兜底定时器谁先到谁推进）
revealedRef  // finishReveal 只跑一次
genRef       // 转场代际
```

**代际（`genRef`）解决的是过期定时器打进下一次转场**：兜底定时器可能比
「动画正常结束 + 冷却」更晚触发。若不校验，一个上一程遗留的
`REVEAL_FALLBACK` 定时器会把刚开始的新覆盖层中途卸载。所以每次 `start()`
自增代际，定时器回调里比对：

```ts
const gen = ++genRef.current
setTimeout(() => { if (gen === genRef.current) proceedCover() }, COVER_FALLBACK_MS)
```

所有 `setTimeout` 句柄都推进 `timersRef`，组件卸载时统一清理。

## 5. 换页那一刻做的四件事

`proceedCover()` 里按顺序：

1. **翻译虚拟环位**：`"/cinema"` 不是真路由，落成 `push("/") + setCinemaMode(true)`；
   去首页则显式 `setCinemaMode(false)`。详见 `05` §3。
2. **判断是否同路由**：已在首页时进出影院没有路由变化，跳过 commit 等待
   （否则白等 1.5s 超时），视图切换由 React 状态驱动。
3. **并行等两件事**：`Promise.all([路由 commit（超时 1.5s 兜底）, MIN_HOLD_MS 停留])`。
4. **双 `requestAnimationFrame`** 再进入 reveal —— 让新页面在遮罩背后完成首绘，
   否则揭开时会露出还没画完的底。

```ts
requestAnimationFrame(() => requestAnimationFrame(() => {
  setActive(cur => cur ? { ...cur, phase: "reveal" } : cur)
}))
```

## 6. 路由 commit 的通知链

遮罩不知道 Next.js 什么时候真的换好了页，靠一个模块级的一次性回调：

```
page-ribbon-transition   →  waitForRouteCommit(1500)   （lib/view-transition-nav.ts）
                                   ↓ 存下 pendingResolve
page-transition.tsx  在 pathname 变化的 layout effect 里
                         →  notifyRouteCommitted()      ↑ 放行
```

`components/page-transition.tsx` 整个组件只有 26 行，唯一职责就是这个通知。
超时会自行放行（`setTimeout(finish, timeoutMs)`），慢网不至于卡死转场。

## 7. 冷却期的行为

冷却期内的新触发**静默忽略**（`runningRef.current` 为真直接 return），
不排队、不叠加 —— 排队会让用户连滑三下后看着三段转场依次播完，比丢掉更糟。

冷却时长安卓 480ms、其它 260ms。安卓更长是因为 WebView 合成器回收慢，
上一程图层还没释放就叠下一程会出鬼影。

## 8. 改时序的检查清单

- [ ] 改了 CSS 的 `ptr-wipe-in/out` 时长或 delay → 同步 `COVER_MS` / `REVEAL_MS`
- [ ] 加了新的入场动画 → 确认 `delay + duration` 落在 0.84s 总预算内（见 §1）
- [ ] 新增 `setTimeout` → 推进 `timersRef`，且回调里校验 `gen === genRef.current`
- [ ] 新增 `animationend` 监听 → 按 `e.animationName` 过滤，确认挂在级联最末层
- [ ] 改了 `MIN_HOLD_MS` → 回头看标题卡入场链会不会被截断（`03` §5）

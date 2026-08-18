# 04 · 路由转场（已迁出）

站内**实际在跑的只有一套**：绝区零式撕纸遮罩。整套文档、时序状态机、安卓对策、
以及可复制套件都已经迁到独立 skill **`page-transition-system`**。

本册只留指路，**不要再读这里找实现细节**。

## 去哪读

| 想做什么 | 读 |
| --- | --- |
| 转场卡住 / 闪屏 / 改时序 | `page-transition-system` 的 `01` |
| 改扫屏层、斜角、主题色 | `page-transition-system` 的 `02` |
| 改装饰层 / 给新页面加转场卡 | `page-transition-system` 的 `03` |
| 安卓花屏 | `page-transition-system` 的 `04` |
| 手势、导航环、哪些页能滑 | `page-transition-system` 的 `05` |
| 在别的项目复刻 | `page-transition-system/assets/` |

## 还在本 skill 的相关项

- 左右滑页手势的**入口**仍挂在 `components/page-swipe.tsx`，细节看新 skill 的 `05`
- 导航栏点击走同一条 `navigateWithTransition`，见 `05-navigation-overlays.md` §1
- View Transitions 立方体翻页是**休眠备选**：`TRANSITION_MODE = "ribbon"`，
  代码还在但够不到。原因与切回方法见新 skill 的 `05` §4

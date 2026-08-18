# hanako visual skills

两个给 AI 编码代理用的视觉系统 skill，描述 [hanaforum](https://github.com/Miruko2/hanaforum)
这个站点的 UI 与动效体系，并附带可以脱离该站点直接使用的成品代码。

| Skill | 覆盖范围 | 体量 |
| --- | --- | --- |
| `site-visual-system/` | 站点除 3D 家园与音乐页之外的全部页面：设计令牌、十一档毛玻璃、关键帧库、逐页效果目录、平台降级 | 12 篇文档 + 11 个成品文件 |
| `music-visual-system/` | 音乐页 `/music`：3D 鱼眼卡片墙、播放器一家、音频可视化、独立的性能预算 | 9 篇文档 + 5 个成品文件 |

两个 skill 的 `SKILL.md` 开头都有**按需读取路由表**，可以精确定位到某一册的某一节，
不必通读。`site-visual-system` 另外有一张覆盖全部效果的索引。

## 怎么用

把本仓库克隆到代理会读的 skills 目录：

```bash
REPO=https://github.com/Miruko2/hanaforum-visual-skills.git

git clone $REPO .kiro/skills                        # Kiro / 本项目约定
git clone $REPO ~/.cursor/skills/hanaforum-visual   # Cursor（用户级）
git clone $REPO .claude/skills                      # Claude Code（项目级）
```

⚠️ 克隆到站点仓库的 `.kiro/skills` 下时不会互相干扰：站点的 `.gitignore` 把整个 `.kiro/`
排除了，两个 git 仓库物理嵌套但各管各的。

只想要成品代码、不关心文档的，直接拿两个 `assets/` 目录：
`site-visual-system/assets/`（毛玻璃 + 高斯模糊动效套件，纯 CSS + 8 个零依赖 React 组件）、
`music-visual-system/assets/`（3D 鱼眼卡片墙）。各自带自包含的 `demo.html`，双击即开。

## 与站点仓库的关系，以及文档为什么不会烂

`references/01-09` 是**站点源码的索引与决策记录**，里面引用了大量类名、关键帧名、组件路径。
站点改一次名，这里就烂一处，而且是静默的。三道防线：

**1. 不写行号，只写符号。** 行号每次编辑都漂，选择器名和组件路径不会。全仓库没有一处
「`globals.css` 第 328 行」，只有「搜 `.glass-card`」。

**2. 校验脚本。** 把文档里所有被反引号包起来的源码路径与 CSS 类名抽出来，去站点仓库里核实：

```bash
node scripts/check-refs.mjs                       # 站点按默认位置找（本仓库在 .kiro/skills 下时即 ../..）
node scripts/check-refs.mjs --site ../hanaforum   # 显式指定
```

目前盯着 276 处引用。改完站点跑一次，新增的失联项就是待修的文档。

**3. 基线。** `scripts/known-external.txt` 记录「本来就查不到」的符号——套件自成一套命名，
站点那边多是 Tailwind 工具类，两边对不上是正常的。基线之外的失联才是真腐烂。
确认某项是误报就跑 `--update-baseline` 收进去，**并顺手写上理由**（现有条目都有注释）。

**基准**：本仓库首次提交时对应 hanaforum `3bd71bb`（2026-08-18）。
每次跑通校验后建议更新这一行。

## 目录

```
site-visual-system/
  SKILL.md              总纲 + 两张按需读取路由表
  TODO.md               改动与修复记录
  references/01-11.md   分册（01-09 索引站点源码，10 接入指南，11 自包含配方）
  assets/               可直接复制的成品：glass-kit.css + 8 个组件 + demo.html + LICENSE
music-visual-system/
  SKILL.md
  references/01-08.md
  assets/               鱼眼墙：数学核心 + React 封装 + CSS + demo.html
scripts/
  check-refs.mjs        引用校验
  known-external.txt    基线（附理由）
```

## 授权

`site-visual-system/assets/` 下有一份 MIT LICENSE（署名处待填）。
`references/` 是针对特定私有站点的内部记录，未做对外授权声明。

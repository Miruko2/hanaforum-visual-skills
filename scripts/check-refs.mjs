#!/usr/bin/env node
/**
 * 引用校验：确认 skill 文档里提到的源码路径、CSS 类名、以及仓库内部链接都还活着。
 *
 * 本仓库与被它描述的站点仓库（hanaforum）是两个 git 仓库，文档会随源码改动而腐烂。
 * 这个脚本把「腐烂」变成一条可以跑的命令。
 *
 *   node scripts/check-refs.mjs                       # 站点仓库按默认位置找（见下）
 *   node scripts/check-refs.mjs --site ../hanaforum   # 显式指定
 *   node scripts/check-refs.mjs --update-baseline     # 认可当前所有失联项，重写基线
 *
 * 默认站点位置：本仓库若被克隆到站点的 .kiro/skills 下，站点根就是 ../..。
 *
 * 基线（scripts/known-external.txt）的意义：套件专有的类名（.fw-card、.enter-slow 等）
 * 本来就不存在于站点里，它们不是腐烂。首次运行把这些收进基线，之后**新增**的失联项
 * 才是真的漂移。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const siteArg = args[args.indexOf("--site") + 1]
const siteRoot = path.resolve(
  repoRoot,
  args.includes("--site") && siteArg ? siteArg : "../..",
)
const updateBaseline = args.includes("--update-baseline")
const baselinePath = path.join(repoRoot, "scripts", "known-external.txt")

// 站点里值得扫的源码目录。node_modules / .next / out 之类一律不进
const SITE_DIRS = ["app", "components", "lib", "hooks", "contexts", "styles", "types", "config", "scripts"]
const SITE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".html"])
// 只用于「路径存在性」判断，不读内容
const SITE_PATH_DIRS = [...SITE_DIRS, "public", "supabase"]

function walk(dir, filter, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, filter, out)
    else if (filter(p)) out.push(p)
  }
  return out
}

// ── 1. 把站点源码拼成一大坨，供类名做存在性判断 ────────────────────────────
const siteFiles = SITE_DIRS.flatMap((d) =>
  walk(path.join(siteRoot, d), (p) => SITE_EXT.has(path.extname(p))),
)
if (siteFiles.length === 0) {
  console.error(`找不到站点源码。试过：${siteRoot}`)
  console.error("用 --site <路径> 指定 hanaforum 的仓库根目录。")
  process.exit(2)
}
const siteBlob = siteFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n")

// 全量路径表：文档常用「相对某个页面目录」的简写（如 _lib/useIsAndroid.ts），
// 所以路径判断除了精确命中，还允许后缀命中。
const sitePaths = SITE_PATH_DIRS.flatMap((d) => walk(path.join(siteRoot, d), () => true)).map((p) =>
  path.relative(siteRoot, p).replace(/\\/g, "/"),
)
// 也认本仓库自己的文件：scripts/ 这类目录两边都有，只要有一边存在就不算失联
const pathExists = (t) =>
  fs.existsSync(path.join(siteRoot, t)) ||
  fs.existsSync(path.join(repoRoot, t)) ||
  sitePaths.some((p) => p.endsWith("/" + t))

// ── 2. 扫本仓库的所有 md，抽出三类引用 ──────────────────────────────────────
const docs = walk(repoRoot, (p) => p.endsWith(".md"))
const PATH_RE = /^[A-Za-z0-9_@./-]+\.(tsx?|jsx?|css|json|html|mjs)$/
const CLASS_RE = /^\.[a-z][a-z0-9-]*$/

/** @type {Map<string, {kind: string, where: Set<string>}>} */
const found = new Map()
const add = (token, kind, where) => {
  const key = `${kind}\t${token}`
  if (!found.has(key)) found.set(key, { kind, token, where: new Set() })
  found.get(key).where.add(where)
}

for (const doc of docs) {
  const rel = path.relative(repoRoot, doc).replace(/\\/g, "/")
  // 该 md 属于哪个 skill（用于解析 assets/… 这类相对写法）
  const skillDir = rel.split("/")[0]
  const text = fs.readFileSync(doc, "utf8")

  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].trim()
    if (t.includes(" ")) continue

    if (PATH_RE.test(t) && t.includes("/")) {
      // 仓库内部资源：assets/… references/… ../assets/…
      if (/^\.\.?\//.test(t) || t.startsWith("assets/") || t.startsWith("references/")) {
        const base = /^\.\.?\//.test(t) ? path.dirname(doc) : path.join(repoRoot, skillDir)
        add(path.relative(repoRoot, path.resolve(base, t)).replace(/\\/g, "/"), "internal", rel)
      } else if (!t.startsWith(".kiro/")) {
        add(t, "site-path", rel)
      }
    } else if (CLASS_RE.test(t) && t.length > 3 && !fs.existsSync(path.join(siteRoot, t))) {
      // 排除 .gitignore / .env 这类「点开头的文件名」被误当成类名
      add(t, "css-class", rel)
    }
  }
}

// ── 3. 判定 ────────────────────────────────────────────────────────────────
const failures = []
for (const { kind, token, where } of found.values()) {
  let ok
  if (kind === "internal") ok = fs.existsSync(path.join(repoRoot, token))
  else if (kind === "site-path") ok = pathExists(token)
  else ok = siteBlob.includes(token)
  if (!ok) failures.push({ kind, token, where: [...where].sort() })
}
failures.sort((a, b) => (a.kind + a.token).localeCompare(b.kind + b.token))

// ── 4. 与基线比对 ──────────────────────────────────────────────────────────
const baseline = new Set(
  fs.existsSync(baselinePath)
    ? fs
        .readFileSync(baselinePath, "utf8")
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*$/, "").trim())
        .filter(Boolean)
    : [],
)

if (updateBaseline) {
  const header = [
    "# 已知的「站点里查不到」清单 —— 由 check-refs.mjs --update-baseline 生成。",
    "# 绝大多数是套件专有的类名（assets/ 里自成一套，站点不用），不是文档腐烂。",
    "# 格式：类型<TAB>符号。手工删掉某行 = 要求脚本重新盯住它。",
    "",
  ]
  fs.writeFileSync(
    baselinePath,
    header.concat(failures.map((f) => `${f.kind}\t${f.token}`)).join("\n") + "\n",
    "utf8",
  )
  console.log(`基线已更新：${failures.length} 项`)
  process.exit(0)
}

const fresh = failures.filter((f) => !baseline.has(`${f.kind}\t${f.token}`))

console.log(`站点：${siteRoot}`)
console.log(`扫描：${docs.length} 篇文档 / ${siteFiles.length} 个源码文件`)
console.log(`引用：${found.size} 处，失联 ${failures.length} 处（其中 ${baseline.size} 处在基线内）`)

if (fresh.length === 0) {
  console.log("\n没有新的失联引用。")
  process.exit(0)
}

const label = { "site-path": "站点文件不存在", "css-class": "站点里搜不到这个类名", internal: "仓库内部链接断了" }
console.log(`\n发现 ${fresh.length} 处新失联 —— 多半是源码改名/删除后文档没跟上：\n`)
for (const f of fresh) {
  console.log(`  [${label[f.kind]}] ${f.token}`)
  console.log(`      被引用于：${f.where.join("、")}`)
}
console.log("\n确认是误报（比如套件专有类名）就跑 --update-baseline 收进基线。")
process.exit(1)

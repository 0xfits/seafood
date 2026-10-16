#!/usr/bin/env bash
# v1.19 §21 · AC-1（四入口保全 + href 一字不改 + T105 判据单一真源）与
#            AC-6（结构不变式：零新 data-sf-region / 零新 token / shell.css 一字不动 / 日夜间构）
# 源码面读数采集器 —— 逐条落 `grep -n` 命令字面 + 行号 + 原始输出（txt）与结构化布尔（json）。
# 用法：bash ops/v119-msg-panel/readings/collect-ac-source.sh [repoRoot]
set -u
ROOT="${1:-/Users/kevin/bistro/seafood}"
R="$ROOT/ops/v119-msg-panel/readings"
TXT1="$R/ac-1.txt"; TXT6="$R/ac-6.txt"
J1="$R/ac-1.json"; J6="$R/ac-6.json"
mkdir -p "$R"
cd "$ROOT" || exit 1

: > "$TXT1"; : > "$TXT6"
sec() { printf '\n$ %s\n' "$1"; }
run() { printf '\n$ %s\n' "$1" >> "$2"; }

# ───────────────────────────── AC-1 ─────────────────────────────
{
  echo "# AC-1 源码面读数 · 四入口保全 + href 一字不改 + T105 判据单一真源"
  echo "# 仓 = $ROOT · HEAD = $(git rev-parse --short HEAD) · 采集时间 = $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$TXT1"

run 'grep -n "messages" frontend/src/shell/nav.js' "$TXT1";      grep -n 'messages' frontend/src/shell/nav.js      >> "$TXT1" 2>&1
run 'grep -n "messages" frontend/src/shell/FloatingMenu.jsx' "$TXT1"; grep -n 'messages' frontend/src/shell/FloatingMenu.jsx >> "$TXT1" 2>&1
run 'grep -n "withPanelParams\|openConversation" frontend/src/pages/item/ItemDetailPage.jsx' "$TXT1"; grep -n 'withPanelParams\|openConversation' frontend/src/pages/item/ItemDetailPage.jsx >> "$TXT1" 2>&1
run 'grep -n "site}/messages" backend-ts/src/messages-service.ts' "$TXT1"; grep -n 'site}/messages' backend-ts/src/messages-service.ts >> "$TXT1" 2>&1
run 'grep -rn "isMessagesPanelOpen" frontend/src --include=*.js --include=*.jsx' "$TXT1"; grep -rn 'isMessagesPanelOpen' frontend/src --include=*.js --include=*.jsx >> "$TXT1" 2>&1
run 'grep -rn "matchMedia\|innerWidth\|innerHeight\|clientWidth\|offsetWidth\|screen.width" frontend/src/shell/*.js frontend/src/shell/*.jsx' "$TXT1"
grep -rn 'matchMedia\|innerWidth\|innerHeight\|clientWidth\|offsetWidth\|screen.width' frontend/src/shell/*.js frontend/src/shell/*.jsx >> "$TXT1" 2>&1 || true
run "grep -cE '<Route' frontend/src/App.jsx" "$TXT1"; grep -cE '<Route' frontend/src/App.jsx >> "$TXT1" 2>&1
run "grep -oE '<Route[ >]' frontend/src/App.jsx | wc -l" "$TXT1"; grep -oE '<Route[ >]' frontend/src/App.jsx | wc -l >> "$TXT1" 2>&1
run "grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts" "$TXT1"; grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts >> "$TXT1" 2>&1
run "grep -n 'path=\"messages\"\|import MessagesPage' frontend/src/App.jsx" "$TXT1"; grep -n 'path="messages"\|import MessagesPage' frontend/src/App.jsx >> "$TXT1" 2>&1
run "grep -rn 'data-sf-nav=\"messages\"' frontend/src/shell/BottomTabBar.jsx frontend/src/shell/FloatingMenu.jsx" "$TXT1"
grep -rn 'messages' frontend/src/shell/BottomTabBar.jsx | grep -n 'onTabClick\|item.key' >> "$TXT1" 2>&1 || true

# ───────────────────────────── AC-6 ─────────────────────────────
{
  echo "# AC-6 源码面读数 · 结构不变式（零新 data-sf-region / 零新 token / shell.css 一字不动 / 日夜间构）"
  echo "# 仓 = $ROOT · HEAD = $(git rev-parse --short HEAD) · 采集时间 = $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$TXT6"

run "grep -n 'data-sf-region=' frontend/src/shell/MessagesPanel.jsx" "$TXT6"; grep -n 'data-sf-region=' frontend/src/shell/MessagesPanel.jsx >> "$TXT6" 2>&1 || echo '(0 命中)' >> "$TXT6"
run "grep -c 'data-sf-region=' frontend/src/shell/MessagesPanel.jsx" "$TXT6"; grep -c 'data-sf-region=' frontend/src/shell/MessagesPanel.jsx >> "$TXT6" 2>&1 || echo 0 >> "$TXT6"
run "grep -n 'data-sf-region' frontend/src/shell/messages-panel.css   # 注释里的词亦列出（判据只看属性形态 data-sf-region=）" "$TXT6"
grep -n 'data-sf-region' frontend/src/shell/messages-panel.css >> "$TXT6" 2>&1 || echo '(0 命中)' >> "$TXT6"
run "grep -c 'data-sf-region=' frontend/src/shell/messages-panel.css" "$TXT6"; grep -c 'data-sf-region=' frontend/src/shell/messages-panel.css >> "$TXT6" 2>&1 || echo 0 >> "$TXT6"
run "grep -n 'data-sf-m' frontend/src/shell/MessagesPanel.jsx | wc -l" "$TXT6"; grep -c 'data-sf-m' frontend/src/shell/MessagesPanel.jsx >> "$TXT6" 2>&1
run "git diff --numstat -- frontend/src/theme frontend/src/theme-tokens.css frontend/src/shell/tokens.js" "$TXT6"
git diff --numstat -- frontend/src/theme frontend/src/theme-tokens.css frontend/src/shell/tokens.js >> "$TXT6" 2>&1
run "git diff --numstat -- frontend/src/shell/shell.css" "$TXT6"; git diff --numstat -- frontend/src/shell/shell.css >> "$TXT6" 2>&1
run "shasum -a 256 frontend/src/shell/shell.css ; git show HEAD:frontend/src/shell/shell.css | shasum -a 256" "$TXT6"
shasum -a 256 frontend/src/shell/shell.css >> "$TXT6" 2>&1
git show HEAD:frontend/src/shell/shell.css | shasum -a 256 >> "$TXT6" 2>&1
run "grep -c '@media' frontend/src/shell/shell.css" "$TXT6"; grep -c '@media' frontend/src/shell/shell.css >> "$TXT6" 2>&1
run "grep -n '767px' frontend/src/shell/shell.css" "$TXT6"; grep -n '767px' frontend/src/shell/shell.css >> "$TXT6" 2>&1
run "grep -c '\[data-theme' frontend/src/shell/shell.css" "$TXT6"; grep -c '\[data-theme' frontend/src/shell/shell.css >> "$TXT6" 2>&1 || echo 0 >> "$TXT6"
run "git status --porcelain frontend/src/shell/messages-panel.css" "$TXT6"; git status --porcelain frontend/src/shell/messages-panel.css >> "$TXT6" 2>&1
run "git status --porcelain frontend/src/theme frontend/src/shell/shell.css frontend/src/styles.css frontend/src/shell/tokens.js" "$TXT6"
git status --porcelain frontend/src/theme frontend/src/shell/shell.css frontend/src/styles.css frontend/src/shell/tokens.js >> "$TXT6" 2>&1
run "grep -c 'data-sf-region' frontend/src/shell/BottomTabBar.jsx frontend/src/shell/FloatingMenu.jsx" "$TXT6"
grep -c 'data-sf-region' frontend/src/shell/BottomTabBar.jsx frontend/src/shell/FloatingMenu.jsx >> "$TXT6" 2>&1

# ───────────────────── 结构化 JSON（判据布尔） ─────────────────────
node - "$ROOT" "$J1" "$J6" <<'NODE'
const fs = require('fs'); const cp = require('child_process'); const crypto = require('crypto')
const [ROOT, J1, J6] = process.argv.slice(2)
const sh = (c) => cp.execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim()
const grepN = (pat, file) => { try { return sh(`grep -nE ${JSON.stringify(pat)} ${file}`).split('\n') } catch { return [] } }
const grepC = (pat, file) => { try { return Number(sh(`grep -cE ${JSON.stringify(pat)} ${file}`)) } catch { return 0 } }
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const head = sh('git rev-parse HEAD'); const headShort = sh('git rev-parse --short HEAD')

const navMsgs = grepN('messages', 'frontend/src/shell/nav.js')
const fmMsgs = grepN('messages', 'frontend/src/shell/FloatingMenu.jsx')
const detail = grepN('withPanelParams|openConversation', 'frontend/src/pages/item/ItemDetailPage.jsx')
const tg = grepN('site}/messages', 'backend-ts/src/messages-service.ts')
const singleSource = grepN('isMessagesPanelOpen', 'frontend/src/shell/AppShell.jsx')
  .concat(grepN('isMessagesPanelOpen', 'frontend/src/shell/MessagesPanel.jsx'))
const widthWordsInShellJs = (() => { try { return sh("grep -rnE 'matchMedia|innerWidth|innerHeight|clientWidth|offsetWidth|screen\\.width' frontend/src/shell/*.js frontend/src/shell/*.jsx || true") } catch { return '' } })()

const ac1 = {
  spec: 'docs/design/design-system.spec.md v1.19 §21.8 AC-1（四入口不减 / href 一字不改）',
  head, headShort, collectedAt: new Date().toISOString(),
  entry1_tabbar_href: {
    anchor: 'theme-shell-isomorphism.test.jsx:97 · tabHrefs 含 /messages',
    navJsLines: navMsgs, grep: 'grep -nE "messages" frontend/src/shell/nav.js',
    pass: navMsgs.some((l) => /key: 'messages'.*path: '\/?messages'/.test(l)),
    note: '单一真源 nav.js ⇒ navPathInLang 产出 `/messages`（zh）/ `/en/messages`；BottomTabBar 的 onClick 只 preventDefault（不改 href）',
    runtimeHref: 'geometry.json → entryWiring.tabBefore.href（现取）',
  },
  entry2_floatmenu_href: {
    anchor: 'v15-nav-floatmenu.test.jsx:138 / :149',
    lines: fmMsgs.filter((l) => /key: 'messages'.*path: '\/?messages'/.test(l)),
    pass: fmMsgs.some((l) => /key: 'messages'.*path: '\/?messages'/.test(l)),
    runtimeHref: 'geometry.json → entryWiring.floatMenuBefore.href = /messages（现取）',
  },
  entry3_itemdetail_chat: {
    anchor: 'ItemDetailPage.jsx:157 现取 = navigate(`/messages?c=`；**本单口径外延 ①** ⇒ 已改就地叠加 withPanelParams(location, id)',
    lines: detail, pass: detail.some((l) => l.includes('withPanelParams')),
    drift: '规范 AC-1③ 字面「navigate 字面含 /messages?c=」已被 Zang 2026-10-16 裁定「方案 1 · 就地叠加」取代（§21.11 Q4 已裁）⇒ 待 Jing 勘误级补登；其 toContain(\'/messages?c=\') 型锚不得采用',
  },
  entry4_telegram_notification: { anchor: 'messages-service.ts:717 / :718', lines: tg, pass: tg.length >= 2 },
  t105_single_source: {
    predicateDef: 'frontend/src/shell/messages-panel-routing.js:24 isMessagesPanelOpen',
    consumers: singleSource.map((l) => l.split(':')[0]), pass: singleSource.length >= 2,
    shellJsZeroWidthWords: widthWordsInShellJs === '', widthWordsOutput: widthWordsInShellJs,
  },
  routeCounts: {
    frontendRouteLiteral: grepC('<Route', 'frontend/src/App.jsx'),
    frontendRouteExact: Number(sh("grep -oE '<Route[ >]' frontend/src/App.jsx | wc -l")),
    backendRegistrations: grepC('^app\\.(get|post|put|delete|patch)\\(', 'backend-ts/src/index.ts'),
    appJsMessagesRoute: grepN('path="messages"', 'frontend/src/App.jsx'),
  },
}
fs.writeFileSync(J1, JSON.stringify(ac1, null, 2))

const shellCssDiff = (() => { try { return sh('git diff --numstat -- frontend/src/shell/shell.css') } catch { return '' } })()
const themeDiff = (() => { try { return sh('git diff --numstat -- frontend/src/theme frontend/src/theme-tokens.css frontend/src/shell/tokens.js') } catch { return '' } })()
const shellCssWorktree = sha(fs.readFileSync(`${ROOT}/frontend/src/shell/shell.css`))
const shellCssHead = sha(cp.execFileSync('git', ['show', 'HEAD:frontend/src/shell/shell.css'], { cwd: ROOT }))
const ac6 = {
  spec: 'docs/design/design-system.spec.md v1.19 §21.8 AC-6（结构不变式）',
  head, headShort, collectedAt: new Date().toISOString(),
  zeroNewRegion: {
    'MessagesPanel.jsx `data-sf-region=` 属性命中': grepC('data-sf-region=', 'frontend/src/shell/MessagesPanel.jsx'),
    'messages-panel.css `data-sf-region=` 属性命中': grepC('data-sf-region=', 'frontend/src/shell/messages-panel.css'),
    'MessagesPanel.jsx 注释中提到该词的行': grepN('data-sf-region', 'frontend/src/shell/MessagesPanel.jsx'),
    'messages-panel.css 注释中提到该词的行': grepN('data-sf-region', 'frontend/src/shell/messages-panel.css'),
    'MessagesPanel.jsx `data-sf-m` 命中数': grepC('data-sf-m', 'frontend/src/shell/MessagesPanel.jsx'),
    pass: grepC('data-sf-region=', 'frontend/src/shell/MessagesPanel.jsx') === 0 && grepC('data-sf-region=', 'frontend/src/shell/messages-panel.css') === 0,
    note: '判据 = **属性形态** `data-sf-region=`（注释里出现该词不算，且实现侧注释本身就是在自我约束「不得新增」）',
  },
  fiveRegionsStrictEqual: (() => {
    try {
      const g = JSON.parse(fs.readFileSync(`${ROOT}/ops/v119-msg-panel/readings/geometry.json`, 'utf8'))
      const per = {}
      let allEqual = true
      const EXPECT = ['shell', 'topnav', 'content', 'footer', 'tabbar']
      for (const [k, v] of Object.entries(g.states)) {
        per[k] = v.regions
        if (JSON.stringify(v.regions) !== JSON.stringify(EXPECT)) allEqual = false
      }
      return { expected: EXPECT, perState: per, allEqual, pass: allEqual }
    } catch (e) { return { error: String(e), pass: null } }
  })(),
  zeroNewToken: { themeDirDiffNumstat: themeDiff, pass: themeDiff === '' },
  shellCssUntouched: { diffNumstat: shellCssDiff, worktreeSha256: shellCssWorktree, headSha256: shellCssHead, identical: shellCssWorktree === shellCssHead, pass: shellCssDiff === '' && shellCssWorktree === shellCssHead },
  shellCssMedia: { count: grepC('@media', 'frontend/src/shell/shell.css'), has767: grepC('767px', 'frontend/src/shell/shell.css') > 0 },
  shellCssNoThemeAttr: { count: grepC('\\[data-theme', 'frontend/src/shell/shell.css') },
  panelCssIsNewFile: sh('git status --porcelain frontend/src/shell/messages-panel.css'),
  dayNightIsomorphism: { source: 'ops/v119-msg-panel/readings/geometry.json → themeShape', see: 'geometry.json' },
}
fs.writeFileSync(J6, JSON.stringify(ac6, null, 2))
console.log(JSON.stringify({ ac1: { entry1: ac1.entry1_tabbar_href.pass, entry2: ac1.entry2_floatmenu_href.pass, entry3: ac1.entry3_itemdetail_chat.pass, entry4: ac1.entry4_telegram_notification.pass, t105: ac1.t105_single_source.pass, counts: ac1.routeCounts, shellWidthWords: ac1.t105_single_source.shellJsZeroWidthWords }, ac6, out: [J1, J6] }, null, 2))
NODE
echo "exit=$?"

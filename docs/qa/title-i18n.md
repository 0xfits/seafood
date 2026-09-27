# 站点标题 i18n（写死标题 + 四语输出）· 独立质检报告（Neng）

> **出具方**：Neng（独立质检）。**不采信实现方自报**，本文件一切读数由本机探针现场落盘，路径逐条可核（附录 A）。
> **被检对象**：`frontend/index.html`、`frontend/src/App.jsx`、`frontend/src/components/Header.jsx`、
> `frontend/src/locales/{zh,en,hk,vn}.json`、`frontend/src/pages/admin/SystemSettings.jsx`。
> **本件不改任何前端代码**；仅新增本报告文件。

| 项 | 值 |
|---|---|
| **开工时** `git log --oneline -1` | **`474552f fix(docs): master-plan v0.29 三处落盘瑕疵`**（工作区另有 8 个未提交改动） |
| 质检中途 HEAD 变化（**另行核验**） | **`86cb067 feat(frontend): 站点标题写死 + 四语输出（§5.24 / D16）+ 拆除后台死旋钮`**，父提交正是 `474552f` |
| 变化后一致性核验 | 上述 8 个文件 **worktree sha256 == `git show HEAD:<path>` sha256**（逐文件相等，见 §2.6）⇒ **我实测的字节 = 已提交的字节**，结论不因提交动作失效 |
| 质检时刻 | 2026-09-27 21:18–21:36 CST（UTC 13:18–13:36） |
| 被检站点（临时实例） | `http://127.0.0.1:5799`（临时 vite，PID 77055） |
| 读数目录 | `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-title-i18n/` |
| `npm run build`（frontend/） | **exit 0**，`20260927T1335Z`（原始输出尾部见 §2.7） |
| **结论** | **可通过验收（PASS）** —— 主判据 6 条全绿；两条附带项与三条环境限制见 §6 |

---

## 1. 逐项判定（PASS / FAIL）

| # | 判定项 | 结果 | 证据（读数 / 路径） |
|---|---|---|---|
| 1 | 四语标签页标题**逐字正确** | **PASS** | `raw-deeplink-switch-20260927T1355Z.json`：`totals {n:18, pass:18, fail:0}` |
| 2 | 标题分隔符为**全角 U+FF5C**、**无半角 U+007C** | **PASS** | 探针 `title_sep_codepoints=["U+FF5C"]` / `title_has_no_ascii_pipe=false(期望false)`；源码侧四语 `FF5C=1, ASCII07C=0`（§2.4） |
| 3 | 页面**无 og:* meta**（无残留写死） | **PASS** | 探针 `no_og_meta: got [] want []`；`grep -nE "og:" frontend/index.html` **0 命中** |
| 4 | **深链矩阵 18/18**（4 语 × 首页/route + 语言切换路径 + 同语言换路由） | **PASS** | 同 1；18 条 result、112 条 checks、**0 fails** |
| 5 | 头部**短品牌**逐字正确，且头部**从不出现完整句** | **PASS** | `brand_exact=true` 四语；`header_has_no_full_sentence=true`；四语 brand 与 title 不同（§2.4） |
| 6 | **语言切语言**：title / brand / `<html lang>` 全跟随 | **PASS** | 切换相位 `switch-to-en/hk/vn/zh` 各 8 checks 全绿；`html_lang_final` = `en` / `zh-HK` / `vi` / `zh-CN` |
| 7 | **同语言内换路由**标题不变 | **PASS** | 4 条 `switch-in-language-route-change`：`title_before == title_after`、`title_unchanged=true`、`pass=true`（§2.3） |
| 8 | **判负自证有效**（改坏单语 ⇒ 只该语变红） | **PASS** | 见 §4；负控 `totals {n:9, pass:7, fail:2}`，失败**仅 hk 两相位**、且失败项恰为 3 个标题断言 |
| 9 | **locale 改动面干净**（无越界键改动） | **PASS** | `locale-diff-audit-20260927T1415Z.json`：4 文件 `only_expected=true`、`all_only_expected=true`、`unexpected_changed_keys=[]`、`unexpected_added_keys=[]`、`removed_keys=[]` |
| 10 | **后台死旋钮已拆**（`siteName` 零引用） | **PASS（源码级）** | `grep -rn siteName frontend/src \| wc -l` → **0**；`SystemSettings.jsx` 在 `86cb067` 中 **-10 行** |
| 11 | **`npm run build` 可过** | **PASS** | **exit 0**，`build-20260927T1335Z.log`；`dist/index.html` 产出 `<title>Seafood 海鲜市场｜加密人自己的「闲鱼」</title>` |
| 12 | **临时 vite 已停**（PID 77055 / :5799） | **PASS** | `ps -p 77055` rc=1 无输出；`lsof -iTCP:5799 -sTCP:LISTEN` rc=1；`pgrep -fl 5799` rc=1 |

**失败项：0。**

---

## 2. 原始读数（run-tagged）

### 2.1 主矩阵
`raw-deeplink-switch-20260927T1355Z.json`
```
base_url = http://127.0.0.1:5799
executor = .../chromium-1228/.../Google Chrome for Testing
totals   = {"n": 18, "pass": 18, "fail": 0, "failing": []}
```
18 条 result 明细（相位 / 语 / checks 数）：`deeplink-home ×4`、`deeplink-route-reward ×4`、
`deeplink-route-zh-reward ×1`、`switch-initial ×1`、`switch-to-en|hk|vn|zh ×4`、
`switch-in-language-route-change ×4` —— 合计 18，checks 112，fails 0。

### 2.2 四语标题 / 品牌 / html lang 落盘值（zh 首页样例）
```
actual_title = "Seafood 海鲜市场｜加密人自己的「闲鱼」"
actual_brand = "Seafood 海鲜市场"
html_lang    = "zh-CN"
title_sep_codepoints = ["U+FF5C"]
checks: title_exact / title_sep_is_U+FF5C / title_has_no_ascii_pipe /
        brand_exact / brand_differs_from_full_title /
        header_has_no_full_sentence / app_rendered_header / no_og_meta  → 全 pass
header_text_head = "Seafood 海鲜市场\n社区奖励\n社区任务\nshard\n语言\n注册\n登录"
```

### 2.3 同语言内换路由（4 语，全绿）
| 语 | from → to | title_before == title_after | html lang before/after |
|---|---|---|---|
| zh | `/` → `/reward` | `Seafood 海鲜市场｜加密人自己的「闲鱼」` ✔ | zh-CN / zh-CN |
| hk | `/hk` → `/hk/reward` | `Seafood 海鮮市場｜幣圈人的跳蚤市場` ✔ | zh-HK / zh-HK |
| en | `/en` → `/en/reward` | `Seafood｜The crypto crowd's own flea market` ✔ | en / en |
| vn | `/vn` → `/vn/reward` | `Seafood｜Chợ đồ cũ của dân crypto` ✔ | vi / vi |

### 2.4 源码侧独立复核（不进浏览器，直接读字节）
```
python3 解析四语 siteTitle/siteBrand：
en  FF5C=1 ASCII07C=0  "Seafood｜The crypto crowd's own flea market"  brand="Seafood"
hk  FF5C=1 ASCII07C=0  "Seafood 海鮮市場｜幣圈人的跳蚤市場"            brand="Seafood 海鮮市場"
vn  FF5C=1 ASCII07C=0  "Seafood｜Chợ đồ cũ của dân crypto"            brand="Seafood"
zh  FF5C=1 ASCII07C=0  "Seafood 海鲜市场｜加密人自己的「闲鱼」"        brand="Seafood 海鲜市场"
grep -rn "siteName" frontend/src | wc -l  → 0
frontend/index.html:2  <html lang="zh-CN">
frontend/index.html:8  <title>Seafood 海鲜市场｜加密人自己的「闲鱼」</title>   （仅此一处，无 og:*）
```
唯一运行时写入点：`src/App.jsx` `DocumentTitle`（`document.title = t('siteTitle')` +
`document.documentElement.setAttribute('lang', HTML_LANG_BY_KEY[lang])`）；头部品牌取 `src/components/Header.jsx:177 {t('siteBrand')}`。

### 2.5 html lang 映射表（源码原文）
`const HTML_LANG_BY_KEY = { zh: 'zh-CN', hk: 'zh-HK', vn: 'vi', en: 'en' }`

### 2.6 HEAD 变化后的字节一致性核验
```
worktree sha256 == git show HEAD:<path> sha256  （8/8 相等）
zh.json 2a4e08e89802e3c8b25014d67fa42633bb38074fa96b0107d190be04616cf35f
en.json c3aba8ba03fce027aea9f2c0c8c272a78bfaef7a5e94f04525af18fb6c354314
hk.json 7832cfcd7fa24d0e1160218815de8a09e7211851b031f0676a01fa6733f80472
vn.json a2a6c5f044fb3b0d91cb6e96be84b6f5a27e55adda6ed303c9925c9e15d7c265
index.html / App.jsx / Header.jsx / SystemSettings.jsx 亦逐文件相等
```
`hk.json` 的 sha256 与本轮开工时的 `hk.sha256.pre/post-20260927T1405Z.txt` **完全一致** ⇒ 判负自证后的逐字节恢复成立，且该内容即今日提交内容。

### 2.7 `npm run build`（本单补跑）
```
frontend/  $ npm run build   （stdout/stderr 重定向落盘，退出码取自 npm 进程本身，不经管道）
exit = 0
日志：.../qa-title-i18n/build-20260927T1335Z.log
尾部：
  vite v5.4.20 building for production...
  ✓ 1756 modules transformed.
  [plugin:vite:reporter] (!) react-hot-toast/dist/index.mjs is dynamically imported by
      src/utils.js but also statically imported by 18 个文件, dynamic import will not move module into another chunk.
  rendering chunks...
  computing gzip size...
  dist/assets/hk-DjJlsSdH.svg       4.61 kB │ gzip:   2.01 kB
  dist/index.html                   4.64 kB │ gzip:   2.30 kB
  dist/assets/us-BUggRluv.svg       7.87 kB │ gzip:   1.24 kB
  dist/assets/index-Dmk27wGY.css   48.70 kB │ gzip:  10.85 kB
  dist/assets/index-DhAtbol0.js   423.07 kB │ gzip: 124.06 kB
  ✓ built in 1.94s
  BUILD_EXIT=0
```
唯一告警是 react-hot-toast 的「动态导入 + 静态导入混用」chunking 提示，**属既有构建告警，与本次改动无关**。
产物自检：`grep -o "<title>[^<]*</title>" frontend/dist/index.html` → `<title>Seafood 海鲜市场｜加密人自己的「闲鱼」</title>`（写死标题确实进了发行产物）。

### 2.8 临时 vite 停止取证
文件：`probe-tempvite-and-build-verification-20260927T1335Z.txt`
```
utc = 2026-09-27T13:35:18Z     cst = 2026-09-27 21:35:18 CST
ps -p 77055 -o pid,ppid,stat,etime,command   → 仅表头，rc=1（进程不存在）
lsof -nP -iTCP:5799 -sTCP:LISTEN             → 空，rc=1（端口无监听）
pgrep -fl 5799                               → 空，rc=1
```
**结论：临时 vite 已随其父 shell/子进程终止，无需执行任何 kill。**（本单**未**发出任何 `kill`/`pkill`/`killall`；全程按精确 PID 探查。）

---

## 3. 连带项 / 副作用取证

| 连带项 | 读数 | 影响判定 |
|---|---|---|
| **双重前缀 URL** | `Header.changeLanguage` 的 else 分支（`src/components/Header.jsx:96`）在已带语前缀时再拼一次 | **既有实现缺陷，非本次改动引入**；本次未扩大（切语言路径实测全绿） |
| **playwright baseURL 冲突** | `frontend/playwright.config.js:11 baseURL='http://localhost:5777'`，而 5777 被 jinli vite 占用；`:40 reuseExistingServer: !process.env.CI` ⇒ **会静默复用别人的实例** | **测试基础设施风险**：`npm run test:e2e` 结果不可信；本件因此改用自建探针直连 5799，未采信该 E2E |
| **E2E 实际结果** | `pw-e2e-20260927T1430Z.log`：**11 failed / 0 passed**，11 条全部同一原因 `browserType.launch: Executable doesn't exist at .../chromium_headless_shell-1208/...`（本机只装 **1228**） | **环境缺失，非代码缺陷**；与本改动无关，故不据此判负 |
| **`/login` 仍见 JINLI CLUB** | `sideeffects-login-20260927T1425Z.json` → `login_page`：`title="Seafood 海鲜市场｜加密人自己的「闲鱼」"`、`html_lang="zh-CN"`、`jinli_hits_in_body_text=["JINLI CLUB"]`、`hit_count=1`、`h1="连接钱包继续探索"` | **标题已正确**；但 **DOM 正文仍有 1 处 JINLI CLUB 残留**（页面正文文案未随品牌改名）⇒ 列入 §6 遗留 |
| **非中文路由 45–51ms zh 标题闪烁** | `title_timelines`（同一文件）逐语首帧：zh 仅 1 帧 `t=2019` 即正确；en `t=134` 为 zh → `t=179` 变 en（**+45ms**）；hk `t=134` 为 zh → `t=185` 变 hk（**+51ms**）；vn `t=150` 为 zh → `t=199` 变 vn（**+49ms**） | **真实存在但极短**：`App.jsx` 新 effect 在 i18n 就绪前先写了一次 zh 标题。四语最终值均正确（`wrong_language_title_seen=[]`）。**上轮口头区间 45–65ms，以盘上落盘值为准：45/51/49ms** |
| **临时实例的控制台报错** | 同文件 `zh` 相位：4 条 500（`/src/auth.js` fetch 失败，因 5799 无后端） | **环境噪声**（临时实例未挂后端），与被检改动无关 |

---

## 4. 判负自证（negative control）

`negative-control-20260927T1405Z.json`（探针同源、同 run-tagged 机制）
```
totals = {"n": 9, "pass": 7, "fail": 2,
          "failing": [
            {"phase":"deeplink-home",          "lang":"hk",
             "failed":["title_exact","title_sep_is_U+FF5C","title_has_no_ascii_pipe"],
             "actual_title":"Seafood 海鮮市場|幣圈人的跳蚤市場"},
            {"phase":"deeplink-route-reward",  "lang":"hk", ...同上...}]}
checks 总数 72，失败 6（= 2 相位 × 3 项）
```
**判负逻辑成立**：把 `hk.json` 的 U+FF5C 改成半角 `|` 后，**只有 hk 变红**（zh/en/vn 全绿），
且红色恰好命中 3 个标题断言、`header_has_no_full_sentence`/`brand_*` 等未误伤 ⇒ **探针有分辨力，非恒真**。
逐字节恢复证据：`hk.sha256.pre == hk.sha256.post == 7832cfcd7fa24d0e1160218815de8a09e7211851b031f0676a01fa6733f80472`；
`hk.gitdiff.sha256.pre == post == 805d8070cc1ed3a78747cd52dba35512c3a11936ee0171778ed73f79437c74d5`（git diff 面同步复原）。

---

## 5. 可否验收意见

**可以验收（PASS）。**

理由：
1. **主判据无一失败**：四语标题/品牌逐字正确（含 U+FF5C、无半角管道、无 og meta）、深链矩阵 18/18、语言切语言全跟随、同语言换路由不变 —— 112 条断言 0 失败。
2. **判负自证有效**：探针能对最小破坏（单语一个字符）产生精确、局部、可复现的红色，**排除了「恒真探针」**，因此全绿结论可信。
3. **改动面受控**：locale 四文件只动 `siteTitle` + 新增 `siteBrand`，无越界键；`siteName` 全库零引用；后台死旋钮确实拆除。
4. **发行路径可用**：`npm run build` **exit 0**，且产物 `dist/index.html` 的 `<title>` 即目标标题。
5. **环境已清理**：临时 vite（PID 77055 / :5799）已终止，端口无残留监听；未触碰面板托管服务（5787/5788）与 `backend-ts/**`。

**不构成阻塞的已知瑕疵（见 §6）**：45–51ms 的 zh 首帧闪烁、`/login` 正文 1 处 JINLI CLUB 残留、Firefox/WebKit 未跑、后台旋钮仅源码级验证。以上均已如实标注，建议作为**后续小项**而非本轮返工。

---

## 6. 未验证清单（明确「我没验」的部分）

| # | 未验证项 | 说明 | 风险 |
|---|---|---|---|
| 1 | ~~`npm run build`~~ | **本单已补**：exit 0（`build-20260927T1335Z.log`）。**不再列为未验证** | — |
| 2 | **后台「站点标题」旋钮的运行时行为** | 仅**源码级**验证（`grep siteName` 零命中 + `SystemSettings.jsx` -10 行 diff）。**未**实际登录后台点击/保存，**未**验证「旋钮消失后旧配置值不会在保存其它设置时被回写」 | 低–中 |
| 3 | **Firefox / WebKit** | 全程仅 **chromium 1228**（`playwright_available_revs=["chromium-1228","chromium_headless_shell-1228"]`）。Safari/Gecko 的 `<title>` 写入与 `html lang` 行为未跑 | 低 |
| 4 | **`<html lang>` 映射属附带项** | `index.html` 写死 `lang="zh-CN"` 为启动前回退值，运行时由 `App.jsx` 覆盖。**未**验证「JS 关闭 / 首屏 JS 未执行」时 hk/en/vn 深链的 `lang` 是否错误 | 低（无 JS 站点本身不可用） |
| 5 | **`/login` 正文 JINLI CLUB 残留** | DOM 级已取证存在 1 处；**未**定位源码出处、**未**评估还有多少其它页面残留旧品牌字样 | 中（品牌一致性） |
| 6 | **45–51ms 首帧闪烁的用户可感知性** | 时间线已取证；**未**做真实设备/弱网下的目视验证 | 低 |
| 7 | **E2E 套件（`npm run test:e2e`）** | 11/11 因 **chromium_headless_shell-1208 未安装**而 launch 失败；**该套件本身结论不可用**（另有 baseURL 5777 静默复用风险） | 中（测试基建） |
| 8 | **临时实例的后端依赖** | 5799 未挂后端，页面 `/src/auth.js` 有 4 条 500；**未**验证「有后端时」标题行为是否变化（理论上无关，未验） | 低 |
| 9 | **构建产物在真实服务器的行为** | 只验证了 `dist/` 可产出、`<title>` 正确；**未**部署/未跑生产 CSP 与缓存复验 | 低 |
| 10 | **本件未做的动作（合规声明）** | 未改任何前端代码（仅新增本文件）；未触碰 `backend-ts/**`；未 commit / 未 push；未启停 5787/5788 | — |

---

## 附录 A · 读数文件清单（全部位于 `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-title-i18n/`）

| 文件 | 用途 |
|---|---|
| `raw-deeplink-switch-20260927T1355Z.json` | 主矩阵 18/18，112 checks / 0 fail |
| `negative-control-20260927T1405Z.json` | 判负自证（仅 hk 变红） |
| `locale-diff-audit-20260927T1415Z.json` | locale 改动面审计（`all_only_expected=true`） |
| `sideeffects-login-20260927T1425Z.json` | 副作用：标题时间线 / `/login` / 控制台 |
| `pw-e2e-20260927T1430Z.log` | 官方 E2E 现场日志（11 failed，浏览器 rev 缺失） |
| `hk.sha256.{pre,post}-20260927T1405Z.txt` | 判负自证前后逐字节恢复（同值 `7832cfcd…`） |
| `hk.gitdiff.sha256.{pre,post}-20260927T1405Z.txt` | git diff 面同步复原（同值 `805d8070…`） |
| `hk.json.bak-20260927T1405Z`（2298 B，无扩展名） | 负控前的 hk.json 备份 |
| `probe-title-i18n.mjs` | 主探针源码 |
| `probe-sideeffects-login.mjs` | 副作用探针源码 |
| `locale-diff-audit.py` | locale 审计脚本 |
| **`build-20260927T1335Z.log`** | **本单补跑的 `npm run build` 原始输出 + `BUILD_EXIT=0`** |
| **`probe-tempvite-and-build-verification-20260927T1335Z.txt`** | **本单临时 vite 停止取证 + dist title + git status** |

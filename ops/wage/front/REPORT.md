# /wage 页面 + 悬浮菜单改版 · 交付报告

## 改动
- `frontend/src/shell/FloatingMenu.jsx`：移除【反馈】项及其弹窗模板位（源码 `feedback` 命中 0）；第二位插入【领工资】（`icon: Banknote`、`labelKey: wage.menuLabel`、`path: wage`）⇒ 新顺序 = 卖闲置 → 领工资 → 消息 → APP → 客服。
- `frontend/src/pages/wage/{WagePage.jsx, wage-api.js, wage.css}`：项目列表（招募中/已截止、已招 X/Y、`工资：batt N/次（间隔 M 小时）` + 次币固定额）、【加入】/【领工资】按钮态（间隔未到置灰 + `m:ss` 倒计时）、领薪成功卡内到账提示并重拉、失败按 `details.reason` 内联提示、未登录提示、390 触控 ≥44。
- `frontend/src/App.jsx`：`/wage` 路由（四语前缀）。
- i18n：新顶层命名空间 `wage` 29 键 × 四语（vn 待复核）；top 131→132 / flat 1140→1169 / nodes 4560→4676；13 个计数断言测试同步。

## 验证
- `npm run build`：exit 0（`index-Cevw_Kkq.js` / `index-_mLH5ONy.css`）
- `test:unit`：**67 文件 / 688 例全绿**（基线 66/678）
  - `v15-nav-floatmenu.test.jsx` 21/21（新五项序 + 无反馈负断言 + `/en/wage`）
  - `wage-page.test.jsx` 10/10
- 探针 `ops/wage/front/probe-wage.mjs`（route 拦截，零后端）：**verdict.pass = true**
  - 菜单 5 项 / 无反馈 / 第二位 wage
  - 10 卡：招募中 8 / 已截止 2、`已招 2/3`、`工资：batt 30/次（间隔 4 小时）`、`＋50 BTTC/次`
  - 领薪成功 ⇒ `POST /api/project/101/claim` ×1 + 卡内到账 + 置灰倒计时；失败 ⇒ 内联 err + 倒计时接管
  - 390/1536 零横向溢出、390 触控 ≥44、pageerror 0

## 边界（不臆造）
- `wage_cid` 无 symbol 时不渲染次币段。
- 间隔与工资同处一条 `wageLine` 文案（未单独立键）。

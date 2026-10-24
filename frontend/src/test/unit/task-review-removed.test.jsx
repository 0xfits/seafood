/**
 * `/task` 页【审核入口】与 `/task/review` 路由链**整条下线**（Kevin 2026-10-24 裁定）：
 *   入口（TaskPage 页头条 Link）/ 路由（App.jsx `task/review`）/ 页面 `pages/jobs/JobReviewPage.jsx`
 *   / 仅它用的 API 层 `pages/jobs/job-api.js` —— 四处静态钉死零残留。
 *
 * ★ 2026-10-24（Kevin 裁定 · `/dashboard` 审核面板下线，本文件第⑥条随之前移）：
 *   `GET /api/tasklist/pending-verification(+ /count)` 与 `POST /api/tasklist/:id/verify` **后端早于
 *   `43ea14a`（2026-10-21，job 领域下线）随 21 条路由删除**，生产实测三 URL 全 404
 *   （`LEDGER_REF_NOT_FOUND` / `ref_type=endpoint`；对照 `/api/currencies` `/api/home` 均 200）
 *   ⇒ 前端 `/dashboard` 的审核面板早已不能工作（只显示加载失败），本单连同该面板一并拆除。
 *   故第⑥条由「后端口仍被 DashboardPage 消费」反转为「**前端零残留 + 后端注册点确不存在**」。
 * i18n 键**保留不删**（`jobs.review` / `jobs.reviewNote` 四语仍在）—— 沿 `dashboard-pages-removed`
 *   先例的「键保留不删」口径：删键会连带触发四语键集计数漂移（1451×4 口径）。
 *
 * 手法：静态读盘（fs 递归），不渲染 —— 与 `test/unit/dashboard-pages-removed.test.jsx` 同款先例。
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(process.cwd(), 'src')
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')

/** fs 递归收集 `src/**` 下所有文本文件（排除 test 目录：反向断言必须能写出被删路径的字面量） */
const walk = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === '__snapshots__') continue
      walk(full, acc)
    } else if (/\.(jsx?|tsx?|css|json|md|mjs)$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

const files = walk(SRC).map((full) => ({
  rel: path.relative(SRC, full).split(path.sep).join('/'),
  text: fs.readFileSync(full, 'utf8'),
}))

const LOCALES = ['zh', 'en', 'hk', 'vn']

describe('/task 审核入口 + /task/review 路由链下线：四处零残留（后端口与 i18n 键保留）', () => {
  it('① 页面与 API 层文件已删除', () => {
    expect(fs.existsSync(path.join(SRC, 'pages/jobs/JobReviewPage.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(SRC, 'pages/jobs/job-api.js'))).toBe(false)
    // 同目录的样式仍被其它面引用 ⇒ 不得顺手删（防过度删除）
    expect(fs.existsSync(path.join(SRC, 'pages/jobs/jobs.css'))).toBe(true)
  })

  it('② App.jsx 无 import、无 task/review 路由', () => {
    const app = read('App.jsx')
    expect(app).not.toContain('JobReviewPage')
    expect(app).not.toContain('job-api')
    expect(app).not.toContain('task/review')
    expect(app).not.toMatch(/path=["']\/?task\/review["']/)
    // 正向对照：同族两条路由仍在（反向断言不是靠「整块路由表被删」蒙对）
    expect(app).toMatch(/path="task"/)
    expect(app).toMatch(/path="task\/:taskId"/)
  })

  it('③ TaskPage.jsx 无入口链接、无入口钩子、无 buildLocalizedPath 死导入', () => {
    const page = read('pages/TaskPage.jsx')
    expect(page).not.toContain('jobs-nav-review')
    expect(page).not.toContain("data-sf-m=\"jobs-nav\"")
    expect(page).not.toContain('/task/review')
    expect(page).not.toContain("t('jobs.review')")
    // 死导入清理：入口删掉后 `Link` / `buildLocalizedPath` 都不该再被 import
    expect(page).not.toMatch(/import\s*\{[^}]*\bLink\b[^}]*\}\s*from\s*'react-router-dom'/)
    expect(page).not.toMatch(/import\s*\{[^}]*\bbuildLocalizedPath\b[^}]*\}/)
    // 页头标题仍在（本单只摘入口，不改标题 / 卡）
    expect(page).toContain("t('taskPage.title')")
    expect(page).toContain('sf-home-camp-grid')
  })

  it('④ 全 src/**（排除 test 自身）无 task/review、无 jobs-nav-review、无 JobReviewPage 残留', () => {
    const hits = { route: [], hook: [], page: [] }
    for (const { rel, text } of files) {
      if (text.includes('task/review')) hits.route.push(rel)
      if (text.includes('jobs-nav-review')) hits.hook.push(rel)
      if (text.includes('JobReviewPage')) hits.page.push(rel)
    }
    expect(hits.route).toEqual([])
    expect(hits.hook).toEqual([])
    expect(hits.page).toEqual([])
  })

  it('⑤ i18n 键保留不删：jobs.review / jobs.reviewNote 四语俱在（键计数 1451×4 不受影响）', () => {
    const tables = LOCALES.map((lang) => [lang, JSON.parse(read(`locales/${lang}.json`))])
    for (const [lang, table] of tables) {
      expect(table.jobs, `${lang}.jobs 缺失`).toBeTruthy()
      expect(typeof table.jobs.review, `${lang}.jobs.review 缺失`).toBe('string')
      expect(table.jobs.review.trim().length, `${lang}.jobs.review 为空`).toBeGreaterThan(0)
      expect(typeof table.jobs.reviewNote, `${lang}.jobs.reviewNote 缺失`).toBe('string')
      expect(table.jobs.reviewNote.trim().length, `${lang}.jobs.reviewNote 为空`).toBeGreaterThan(0)
    }
    // 四语文案两两不同 ⇒ 不是同一份被复制粘贴（同时也钉住本键未被改值）
    expect(new Set(tables.map(([, table]) => table.jobs.review)).size).toBe(4)
  })

  it('⑥ 审核面前端零残留：DashboardPage 不含审核读口 / 写口 / 面板锚点（反向判据）', () => {
    const dash = read('pages/DashboardPage.jsx')
    // 读口：审核队列两条 URL 一律不得再出现
    expect(dash).not.toContain('pending-verification')
    expect(dash).not.toContain('tasklist/')
    // 写口：动作函数与被它调的 verify 路径
    expect(dash).not.toContain('handleVerifyTask')
    expect(dash).not.toContain('/verify')
    // job 域动作口（`POST /api/job/:jobId/review`）与已删路由的路径残片
    expect(dash).not.toContain('job/')
    expect(dash).not.toContain('/review')
    expect(dash).not.toContain('task/review')
    // 队列面板的 UI 锚点（搜索框 / 通过驳回钮 / 队列摘要 / 待审核统计卡）
    expect(dash).not.toContain('reviewQuery')
    expect(dash).not.toContain('queueSummary')
    expect(dash).not.toContain('resolvePendingVerificationCount')
    expect(dash).not.toContain('filteredPendingTasks')
    expect(dash).not.toContain('pendingVerificationTasks')
    // 反向断言的对照：仪表盘其余面板仍在（不是「整页被删」蒙对）
    expect(dash).toContain("t('dashPage.statUsers')")
    expect(dash).toContain("t('dashPage.linksTitle')")
    expect(dash).toContain("t('dashPage.roleReviewer')")
  })

  it('⑦ 后端现取事实：`backend-ts/src/index.ts` **不存在**审核队列与 job 审核路由注册点', () => {
    // 本条的用途：钉住「后端注册点已不存在」这一事实本身 —— 防后来者再按旧文档写出
    // 「口还在、只是前端换了消费方」这类假前提（现实测三 URL 全 404）。
    const backend = fs.readFileSync(path.resolve(process.cwd(), '../backend-ts/src/index.ts'), 'utf8')
    // 正对照：读到的是真路由册（否则下面的反向断言等于对空字符串求假）
    expect(backend).toContain("app.get('/api/currencies'")
    expect(backend.length).toBeGreaterThan(100000)
    expect(backend).not.toContain('pending-verification')
    expect(backend).not.toContain('/api/job/')
    expect(backend).not.toMatch(/job\/:jobId\/review/)
    expect(backend).not.toMatch(/app\.post\('\(\/api\/job/)
  })
})

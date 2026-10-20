/**
 * 「招工 → 任务 → 悬赏」文案口径守卫（Kevin 2026-10-21 需求①：/task 页改名【悬赏】）
 *
 * 判据（对齐派单）：
 *   ① `jobs.*` 全组 + `taskPage.*` + 本单点名的顶层键，四语均**不得**再出现「任务 / 任務」字样；
 *      en 不得出现 `task(s)` 词，vn 不得出现 `nhiệm vụ` 词（vn 文案标「待复核」）。
 *   ② 只改值不改键：四语 `jobs` 组键集逐字相等且 = 冻结清单（键数零变化）；`taskPage` 键集同样冻结。
 *   ③ 插值占位符不丢：`itemTitle` 仍带 `{{job}}` 与 `{{app}}`（改了词不能改键/占位符）。
 *   ④ 管理员端 `adminNav.arbitrationReview*` 属后台仲裁业务名 ⇒ **保持「招工」不改**（负向锁）；
 *      `wage.*` 不在本单范围（同样不改）。
 *   历史：本文件前身锁的是「招工 → 任务」，2026-10-21 同口径推进为「任务 → 悬赏」。
 */
import { describe, expect, it } from 'vitest'
import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const DICTS = { zh, en, hk, vn }
const LANGS = Object.keys(DICTS)

/** 冻结的 `jobs` 键集（改词不改键：顺序即线上序，逐项比对） */
const JOBS_KEYS = [
  'line', 'list', 'publish', 'publishNote', 'publishOk', 'review', 'reviewNote', 'refresh',
  'myApps', 'myAppsEmpty', 'detail', 'title', 'description', 'reward', 'headcount',
  'headcountInvalid', 'depositHint', 'cid', 'cidNote', 'participants', 'participantsHeadcount',
  'submit', 'submitNote', 'deliverable', 'submitOk', 'submitNotApplicant', 'submitNotSelected',
  'submitJobStateInvalid', 'submitting', 'itemTitle', 'approve', 'reject', 'approveOk',
  'rejectOk', 'queueEmpty', 'submissions', 'submissionsEmpty', 'submissionItemTitle',
  'subStatusPending', 'subStatusApproved', 'subStatusRejected', 'markQualified',
  'markUnqualified', 'reviewQualifiedOk', 'reviewUnqualifiedOk',
]

/** 冻结的 `taskPage` 键集（改词不改键；`requestFailed` 不含业务名词，未纳入扫词面） */
const TASK_PAGE_KEYS = [
  'title', 'subtitle', 'continueTask', 'emptyAvailable', 'emptyAvailableHint', 'emptyPending',
  'emptyPendingHint', 'emptyCompleted', 'emptyCompletedHint', 'emptyVerification',
  'emptyVerificationHint',
]

/** 本单改值面（顶层键；值里的业务名词必须已是「悬赏 / bounty / treo thưởng」） */
const TOP_KEYS = [
  'task', 'tasks', 'tasksToComplete', 'tasksClaimed', 'tasksStats', 'successSubmitTask',
  'successVerifyTask', 'completeTask', 'enterTaskInfo', 'taskLink',
]

/** 连带改值面（嵌套路径；只锁「旧词缺席」） */
const NESTED_KEYS = ['common.loadingTasks', 'activeTaskModal.submitFailed']

/** ledger.kind 三键（任务托管 / 任务报酬 / 任务服务费 → 悬赏…） */
const LEDGER_KIND_KEYS = ['job_escrow', 'job_payout', 'job_fee']

const OLD_ZH_CHARS = ['任务', '任務']
const OLD_EN_WORD = /\btasks?\b/i
const OLD_VN_WORD = /nhiệm vụ/iu

const pick = (dict, path) => path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), dict)

describe('task 文案：任务 → 悬赏（只改值）', () => {
  it('四语 jobs 键集 = 冻结清单（键数零变化）', () => {
    for (const lang of LANGS) {
      expect(Object.keys(DICTS[lang].jobs), lang).toEqual(JOBS_KEYS)
    }
  })

  it('四语 taskPage 键集 = 其余键集（键数零变化）', () => {
    for (const lang of LANGS) {
      expect(
        Object.keys(DICTS[lang].taskPage).filter((k) => TASK_PAGE_KEYS.includes(k)),
        lang,
      ).toEqual(TASK_PAGE_KEYS)
    }
  })

  it('zh / hk 改值面内无「任务 / 任務」字样', () => {
    for (const lang of ['zh', 'hk']) {
      const texts = [
        ...JOBS_KEYS.map((k) => pick(DICTS[lang], `jobs.${k}`)),
        ...TASK_PAGE_KEYS.map((k) => pick(DICTS[lang], `taskPage.${k}`)),
        ...TOP_KEYS.map((k) => DICTS[lang][k]),
        ...NESTED_KEYS.map((k) => pick(DICTS[lang], k)),
        ...LEDGER_KIND_KEYS.map((k) => pick(DICTS[lang], `ledger.kind.${k}`)),
      ].map(String)
      for (const text of texts) {
        for (const word of OLD_ZH_CHARS) {
          expect(text, `${lang}: ${text}`).not.toContain(word)
        }
      }
    }
  })

  it('en 不再用 task(s) 表述 / vn 不再用 nhiệm vụ 表述', () => {
    // 占位符 `{{job}}` 是键名（改词不改占位符）⇒ 先剥掉再判词
    const strip = (s) => String(s).replace(/\{\{[^}]+\}\}/g, ' ')
    const collect = (lang) => [
      ...JOBS_KEYS.map((k) => pick(DICTS[lang], `jobs.${k}`)),
      ...TASK_PAGE_KEYS.map((k) => pick(DICTS[lang], `taskPage.${k}`)),
      ...TOP_KEYS.map((k) => DICTS[lang][k]),
      ...NESTED_KEYS.map((k) => pick(DICTS[lang], k)),
      ...LEDGER_KIND_KEYS.map((k) => pick(DICTS[lang], `ledger.kind.${k}`)),
    ].map(strip).join(' | ')
    expect(collect('en')).not.toMatch(OLD_EN_WORD)
    expect(collect('vn')).not.toMatch(OLD_VN_WORD)
  })

  it('四语都落到「悬赏」口径（zh 逐条 / en bounty / hk 懸賞 / vn treo thưởng）', () => {
    // zh 主口径逐条落地（任务线 / 任务列表 / 发布悬赏 / 任务详情 / 任务标题 / 任务说明）
    expect(zh.jobs.line).toBe('悬赏线')
    expect(zh.jobs.list).toBe('悬赏列表')
    expect(zh.jobs.publish).toBe('发布悬赏')
    expect(zh.jobs.publishOk).toBe('悬赏已发布并托管酬金')
    expect(zh.jobs.detail).toBe('悬赏详情')
    expect(zh.jobs.title).toBe('悬赏标题')
    expect(zh.jobs.description).toBe('悬赏说明')
    expect(zh.taskPage.title).toBe('悬赏中心')
    expect(zh.task).toBe('悬赏中心')
    expect(zh.ledger.kind.job_escrow).toBe('悬赏托管')
    // 其余三语至少要在标题/按钮面落词（逐字锁死会锁住译文措辞，只锁关键词）
    expect(en.jobs.publish).toBe('Post a bounty')
    expect(en.taskPage.title).toBe('Bounty Center')
    expect(hk.jobs.publish).toBe('發佈懸賞')
    expect(hk.taskPage.title).toBe('懸賞中心')
    expect(vn.jobs.publish).toBe('Đăng treo thưởng')
    expect(vn.taskPage.title).toBe('Trung tâm treo thưởng')
  })

  it('itemTitle 插值占位符 {{job}} / {{app}} 不丢（改词不改占位符）', () => {
    for (const lang of LANGS) {
      const tpl = String(DICTS[lang].jobs.itemTitle)
      expect(tpl, lang).toContain('{{job}}')
      expect(tpl, lang).toContain('{{app}}')
    }
  })

  it('管理员端仲裁业务名 / wage 面不随本单改动（负向锁）', () => {
    expect(zh.adminNav.arbitrationReview).toBe('招工仲裁')
    expect(zh.adminNav.arbitrationReviewDesc).toContain('招工')
    expect(zh.wage.empty).toBe('暂无任务项目')
  })
})

/**
 * 「招工 → 任务」文案口径守卫（Kevin 2026-10-21 需求①）
 *
 * 判据（对齐派单）：
 *   ① `jobs.*` 全组 + `wage.empty` 四语均**不得**再出现「招工」字样；en 不得出现 `job(s)` 词，
 *      vn 不得出现 `việc` 词（vn 文案标「待复核」，此处只锁「旧词缺席」这一硬口径）。
 *   ② 只改值不改键：四语 `jobs` 组键集逐字相等且 = 冻结清单（键数零变化）。
 *   ③ 插值占位符不丢：`itemTitle` 仍带 `{{job}}` 与 `{{app}}`（改了词不能改键/占位符）。
 *   ④ 管理员端 `adminNav.arbitrationReview*` 属后台仲裁业务名 ⇒ **保持「招工」不改**（负向锁）。
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

const HIRING_CHARS = '招工'
const JOB_WORD = /\bjobs?\b/i
const VIEC_WORD = /\bviệc\b/iu

describe('task 文案：招工 → 任务（只改值）', () => {
  it('四语 jobs 键集 = 冻结清单（键数零变化）', () => {
    for (const lang of LANGS) {
      expect(Object.keys(DICTS[lang].jobs), lang).toEqual(JOBS_KEYS)
    }
  })

  it('四语 jobs.* 全组无「招工」字样', () => {
    for (const lang of LANGS) {
      for (const key of JOBS_KEYS) {
        expect(String(DICTS[lang].jobs[key]), `${lang}.jobs.${key}`).not.toContain(HIRING_CHARS)
      }
    }
  })

  it('四语 wage.empty 无「招工」字样', () => {
    for (const lang of LANGS) {
      expect(String(DICTS[lang].wage.empty), `${lang}.wage.empty`).not.toContain(HIRING_CHARS)
    }
  })

  it('en 不再用 job(s) 表述 / vn 不再用 việc 表述', () => {
    // 占位符 `{{job}}` 是键名（改词不改占位符）⇒ 先剥掉再判词
    const strip = (s) => String(s).replace(/\{\{[^}]+\}\}/g, ' ')
    const enValues = [...JOBS_KEYS.map((k) => en.jobs[k]), en.wage.empty].map(strip).join(' | ')
    expect(enValues).not.toMatch(JOB_WORD)
    const vnValues = [...JOBS_KEYS.map((k) => vn.jobs[k]), vn.wage.empty].map(strip).join(' | ')
    expect(vnValues).not.toMatch(VIEC_WORD)
  })

  it('zh 主口径逐条落地（任务线 / 任务列表 / 发布任务 / 任务详情 / 任务标题 / 任务说明）', () => {
    expect(zh.jobs.line).toBe('任务线')
    expect(zh.jobs.list).toBe('任务列表')
    expect(zh.jobs.publish).toBe('发布任务')
    expect(zh.jobs.publishOk).toBe('任务已发布并托管酬金')
    expect(zh.jobs.detail).toBe('任务详情')
    expect(zh.jobs.title).toBe('任务标题')
    expect(zh.jobs.description).toBe('任务说明')
    expect(zh.wage.empty).toBe('暂无任务项目')
  })

  it('itemTitle 插值占位符 {{job}} / {{app}} 不丢（改词不改占位符）', () => {
    for (const lang of LANGS) {
      const tpl = String(DICTS[lang].jobs.itemTitle)
      expect(tpl, lang).toContain('{{job}}')
      expect(tpl, lang).toContain('{{app}}')
    }
  })

  it('管理员端仲裁业务名不随本单改动（adminNav.arbitrationReview* 仍为「招工仲裁」）', () => {
    expect(zh.adminNav.arbitrationReview).toBe('招工仲裁')
    expect(zh.adminNav.arbitrationReviewDesc).toContain('招工')
  })
})

import React, { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import {
  createListingPublishTracker,
  listingPublishFingerprint,
  publishListing,
  setListingStatus,
} from './listing-api'
import './listings.css'

// ============================================================================
// 商品线 · 上架（P4-B4c-ii-b / Kong）
// 接线：`POST /api/listing`（**已注册** backend-ts/src/index.ts:1492）= 直 DML · 无分录；
//       随后 `PATCH /api/listing/:listingId`（:1545）把状态 `draft → listed`（**只有 listed 才可被购买**，
//       DB 侧 `createListingRow` 硬写 `'draft'`，真源 database.ts:1545）。
// 幂等键：`create_key` 由**前端提供**（`cli:<uuid-v4>`；tracker 保证同一次操作重试 ⇒ 同键）。
//       服务端**缺键会派生**（`listing-service.ts:75-81`）⇒ 本页仍显式供键（不给服务端兜底可乘之机）。
// 金额口径：`price` = **A 类供给侧自主出价**（§4.8.1：客户端出价、路由层零计算）⇒ 允许前端填、原样透传。
// 失败态：走 R107 链（`error.message` 已是字符串）⇒ 页面不会出现 `[object Object]`。
// ============================================================================
const PublishListingPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [form, setForm] = useState({ cid: '1', price: '', stock: '1', title: '', description: '' })
  const [state, setState] = useState({ phase: 'idle', message: '' })
  const tracker = useMemo(() => createListingPublishTracker(), [])

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    if (state.phase === 'loading') return
    const createKey = tracker.keyFor(listingPublishFingerprint(form))
    setState({ phase: 'loading', message: t('jobs.submitting') })
    try {
      const created = await publishListing({
        cid: Number(form.cid),
        price: String(form.price).trim(),
        stock: String(form.stock).trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        createKey,
        user,
      })
      tracker.reset()
      const listingId = created?.listing_id ?? created?.bID ?? null
      // 上架 = 创建（draft）→ 迁移到 listed；两步都成功后商品才可购买
      let listed = false
      if (listingId) {
        try {
          await setListingStatus(listingId, 'listed', user)
          listed = true
        } catch (error) {
          setState({ phase: 'error', message: `${t('listings.listedFail')}: ${String(error?.message || t('error'))}` })
          return
        }
      }
      setState({
        phase: 'ok',
        message: `${t('listings.publishOk')} · #${listingId ?? '-'}${listed ? ` · ${t('listings.listed')}` : ''}`,
      })
    } catch (error) {
      setState({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  // F2 修复：站内链接 = 当前语言前缀 + 站内路径（唯一构造器 utils.buildLocalizedPath）
  const lang = getLanguageFromUrl(location.pathname)
  const root = (p) => buildLocalizedPath(lang, p)

  if (!isAuthenticated) {
    return (
      <div className="sf-listings" data-sf-m="listing-hero-empty">
        <div className="sf-listings-empty">{t('pleaseLogin')}</div>
      </div>
    )
  }

  return (
    <div className="sf-layout" data-sf-m="listing-layout">
      <div className="sf-layout-main">
        <div className="sf-listings">
          <div className="sf-listings-head" data-sf-m="listing-hero">
            <h1 className="sf-listings-title">{t('listings.publish')}</h1>
            <p className="sf-listings-note">{t('listings.priceRoleNote')}</p>
            <div className="sf-listings-actions">
              <Link className="sf-listings-link" to={root('/listing')}>{t('listings.list')}</Link>
              <button className="sf-btn sf-listings-btn" type="button" onClick={() => navigate(root('/listing'))} data-sf-m="listing-goto-feed">
                {t('listings.myOrders')}
              </button>
            </div>
          </div>

          <form className="sf-listings-panel" onSubmit={onSubmit} data-sf-m="listing-form">
            <div className="sf-listings-form">
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('listings.title')}</span>
                <input className="sf-listings-input" data-sf-m="listing-input-title" value={form.title} onChange={setField('title')} required />
              </label>
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('listings.price')}</span>
                <input className="sf-listings-input" data-sf-m="listing-input-price" value={form.price} onChange={setField('price')} inputMode="numeric" required />
              </label>
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('listings.stock')}</span>
                <input className="sf-listings-input" data-sf-m="listing-input-stock" value={form.stock} onChange={setField('stock')} inputMode="numeric" required />
              </label>
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('listings.cid')}</span>
                <input className="sf-listings-input" data-sf-m="listing-input-cid" value={form.cid} onChange={setField('cid')} inputMode="numeric" required />
              </label>
              <label className="sf-listings-field sf-listings-field-wide">
                <span className="sf-listings-label">{t('listings.description')}</span>
                <textarea className="sf-listings-textarea" data-sf-m="listing-input-note" value={form.description} onChange={setField('description')} rows={3} />
              </label>
            </div>
            <p className="sf-listings-meta">{t('listings.cidNote')}</p>
            <div className="sf-listings-row">
              <button className="sf-btn sf-listings-btn" type="submit" data-sf-m="listing-primary" disabled={state.phase === 'loading'}>
                {state.phase === 'loading' ? t('jobs.submitting') : t('listings.publish')}
              </button>
              <span
                className={`sf-listings-status${state.phase === 'error' ? ' sf-listings-err' : ''}${state.phase === 'ok' ? ' sf-listings-ok' : ''}`}
                data-sf-m="listing-status"
                data-sf-phase={state.phase}
                role="status"
              >
                {state.message}
              </span>
            </div>
          </form>
        </div>
      </div>

      <div className="sf-layout-side">
        <div className="sf-listings-panel" data-sf-m="listing-side">
          <h2 className="sf-listings-title">{t('listings.line')}</h2>
          <p className="sf-listings-meta">{t('listings.publishNote')}</p>
          <p className="sf-listings-meta">{t('listings.stockNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default PublishListingPage

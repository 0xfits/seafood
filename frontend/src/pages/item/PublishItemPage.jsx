import React, { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import {
  createListingPublishTracker,
  listingPublishFingerprint,
  publishListing,
  setListingStatus,
} from './item-api'
import './item.css'

// ============================================================================
// 闲置物品线 · 上架（原 `pages/listings/PublishListingPage.jsx`；2026-10-11 合并单改名单为 `item`）
// 路由（LangShell 内层相对段）：`item/new`（**原 `listing/new`**）。
// 接线：`POST /api/listing`（**已注册** backend-ts/src/index.ts:1492）= 直 DML · 无分录；
//       随后 `PATCH /api/listing/:listingId`（:1545）把状态 `draft → listed`（**只有 listed 才可被购买**）。
// 幂等键：`create_key` 由**前端提供**（`cli:<uuid-v4>`；tracker 保证同一次操作重试 ⇒ 同键）。
// 金额口径：`price` = **A 类供给侧自主出价**（§4.8.1：客户端出价、路由层零计算）⇒ 允许前端填、原样透传。
// 失败态：走 R107 链（`error.message` 已是字符串）⇒ 页面不会出现 `[object Object]`。
// 后端面一字不动（`/api/listing*` 路径名不变）。
// ============================================================================
const PublishItemPage = () => {
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
          setState({ phase: 'error', message: `${t('item.listedFail')}: ${String(error?.message || t('error'))}` })
          return
        }
      }
      setState({
        phase: 'ok',
        message: `${t('item.publishOk')} · #${listingId ?? '-'}${listed ? ` · ${t('item.listed')}` : ''}`,
      })
      // ★ 上架**成功且已 listed** ⇒ 自动跳该商品详情页（本单：目标由 `/listing/<id>` 改为 `/item/<id>`）。
      //   口径：① 目标 = 仓内唯一构造器 `root('/item/' + listingId)`（**带当前语言前缀**，四语一致）；
      //        ② **跳转前**先弹 `react-hot-toast`（`main.jsx` 顶层已挂 `<Toaster/>` ⇒ 跨路由存活）；
      //        ③ **失败与无 id 一律不跳**：`listingId` 缺失 ⇒ 保持 ok 态原地停留，**绝不拼 `/item/null`**。
      //           即时跳转（不引延时器）⇒ 无「未清理定时器」面，单测确定性也更高。
      if (listingId && listed) {
        toast.success(`${t('item.publishOk')} · #${listingId}`)
        navigate(root(`/item/${listingId}`))
      }
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
            <h1 className="sf-listings-title">{t('item.publish')}</h1>
            <p className="sf-listings-note">{t('item.priceRoleNote')}</p>
            <div className="sf-listings-actions">
              <Link className="sf-listings-link" to={root('/')}>{t('item.list')}</Link>
              <button className="sf-btn sf-listings-btn" type="button" onClick={() => navigate(root('/'))} data-sf-m="listing-goto-feed">
                {t('item.myOrders')}
              </button>
            </div>
          </div>

          <form className="sf-listings-panel" onSubmit={onSubmit} data-sf-m="listing-form">
            <div className="sf-listings-form">
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('item.title')}</span>
                <input className="sf-listings-input" data-sf-m="listing-input-title" value={form.title} onChange={setField('title')} required />
              </label>
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('item.price')}</span>
                <input className="sf-listings-input" data-sf-m="listing-input-price" value={form.price} onChange={setField('price')} inputMode="numeric" required />
              </label>
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('item.stock')}</span>
                <input className="sf-listings-input" data-sf-m="listing-input-stock" value={form.stock} onChange={setField('stock')} inputMode="numeric" required />
              </label>
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('item.cid')}</span>
                <input className="sf-listings-input" data-sf-m="listing-input-cid" value={form.cid} onChange={setField('cid')} inputMode="numeric" required />
              </label>
              <label className="sf-listings-field sf-listings-field-wide">
                <span className="sf-listings-label">{t('item.description')}</span>
                <textarea className="sf-listings-textarea" data-sf-m="listing-input-note" value={form.description} onChange={setField('description')} rows={3} />
              </label>
            </div>
            <p className="sf-listings-meta">{t('item.cidNote')}</p>
            <div className="sf-listings-row">
              <button className="sf-btn sf-listings-btn" type="submit" data-sf-m="listing-primary" disabled={state.phase === 'loading'}>
                {state.phase === 'loading' ? t('jobs.submitting') : t('item.publish')}
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
          <h2 className="sf-listings-title">{t('item.line')}</h2>
          <p className="sf-listings-meta">{t('item.publishNote')}</p>
          <p className="sf-listings-meta">{t('item.stockNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default PublishItemPage

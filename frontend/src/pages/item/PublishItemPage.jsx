import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import {
  createListingPublishTracker,
  fetchCurrencies,
  listingPublishFingerprint,
  publishListing,
  setListingStatus,
  uploadMedia,
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
//
// 币种字段（Kevin 2026-10-19）：`item-input-cid`（手填编号）⇒ `item-select-cid`（下拉选择）。
//   选项来源 = `GET /api/currencies`（**公开只读**；只列 `status='listed'`，行键 cid/symbol/name）
//   ⇒ 自建币种单位是产品既有能力，**前端不得硬编码币种清单**。
//   显示文本 = `${symbol}${name ? ' · ' + name : ''}`（**不显示编号**）；默认 `'1'`（平台 $，与旧默认一致）。
//   加载失败 / 空列表 ⇒ **回退仅 $（cid 1）一项**，表单照常可提交（不白屏、不禁用提交、零新增文案键）。
// ============================================================================
const DEFAULT_CID = '1'

/** 回退选项（接口失败 / 空列表时唯一可用项）：平台 `$`，`cid = 1`，无 name。 */
const FALLBACK_CURRENCIES = [{ cid: 1, symbol: '$', name: '' }]

/** 币种选项显示文本：`symbol · name`；**不显示编号**（`cid` 只作 value）。 */
const currencyLabel = (row) => {
  const symbol = String(row?.symbol ?? '')
  const name = typeof row?.name === 'string' ? row.name : ''
  return `${symbol}${name ? ` · ${name}` : ''}`
}

// ---- 商品图片（可选 · 媒体单前端阶段 B） --------------------------------------
// 口径：最多 4 张；仅 image/*；客户端压缩（canvas 长边 ≤1280，WebP q0.82，
// 不支持 WebP ⇒ JPEG q0.85）；**先逐张上传**，任一失败 ⇒ 取消发布（绝不产生半截商品）。
// 体积硬顶（Kevin 2026-10-19）：编码后 **必须 ≤1MiB = 1,048,576 bytes**（与后端 MEDIA_MAX_BYTES /
//   0051 的 size_bytes CHECK 三层同口径）⇒ 超限按「质量档 → 边长档」逐级降级重编码，全档位仍超
//   ⇒ 该张拒收（`item.imageTooLarge` 提示，不入列表；其余已选图片不受影响）。
const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 1 * 1024 * 1024
/** 初档 = 既有压缩参数（WebP q0.82 / JPEG q0.85），其后逐级降质。 */
const QUALITY_LADDER = [0.82, 0.72, 0.62, 0.5]
const JPEG_QUALITY_LADDER = [0.85, 0.72, 0.62, 0.5]
/** 降质仍超 ⇒ 再逐级缩长边（与质量档交叉试，命中即收）。 */
const EDGE_LADDER = [1280, 1120, 960, 832]

/** base64 文本 ⇒ 解码后字节数（不含 `data:` 前缀；按 RFC 4648 padding 精确折算，无需 atob）。 */
const base64ByteLength = (dataBase64) => {
  if (!dataBase64) return 0
  const padding = dataBase64.endsWith('==') ? 2 : dataBase64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((dataBase64.length * 3) / 4) - padding)
}

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error || new Error('read failed'))
  reader.readAsDataURL(file)
})

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('decode failed'))
  image.src = src
})

/**
 * 单张压缩 ⇒ `{ contentType, dataBase64, preview }`（`preview` = 压缩后的 data URL，直接做缩略图）。
 * 体积硬顶：编码字节数必须 ≤`MAX_IMAGE_BYTES`；超限逐级降级重编码（质量档 × 4 边长档交叉），
 * 命中即收；**全部档位仍超 ⇒ 返回 `null`**（由调用方拒收该张并提示，不入列表）。
 */
const compressImage = async (file) => {
  const raw = await readFileAsDataUrl(file)
  const image = await loadImageElement(raw)
  const width = image.naturalWidth || image.width || 0
  const height = image.naturalHeight || image.height || 0
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas unavailable')
  // 优先 WebP；浏览器不支持时 `toDataURL('image/webp')` 会静默回落 PNG ⇒ 首个编码结果一探即知，
  // 命中非 WebP 则整张改走 JPEG（q0.85 起档），后续档位都以实际 mime 为准。
  let contentType = 'image/webp'
  for (const edge of EDGE_LADDER) {
    const scale = width && height ? Math.min(1, edge / Math.max(width, height)) : 1
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const qualityLadder = () => (contentType === 'image/webp' ? QUALITY_LADDER : JPEG_QUALITY_LADDER)
    let qualityIndex = 0
    while (qualityIndex < qualityLadder().length) {
      const dataUrl = canvas.toDataURL(contentType, qualityLadder()[qualityIndex])
      if (contentType === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
        contentType = 'image/jpeg'
        continue // 质量档换表、下标归 0（mime 只切一次：切后本分支不再成立）
      }
      const comma = dataUrl.indexOf(',')
      if (comma < 0) throw new Error('encode failed')
      const dataBase64 = dataUrl.slice(comma + 1)
      if (base64ByteLength(dataBase64) <= MAX_IMAGE_BYTES) {
        return { contentType, dataBase64, preview: dataUrl }
      }
      qualityIndex += 1
    }
  }
  return null
}


const PublishItemPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [form, setForm] = useState({ cid: DEFAULT_CID, price: '', stock: '1', title: '', description: '' })
  const [images, setImages] = useState([])
  const [imageNotice, setImageNotice] = useState('')
  const [state, setState] = useState({ phase: 'idle', message: '' })
  const [currencies, setCurrencies] = useState(FALLBACK_CURRENCIES)
  const tracker = useMemo(() => createListingPublishTracker(), [])
  const fileInputRef = useRef(null)

  // 币种选项：挂载时取一次（公开读口 ⇒ 无 token 也返回）。任一路失败都**回退 $**、绝不拦提交。
  useEffect(() => {
    let cancelled = false
    fetchCurrencies(user)
      .then((rows) => {
        if (cancelled) return
        const list = Array.isArray(rows)
          ? rows.filter((row) => row && row.cid !== undefined && row.cid !== null && String(row.cid) !== '')
          : []
        if (!list.length) {
          setCurrencies(FALLBACK_CURRENCIES)
          return
        }
        setCurrencies(list)
        // 默认值不在返回列表里 ⇒ 选第一项（否则 select 会停在空值、提交 `Number('')` = 0）。
        setForm((prev) => (
          list.some((row) => String(row.cid) === String(prev.cid))
            ? prev
            : { ...prev, cid: String(list[0].cid) }
        ))
      })
      .catch(() => {
        if (!cancelled) setCurrencies(FALLBACK_CURRENCIES)
      })
    return () => { cancelled = true }
    // 刻意只跑一次（挂载时）：选项来源是公开只读面，不随登录态变化而重取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  /** 选图：仅 image/*；超出 4 张忽略多余；逐张本地压缩后入列（失败的单张丢弃，不拦其余）。
   *  压缩后仍 >1MiB 的（`compressImage` 返 null）⇒ **拒收该张**：提示 `item.imageTooLarge`，
   *  该张不入列表（其余已选图片照常保留/入列）。 */
  const onPickImages = async (event) => {
    const input = event.target
    const picked = Array.from(input.files || []).filter((file) => file && String(file.type || '').startsWith('image/'))
    input.value = '' // 允许再次选择同一文件
    const room = MAX_IMAGES - images.length
    if (room <= 0 || !picked.length) return
    const accepted = picked.slice(0, room)
    const settled = await Promise.allSettled(accepted.map(compressImage))
    const next = settled.filter((row) => row.status === 'fulfilled' && row.value).map((row) => row.value)
    const tooLarge = settled.filter((row) => row.status === 'fulfilled' && !row.value).length
    setImageNotice(tooLarge > 0 ? t('item.imageTooLarge') : '')
    if (next.length) setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES))
  }

  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index))

  const onSubmit = async (event) => {
    event.preventDefault()
    if (state.phase === 'loading') return
    setState({ phase: 'loading', message: t('jobs.submitting') })

    // ① 先逐张上传（顺序）：任一张失败 ⇒ **取消发布**（不调 publishListing，绝不产生半截商品）。
    const mediaUrls = []
    try {
      for (const image of images) {
        const uploaded = await uploadMedia(user, { content_type: image.contentType, data_base64: image.dataBase64 })
        const url = uploaded?.url
        if (typeof url !== 'string' || !url) throw new Error(String(t('error')))
        mediaUrls.push(url)
      }
    } catch (error) {
      tracker.reset() // 本次操作作废 ⇒ 重试重新取键
      setState({ phase: 'error', message: `${t('item.imageUploadFail')}: ${String(error?.message || t('error'))}` })
      return
    }

    const createKey = tracker.keyFor(listingPublishFingerprint(form))
    try {
      const created = await publishListing({
        cid: Number(form.cid),
        price: String(form.price).trim(),
        stock: String(form.stock).trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        mediaUrls,
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
      <div className="sf-item" data-sf-m="item-hero-empty">
        <div className="sf-item-empty">{t('pleaseLogin')}</div>
      </div>
    )
  }

  return (
    <div className="sf-layout" data-sf-m="item-layout">
      <div className="sf-layout-main">
        <div className="sf-item">
          <div className="sf-item-head" data-sf-m="item-hero">
            <h1 className="sf-item-title">{t('item.publish')}</h1>
            <p className="sf-item-note">{t('item.priceRoleNote')}</p>
            <div className="sf-item-actions">
              <Link className="sf-item-link" to={root('/')}>{t('item.list')}</Link>
              <button className="sf-btn sf-item-btn" type="button" onClick={() => navigate(root('/'))} data-sf-m="item-goto-feed">
                {t('item.myOrders')}
              </button>
            </div>
          </div>

          <form className="sf-item-panel" onSubmit={onSubmit} data-sf-m="item-form">
            <div className="sf-item-form">
              <label className="sf-item-field">
                <span className="sf-item-label">{t('item.title')}</span>
                <input className="sf-item-input" data-sf-m="item-input-title" value={form.title} onChange={setField('title')} required />
              </label>
              <label className="sf-item-field">
                <span className="sf-item-label">{t('item.price')}</span>
                <input className="sf-item-input" data-sf-m="item-input-price" value={form.price} onChange={setField('price')} inputMode="numeric" required />
              </label>
              <label className="sf-item-field">
                <span className="sf-item-label">{t('item.stock')}</span>
                <input className="sf-item-input" data-sf-m="item-input-stock" value={form.stock} onChange={setField('stock')} inputMode="numeric" required />
              </label>
              <label className="sf-item-field">
                <span className="sf-item-label">{t('item.cid')}</span>
                <select className="sf-item-input" data-sf-m="item-select-cid" value={form.cid} onChange={setField('cid')} required>
                  {currencies.map((row) => (
                    <option key={String(row.cid)} value={String(row.cid)}>{currencyLabel(row)}</option>
                  ))}
                </select>
              </label>
              <label className="sf-item-field sf-item-field-wide">
                <span className="sf-item-label">{t('item.description')}</span>
                <textarea className="sf-item-textarea" data-sf-m="item-input-note" value={form.description} onChange={setField('description')} rows={3} />
              </label>
              <div className="sf-item-field sf-item-field-wide" data-sf-m="item-images">
                <span className="sf-item-label">{t('item.imagesLabel')}</span>
                <input
                  ref={fileInputRef}
                  className="sf-item-file"
                  type="file"
                  accept="image/*"
                  multiple
                  data-sf-m="item-image-input"
                  onChange={onPickImages}
                />
                <div className="sf-item-image-row">
                  <button
                    className="sf-btn sf-item-btn"
                    type="button"
                    data-sf-m="item-image-add"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= MAX_IMAGES}
                  >
                    +
                  </button>
                  {images.map((image, index) => (
                    <div className="sf-item-image-thumb" data-sf-m={`item-image-thumb-${index}`} key={`${index}:${image.contentType}:${image.preview.length}`}>
                      <img src={image.preview} alt="" />
                      <button
                        className="sf-item-image-remove"
                        type="button"
                        data-sf-m={`item-image-remove-${index}`}
                        onClick={() => removeImage(index)}
                      >
                        {t('item.imageRemove')}
                      </button>
                    </div>
                  ))}
                </div>
                {imageNotice ? (
                  <p className="sf-item-meta sf-item-err" data-sf-m="item-image-notice" role="alert">{imageNotice}</p>
                ) : null}
              </div>
            </div>
            <p className="sf-item-meta">{t('item.cidNote')}</p>
            <div className="sf-item-row">
              <button className="sf-btn sf-item-btn" type="submit" data-sf-m="item-primary" disabled={state.phase === 'loading'}>
                {state.phase === 'loading' ? t('jobs.submitting') : t('item.publish')}
              </button>
              <span
                className={`sf-item-status${state.phase === 'error' ? ' sf-item-err' : ''}${state.phase === 'ok' ? ' sf-item-ok' : ''}`}
                data-sf-m="item-status"
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
        <div className="sf-item-panel" data-sf-m="item-side">
          <h2 className="sf-item-title">{t('item.line')}</h2>
          <p className="sf-item-meta">{t('item.publishNote')}</p>
          <p className="sf-item-meta">{t('item.stockNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default PublishItemPage

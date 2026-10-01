import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { buildLangPath, getLanguageFromUrl, SUPPORTED_LANGS } from '../utils'
import { useTheme } from '../theme/ThemeProvider'
import { STRUCT, TOKEN_KEYS, THEME_ATTR, THEME_TOKENS, THEME_ATTR_VALUES } from '../theme/tokens'
import {
  PREVIEW_TITLE,
  PREVIEW_CURRENT,
  PREVIEW_SOURCE_NOTE,
  THEME_BTN_DAY,
  THEME_BTN_NIGHT,
  SEARCH_DEMO,
  CHIP_DEMO,
  PRICE_UNIT,
  cardTitle,
  CARD_META,
  JOBS_TITLE,
  JOBS_DEMO,
  MARKET_TITLE,
  REBATE_TAG,
  LIVE_TITLE,
  tableTitle,
  TH_DAY,
  TH_NIGHT,
  TH_SAME,
} from './theme-preview-demo'
import './theme-preview.css'

// 4c-i 的可交互预览件（路由：/theme-preview，四语前缀下同样可达 /en/theme-preview 等）：
// ① 日/夜一键切换（真实走 ThemeProvider ⇒ 写 <html data-theme> + localStorage）
// ② 拖动浏览器窗口宽度即可看到横屏骨架 ↔ 竖屏骨架（≤767px 出现底部 tab）
// ③ 被量测元素全部带 data-sf-m，window.__sfThemePreview.measure() 一次吐全部读数，
//    供 CDP 探针做「主题切换前后几何逐值相等」的机器验证。
// ★ P6-I18N-LIT-B5：本页正文 = **演示数据**（`theme-preview-demo.js`），不国际化；
//   页内真实 UI 面（语言 chip）照旧走 locale 键。理由见 demo 模块头部。
const LOCALE_LABEL_KEYS = { zh: 'chinese', en: 'english', hk: 'cantonese', vn: 'vietnamese' }

const MEASURED = ['hero', 'search', 'chips', 'layout', 'grid', 'card-1', 'card-4', 'side', 'price-1', 'toggle-day', 'toggle-night', 'tabbar']

const ThemePreviewPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [liveValues, setLiveValues] = useState({})

  const lang = getLanguageFromUrl(location.pathname)

  // 读「当前生效值」：证明主题确实换值了（否则「几何 0 差」可能只是因为压根没换肤）。
  useEffect(() => {
    if (typeof window === 'undefined') return
    const probe = document.querySelector('[data-sf-m="card-1"]')
    if (!probe) return
    const cs = window.getComputedStyle(probe)
    setLiveValues({
      theme,
      attr: document.documentElement.getAttribute(THEME_ATTR),
      pageBg: window.getComputedStyle(document.querySelector('.sf-shell') || document.body).backgroundColor,
      cardBg: cs.backgroundColor,
      cardBorderTopColor: cs.borderTopColor,
      cardRadius: cs.borderTopLeftRadius,
      cardShadow: cs.boxShadow,
      priceRadius: window.getComputedStyle(document.querySelector('[data-sf-m="price-1"]') || probe).borderTopLeftRadius,
    })
  }, [theme])

  // 探针接口（只读量测 + 受控切换）
  useEffect(() => {
    if (typeof window === 'undefined') return
    const api = {
      setTheme: (next) => setTheme(next),
      getTheme: () => theme,
      attr: () => document.documentElement.getAttribute(THEME_ATTR),
      tokens: () => THEME_TOKENS,
      tokenKeys: () => TOKEN_KEYS,
      struct: () => STRUCT,
      measure: () => {
        const out = {}
        for (const key of MEASURED) {
          const el = document.querySelector(`[data-sf-m="${key}"]`)
          if (!el) { out[key] = null; continue }
          const r = el.getBoundingClientRect()
          out[key] = { x: r.x, y: r.y, w: r.width, h: r.height, display: window.getComputedStyle(el).display }
        }
        return out
      },
      skin: () => {
        const el = document.querySelector('[data-sf-m="card-1"]')
        const cs = window.getComputedStyle(el)
        return {
          bg: cs.backgroundColor,
          border: cs.borderTopColor,
          radius: cs.borderTopLeftRadius,
          shadow: cs.boxShadow,
          attr: document.documentElement.getAttribute(THEME_ATTR),
        }
      },
    }
    window.__sfThemePreview = api
    return () => {
      if (window.__sfThemePreview === api) delete window.__sfThemePreview
    }
  }, [theme, setTheme])

  const table = useMemo(
    () => TOKEN_KEYS.map((key) => ({ key, day: THEME_TOKENS.day[key], night: THEME_TOKENS.night[key], same: THEME_TOKENS.day[key] === THEME_TOKENS.night[key] })),
    []
  )

  return (
    <div className="sf-preview">
      <h1 data-sf-m="hero">{PREVIEW_TITLE}</h1>
      <p className="sf-preview-note">
        {PREVIEW_CURRENT}<b data-sf-theme-name>{theme}</b>（&lt;html data-theme=&quot;{THEME_ATTR_VALUES[theme]}&quot;&gt;）。
        {PREVIEW_SOURCE_NOTE}
      </p>

      <div className="sf-preview-controls">
        <button type="button" data-sf-m="toggle-day" className={`sf-btn sf-preview-btn${theme === 'day' ? ' is-on' : ''}`} onClick={() => setTheme('day')}>{THEME_BTN_DAY}</button>
        <button type="button" data-sf-m="toggle-night" className={`sf-btn sf-preview-btn${theme === 'night' ? ' is-on' : ''}`} onClick={() => setTheme('night')}>{THEME_BTN_NIGHT}</button>
        <span className="sf-preview-langs">
          {SUPPORTED_LANGS.map((code) => (
            <button
              key={code}
              type="button"
              data-sf-locale={code}
              className={`sf-chip${code === lang ? ' is-on' : ''}`}
              onClick={() => navigate(`${buildLangPath(location.pathname, code)}${location.search}`)}
            >
              {t(LOCALE_LABEL_KEYS[code])}
            </button>
          ))}
        </span>
      </div>

      <div className="sf-box" data-sf-m="search">{SEARCH_DEMO}</div>

      <div data-sf-m="chips" className="sf-preview-chips">
        {CHIP_DEMO.map((c, i) => (
          <span key={c} className={`sf-chip${i === 0 ? ' is-on' : ''}`}>{c}</span>
        ))}
      </div>

      <div className="sf-layout" data-sf-m="layout">
        <div className="sf-layout-main">
          <div className="sf-grid" data-sf-m="grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="sf-card" data-sf-m={`card-${i + 1}`}>
                <div className="sf-card-body">
                  <div className="sf-card-title">{cardTitle(i + 1)}</div>
                  <div className="sf-price" data-sf-m={i === 0 ? 'price-1' : undefined}>
                    <span className="sf-price-cur">$</span>
                    <span className="sf-price-num">{320 + i * 10}</span>
                    <span className="sf-price-unit">{PRICE_UNIT}</span>
                  </div>
                  <div className="sf-preview-meta">{CARD_META}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="sf-layout-side" data-sf-m="side">
          <div className="sf-panel">
            <div className="sf-panel-title">{JOBS_TITLE}</div>
            <div className="sf-preview-meta">{JOBS_DEMO[0].name}　<b>{JOBS_DEMO[0].pay}</b></div>
            <div className="sf-divider" />
            <div className="sf-preview-meta">{JOBS_DEMO[1].name}　<b>{JOBS_DEMO[1].pay}</b></div>
            <div className="sf-divider" />
            <div className="sf-preview-meta">{JOBS_DEMO[2].name}　<b>{JOBS_DEMO[2].pay}</b></div>
          </div>
          <div className="sf-panel">
            <div className="sf-panel-title">{MARKET_TITLE}</div>
            <div className="sf-preview-meta">SEAFOOD / $　<b>1.0240</b></div>
            <div className="sf-preview-meta">DASHJ / $　<b>0.3312</b></div>
            <div className="sf-tag">{REBATE_TAG}</div>
          </div>
        </aside>
      </div>

      <h2>{LIVE_TITLE}</h2>
      <pre data-sf-m="live" className="sf-preview-pre">{JSON.stringify(liveValues, null, 2)}</pre>

      <h2>{tableTitle(TOKEN_KEYS.length)}</h2>
      <div className="sf-preview-table-wrap">
        <table className="sf-preview-table">
          <thead>
            <tr><th>token</th><th>{TH_DAY}</th><th>{TH_NIGHT}</th><th>{TH_SAME}</th></tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.key}>
                <td>--sf-{row.key}</td>
                <td className="sf-swatch" style={{ background: row.day }}>{row.day}</td>
                <td className="sf-swatch" style={{ background: row.night }}>{row.night}</td>
                <td>{row.same ? 'yes' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ThemePreviewPage

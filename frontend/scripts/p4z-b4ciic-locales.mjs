// P4-B4c-ii-c ① / ② 文案落地探针（Kong · 本单自用；**不做语义改写，只按锚点行插入**）
// 口径：① 两条登录 401 文案（真源 backend-ts/src/auth.ts:223 / :227）⇒ locales/{zh,en,hk,vn}.json 的 `auth.err.*` 各 2 键；
//       ② 退化币对（§5.103）⇒ locales/*.json 的 `market.pairDegenerate` 1 键。
// 只按**行锚点**插入新行，保留各文件既有排版（不 JSON.stringify 重排 ⇒ diff 最小），并打印逐文件键集对拍结果。
// 用法：node scripts/p4z-b4ciic-locales.mjs            # dry-run 只打印将插入的内容
//       node scripts/p4z-b4ciic-locales.mjs --write    # 落盘
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LOCALES = path.resolve(HERE, '../src/locales')
const WRITE = process.argv.includes('--write')

const CONTENT = {
  zh: {
    auth: [
      ['INVALID_WALLET_SIGNATURE', '钱包签名无效，请重新签名后再登录。'],
      ['SIGNATURE_ADDRESS_MISMATCH', '签名与所声明的钱包地址不一致，请切回正确的钱包账号再重试。'],
    ],
    market: [['pairDegenerate', '币对退化：平台计价币（#1）不能与自身成对，该请求已跳过。']],
  },
  en: {
    auth: [
      ['INVALID_WALLET_SIGNATURE', 'The wallet signature is invalid. Please sign again to log in.'],
      ['SIGNATURE_ADDRESS_MISMATCH', 'The signed account is not the one that was claimed. Please switch accounts and retry.'],
    ],
    market: [['pairDegenerate', 'Degenerate pair: the platform quote currency (#1) cannot be paired against itself, so the request was skipped.']],
  },
  hk: {
    auth: [
      ['INVALID_WALLET_SIGNATURE', '錢包簽名無效，請重新簽名再登入。'],
      ['SIGNATURE_ADDRESS_MISMATCH', '簽名同所聲明嘅錢包地址唔一致，請轉返正確嘅錢包帳號再試。'],
    ],
    market: [['pairDegenerate', '幣對退化：平台計價幣（#1）唔可以同自己成對，嗰個請求已經跳過。']],
  },
  vn: {
    auth: [
      ['INVALID_WALLET_SIGNATURE', 'Chữ ký ví không hợp lệ, vui lòng ký lại để đăng nhập.'],
      ['SIGNATURE_ADDRESS_MISMATCH', 'Chữ ký không khớp với địa chỉ ví đã khai báo, vui lòng chuyển lại đúng tài khoản ví rồi thử lại.'],
    ],
    market: [['pairDegenerate', 'Cặp tiền suy biến: đồng định giá nền tảng (#1) không thể ghép cặp với chính nó, yêu cầu đã được bỏ qua.']],
  },
}

// 行锚点：① `"AUTH_FORBIDDEN": ...`（无尾逗号，取该行缩进）；② `"bookEmpty": ...,`（已带尾逗号）
const AUTH_ANCHOR = /^(\s*)"AUTH_FORBIDDEN":.*$/
const BOOK_ANCHOR = /^(\s*)"bookEmpty":.*,?$/

const insertAfter = (lines, anchor, pairs, { commaOnAnchor, allCommas = false }) => {
  const idx = lines.findIndex((l) => anchor.test(l))
  if (idx < 0) throw new Error(`anchor not found: ${anchor}`)
  const dupes = lines.filter((l) => anchor.test(l)).length
  if (dupes !== 1) throw new Error(`anchor not unique (${dupes}): ${anchor}`)
  const indent = lines[idx].match(anchor)[1]
  const block = pairs.map(([k, v], i) => {
    const last = i === pairs.length - 1
    return `${indent}"${k}": "${v}"${!allCommas && last ? '' : ','}`
  })
  if (commaOnAnchor) lines[idx] = lines[idx].replace(/\s*$/, '') + ','
  lines.splice(idx + 1, 0, ...block)
  return lines
}

const keys = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
)).sort()

const out = { write: WRITE, files: {}, keySets: {}, verdict: {} }

for (const [lang, spec] of Object.entries(CONTENT)) {
  const file = path.join(LOCALES, `${lang}.json`)
  const raw = fs.readFileSync(file, 'utf8')
  const hadCRLF = raw.includes('\r\n')
  out.files[lang] = { file, hadCRLF, bytesBefore: Buffer.byteLength(raw) }
  if (hadCRLF) throw new Error(`unexpected CRLF in ${file}`)

  let lines = raw.replace(/\n$/, '').split('\n')
  const already = lines.some((l) => l.includes('"pairDegenerate"') || l.includes('"INVALID_WALLET_SIGNATURE"'))
  if (already) {
    out.files[lang].skipped = 'already patched'
  } else {
    lines = insertAfter(lines, AUTH_ANCHOR, spec.auth, { commaOnAnchor: true })
    lines = insertAfter(lines, BOOK_ANCHOR, spec.market, { commaOnAnchor: false, allCommas: true })
    const next = `${lines.join('\n')}\n`
    JSON.parse(next) // 解析失败即抛（不允许写坏 JSON）
    if (WRITE) fs.writeFileSync(file, next)
    out.files[lang].bytesAfter = Buffer.byteLength(next)
    out.files[lang].inserted = [...spec.auth.map(([k]) => `auth.err.${k}`), ...spec.market.map(([k]) => `market.${k}`)]
  }
  const table = JSON.parse(fs.readFileSync(file, 'utf8'))
  out.keySets[lang] = keys(table)
  for (const [k, v] of spec.auth) out.files[lang][`value.auth.err.${k}`] = table.auth.err[k] ?? null
  for (const [k] of spec.market) out.files[lang][`value.market.${k}`] = table.market?.[k] ?? null
  if (table.auth.err.INVALID_WALLET_SIGNATURE === undefined || table.market.pairDegenerate === undefined) {
    out.verdict[lang] = 'MISSING_KEYS'
  }
}

const base = out.keySets.zh
for (const lang of Object.keys(CONTENT)) {
  out.verdict[lang] = out.verdict[lang] || (JSON.stringify(out.keySets[lang]) === JSON.stringify(base) ? 'KEYS_IDENTICAL' : 'KEYS_DIFFER')
}
out.verdict.summary = Object.values(out.verdict).every((v) => v === 'KEYS_IDENTICAL') ? 'ALL_FOUR_IDENTICAL' : 'MISMATCH'
out.keyCount = out.keySets.zh.length
console.log(JSON.stringify(out, null, 2))

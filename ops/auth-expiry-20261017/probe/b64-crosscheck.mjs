// AC1 证据：从 frontend/src/auth.js 现取解码实现，与 Buffer 逐字对照。
// 不在脚本里复写实现 —— 抽的是盘上真身源码，改坏产品代码这里会立刻红。
//
// 两层分开验（解码器与归一化各有自己的契约，混在一起会造出假 FAIL）：
//   A 层 decodeBase64Ascii：契约 = 标准 base64 字母表、无尾部 `=`（归一化由上层做）
//   B 层 decodeJwtPayloadSegment：契约 = 完整 token（base64url / 尾部补位 / 百分号编码 / 非法字符）
import fs from 'node:fs'
import path from 'node:path'

const REPO = '/Users/kevin/bistro/seafood'
const src = fs.readFileSync(path.join(REPO, 'frontend/src/auth.js'), 'utf8')

const start = src.indexOf('const B64_ALPHABET')
const endMarker = '\n}\n'
const decodeJwtStart = src.indexOf('const decodeJwtPayloadSegment')
const end = src.indexOf(endMarker, decodeJwtStart)
if (start < 0 || end < 0) {
  console.error('EXTRACT_FAILED')
  process.exit(1)
}
const extracted = src.slice(start, end + endMarker.length)
const { decodeBase64Ascii, decodeJwtPayloadSegment } = new Function(
  extracted + '\nreturn { decodeBase64Ascii, decodeJwtPayloadSegment }',
)()

// Buffer 侧参照：先归一到 Buffer 认识的形态（base64url → base64，补 `=`），再按 latin1 取字节
const refDecode = (s) => {
  let t = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (t.length % 4 === 1) return '<INVALID:len%4==1>'
  t += '='.repeat((4 - (t.length % 4)) % 4)
  return Buffer.from(t, 'base64').toString('latin1')
}
const strip = (s) => s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')

const rows = []
const push = (layer, name, input, expected, got, extra = {}) => {
  rows.push({ layer, name, input, expected, got, ok: expected === got, ...extra })
}

// ── A 层：decodeBase64Ascii（标准字母表、无尾部补位）─────────────────────────────
const aSamples = [
  ['A-1 父单实测的合法串（12 字符 / 无 padding）', 'eyJleHAiOjF9'],
  ['A-2 真实 payload shape（{"exp":1700000000,"sub":1}）', strip(Buffer.from('{"exp":1700000000,"sub":1}').toString('base64'))],
  ['A-3 多字节 UTF-8（按字节级对照，不做 UTF-8 还原）', strip(Buffer.from('{"name":"海鲜"}').toString('base64'))],
  ['A-4 含 `0x00` / `0xFF` 高位字节', strip(Buffer.from([0x00, 0xff, 0x10, 0x80]).toString('base64'))],
  ['A-5 exp 极端值长串', strip(Buffer.from('{"exp":9999999999}').toString('base64'))],
  ['A-6 单字节（最短合法组）', strip(Buffer.from([0x41]).toString('base64'))],
  ['A-7 空串 ⇒ 进程内真身回空串', ''],
  ['A-8 非法字符 `!` ⇒ 回空串（Buffer 宽容跳过，属刻意的严格）', 'ab!d'],
]
for (const [name, input] of aSamples) {
  const illegal = /[^A-Za-z0-9+/]/.test(input)
  const expected = input === '' || illegal ? '' : refDecode(input)
  push('A:decodeBase64Ascii', name, input, expected, decodeBase64Ascii(input),
    illegal ? { buffer_lenient: refDecode(input) } : {})
}

// ── B 层：decodeJwtPayloadSegment（完整 token）──────────────────────────────────
const bin = Buffer.from([0xfb, 0xef, 0xbe, 0x00, 0xff, 0xc3, 0xa9])
const bSamples = [
  ['B-1 base64url 含 `-`/`_`（0xFB 0xEF 0xBE 0x00 0xFF 0xC3 0xA9）', bin.toString('base64url')],
  ['B-2 base64url 无 padding', Buffer.from('{"exp":1700000000,"sub":1}').toString('base64url')],
  ['B-3 标准 base64 带 1 个 `=`', Buffer.from('{"exp":77}').toString('base64')],
  ['B-4 标准 base64 带 `==`', Buffer.from('{"a":1}').toString('base64')],
  ['B-5 百分号编码的补位（`%3D`）', Buffer.from('{"exp":7}').toString('base64url') + '%3D'],
  ['B-6 无 padding 的真实 JWT payload 段', 'eyJleHAiOjF9'],
]
for (const [name, seg] of bSamples) {
  const normalized = decodeURIComponent(seg)
  const expected = refDecode(normalized)
  push('B:decodeJwtPayloadSegment', name, seg, expected, decodeJwtPayloadSegment(`h.${seg}.s`))
}

// ── B 层负例：非法 / 非 JWT 形态 ⇒ 一律回 ''（→ exp=null → 绝不误踢）──────────────
const negatives = [
  ['B-7 段内夹 `!`', 'h.ab!d.s'],
  ['B-8 长度 %4==1', 'h.abcde.s'],
  ['B-9 空段', 'h..s'],
  ['B-10 非 JWT 形态（无点）', 'notajwt'],
  ['B-11 四段（非 JWT）', 'a.b.c.d'],
]
for (const [name, token] of negatives) {
  push('B:negative', name, token, '', decodeJwtPayloadSegment(token))
}

const pass = rows.filter((r) => r.ok).length
const fail = rows.length - pass
console.log(JSON.stringify({
  script: 'ops/auth-expiry-20261017/probe/b64-crosscheck.mjs',
  at: new Date().toISOString(),
  source_of_truth: 'frontend/src/auth.js（现盘抽取 decodeBase64Ascii + decodeJwtPayloadSegment）',
  reference: "Buffer.from(x,'base64').toString('latin1')",
  samples: rows.length,
  pass,
  fail,
  verdict: fail === 0 ? 'PASS' : 'FAIL',
  rows,
}, null, 2))

process.exit(fail === 0 ? 0 : 1)

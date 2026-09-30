// P4-B4c-ii-c ③ 几何回归探针 retarget（Kong）：把 4c-ii-b 的尺子复制成本单的尺子（目标页换成本单改动页）
//   · 源 = scripts/p4z-b4ciib-geometry.mjs（246 行，尺子本体不变：日/夜 rect 逐值、1px 灵敏度、可重复性、横竖屏）
//   · 目标页 = `/shard`（交易所线 = 本单 ② 改页）· `/login`（登录面板 = 本单 ① 改页）
//   · 只做**逐处字符串替换**（每处必须命中且仅命中 1 次），不改量测逻辑。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(HERE, 'p4z-b4ciib-geometry.mjs')
const DST = path.join(HERE, 'p4z-b4ciic-geometry.mjs')

const EDITS = [
  [
    "const OUT = path.join(OUT_DIR, 'post', 'b4ciib-geometry.json')",
    "const OUT = path.join(OUT_DIR, 'post', 'b4ciic-geometry.json')",
  ],
  [
    `const PAGES = [
  { name: 'listing_feed', url: \`\${ORIGIN}/listing\`, perturb: '[data-sf-m="listing-refund"]' },
  { name: 'listing_new', url: \`\${ORIGIN}/listing/new\`, perturb: '[data-sf-m="listing-form"]' },
  { name: 'listing_detail', url: \`\${ORIGIN}/listing/1\`, perturb: '[data-sf-m="listing-buy-form"]' },
  { name: 'market', url: \`\${ORIGIN}/shard\`, perturb: '[data-sf-m="mkt-form"]' },
]`,
    `const PAGES = [
  // 本单 ② 改动页：交易所线（退化币对空态分支 + 不发请求）
  { name: 'market', url: \`\${ORIGIN}/shard\`, perturb: '[data-sf-m="mkt-form"]' },
  // 本单 ① 改动页：登录面板（WalletAuthPanel 根节点新增 data-sf-m 供尺子取点）
  { name: 'login', url: \`\${ORIGIN}/login\`, perturb: '[data-sf-m="auth-wallet-panel"]' },
]`,
  ],
  [
    `  '[data-sf-m="mkt-ledger-empty"]',
]`,
    `  '[data-sf-m="mkt-ledger-empty"]',
  // 登录面板（本单 ①）
  '[data-sf-m="auth-wallet-panel"]',
]`,
  ],
  [
    "window.localStorage.setItem('user', JSON.stringify({ uID: 1, EVM: '0xprobe', token: 'probe-token' }))",
    "window.localStorage.setItem('user', JSON.stringify({ uID: 1, EVM: '0xprobe', token: 'probe-token', bio: 'probe profile ready' }))",
  ],
  [
    '// P4-B4c-ii-b ② 真实浏览器几何量测（复制 4c-ii-a 的 `p4z-b4cii-geometry.mjs` 尺子，目标页换成本单新增/改动的页）',
    '// P4-B4c-ii-c ③ 真实浏览器几何量测（复制 4c-ii-b 的 `p4z-b4ciib-geometry.mjs` 尺子，目标页换成本单改动页：/shard · /login）',
  ],
]

let text = fs.readFileSync(SRC, 'utf8')
const applied = []
for (const [from, to] of EDITS) {
  const hits = text.split(from).length - 1
  if (hits !== 1) throw new Error(`edit must hit exactly once (got ${hits}): ${from.slice(0, 60)}`)
  text = text.replace(from, to)
  applied.push(from.split('\n')[0].trim().slice(0, 70))
}
fs.writeFileSync(DST, text)
console.log(JSON.stringify({ src: SRC, dst: DST, bytes: Buffer.byteLength(text), applied }, null, 2))

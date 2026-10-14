/**
 * AC-1 探针 · 站内信通知「带预览」**出站文本真链取证**（Neng 窄质检 · 只读）
 * ---------------------------------------------------------------------------
 * 跑法：
 *   cd /Users/kevin/bistro/seafood/backend-ts && \
 *   npx ts-node --transpile-only --project tsconfig.scripts.probe.json \
 *     /Users/kevin/bistro/seafood/ops/tg-notify-preview/probes/probe-ac1-realchain.ts \
 *     /Users/kevin/bistro/seafood/ops/tg-notify-preview/readings/ac1-outbound-text.json
 *
 * 真链口径（本次关键）：
 *   · **真 `require`** `backend-ts/src/messages-service`（真链级；探针内**不重写任何截断逻辑**）。
 *   · `globalThis.fetch` 被 stub ⇒ **捕获真实发送路径的 payload**（`notifyMessageCounterpart` 的 body）。
 *   · `db.readQuery` **只读面**路由：`app_config`（站点名）走**真库读**；对端绑定行返回**合成** chat_id/title。
 *   · 自写向量（非跑作者脚本）：预览 5 类 + 边界，期望值为**字面量**；另有探针自建独立尺子做不变量。
 *   · 负向：仓外变异体副本（7 单位尺子 / 空预览照插）⇒ 断言**必红**。
 */
import assert from 'assert';
import fs from 'fs';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';

declare const require: (m: string) => any;

const REPO = '/Users/kevin/bistro/seafood';
const BE = `${REPO}/backend-ts`;
const OUT = process.argv[2] || `${REPO}/ops/tg-notify-preview/readings/ac1-outbound-text.json`;

const checks: { id: string; pass: boolean; detail?: unknown }[] = [];
const ok = (id: string, detail?: unknown): void => { checks.push({ id, pass: true, detail }); };
const bad = (id: string, detail?: unknown): void => { checks.push({ id, pass: false, detail }); };
const check = (id: string, cond: boolean, detail?: unknown): void => (cond ? ok(id, detail) : bad(id, detail));

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// ================================================================ ① 真链装配（fetch stub + 真 import）
const captured: { url: string; body: any }[] = [];
(globalThis as any).fetch = async (url: any, init: any) => {
  let body: any = null;
  try { body = JSON.parse(String(init?.body ?? '{}')); } catch { body = { __unparsed: String(init?.body) }; }
  captured.push({ url: String(url), body });
  return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) } as any;
};

const svc = require(`${BE}/src/messages-service`); // ★ 真链：真模块（不复制实现）
const db = require(`${BE}/src/db`);
const realReadQuery = db.readQuery;
const SYNTH = {
  chatId: '9900000000001',                                  // 合成 chat_id（具名披露）
  title: 'Probe-List',                                      // 合成商品标题（≤ 12 字 ⇒ 掩码不截断，便于逐字比对）
  titleLong: 'Synthetic Probe Listing For Mask Check',      // 合成长标题（> 12 字 ⇒ 掩码截断，用 e8 独立核对）
  conversationId: 900001,
  fromUid: 971214,
};
const sqlSeen: { sql: string; params: unknown }[] = [];
let titleForRow = SYNTH.title; // 合成标题开关（e8 用长标题；不影响真实现）
db.readQuery = async (text: string, params?: unknown[]) => {
  const one = String(text).replace(/\s+/g, ' ').trim();
  sqlSeen.push({ sql: one.slice(0, 64), params: params ?? null });
  if (/app_config/.test(text)) return realReadQuery(text, params);     // 站点名 = 真库读
  return [{ tg_user_id: SYNTH.chatId, title: titleForRow }];           // 对端行 = 合成（披露）
};

// ================================================================ ② 现取规范册 §41.7「模板 = …」行（括号配对抽取，非手抄）
const specPath = `${REPO}/docs/route-layer.spec.md`;
const specLines = fs.readFileSync(specPath, 'utf8').split('\n');
const rowIdx = specLines.findIndex((l) => l.includes('模板 = 「<站点名>：你有新消息'));
assert.ok(rowIdx >= 0, '§41.7 模板行必须在册');
const specRow = specLines[rowIdx];
const marker = '模板 = 「';
let i = specRow.indexOf(marker) + marker.length;
let depth = 1;
let specTemplate = '';
while (i < specRow.length && depth > 0) {
  const ch = specRow[i];
  if (ch === '「') depth += 1;
  else if (ch === '」') { depth -= 1; if (depth === 0) break; }
  specTemplate += ch;
  i += 1;
}
const renderFromSpec = (v: { siteName: string; site: string; maskedTitle: string; preview: string }): string =>
  specTemplate
    .replaceAll('<站点名>', v.siteName)
    .replaceAll('<商品标题掩码>', v.maskedTitle)
    .replaceAll('<消息开头预览>', v.preview)
    .replaceAll('<站点域名>', v.site)
    .replaceAll('<site>', v.site);
check('a1 抽取到的 §41.7 模板字面非空且含全部 5 个占位符',
  specTemplate.length > 0 && ['<站点名>', '<商品标题掩码>', '<消息开头预览>', '<站点域名>', '<site>'].every((p) => specTemplate.includes(p)),
  specTemplate);

// ================================================================ ③ 原形（空正文回落句）：现取 a280afe^ 的旧字面（非手抄）
const oldSrc = execFileSync('git', ['-C', REPO, 'show', 'a280afe^:backend-ts/src/messages-service.ts'], { encoding: 'utf8' });
const oldLine = oldSrc.split('\n').find((l) => l.includes('你有新消息')) ?? '';
const oldMatch = oldLine.match(/const text = `([^`]*)`/);
assert.ok(oldMatch, '旧实现（a280afe^）通知字面必须在册');
const oldTemplate = oldMatch[1];
const renderOriginal = (v: { siteName: string; site: string; maskedTitle: string }): string =>
  oldTemplate.replaceAll('${siteName}', v.siteName).replaceAll('${maskedTitle}', v.maskedTitle)
    .replaceAll('${masked}', v.maskedTitle).replaceAll('${site}', v.site);

// ================================================================ ④ a. 模板逐字一致（实现 vs 规范行）
const FIX = { siteName: 'Seafood Club', site: 'https://0xseafood.com', maskedTitle: '合成标题掩码ABC' };
const withPreview = svc.buildMessageNotificationText({ ...FIX, preview: '你好吗' });
const noPreview = svc.buildMessageNotificationText({ ...FIX, preview: '' });
check('a2 有预览 ⇒ 与 §41.7 模板行逐字一致（占位符代入）', withPreview === renderFromSpec({ ...FIX, preview: '你好吗' }),
  { got: withPreview, want: renderFromSpec({ ...FIX, preview: '你好吗' }) });
check('a3 无预览 ⇒ 与 §41.7 模板行「预览段置空」逐字一致（预览紧随右括号、无「：」引出）',
  noPreview === renderFromSpec({ ...FIX, preview: '' }).replace('「」', ''), // 预览段整体不出现
  { got: noPreview, want: renderFromSpec({ ...FIX, preview: '' }).replace('「」', '') });
check('a4 无预览 ⇒ 与 a280afe^ 旧字面逐字一致（原形零位移）', noPreview === renderOriginal(FIX),
  { got: noPreview, want: renderOriginal(FIX) });

// ================================================================ ⑤ b. 自写预览向量（期望值为字面量）
const PREVIEW_VECTORS: { label: string; body: unknown; want: string }[] = [
  { label: 'b1 纯汉字 3 字（=6 单位）⇒ 不省略', body: '你好吗', want: '你好吗' },
  { label: 'b2 纯汉字 4 字 ⇒ 截 3 字 + …', body: '你好吗的', want: '你好吗…' },
  { label: 'b3 拉丁 6 ⇒ 不省略', body: 'abcdef', want: 'abcdef' },
  { label: 'b4 拉丁 7 ⇒ 截 6 + …', body: 'abcdefg', want: 'abcdef…' },
  { label: 'b5 中英混合满额（你好ab=6）⇒ 不省略', body: '你好ab', want: '你好ab' },
  { label: 'b6 中英混合超一（你好abc=7）⇒ 你好ab + …', body: '你好abc', want: '你好ab…' },
  { label: 'b7 国旗 3 簇（区域指示符成对，6 单位）⇒ 不省略、不拆对', body: '🇻🇳🇺🇸🇯🇵', want: '🇻🇳🇺🇸🇯🇵' },
  { label: 'b8 国旗 3 簇 + 拉丁 ⇒ 三面旗全留 + …', body: '🇻🇳🇺🇸🇯🇵x', want: '🇻🇳🇺🇸🇯🇵…' },
  { label: 'b9 ZWJ 家庭簇（单簇）⇒ 整簇不拆', body: '👨‍👩‍👧', want: '👨‍👩‍👧' },
  { label: 'b10 ZWJ 簇 + 2 汉字（=6）⇒ 不省略', body: '👨‍👩‍👧你好', want: '👨‍👩‍👧你好' },
  { label: 'b11 ZWJ 簇 + 3 汉字 ⇒ 截在簇边界（你好 + …）', body: '👨‍👩‍👧你好吗', want: '👨‍👩‍👧你好…' },
  { label: 'b12 全角标点 4 个 ⇒ 截 3 + …', body: '！！！！', want: '！！！…' },
  { label: 'b13 首尾空白先去', body: '  你好吗  ', want: '你好吗' },
  { label: 'b14 空正文 ⇒ 空预览', body: '', want: '' },
  { label: 'b15 全空白 ⇒ 空预览', body: '   \n\t ', want: '' },
  { label: 'b16 非串（数字）⇒ 空预览', body: 12345, want: '' },
  { label: 'b17 null ⇒ 空预览', body: null, want: '' },
];
const vectorReads = PREVIEW_VECTORS.map((v) => {
  const got = svc.buildMessagePreview(v.body);
  const pass = got === v.want;
  check(`预览向量 ${v.label}`, pass, { in: typeof v.body === 'string' ? v.body : JSON.stringify(v.body), got, want: v.want });
  return { label: v.label, input: v.body, got, want: v.want, pass };
});

// 簇完整性（emoji 不拆对 / 不留孤立代理 / 不留悬空 ZWJ）
const emojiOuts = vectorReads.filter((r) => /[\uD800-\uDFFF\u200D]/.test(String(r.got)));
check('b18 emoji 输出无孤立代理半体且不以 ZWJ 结尾',
  emojiOuts.every((r) => !LONE_SURROGATE.test(String(r.got)) && !String(r.got).endsWith('\u200D')),
  emojiOuts.map((r) => ({ label: r.label, got: r.got, lone: LONE_SURROGATE.test(String(r.got)) })));

// 探针自建独立尺子（不进被测实现）→ 不变量：输出（去省略号）显示宽 ≤ 6
const WIDE_RANGES: [number, number][] = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
  [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe4f],
  [0xff01, 0xff60], [0xffe0, 0xffe6], [0x1f000, 0x1faff], [0x2600, 0x27bf], [0x1f1e6, 0x1f1ff],
];
const independentUnits = (s: string): number => {
  const Seg = (Intl as any).Segmenter;
  const clusters: string[] = Seg
    ? [...new Seg('en', { granularity: 'grapheme' }).segment(s)].map((p: any) => p.segment)
    : Array.from(s);
  let units = 0;
  for (const c of clusters) {
    const wide = [...c].some((ch) => {
      const cp = ch.codePointAt(0) as number;
      return WIDE_RANGES.some(([a, b]) => cp >= a && cp <= b);
    });
    units += wide ? 2 : 1;
  }
  return units;
};
const unitReads = vectorReads
  .filter((r) => String(r.got) !== '')
  .map((r) => ({ label: r.label, stripped: String(r.got).replace(/…$/, ''), units: independentUnits(String(r.got).replace(/…$/, '')) }));
check('b19 不变量（自建独立尺子）：各向量输出（去省略号）显示宽 ≤ 6 且 ≤ 输入', unitReads.every((r) => r.units <= 6), unitReads);

// ================================================================ ⑥ c. 英文半段逐字未变 + 预览不重复
const EN_HALF = ' / You have a new message, open https://0xseafood.com/messages';
check('c1 英文半段逐字未变（与规范模板行的英文半段同源）',
  withPreview.endsWith(EN_HALF) && renderFromSpec({ ...FIX, preview: '' }).includes(EN_HALF.trim().replace(' / ', ' / '))
  && specTemplate.includes(' / You have a new message, open <site>/messages'),
  { tail: withPreview.slice(-EN_HALF.length) });
check('c2 预览在整个文本中恰出现 1 次（不重复）', withPreview.split('你好吗').length - 1 === 1, withPreview);
check('c3 英文半段恰出现 1 次', withPreview.split(EN_HALF).length - 1 === 1, withPreview);

// ================================================================ ⑦ 真链：notifyMessageCounterpart ⇒ fetch 捕获
const main = async (): Promise<void> => {
process.env.TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim() || 'probe-dummy-token';
const dbSiteRow = (await realReadQuery<{ value: unknown }>(
  `SELECT value FROM public.app_config WHERE key = 'system_settings' LIMIT 1`,
)) as { value: unknown }[];
const rawName = dbSiteRow[0]?.value && typeof (dbSiteRow[0].value as any).siteName === 'string' ? String((dbSiteRow[0].value as any).siteName).trim() : '';
const expectSiteName = rawName || 'Seafood Club';
const expectSite = (process.env.PUBLIC_SITE_URL || '').trim() || 'https://0xseafood.com';

captured.length = 0;
svc.notifyMessageCounterpart({ conversationId: SYNTH.conversationId, fromUid: SYNTH.fromUid, previewText: '你好吗的' });
const deadline = Date.now() + 8000;
while (captured.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));

const send = captured[0];
const wantChain = renderFromSpec({ siteName: expectSiteName, site: expectSite, maskedTitle: SYNTH.title, preview: '你好吗…' });
const tokenInEnv = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
check('e1 真链触发 fetch（notifyMessageCounterpart 后台段）', captured.length === 1, { captured: captured.length, sql_seen: sqlSeen });
check('e2 捕获 URL = Telegram sendMessage（token 掩码）',
  !!send && /^https:\/\/api\.telegram\.org\/bot.+\/sendMessage$/.test(send.url),
  send && send.url.replace(tokenInEnv, '***TOKEN***'));
check('e3 payload.chat_id = 合成对端 tg_user_id（字符串原样）', send?.body?.chat_id === SYNTH.chatId, send?.body?.chat_id);
check('e4 真链出站 text 与 §41.7 模板行逐字一致（含预览 你好吗…）', send?.body?.text === wantChain,
  { got: send?.body?.text, want: wantChain });
check('e5 真链出站 text 预览恰 1 次、英文半段恰 1 次',
  !!send && send.body.text.split('你好吗…').length - 1 === 1 && send.body.text.split(` / You have a new message, open ${expectSite}/messages`).length - 1 === 1,
  send?.body?.text);
check('e6 真链出站 text 不含「：」引出预览的作废形态', !!send && !/）\s*：/.test(send.body.text), send?.body?.text);

// ④ 空正文真链：不追加预览段
captured.length = 0;
svc.notifyMessageCounterpart({ conversationId: SYNTH.conversationId, fromUid: SYNTH.fromUid, previewText: '   ' });
const deadline2 = Date.now() + 8000;
while (captured.length === 0 && Date.now() < deadline2) await new Promise((r) => setTimeout(r, 10));
const sendEmpty = captured[0];
check('e7 空/全空白正文真链 ⇒ 整句逐字回原形（无「」预览段）',
  sendEmpty?.body?.text === renderOriginal({ siteName: expectSiteName, site: expectSite, maskedTitle: SYNTH.title })
  && !sendEmpty?.body?.text.includes('「'),
  { got: sendEmpty?.body?.text, want: renderOriginal({ siteName: expectSiteName, site: expectSite, maskedTitle: SYNTH.title }) });

// ④-b 环境性：哑 token 真发（getMe）⇒ 记录不判负
let envRealSend: any = null;
try {
  const raw = execFileSync('curl', ['-s', '-m', '15', '-w', '\n%{http_code}',
    `https://api.telegram.org/bot${tokenInEnv}/getMe`], { encoding: 'utf8' });
  const idx = raw.lastIndexOf('\n');
  envRealSend = { http: Number(raw.slice(idx + 1)), body: raw.slice(0, idx).replace(tokenInEnv, '***TOKEN***').slice(0, 300) };
} catch (e) {
  envRealSend = { error: (e as Error).message.slice(0, 200) };
}

// ④-c 长标题（>12 字）⇒ 预览紧随**掩码后**标题；掩码形态由探针独立公式核对（§41.2 `TITLE_MASK_MAX_CHARS`）
titleForRow = SYNTH.titleLong;
captured.length = 0;
svc.notifyMessageCounterpart({ conversationId: SYNTH.conversationId, fromUid: SYNTH.fromUid, previewText: '你好吗' });
const deadline3 = Date.now() + 8000;
while (captured.length === 0 && Date.now() < deadline3) await new Promise((r) => setTimeout(r, 10));
const sendLong = captured[0];
const wantLongMasked = `${SYNTH.titleLong.slice(0, 12)}…`;
check('e8 长标题 ⇒ 出站含「掩码标题（首 12 字 + …）」且预览紧随其后（逐字）',
  sendLong?.body?.text === `${expectSiteName}：你有新消息（来自会话：${wantLongMasked}）「你好吗」，打开 ${expectSite}/messages 查看 / You have a new message, open ${expectSite}/messages`
  && !sendLong?.body?.text.includes(SYNTH.titleLong),
  { got: sendLong?.body?.text, want_masked: wantLongMasked });
titleForRow = SYNTH.title;

// ================================================================ ⑧ d. 负向：仓外变异体 ⇒ 必红
const mutants = require(`${REPO}/ops/tg-notify-preview/probes/mutants-msg-preview.ts`);
const mutate = (fn: (b: unknown) => string): { label: string; got: string; want: string }[] =>
  PREVIEW_VECTORS.map((v) => ({ label: v.label, got: fn(v.body), want: v.want })).filter((r) => r.got !== r.want);
const m1Red = mutate(mutants.mutantPreviewTrunc7);
const m1GreenAgainstMutant = PREVIEW_VECTORS.filter((v) => mutants.mutantPreviewTrunc7(v.body) === v.want).length;
const DIFF_BODY = 'abcdefgh'; // 8 拉丁：真实现 ⇒ 'abcdef…'；M1（7 单位）⇒ 'abcdefg…'
const diffReal = svc.buildMessagePreview(DIFF_BODY);
const diffMut1 = mutants.mutantPreviewTrunc7(DIFF_BODY);
check('d1 变异体 M1（7 单位尺子）被自写向量判红（≥3 条红，含 b4/b6/b8）',
  m1Red.length >= 3 && ['b4', 'b6', 'b8'].every((p) => m1Red.some((r) => r.label.startsWith(p))),
  { red: m1Red, green: m1GreenAgainstMutant });
check(`d1b 边界差分（${DIFF_BODY} = 8 单位）：真实现 6 单位尺子 / M1 7 单位尺子，两者必不同`,
  diffReal === 'abcdef…' && diffMut1 === 'abcdefg…' && diffReal !== diffMut1,
  { real: diffReal, mutant_m1: diffMut1 });
check('d2 变异体 M1 的真实函数族对照：真实现 0 条红 / M1 ≥3 条红（尺子灵敏）',
  vectorReads.every((r) => r.pass) && m1Red.length >= 3,
  { real_red: vectorReads.filter((r) => !r.pass).length, mut_red: m1Red.length });
const m2Got = mutants.mutantNotificationAlwaysPreview({ ...FIX, preview: '' });
check('d3 变异体 M2（空预览照插「」）被判红：真实现回原形 / M2 出现「」空预览段',
  noPreview === renderOriginal(FIX) && m2Got !== noPreview && m2Got.includes('「」'),
  { real: noPreview, mutant: m2Got });

// ================================================================ ⑨ 写读数
const head = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const result = {
  ac: 'AC-1',
  at: new Date().toISOString(),
  head_under_test: head,
  module_under_test: 'backend-ts/src/messages-service.ts (真 require，真链级)',
  probes: {
    ac1: `${REPO}/ops/tg-notify-preview/probes/probe-ac1-realchain.ts`,
    mutants: `${REPO}/ops/tg-notify-preview/probes/mutants-msg-preview.ts`,
  },
  spec: {
    path: 'docs/route-layer.spec.md', line: rowIdx + 1, template: specTemplate,
    template_sha256: createHash('sha256').update(specTemplate).digest('hex'),
  },
  original_literal_source: 'git show a280afe^:backend-ts/src/messages-service.ts (旧句现取)',
  original_template_sha256: createHash('sha256').update(oldTemplate).digest('hex'),
  synthetic_fixture: SYNTH,
  sql_seen: sqlSeen,
  vectors: vectorReads,
  mutation: { m1_red: m1Red, m1_green: m1GreenAgainstMutant, m2_mutant_text: m2Got },
  real_chain: {
    url_masked: send?.url.replace(tokenInEnv, '***TOKEN***') ?? null,
    payload: send?.body ?? null,
    want: wantChain,
    empty_body_payload: sendEmpty?.body ?? null,
    long_title_payload: sendLong?.body ?? null,
    long_title_want_masked: wantLongMasked,
    expect_site_name: expectSiteName, expect_site: expectSite,
  },
  env_real_send_dumb_token: envRealSend,
  checks,
  failed_checks: checks.filter((c) => !c.pass),
  verdict: checks.every((c) => c.pass) ? 'PASS' : 'FAIL',
};
fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ verdict: result.verdict, checks: checks.length, failed: result.failed_checks, spec_line: rowIdx + 1, real_chain_text: send?.body?.text, m1_red: m1Red.length, env: envRealSend }, null, 2));
};

main().catch((e: unknown) => { console.error('PROBE ERROR:', e instanceof Error ? e.stack ?? e.message : e); process.exit(1); });

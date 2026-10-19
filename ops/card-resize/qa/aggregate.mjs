// card-resize QA · 聚合判据（读盘上既有读数做逐条断言，零写库）
// 产出: readings/aggregate.json（每条判据 pass/fail + 实测值）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/kevin/bistro/seafood';
const QA = path.join(ROOT, 'ops/card-resize/qa');
const R = (f) => JSON.parse(fs.readFileSync(path.join(QA, 'readings', f), 'utf8'));

const checks = [];
const ck = (id, cond, got, note = '') => { checks.push({ id, pass: !!cond, got, note }); return cond; };
const near = (a, b, tol = 0.51) => Math.abs(a - b) <= tol;

const probe = R('probe-card-qa.json');
const credit = R('credit-tier.json');

// ---------- AC1 四组合恒高（1440 + 1536） ----------
const COMBO_NAMES = ['A有图', 'B无图(占位)', 'C长标题60字', 'D无描述'];
for (const v of ['fixture-w1440', 'fixture-w1536']) {
  const view = probe.views[v];
  ck(`${v}.cardCount=4`, view.cardCount === 4, view.cardCount);
  view.cards.forEach((c, i) => {
    const tag = `${v}.${COMBO_NAMES[i]}`;
    ck(`${tag}.cardH=412`, c.cardH === 412, c.cardH);
    ck(`${tag}.innerH=412`, c.innerH === 412, c.innerH);
    ck(`${tag}.sellerH=48`, c.sellerH === 48, c.sellerH);
    if (c.media) {
      ck(`${tag}.mediaH=240`, c.media.h === 240, c.media.h);
      // 「通栏 = 占满卡内宽」：参照 = .sf-reward-inner 的 clientWidth（不含 1px 边框；padding=0）
      ck(`${tag}.mediaW=卡内宽`, near(c.media.w, c.innerClientW), { mediaW: c.media.w, innerClientW: c.innerClientW, cardW: c.cardW, borderX: c.innerBorderX });
      ck(`${tag}.innerW自洽(卡宽-边框=内宽)`, near(c.cardW - (c.innerBorderX || 0), c.innerClientW), { cardW: c.cardW, borderX: c.innerBorderX, innerClientW: c.innerClientW });
      ck(`${tag}.fit=cover`, c.img && c.img.fit === 'cover', c.img && c.img.fit);
      ck(`${tag}.imgLoaded`, c.img && c.img.complete && c.img.naturalWidth > 0, c.img);
    } else {
      ck(`${tag}.mediaPresent`, false, 'media block missing');
    }
    ck(`${tag}.blobPresent`, c.blob.present === true, c.blob.present);
    ck(`${tag}.sellerW=卡内宽`, near(c.sellerW, c.innerClientW), { sellerW: c.sellerW, innerClientW: c.innerClientW });
  });
}
// 组合语义抽查：C 长标题在 title、D 无描述
{
  const c = probe.views['fixture-w1440'].cards;
  ck('combo.C.titleLen60', [...(c[2].title || '')].length === 60, [...(c[2].title || '')].length);
  ck('combo.D.noDesc', c[3].descPresent === false, c[3].descPresent);
  ck('combo.A.shortTitle', [...(c[0].title || '')].length < 20, c[0].title);
}

// ---------- AC2 移除项计数 0 + 光斑保留 ----------
for (const v of ['fixture-w1440', 'fixture-w1536', 'realfeed-w1440', 'realfeed-w390']) {
  const view = probe.views[v];
  ck(`${v}.giftIcons=0`, view.gridGiftIcons === 0 && view.cards.every(c => c.giftIcons === 0), { grid: view.gridGiftIcons, perCard: view.cards.map(c => c.giftIcons) });
  ck(`${v}.removedTexts=0`, view.gridRemovedCounts.every(x => x.n === 0) && view.cards.every(c => c.removedTexts.length === 0), view.gridRemovedCounts);
  ck(`${v}.blob每卡在场`, view.cards.every(c => c.blob.present), view.cards.map(c => c.blob.present));
}

// ---------- AC3 卖家栏（真 feed：掩码格式 / 占位头像 / new 档） ----------
const MASK_RE = /^0x[0-9a-fA-F]{2}\*\*[0-9a-fA-F]{2}$/;
{
  const view = probe.views['realfeed-w1440'];
  view.cards.forEach((c, i) => {
    const tag = `realfeed.card${i}`;
    ck(`${tag}.sellerH=48`, c.sellerH === 48, c.sellerH);
    ck(`${tag}.maskFormat`, MASK_RE.test(c.nickname || '') && (c.nickname || '').length === 8, c.nickname);
    ck(`${tag}.avatar占位(灰底首字符)`, c.avatar && !c.avatar.hasImg && c.avatar.bg === 'rgb(238, 240, 242)' && c.avatar.text === (c.nickname || ' ')[0], c.avatar);
    ck(`${tag}.tier=new文案`, c.tierText === '新卖家', c.tierText);
  });
}
// 掩码不含完整地址（对 feed 全部卖家的 DB evm 逐一断言）
{
  const createRequire2 = createRequire(path.join(ROOT, 'backend-ts/package.json'));
  const { neon } = createRequire2('@neondatabase/serverless');
  const dotenv = createRequire2('dotenv');
  const parsed = dotenv.parse(fs.readFileSync(path.join(ROOT, 'backend-ts/.env.local'), 'utf8'));
  const sql = neon(parsed.DATABASE_URL);
  const view = probe.views['realfeed-w1440'];
  const nicknames = [...new Set(view.cards.map(c => c.nickname))];
  // 由掩码反查：取全部用户 evm，按 maskWalletAddress 规则现场重算比对
  const users = await sql`SELECT uid::text AS uid, evm FROM public.users`;
  const recompute = (evm) => (String(evm).length >= 8 ? `${String(evm).slice(0, 4)}**${String(evm).slice(-2)}` : String(evm));
  const byMask = {};
  for (const u of users) { const m = recompute(u.evm); (byMask[m] = byMask[m] || []).push(u.evm); }
  for (const nick of nicknames) {
    const evms = byMask[nick] || [];
    ck(`mask.${nick}=单源重算一致且不含全址`, evms.length >= 1 && evms.every(e => e !== nick && !nick.includes(e) && nick.length === 8), { nick, evmCount: evms.length, evmSample: (evms[0] || '').slice(0, 10) + '…' });
  }
  ck('mask.feed昵称集非空', nicknames.length >= 1, nicknames);
}

// ---------- AC3 信用档（无评分 new / 插 5 星 excellent） ----------
ck('credit.插行前全 new', probe.views['realfeed-w1440'].cards.every(c => c.tierText === '新卖家'), 'realfeed 插行前档分布');
ck('credit.插行计数0→1→0', credit.before.rating_count === 0 && credit.inserted.count_after_insert === 1 && credit.after.rating_count === 0, { before: credit.before.rating_count, mid: credit.inserted.count_after_insert, after: credit.after.rating_count });
ck('credit.触发器恒O', credit.before.trigger === 'O' && credit.inserted.trigger_after_insert === 'O' && credit.after.trigger === 'O', { before: credit.before.trigger, mid: credit.inserted.trigger_after_insert, after: credit.after.trigger });
ck('credit.API.excellent', (credit.api.seller970213 || []).some(x => x.bID === 76 && x.credit === 'excellent'), credit.api.seller970213);
ck('credit.其余仍new', credit.api.otherCredits.every(x => x === 'new'), credit.api.otherCredits);
ck('credit.页面.卖家信用优秀', credit.page.listing76Tier === '卖家信用优秀', credit.page.listing76Tier);
ck('credit.页面.其余新卖家', credit.page.tierDistribution.filter(t => t === '卖家信用优秀').length === 1, credit.page.tierDistribution);

// ---------- AC4 数据面（dev / 生产） ----------
{
  const all = R('dev-prize-all.json');
  const rows = all.data;
  const first = rows[0];
  const KEYCOUNT = Object.keys(first).length;
  ck('dev.prizeAll.行键46', KEYCOUNT === 46 && rows.every(r => Object.keys(r).length === 46), KEYCOUNT);
  ck('dev.prizeAll.seller四键', rows.every(r => r.seller && JSON.stringify(Object.keys(r.seller).sort()) === JSON.stringify(['avatar', 'credit', 'nickname', 'uid'])), first.seller);
  const one = R('dev-prize-1.json').data;
  ck('dev.prize1.顶层46', Object.keys(one).length === 46, Object.keys(one).length);
  ck('dev.prize1.seller.credit在场', one.seller && 'credit' in one.seller, one.seller);
  // 生产（未 push ⇒ 旧版预期态：读数留证，不判产品缺陷）
  const prodAll = R('prod-prize-all.json');
  ck('prod.prizeAll.行键45(未push旧版)', Object.keys(prodAll.data[0]).length === 45 && prodAll.data.every(r => !r.seller), Object.keys(prodAll.data[0]).length);
  const prodOne = R('prod-prize-1.json').data;
  ck('prod.prize1.seller无credit(未push旧版)', prodOne.seller && !('credit' in prodOne.seller), prodOne.seller);
}

// ---------- AC6 回归 ----------
{
  const item1 = probe.views['item1-w1440'];
  ck('item1.渲染(rootLen>0)', item1.rootLen > 0, item1.rootLen);
  ck('item1.零未捕获异常', (item1.uncaught || []).length === 0, item1.uncaught);
  const m390 = probe.views['realfeed-w390'];
  ck('w390.零横向溢出', m390.overflowX === 0, m390.overflowX);
  ck('w390.卡高412', m390.cards.every(c => c.cardH === 412), m390.cards.map(c => c.cardH));
  ck('w390.零未捕获异常', (m390.uncaught || []).length === 0, m390.uncaught);
  // currencies / media999 现取
  const cur = await fetch('http://localhost:5788/api/currencies').then(r => r.json());
  ck('reg.currencies=2行', Array.isArray(cur.data) && cur.data.length === 2, (cur.data || []).map(x => x.symbol));
  const m999 = await fetch('http://localhost:5788/api/media/999');
  ck('reg.media999=404', m999.status === 404, m999.status);
}

// ---------- 门套读数（落盘日志判读） ----------
{
  const buildLog = fs.readFileSync(path.join(QA, 'logs/build.log'), 'utf8');
  ck('gate.build.exit0+✓built', buildLog.includes('BUILD_EXIT=0') && /✓ built in/.test(buildLog), buildLog.split('\n').filter(l => l.includes('built in') || l.includes('BUILD_EXIT')).join(' | '));
  const tuLog = fs.readFileSync(path.join(QA, 'logs/test-unit.log'), 'utf8');
  const mFiles = tuLog.match(/Test Files\s+(\d+) passed \((\d+)\)/);
  const mTests = tuLog.match(/Tests\s+(\d+) passed \((\d+)\)/);
  ck('gate.testUnit.62文件/598例', mFiles && +mFiles[2] >= 62 && mTests && +mTests[2] >= 598 && tuLog.includes('TEST_EXIT=0'), { files: mFiles && mFiles[2], tests: mTests && mTests[2] });
  const tscLog = fs.readFileSync(path.join(QA, 'logs/backend-tsc.log'), 'utf8');
  ck('gate.backendTsc.exit0', tscLog.includes('TSC_EXIT=0') && !/error TS/i.test(tscLog), tscLog.trim().split('\n').slice(-2).join(' | '));
  const p7Raw = fs.readFileSync(path.join(QA, 'logs/p7b-03.log'), 'utf8');
  const p7 = JSON.parse(p7Raw.slice(p7Raw.indexOf('{'), p7Raw.lastIndexOf('}') + 1));
  ck('gate.p7b03.37/37', p7.summary.total === 37 && p7.summary.passed === 37 && p7.summary.failed === 0, p7.summary);
  // regs 独立复算（index.ts 行首零缩进）
  const indexTs = fs.readFileSync(path.join(ROOT, 'backend-ts/src/index.ts'), 'utf8');
  const regs = (indexTs.match(/^app\.(get|post|put|delete|patch)\(/gm) || []).length;
  ck('gate.regs=110', regs === 110, regs);
  // schema 顶 0052（dev + 生产）
  const dbDev = R('db-dev.json'); const dbProd = R('db-prod.json');
  ck('schema.dev顶0052', dbDev.schema_top === '0052' && dbDev.project_id === 'quiet-math-65207667', { top: dbDev.schema_top, project: dbDev.project_id });
  ck('schema.prod顶0052', dbProd.schema_top === '0052' && dbProd.project_id === 'sweet-pond-28934105', { top: dbProd.schema_top, project: dbProd.project_id });
}

// ---------- 生产 UI（未 push ⇒ 旧版预期态，读数留证） ----------
{
  const prod = probe.views['prod-w1440'];
  ck('prodUI.旧版特征(gift>0/高不一)=未push预期', prod.gridGiftIcons > 0 && new Set(prod.cards.map(c => c.cardH)).size > 1, { cards: prod.cards.length, gift: prod.gridGiftIcons, heights: prod.cards.map(c => c.cardH) });
  ck('prodUI.零未捕获异常', (prod.uncaught || []).length === 0, prod.uncaught);
  ck('prodUI.渲染(rootLen>0)', prod.rootLen > 0, prod.rootLen);
}

const failed = checks.filter(c => !c.pass);
const out = { generatedAt: new Date().toISOString(), head: 'd37a813', total: checks.length, failedCount: failed.length, checks };
fs.writeFileSync(path.join(QA, 'readings/aggregate.json'), JSON.stringify(out, null, 2));
console.log(`TOTAL=${checks.length} FAILED=${failed.length}`);
for (const c of failed) console.log('FAIL:', c.id, JSON.stringify(c.got));
if (failed.length === 0) console.log('ALL CHECKS PASS');

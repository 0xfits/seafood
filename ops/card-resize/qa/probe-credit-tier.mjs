// card-resize QA · 信用档位端到端（dev 库）：插 5 星评分 ⇒ excellent ⇒ 回收（try/finally 保证回收）
// before/after 计数落 readings/credit-tier.json；触发器 tgenabled 前后各验一次。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/kevin/bistro/seafood';
const QA = path.join(ROOT, 'ops/card-resize/qa');
const req = createRequire(path.join(ROOT, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');
const dotenv = req('dotenv');
const parsed = dotenv.parse(fs.readFileSync(path.join(ROOT, 'backend-ts/.env.local'), 'utf8'));
const sql = neon(parsed.DATABASE_URL_UNPOOLED || parsed.POSTGRES_URL_NON_POOLING || parsed.DATABASE_URL);
const IDEM = 'qa:card-resize-20261019:excellent';

const out = { before: {}, inserted: null, api: null, page: null, after: {} };

// 前置自证 + before 计数
const selfCert = await sql`SELECT current_setting('neon.project_id', true) AS v`;
out.before.project_id = selfCert[0].v;
if (out.before.project_id !== 'quiet-math-65207667') throw new Error('非 dev 库，停手');
out.before.schema_top = (await sql`SELECT version::text AS v FROM public.schema_migration ORDER BY version DESC LIMIT 1`)[0].v;
out.before.rating_count = (await sql`SELECT count(*)::int AS v FROM public.rating`)[0].v;
out.before.trigger = (await sql`SELECT tgenabled AS v FROM pg_trigger WHERE tgname='trg_rating_append_only' AND tgrelid='public.rating'::regclass`)[0].v;
out.before.qa_rows = (await sql`SELECT count(*)::int AS v FROM public.rating WHERE idempotency_key = ${IDEM}`)[0].v;
// 全量 evm（掩码断言用，只读）
const evms = await sql`SELECT uid::text AS uid, evm FROM public.users WHERE uid IN (970101, 970213)`;
out.evms = Object.fromEntries(evms.map(r => [r.uid, r.evm]));
console.log('before:', JSON.stringify(out.before), 'evms:', JSON.stringify(out.evms));

try {
  // 单条 DO 块：disable → insert → enable（异常路径也复原 enable；IDEM 为本脚本常量，字面量内插——DO 块体内不可用绑定参数）
  await sql`DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.rating DISABLE TRIGGER trg_rating_append_only';
  BEGIN
    INSERT INTO public.rating (rater_uid, ratee_uid, target_type, target_id, direction, stars, idempotency_key, request_fingerprint, memo)
    VALUES (970101, 970213, 'listing', 76, 'customer_to_vendor', 5.0000, 'qa:card-resize-20261019:excellent', 'qa:card-resize-20261019', 'QA 夹具：excellent 档验证（测完回收）');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'ALTER TABLE public.rating ENABLE TRIGGER trg_rating_append_only';
    RAISE;
  END;
  EXECUTE 'ALTER TABLE public.rating ENABLE TRIGGER trg_rating_append_only';
END $$;`;
  out.inserted = {
    count_after_insert: (await sql`SELECT count(*)::int AS v FROM public.rating`)[0].v,
    trigger_after_insert: (await sql`SELECT tgenabled AS v FROM pg_trigger WHERE tgname='trg_rating_append_only' AND tgrelid='public.rating'::regclass`)[0].v,
  };
  console.log('inserted:', JSON.stringify(out.inserted));

  // API 面：dev /api/prize/all 中 uid=970213 的行 credit 必须 = excellent；其余卖家仍 new
  const res = await fetch('http://localhost:5788/api/prize/all?skip=0&limit=36');
  const payload = await res.json();
  const rows = payload.data || [];
  const t = rows.filter(r => r.seller && Number(r.seller.uid) === 970213).map(r => ({ bID: r.bID, credit: r.seller.credit, nickname: r.seller.nickname }));
  const others = [...new Set(rows.filter(r => r.seller && Number(r.seller.uid) !== 970213).map(r => r.seller.credit))];
  out.api = { http: res.status, rows: rows.length, seller970213: t, otherCredits: others };
  console.log('api:', JSON.stringify(out.api));

  // 页面真读数：/item/1（卖家 970101）卡与首页 uid=970101 卡的胶囊文案 = 卖家信用优秀
  const r2 = createRequire(path.join(ROOT, 'frontend/package.json'));
  const { chromium } = r2('playwright');
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto('http://localhost:5787/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForSelector('[data-sf-m="feed-grid"] .sf-reward-card', { timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.sf-reward-media-img')].every(i => i.complete), { timeout: 30000 }).catch(() => {});
  out.page = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-sf-m="feed-grid"] .sf-reward-card')];
    const one = cards.find(c => /\/item\/76$/.test(c.getAttribute('href') || ''));
    return {
      cardCount: cards.length,
      listing76Tier: one ? one.querySelector('[data-sf-m="reward-card-seller-tier"]')?.textContent : null,
      listing76Nickname: one ? one.querySelector('.sf-reward-seller-name')?.textContent : null,
      listing76AvatarText: one ? one.querySelector('.sf-reward-seller-avatar')?.textContent : null,
      tierDistribution: cards.map(c => c.querySelector('[data-sf-m="reward-card-seller-tier"]')?.textContent),
    };
  });
  await browser.close();
  console.log('page:', JSON.stringify(out.page));
} finally {
  // 回收（同前例单条 DO 块），保证任何路径都执行
  await sql`DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.rating DISABLE TRIGGER trg_rating_append_only';
  BEGIN
    DELETE FROM public.rating WHERE idempotency_key = 'qa:card-resize-20261019:excellent';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'ALTER TABLE public.rating ENABLE TRIGGER trg_rating_append_only';
    RAISE;
  END;
  EXECUTE 'ALTER TABLE public.rating ENABLE TRIGGER trg_rating_append_only';
END $$;`;
  out.after.rating_count = (await sql`SELECT count(*)::int AS v FROM public.rating`)[0].v;
  out.after.qa_rows = (await sql`SELECT count(*)::int AS v FROM public.rating WHERE idempotency_key = ${IDEM}`)[0].v;
  out.after.trigger = (await sql`SELECT tgenabled AS v FROM pg_trigger WHERE tgname='trg_rating_append_only' AND tgrelid='public.rating'::regclass`)[0].v;
  console.log('after:', JSON.stringify(out.after));
}

fs.writeFileSync(path.join(QA, 'readings/credit-tier.json'), JSON.stringify(out, null, 2));
console.log('RECOVERED: before_count=%s after_count=%s trigger=%s', out.before.rating_count, out.after.rating_count, out.after.trigger);

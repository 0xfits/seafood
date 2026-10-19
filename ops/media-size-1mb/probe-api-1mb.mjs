/**
 * 服务端 1MiB 边界 + DB CHECK 硬闸 独立复验（dev 5788 · 真钱包登录）
 *
 * 跑法：node ops/media-size-1mb/probe-api-1mb.mjs
 * 纪律：
 *   · 私钥 = 每次运行随机生成（不落盘、不打印；只印地址尾 6 位）
 *   · 不打印 JWT / challenge_token 本体（只印长度）
 *   · 接受 1MiB 那张会真的入库 ⇒ 读数后按 media_id DELETE 回收，并报前后行数
 *   · DB 侧除「故意失败的 INSERT（事务内 ROLLBACK）」与回收 DELETE 外零写
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/kevin/bistro/seafood';
const require = createRequire(`${REPO}/backend-ts/package.json`);
const { Wallet } = require('ethers');
const { neon, neonConfig, Pool } = require('@neondatabase/serverless');
const WS = require('ws');

neonConfig.webSocketConstructor = WS;

const API = 'http://localhost:5788';
const OUT = `${REPO}/ops/media-size-1mb/readings/api-1mb.json`;
const CAP = 1048576;

const env = Object.fromEntries(
  fs.readFileSync(`${REPO}/backend-ts/.env.local`, 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sql = neon(env.DATABASE_URL);
const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL });

const tail = (s) => String(s).slice(-6);

/** 构造 n 字节 webp 容器（RIFF….WEBP 头合规 ⇒ 过魔数闸；内容为零填充，不解码） */
function webpOfSize(n) {
  const b = Buffer.alloc(n);
  b.write('RIFF', 0, 'latin1');
  b.writeUInt32LE(n - 8, 4);
  b.write('WEBP', 8, 'latin1');
  b.write('VP8X', 12, 'latin1');
  b.writeUInt32LE(10, 16); // chunk size
  return b;
}

const postJson = async (url, obj, headers = {}) => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(obj),
    signal: AbortSignal.timeout(120000),
  });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  return { status: r.status, body };
};

const rec = {
  at: new Date().toISOString(),
  api: API,
  cap_bytes: CAP,
  phases: {},
};

const main = async () => {
  // ---------- 1) 真钱包登录 ----------
  const wallet = Wallet.createRandom();
  const address = wallet.address;
  const ch = await postJson(`${API}/api/auth/challenge`, { evm_address: address });
  const message = ch.body?.data?.message;
  const challengeToken = ch.body?.data?.challenge_token;
  const signature = await wallet.signMessage(message);
  const ve = await postJson(`${API}/api/auth/verify`, {
    evm_address: address, signature, challenge_token: challengeToken,
  });
  const token = ve.body?.data?.token || ve.body?.token;
  rec.phases.login = {
    address_tail: tail(address),
    challenge_status: ch.status,
    message_len: typeof message === 'string' ? message.length : -1,
    verify_status: ve.status,
    token_present: !!token,
    token_len: token ? token.length : 0,
    uid: ve.body?.data?.uID ?? null,
  };
  if (!token) {
    rec.phases.login.error = ve.body;
    fs.writeFileSync(OUT, `${JSON.stringify(rec, null, 2)}\n`);
    console.log(JSON.stringify(rec.phases.login, null, 2));
    await pool.end();
    process.exit(2);
  }
  const auth = { Authorization: `Bearer ${token}` };

  // ---------- 2) 媒体行基线 ----------
  const before = (await sql`SELECT count(*)::int AS n, coalesce(max(media_id),0)::bigint AS max_id FROM public.media`)[0];
  rec.phases.row_baseline = { count_before: before.n, max_id_before: String(before.max_id) };

  // ---------- 3) 服务端边界：1MiB 整 ⇒ 200 ----------
  const exact = webpOfSize(CAP);
  const r1 = await postJson(`${API}/api/media`, {
    content_type: 'image/webp',
    data_base64: exact.toString('base64'),
  }, auth);
  const d1 = r1.body?.data;
  rec.phases.exact_1048576 = {
    request_bytes_decoded: exact.length,
    request_body_approx_bytes: JSON.stringify({ content_type: 'image/webp', data_base64: exact.toString('base64') }).length,
    http: r1.status,
    ok: !!r1.body?.ok,
    data: d1 ? {
      url: d1.url, media_id: d1.media_id, size_bytes: d1.size_bytes,
      sha256_tail: tail(d1.sha256), deduplicated: d1.deduplicated,
    } : null,
    error: r1.body?.error ?? null,
    pass: r1.status === 200 && d1?.size_bytes === CAP,
  };

  // ---------- 4) 服务端边界：1MiB+1 ⇒ 400 MEDIA_SIZE_EXCEEDED ----------
  const over = webpOfSize(CAP + 1);
  const r2 = await postJson(`${API}/api/media`, {
    content_type: 'image/webp',
    data_base64: over.toString('base64'),
  }, auth);
  rec.phases.over_1048577 = {
    request_bytes_decoded: over.length,
    request_body_approx_bytes: JSON.stringify({ content_type: 'image/webp', data_base64: over.toString('base64') }).length,
    http: r2.status,
    error: r2.body?.error ? {
      code: r2.body.error.code,
      message: r2.body.error.message,
      i18n_key: r2.body.error.i18n_key,
      details: r2.body.error.details,
    } : null,
    pass: r2.status === 400
      && r2.body?.error?.code === 'MEDIA_SIZE_EXCEEDED'
      && r2.body?.error?.details?.max_bytes === CAP
      && r2.body?.error?.details?.decoded_bytes === CAP + 1,
  };

  // ---------- 5) DB 约束定义 ----------
  const cons = await sql`
    SELECT conname, contype, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid = 'public.media'::regclass AND contype = 'c'
     ORDER BY conname`;
  const sizeCons = cons.filter((c) => /size_bytes/.test(c.def));
  rec.phases.db_constraint = {
    all_check_constraints: cons.map((c) => ({ conname: c.conname, def: c.def })),
    size_bytes_checks: sizeCons.map((c) => ({ conname: c.conname, def: c.def })),
    has_1048576: sizeCons.some((c) => c.def.includes('1048576')),
    has_2097152: sizeCons.some((c) => c.def.includes('2097152')),
    constraint_count_on_size_bytes: sizeCons.length,
    pass: sizeCons.length === 1
      && sizeCons[0].conname === 'media_size_bytes_check'
      && sizeCons[0].def.includes('1048576')
      && !sizeCons.some((c) => c.def.includes('2097152')),
  };

  // ---------- 6) DB 硬闸：故意失败 INSERT（事务内，ROLLBACK 不留行）----------
  const ownerRow = await sql`SELECT uid FROM public.users ORDER BY uid LIMIT 1`;
  const ownerUid = ownerRow[0]?.uid ?? null;
  const client = await pool.connect();
  let insertErr = null;
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO public.media (sha256, content_type, bytes, size_bytes, owner_uid)
       VALUES ($1, 'image/webp', $2::bytea, $3, $4)`,
      ['0'.repeat(64), Buffer.from([0x52, 0x49, 0x46, 0x46]), CAP + 1, ownerUid],
    );
    await client.query('ROLLBACK');
    insertErr = { unexpected: 'insert succeeded — CHECK is NOT enforcing' };
  } catch (e) {
    insertErr = {
      sqlstate: e.code ?? null,
      constraint: e.constraint ?? null,
      message: String(e.message || '').slice(0, 240),
    };
    try { await client.query('ROLLBACK'); } catch { /* already aborted */ }
  } finally {
    client.release();
  }
  // 反向对照：恰 1MiB 在 CHECK 内（同事务插入后回滚 ⇒ 证明 1MiB 不被 DB 拒）
  const client2 = await pool.connect();
  let exactDbErr = null;
  try {
    await client2.query('BEGIN');
    await client2.query(
      `INSERT INTO public.media (sha256, content_type, bytes, size_bytes, owner_uid)
       VALUES ($1, 'image/webp', $2::bytea, $3, $4)`,
      ['f'.repeat(64), Buffer.from([0x52, 0x49, 0x46, 0x46]), CAP, ownerUid],
    );
    await client2.query('ROLLBACK');
    exactDbErr = null;
  } catch (e) {
    exactDbErr = { sqlstate: e.code ?? null, constraint: e.constraint ?? null, message: String(e.message || '').slice(0, 240) };
    try { await client2.query('ROLLBACK'); } catch { /* noop */ }
  } finally {
    client2.release();
  }
  rec.phases.db_failed_insert = {
    attempted_size_bytes: CAP + 1,
    owner_uid: ownerUid,
    error: insertErr,
    exact_cap_insert_error: exactDbErr,
    pass: insertErr?.sqlstate === '23514'
      && insertErr?.constraint === 'media_size_bytes_check'
      && exactDbErr === null,
  };

  // ---------- 7) 回收：删除步骤 3 建的行（若有）并核对前后计数 ----------
  let deleted = 0;
  const newId = d1?.media_id;
  if (newId) {
    const del = await sql`DELETE FROM public.media WHERE media_id = ${newId} RETURNING media_id`;
    deleted = del.length;
  }
  const after = (await sql`SELECT count(*)::int AS n FROM public.media`)[0];
  rec.phases.cleanup = {
    deleted_media_id: newId ?? null,
    deleted_rows: deleted,
    count_before: before.n,
    count_after: after.n,
    pass: after.n === before.n,
  };

  rec.summary = {
    checks: ['login', 'exact_1048576', 'over_1048577', 'db_constraint', 'db_failed_insert', 'cleanup'],
    passed: ['exact_1048576', 'over_1048577', 'db_constraint', 'db_failed_insert', 'cleanup']
      .filter((k) => rec.phases[k].pass).length,
    failed: ['exact_1048576', 'over_1048577', 'db_constraint', 'db_failed_insert', 'cleanup']
      .filter((k) => !rec.phases[k].pass),
    total: 5,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(rec, null, 2)}\n`);
  console.log(JSON.stringify(rec.summary, null, 2));
  console.log(JSON.stringify({
    login: rec.phases.login,
    exact: { http: rec.phases.exact_1048576.http, size: rec.phases.exact_1048576.data?.size_bytes, pass: rec.phases.exact_1048576.pass },
    over: { http: rec.phases.over_1048577.http, error: rec.phases.over_1048577.error, pass: rec.phases.over_1048577.pass },
    db: rec.phases.db_constraint.size_bytes_checks,
    insert: rec.phases.db_failed_insert,
    cleanup: rec.phases.cleanup,
  }, null, 2));

  await pool.end();
  process.exit(rec.summary.failed.length === 0 ? 0 : 1);
};

main().catch(async (e) => {
  console.error('PROBE FAILED:', e?.stack || e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(2);
});

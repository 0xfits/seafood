// p4z-b5sv-01-http.ts — SIG-VERIFY 真 HTTP 探针（改前 / 改后**同脚本同口径**）
// ============================================================================
// 口径（§5.7）：
//   · 私钥**仅存进程内**（`Wallet.createRandom()`），产物只落**地址**（公开链上标识）与 **sha256 前 12 位指纹**；
//     绝不落私钥、绝不落 JWT 本体 / challenge_token 本体（§5.7⑦：grep -c 私钥或 'eyJ' == 0）。
//   · 退出码**直接取**（不经管道）；pre 相**预期** exit 1（AC2 在改前必为 200 ⇒ 该行按设计判 FAIL）。
//   · 入参字段名严格照真源：`evm_address` / `signature` / `challenge_token`。
// 用法：ts-node --transpile-only scripts/p4z-b5sv-01-http.ts <outDir> <pre|post>
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http from 'http';
import { Wallet } from 'ethers';

const REPO = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.SEAFOOD_PORT || 5788);
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b5sv-run'));
const PHASE = process.argv[3] === 'pre' ? 'pre' : 'post';
fs.mkdirSync(outDir, { recursive: true });

const fp = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 12);

const call = (method: string, p: string, body?: unknown) =>
  new Promise<{ status: number; json: any; raw: string }>((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: p,
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json: any = null;
          try { json = JSON.parse(raw); } catch { /* 非 JSON 保持 null */ }
          resolve({ status: res.statusCode || 0, json, raw });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });

interface Row { id: string; name: string; expect: number; got: number; pass: boolean; extra: Record<string, unknown>; }
const rows: Row[] = [];
const log: string[] = [];
const say = (s: string) => { log.push(s); console.log(s); };

const rec = (id: string, name: string, expect: number, got: number, extra: Record<string, unknown> = {}) => {
  const pass = got === expect;
  rows.push({ id, name, expect, got, pass, extra });
  say(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} expect=${expect} got=${got} ${JSON.stringify(extra)}`);
  return pass;
};

const bodyOf = (r: { json: any }) => (r.json && r.json.data !== undefined ? r.json.data : r.json);
const challenge = async (addr: string) => call('POST', '/api/auth/challenge', { evm_address: addr });

(async () => {
  const meta: Record<string, unknown> = { phase: PHASE, host: `${HOST}:${PORT}`, at: new Date().toISOString() };

  // 本地自建私钥（本进程新造 ⇒ 库内必无 account 行 ⇒ 同时构成 AC⑩「新钱包登录」）
  const A = Wallet.createRandom();
  const B = Wallet.createRandom();
  const aLow = A.address.toLowerCase();
  meta.wallet_A_address = A.address;
  meta.wallet_A_address_fp = fp(A.address);
  meta.wallet_B_address = B.address;
  meta.wallet_B_address_fp = fp(B.address);

  const h = await call('GET', '/health');
  rec('P0', 'GET /health', 200, h.status);

  // ---- AC① / AC⑩：真签名 ⇒ 200（新钱包登录） ----
  const c1 = await challenge(aLow);
  const ch1 = bodyOf(c1);
  const msg1 = String(ch1?.message || '');
  const tok1 = String(ch1?.challenge_token || '');
  meta.challenge_1 = { status: c1.status, message_sha256_12: fp(msg1), message_len: msg1.length, message_head: msg1.slice(0, 24), token_fp: fp(tok1) };
  const sig1 = await A.signMessage(msg1);
  meta.sig_A_sha256_12 = fp(sig1);
  const v1 = await call('POST', '/api/auth/verify', { evm_address: aLow, signature: sig1, challenge_token: tok1 });
  const d1 = bodyOf(v1);
  meta.verify_A = { status: v1.status, success: v1.json?.success, uid: d1?.uid, token_present: !!d1?.token, token_fp: d1?.token ? fp(String(d1.token)) : null, token_type: d1?.token_type, points: d1?.points };
  rec('AC1', '真签名（A 签 A 的 challenge）', 200, v1.status, { success: v1.json?.success, uid: d1?.uid, token_present: !!d1?.token });
  rec('AC10', '新钱包登录（A 为进程内新造地址）', 200, v1.status);

  // ---- AC④：重放同 challenge ⇒ 401（保持单次消费） ----
  const v2 = await call('POST', '/api/auth/verify', { evm_address: aLow, signature: sig1, challenge_token: tok1 });
  meta.replay = { status: v2.status, message: v2.json?.message };
  rec('AC4', '重放（同 challenge 二次）', 401, v2.status, { message: v2.json?.message });

  // ---- AC②：垃圾签名 0xdeadbeef ⇒ 401（核心回归判据；改前 = 200） ----
  const c2 = await challenge(aLow);
  const ch2 = bodyOf(c2);
  const v3 = await call('POST', '/api/auth/verify', { evm_address: aLow, signature: '0xdeadbeef', challenge_token: String(ch2?.challenge_token || '') });
  const d3 = bodyOf(v3);
  meta.garbage = { status: v3.status, success: v3.json?.success, message: v3.json?.message, token_issued: !!d3?.token, uid: d3?.uid };
  rec('AC2', '垃圾签名 0xdeadbeef', 401, v3.status, { message: v3.json?.message, token_issued: !!d3?.token, success: v3.json?.success });

  // ---- AC③：他人签名（B 私钥签 A 的 challenge）⇒ 401 ----
  const c3 = await challenge(aLow);
  const ch3 = bodyOf(c3);
  const msg3 = String(ch3?.message || '');
  const tok3 = String(ch3?.challenge_token || '');
  const sigB = await B.signMessage(msg3);
  const v4 = await call('POST', '/api/auth/verify', { evm_address: aLow, signature: sigB, challenge_token: tok3 });
  meta.other_sig = { status: v4.status, message: v4.json?.message, success: v4.json?.success };
  rec('AC3', '他人签名（B 签 A 的 challenge）', 401, v4.status, { message: v4.json?.message });

  // ---- 补充 S1（自证设计决定「验签失败不消费 challenge」；非硬 AC） ----
  const sigA3 = await A.signMessage(msg3);
  const v4b = await call('POST', '/api/auth/verify', { evm_address: aLow, signature: sigA3, challenge_token: tok3 });
  meta.after_fail_recover = { status: v4b.status };
  say(`INFO S1 失败后同 challenge 用正确签名再投 ⇒ ${v4b.status}（post 期望 200 = 失败不消费；pre 期望 401 = 已被误消费）`);

  // ---- AC⑤：同地址大小写（校验和变体）⇒ 200（不得误杀） ----
  const c4 = await challenge(aLow);
  const ch4 = bodyOf(c4);
  const msg4 = String(ch4?.message || '');
  const sig4 = await A.signMessage(msg4);
  const v5 = await call('POST', '/api/auth/verify', { evm_address: A.address, signature: sig4, challenge_token: String(ch4?.challenge_token || '') });
  const d5 = bodyOf(v5);
  meta.case_variant = { status: v5.status, sent_address: A.address, token_present: !!d5?.token };
  rec('AC5', '同地址校验和变体（lower 申领 / checksum 提交）', 200, v5.status, { sent: A.address, token_present: !!d5?.token });

  // ---- 既有 401 面保持（不削弱其它鉴权面） ----
  const v6 = await call('POST', '/api/auth/verify', { evm_address: aLow, signature: sig1 });
  const v7 = await call('POST', '/api/auth/verify', { evm_address: aLow, signature: sig1, challenge_token: 'garbage.token.here' });
  const c5 = await challenge(aLow);
  const ch5 = bodyOf(c5);
  const v8 = await call('POST', '/api/auth/verify', { evm_address: B.address.toLowerCase(), signature: sig1, challenge_token: String(ch5?.challenge_token || '') });
  rec('R1', '缺 challenge_token', 401, v6.status, { message: v6.json?.message });
  rec('R2', '垃圾 challenge_token', 401, v7.status, { message: v7.json?.message });
  rec('R3', '声明地址与 challenge 不符', 401, v8.status, { message: v8.json?.message });

  // ---- ⑧ 已落 410 面 6/6 ----
  const gone = ['/api/admin/task/create', '/api/admin/task/update', '/api/admin/task/delete', '/api/admin/prize/create', '/api/admin/prize/update', '/api/admin/prize/delete'];
  let goneOk = 0;
  const goneDetail: Record<string, number> = {};
  for (const g of gone) {
    const r = await call('POST', g, {});
    goneDetail[g] = r.status;
    if (r.status === 410) goneOk++;
  }
  meta.gone_face_detail = goneDetail;
  say(`410 face ${JSON.stringify(goneDetail)}`);
  rec('AC8', '已落 410 面（6 条）', 6, goneOk);

  const failed = rows.filter((r) => !r.pass);
  const summary = { phase: PHASE, total: rows.length, pass: rows.length - failed.length, fail: failed.length, failed_ids: failed.map((r) => r.id) };
  fs.writeFileSync(path.join(outDir, `http-${PHASE}.json`), JSON.stringify({ summary, meta, rows }, null, 2));
  fs.writeFileSync(path.join(outDir, `probe-${PHASE}.log`), log.join('\n') + '\n');
  console.log('SUMMARY', JSON.stringify(summary));
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => { console.error('PROBE_ERROR', e); process.exit(2); });

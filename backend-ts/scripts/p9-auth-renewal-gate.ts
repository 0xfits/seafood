/**
 * p9 · 无状态滑动续期（sliding session + absolute cap）**离线零 DB 门**
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p9-auth-renewal-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 读数：<repo>/ops/auth-renewal-20261017/readings/p9-gate.json（同份镜像到 .p9-artifacts/）
 *
 * **零 DB / 零网络 / 零 HTTP / 零端口**（只 import 纯函数 + 读源码文本）—— 与仓内 `p*` 离线门同族。
 * 时钟一律**假时钟**（`Date.now` 打桩）⇒ 3 天 / 7 天 / 1 小时这类边界不靠等待、也不会 flake。
 * env 覆盖用「清 require 缓存 + 换 env 重新加载模块」实现 ⇒ 测的是**真模块常量**，不是复制品。
 *
 * 口径（Kevin 2026-10-17 裁定 · 变体 1，逐字）：
 *   · 闲置上限 3 天（末次鉴权活动起）· 绝对上限 7 天（首次登录起）· 两者取先到
 *   · 续期粒度 1 小时（`now >= iat + 3600` 才重签）· 续期保留 `sst`，`iat = now`，`exp = min(iat+IDLE, sst+ABS)`
 *   · 零新路由 / 零新错误码 / 零库写
 *
 * 覆盖（每条都可判负）：G1 形状与常量 · G2 闲置过期 · G3 续期保留会话起点 · G4 绝对上限夹紧
 *   · G5 绝对上限到点不续 · G6 旧 token 兼容 · G7 篡改签名 · G8 粒度边界
 *   · G9 env 覆盖 · G10 **反向臂**（IDLE=5min ⇒ G2/G8 类断言必须翻转）· G11 零新路由/零库面 · G12 防御面
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const HERE = __dirname;
const BACKEND = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(BACKEND, '..');
const OUT_OPS = path.join(REPO_ROOT, 'ops', 'auth-renewal-20261017', 'readings', 'p9-gate.json');
const ARTIFACTS = path.join(BACKEND, '.p9-artifacts', `p9-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`);

// ── 门自身不依赖真实凭据：先落一个**非公开占位值以外**的临时密钥（auth.ts 缺失即 fail-fast）
const GATE_SECRET = 'p9-gate-offline-only-secret-not-used-anywhere-else';
const TOUCHED = ['SECRET_KEY', 'AUTH_SESSION_IDLE_MINUTES', 'AUTH_SESSION_ABSOLUTE_MINUTES', 'ACCESS_TOKEN_EXPIRE_MINUTES'];
const savedEnv: Record<string, string | undefined> = {};
for (const k of TOUCHED) savedEnv[k] = process.env[k];
process.env.SECRET_KEY = GATE_SECRET;
delete process.env.AUTH_SESSION_IDLE_MINUTES;
delete process.env.AUTH_SESSION_ABSOLUTE_MINUTES;
delete process.env.ACCESS_TOKEN_EXPIRE_MINUTES;

type AuthModule = typeof import('../src/auth');
const AUTH_PATH = require.resolve('../src/auth');

const loadAuth = (): AuthModule => {
  delete require.cache[AUTH_PATH];
  return require(AUTH_PATH) as AuthModule;
};

/** 换 env 加载一臂：常量在**模块求值时**读取 ⇒ 加载完立刻还原 env 不会影响该臂 */
const loadAuthWith = (env: Record<string, string | undefined>): AuthModule => {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    prev[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k] as string;
  }
  const mod = loadAuth();
  for (const k of Object.keys(prev)) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k] as string;
  }
  return mod;
};

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};

/** 假时钟（epoch 秒）——`createSessionToken` / `verifySessionToken` / `shouldRenewSession` 全部读 `Date.now` */
const at = <T>(epochSeconds: number, fn: () => T): T => {
  const real = Date.now;
  Date.now = () => epochSeconds * 1000;
  try { return fn(); } finally { Date.now = real; }
};

const decode = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>;

/** 旧形态 token（`{sub, evm, exp}`，无 iat/sst）——按现盘签名算法逐字复刻，用于兼容臂 */
const signLegacy = (payload: Record<string, unknown>): string => {
  const b64 = (v: string) => Buffer.from(v).toString('base64url');
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', GATE_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
};

const throwsWith = (fn: () => unknown, needle: string): { threw: boolean; message: string } => {
  try {
    fn();
    return { threw: false, message: '' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { threw: message.includes(needle), message };
  }
};

const T0 = 1_700_000_000; // 固定基准（2023-11-14T22:13:20Z）；所有断言都相对它
const UID = 4242;
const EVM = '0x' + 'ab'.repeat(20);

const auth = loadAuth(); // ← 默认臂（不设任何续期 env）
const IDLE = auth.SESSION_POLICY.idleSeconds;          // 3d = 259200
const ABS = auth.SESSION_POLICY.absoluteSeconds;       // 7d = 604800
const GRAN = auth.SESSION_POLICY.renewGranularitySeconds; // 3600
const LEGACY_TTL = auth.SESSION_POLICY.legacyAccessTokenSeconds; // 1800

// ════════════════════════════════════════════════════════════ G1 形状与常量
t('G1-1', 'policy', IDLE === 4320 * 60 && ABS === 10080 * 60 && GRAN === 3600 && LEGACY_TTL === 1800,
  'idle=259200 abs=604800 gran=3600 legacy=1800', `idle=${IDLE} abs=${ABS} gran=${GRAN} legacy=${LEGACY_TTL}`);

const fresh = at(T0, () => auth.createSessionToken({ uID: UID, evm: EVM }));
const freshPayload = decode(fresh);
t('G1-2', 'shape', ['evm', 'exp', 'iat', 'sst', 'sub'].every((k, i) => Object.keys(freshPayload).sort()[i] === k),
  'keys=evm,exp,iat,sst,sub', `keys=${Object.keys(freshPayload).sort().join(',')}`);
t('G1-3', 'shape', freshPayload.iat === T0 && freshPayload.sst === T0,
  `iat=${T0} sst=${T0}`, `iat=${String(freshPayload.iat)} sst=${String(freshPayload.sst)}`);
t('G1-4', 'shape', freshPayload.exp === Math.min(T0 + IDLE, T0 + ABS) && freshPayload.exp === T0 + 259200,
  `exp=${T0 + 259200}（= min(iat+3d, sst+7d)）`, `exp=${String(freshPayload.exp)}`);

// ════════════════════════════════════════════════════════════ G2 闲置 3 天过期
const idleBefore = at(T0 + IDLE - 1, () => auth.verifySessionToken(fresh));
t('G2-1', 'idle', idleBefore.uID === UID && idleBefore.iat === T0 && idleBefore.sessionStartedAt === T0,
  `T0+3d-1s 仍可验签，iat/sst=${T0}`, `uID=${idleBefore.uID} iat=${idleBefore.iat} sst=${idleBefore.sessionStartedAt}`);
const idleExpired = at(T0 + IDLE, () => throwsWith(() => auth.verifySessionToken(fresh), 'Token expired'));
t('G2-2', 'idle', idleExpired.threw, "T0+3d ⇒ throws 'Token expired'", `message=${idleExpired.message || 'NO_THROW'}`);

// ════════════════════════════════════════════════════════════ G3 续期保留会话起点
const renewDue = auth.shouldRenewSession({ issuedAt: T0, sessionStartedAt: T0, now: T0 + GRAN });
t('G3-1', 'renew', renewDue === true, 'iat+1h ⇒ true', `got=${renewDue}`);
const renewed = at(T0 + GRAN, () => auth.createSessionToken({ uID: UID, evm: EVM, sessionStartedAt: T0 }));
const renewedPayload = decode(renewed);
t('G3-2', 'renew', renewedPayload.sst === T0 && renewedPayload.iat === T0 + GRAN,
  `sst 不变=${T0} iat=now=${T0 + GRAN}`, `sst=${String(renewedPayload.sst)} iat=${String(renewedPayload.iat)}`);
t('G3-3', 'renew', renewedPayload.exp === T0 + GRAN + IDLE, `exp=${T0 + GRAN + IDLE}（= iat+3d）`, `exp=${String(renewedPayload.exp)}`);

// 连续 100 次「每小时续期」：sst 必须恒为 T0，exp 永不超过 sst+7d（绝对上限不被续期推后）
let chainToken = fresh;
let chainOk = true;
let chainLast = freshPayload;
for (let i = 1; i <= 100; i += 1) {
  const nowSec = T0 + i * GRAN;
  const verified = at(nowSec - 1, () => auth.verifySessionToken(chainToken));
  if (verified.sessionStartedAt !== T0) chainOk = false;
  chainToken = at(nowSec, () => auth.createSessionToken({ uID: UID, evm: EVM, sessionStartedAt: verified.sessionStartedAt }));
  chainLast = decode(chainToken);
  if (Number(chainLast.exp) > T0 + ABS) chainOk = false;
}
t('G3-4', 'renew', chainOk && chainLast.sst === T0 && chainLast.exp === T0 + ABS,
  `100 次续期后 sst=${T0} 且 exp<=sst+7d（到点后 exp 夹在 ${T0 + ABS}）`,
  `sst=${String(chainLast.sst)} exp=${String(chainLast.exp)} ok=${chainOk}`);

// ════════════════════════════════════════════════════════════ G4 绝对上限夹紧（不足 3 天）
const NEAR = T0 + 603936; // = sst + 6.99d（距绝对上限仅剩 864s）
const NEAR_IAT = NEAR - 3700; // 该 token 在 1h1m40s 前签发（> 粒度 ⇒ 到期该续；但绝对上限只剩 864s）
const nearToken = at(NEAR_IAT, () => auth.createSessionToken({ uID: UID, evm: EVM, sessionStartedAt: T0 }));
const nearPayload = decode(nearToken);
t('G4-1', 'absolute', nearPayload.exp === T0 + ABS,
  `exp=sst+7d=${T0 + ABS}（而不是 iat+3d=${NEAR_IAT + IDLE}）`, `exp=${String(nearPayload.exp)}`);
t('G4-2', 'absolute', (T0 + ABS) - NEAR === 864 && ((T0 + ABS) - NEAR) < IDLE,
  '剩余 864s < 3d（夹紧生效）', `remaining=${(T0 + ABS) - NEAR}s`);
const nearRenew = at(NEAR, () => {
  const verified = auth.verifySessionToken(nearToken);
  const should = auth.shouldRenewSession({ issuedAt: verified.iat, sessionStartedAt: verified.sessionStartedAt, now: NEAR });
  const next = should ? decode(auth.createSessionToken({ uID: UID, evm: EVM, sessionStartedAt: verified.sessionStartedAt })) : null;
  return { should, exp: next ? Number(next.exp) : null, sst: next ? Number(next.sst) : null };
});
t('G4-3', 'absolute', nearRenew.should === true && nearRenew.exp === T0 + ABS && nearRenew.sst === T0,
  `shouldRenew=true 且新 exp=${T0 + ABS}（不越过绝对上限）`,
  `should=${nearRenew.should} exp=${String(nearRenew.exp)} sst=${String(nearRenew.sst)}`);

// ════════════════════════════════════════════════════════════ G5 绝对上限到点 ⇒ 不再续
const exactAbs = auth.shouldRenewSession({ issuedAt: T0 + ABS - 2 * GRAN, sessionStartedAt: T0, now: T0 + ABS });
t('G5-1', 'absolute', exactAbs === false, 'sst+7d 整点 ⇒ false', `got=${exactAbs}`);
const pastAbs = auth.shouldRenewSession({ issuedAt: T0 + ABS - 2 * GRAN, sessionStartedAt: T0, now: T0 + ABS + 1 });
t('G5-2', 'absolute', pastAbs === false, 'sst+7d+1s ⇒ false', `got=${pastAbs}`);

// ════════════════════════════════════════════════════════════ G6 旧 token 兼容（无 iat/sst）
const LEGACY_IAT = T0;
const legacy = signLegacy({ sub: String(UID), evm: EVM, exp: LEGACY_IAT + LEGACY_TTL });
const legacyVerified = at(LEGACY_IAT + 60, () => auth.verifySessionToken(legacy));
t('G6-1', 'legacy', legacyVerified.uID === UID && legacyVerified.iat === LEGACY_IAT && legacyVerified.sessionStartedAt === LEGACY_IAT,
  `验签通过 + iat=exp-30min=${LEGACY_IAT} + sst 回落 iat`,
  `uID=${legacyVerified.uID} iat=${legacyVerified.iat} sst=${legacyVerified.sessionStartedAt}`);

// 旧部署 TTL 若 > 续期粒度（此处模拟 120min），旧 token 仍可被续期，且 sst 回落为它的 iat
const authLegacy120 = loadAuthWith({ ACCESS_TOKEN_EXPIRE_MINUTES: '120' });
const legacy120 = signLegacy({ sub: String(UID), evm: EVM, exp: LEGACY_IAT + 7200 });
const legacy120Renew = at(LEGACY_IAT + 3600, () => {
  const verified = authLegacy120.verifySessionToken(legacy120);
  const should = authLegacy120.shouldRenewSession({ issuedAt: verified.iat, sessionStartedAt: verified.sessionStartedAt, now: LEGACY_IAT + 3600 });
  const next = should ? decode(authLegacy120.createSessionToken({ uID: UID, evm: EVM, sessionStartedAt: verified.sessionStartedAt })) : null;
  return { iat: verified.iat, sst: verified.sessionStartedAt, should, nextSst: next ? Number(next.sst) : null };
});
t('G6-2', 'legacy', legacy120Renew.iat === LEGACY_IAT && legacy120Renew.should === true && legacy120Renew.nextSst === LEGACY_IAT,
  `TTL=120min 的旧 token：iat=${LEGACY_IAT}、1h 后 shouldRenew=true、新 sst=${LEGACY_IAT}`,
  `iat=${legacy120Renew.iat} should=${legacy120Renew.should} newSst=${String(legacy120Renew.nextSst)}`);

// ════════════════════════════════════════════════════════════ G7 篡改 ⇒ 报错
const [h, p, s] = fresh.split('.');
const tamperedSig = `${h}.${p}.${s.slice(0, -2)}${s.slice(-2) === 'aa' ? 'bb' : 'aa'}`;
const sigBad = at(T0 + 60, () => throwsWith(() => auth.verifySessionToken(tamperedSig), 'Invalid token signature'));
t('G7-1', 'tamper', sigBad.threw, "改签名 ⇒ 'Invalid token signature'", `message=${sigBad.message || 'NO_THROW'}`);
const forgedPayload = Buffer.from(JSON.stringify({ ...freshPayload, sub: '9' })).toString('base64url');
const forgedBad = at(T0 + 60, () => throwsWith(() => auth.verifySessionToken(`${h}.${forgedPayload}.${s}`), 'Invalid token signature'));
t('G7-2', 'tamper', forgedBad.threw, "改载荷(sub 9) 复用旧签名 ⇒ 'Invalid token signature'", `message=${forgedBad.message || 'NO_THROW'}`);

// ════════════════════════════════════════════════════════════ G8 粒度（1 小时）
const granRows = [1800, 3570, 3599, 3600, 3601].map((back) => {
  const iat = T0;
  const now = T0 + back;
  return { back, got: auth.shouldRenewSession({ issuedAt: iat, sessionStartedAt: iat, now }) };
});
t('G8-1', 'granularity', granRows[0].got === false && granRows[1].got === false && granRows[2].got === false,
  'iat 30min / 59.5min / 59m59s 前 ⇒ false', JSON.stringify(granRows.slice(0, 3)));
t('G8-2', 'granularity', granRows[3].got === true && granRows[4].got === true,
  'iat 整 1h / 1h1s 前 ⇒ true', JSON.stringify(granRows.slice(3)));

// ════════════════════════════════════════════════════════════ G9 env 覆盖生效
const authShort = loadAuthWith({ AUTH_SESSION_IDLE_MINUTES: '5', AUTH_SESSION_ABSOLUTE_MINUTES: '10' });
t('G9-1', 'env', authShort.SESSION_POLICY.idleSeconds === 300 && authShort.SESSION_POLICY.absoluteSeconds === 600,
  'IDLE=5min ⇒ 300s；ABSOLUTE=10min ⇒ 600s',
  `idle=${authShort.SESSION_POLICY.idleSeconds} abs=${authShort.SESSION_POLICY.absoluteSeconds}`);
const shortFresh = decode(at(T0, () => authShort.createSessionToken({ uID: UID, evm: EVM })));
t('G9-2', 'env', shortFresh.exp === T0 + 300, `exp=iat+300=${T0 + 300}`, `exp=${String(shortFresh.exp)}`);
const shortNearAbs = decode(at(T0, () => authShort.createSessionToken({ uID: UID, evm: EVM, sessionStartedAt: T0 - 540 })));
t('G9-3', 'env', shortNearAbs.exp === T0 + 60, `sst=T0-540 ⇒ exp=sst+600=${T0 + 60}（< iat+300）`, `exp=${String(shortNearAbs.exp)}`);

// ════════════════════════════════════════════════════════════ G10 反向臂（尺子有分辨力）
// ① 断言（exp = iat + IDLE）在同一次运行里按 env 翻转：默认臂 259200s vs IDLE=5min 臂 300s
const shortFreshToken = at(T0, () => authShort.createSessionToken({ uID: UID, evm: EVM }));
const shortFreshPayload = decode(shortFreshToken);
t('G10-1', 'reverse-arm', freshPayload.exp === T0 + 259200 && shortFreshPayload.exp === T0 + 300,
  '同一断言两臂：默认 exp=iat+259200 / IDLE=5min exp=iat+300',
  `default=${String(freshPayload.exp)} short=${String(shortFreshPayload.exp)}`);

// ② 断言 G8 的前提（「iat 30 分钟前的 token 仍有效」）在窄尺下翻转
const defAt1800 = at(T0 + 1800, () => {
  try {
    const v = auth.verifySessionToken(fresh);
    const should = auth.shouldRenewSession({ issuedAt: v.iat, sessionStartedAt: v.sessionStartedAt, now: T0 + 1800 });
    return `ok:renew=${should}`;
  } catch (e) { return `throw:${e instanceof Error ? e.message : String(e)}`; }
});
const shortAt1800 = at(T0 + 1800, () => {
  try { authShort.verifySessionToken(shortFreshToken); return 'ok'; } catch (e) { return `throw:${e instanceof Error ? e.message : String(e)}`; }
});
t('G10-2', 'reverse-arm', defAt1800 === 'ok:renew=false' && shortAt1800.includes('Token expired'),
  '同年龄(1800s)两臂：默认 有效且不续；IDLE=5min Token expired',
  `default=${defAt1800} short=${shortAt1800}`);

// ③ 配置脚枪（**写进报告**）：IDLE ≤ 粒度（1h）时，token 死在 iat+IDLE ⇒ 续期在结构上永不触发
const shortAt299 = at(T0 + 299, () => { try { authShort.verifySessionToken(shortFreshToken); return 'ok'; } catch (e) { return `throw:${e instanceof Error ? e.message : String(e)}`; } });
const shortAt301 = at(T0 + 301, () => { try { authShort.verifySessionToken(shortFreshToken); return 'ok'; } catch (e) { return `throw:${e instanceof Error ? e.message : String(e)}`; } });
t('G10-3', 'reverse-arm',
  authShort.SESSION_POLICY.idleSeconds < authShort.SESSION_POLICY.renewGranularitySeconds
    && shortAt299 === 'ok' && shortAt301.includes('Token expired'),
  'IDLE(300s) < 粒度(3600s) ⇒ 299s 仍有效、301s 已死 ⇒ 续期分支结构上不可达（脚枪）',
  `idle=${authShort.SESSION_POLICY.idleSeconds} gran=${authShort.SESSION_POLICY.renewGranularitySeconds} @299=${shortAt299} @301=${shortAt301}`);

// ════════════════════════════════════════════════════════════ G11 零新路由 / 零库面 / 注册点常量不动
const INDEX_TS = fs.readFileSync(path.join(BACKEND, 'src', 'index.ts'), 'utf8');
const AUTH_TS = fs.readFileSync(path.join(BACKEND, 'src', 'auth.ts'), 'utf8');
const P7B_GATE = fs.readFileSync(path.join(BACKEND, 'scripts', 'p7b-03-offline-gates.ts'), 'utf8');
const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
const verbCounts = ['get', 'post', 'put', 'delete', 'patch']
  .map((v) => `${v}=${(INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length}`).join(' ');
const p7bConst = /regs === (\d+)/.exec(P7B_GATE);
t('G11-1', 'no-new-route', regs === 107 && p7bConst !== null && p7bConst[1] === '107',
  '注册点 = 107 且 p7b-03 常量仍是 107（零新路由 ⇒ 常量不得动）',
  `regs=${regs} (${verbCounts}) p7b03_constant=${p7bConst ? p7bConst[1] : 'NOT_FOUND'}`);
const setHeaderHits = (INDEX_TS.match(/res\.setHeader\('X-Session-Token'/g) ?? []).length;
const corsExposeHits = (INDEX_TS.match(/exposedHeaders: \['X-Session-Token'\]/g) ?? []).length;
t('G11-2', 'no-new-route', setHeaderHits === 1 && corsExposeHits === 1,
  '续期头下发点恰 1 处（单一签发源）+ cors exposedHeaders 恰 1 处',
  `setHeader=${setHeaderHits} exposed=${corsExposeHits}`);
const dbRefs = (AUTH_TS.match(/\bneon\b|DatabaseService|\bINSERT\b|\bUPDATE\b|\bDELETE FROM\b/g) ?? []).length;
t('G11-3', 'zero-db-write', dbRefs === 0,
  'auth.ts 零库面引用（无 SQL / 无 DatabaseService；HMAC `.update(` 不算）', `matches=${dbRefs}`);
const unauthorizedBranch = (INDEX_TS.match(/sendAuthError\(res, 401\)/g) ?? []).length;
t('G11-4', 'zero-new-code', unauthorizedBranch >= 1 && INDEX_TS.includes("'AUTH_UNAUTHORIZED'"),
  '401 语义不变：requireActor 仍 sendAuthError(res,401) + AUTH_UNAUTHORIZED（无新错误码）',
  `sendAuthError401_hits=${unauthorizedBranch}`);
const renewCallSites = (INDEX_TS.match(/maybeIssueRenewedSession\(res, /g) ?? []).length;
t('G11-5', 'wiring', renewCallSites === 2 && INDEX_TS.includes('maybeIssueRenewedSession(res, resolved.session)'),
  '续期接在 2 处：requireActor 成功出口（52 个调用点共用）+ /api/home 直连 resolveActor 面',
  `call_sites=${renewCallSites}`);
const privateCacheNextToHeader = /res\.setHeader\('X-Session-Token'[\s\S]{0,400}?res\.setHeader\('Cache-Control', 'private, no-store'\)/.test(INDEX_TS);
t('G11-6', 'wiring', privateCacheNextToHeader,
  '续期头与 `Cache-Control: private, no-store` 同在一处（带凭证响应不入共享缓存）',
  `co_located=${privateCacheNextToHeader}`);

// ════════════════════════════════════════════════════════════ G12 防御面
const futureSst = decode(at(T0, () => auth.createSessionToken({ uID: UID, evm: EVM, sessionStartedAt: T0 + 99_999 })));
t('G12-1', 'defensive', futureSst.sst === T0,
  `未来 sst ⇒ 上钳到 now=${T0}（不得把绝对上限后推）`, `sst=${String(futureSst.sst)}`);
const nanArm = [
  auth.shouldRenewSession({ issuedAt: Number.NaN, sessionStartedAt: T0, now: T0 + GRAN }),
  auth.shouldRenewSession({ issuedAt: T0, sessionStartedAt: Number.NaN, now: T0 + GRAN }),
  auth.shouldRenewSession({ issuedAt: T0, sessionStartedAt: T0, now: Number.NaN }),
];
t('G12-2', 'defensive', nanArm.every((v) => v === false), '坏输入 ⇒ 全 false（fail-closed）', JSON.stringify(nanArm));

// ── 汇总 + 落盘
const passed = checks.filter((c) => c.pass).length;
const failed = checks.length - passed;
const summary = {
  script: 'backend-ts/scripts/p9-auth-renewal-gate.ts',
  at: new Date().toISOString(),
  clock: 'fake（Date.now 打桩，基准 T0=' + T0 + '）',
  policy: {
    idle_seconds: IDLE, absolute_seconds: ABS, renew_granularity_seconds: GRAN,
    legacy_access_token_seconds: LEGACY_TTL, note: '默认臂 = 无 AUTH_SESSION_* env',
  },
  registration_points: { total: regs, verbs: verbCounts, p7b03_constant: p7bConst ? p7bConst[1] : null },
  checks,
  summary: { total: checks.length, passed, failed },
  verdict: failed === 0 ? 'PASS' : 'FAIL',
};

fs.mkdirSync(path.dirname(OUT_OPS), { recursive: true });
fs.writeFileSync(OUT_OPS, `${JSON.stringify(summary, null, 2)}\n`);
fs.mkdirSync(ARTIFACTS, { recursive: true });
fs.writeFileSync(path.join(ARTIFACTS, 'gate.json'), `${JSON.stringify(summary, null, 2)}\n`);

for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(7)} [${c.group}] expect=${c.expect} actual=${c.actual}`);
}
console.log(`\n${passed}/${checks.length} green · verdict=${summary.verdict} · readings=${OUT_OPS}`);

// 还原门动过的 env（不影响退出码，只为同一 shell 里的后续脚本）
for (const k of TOUCHED) {
  if (savedEnv[k] === undefined) delete process.env[k];
  else process.env[k] = savedEnv[k] as string;
}

process.exit(failed === 0 ? 0 : 1);

import crypto from 'crypto';
import { verifyMessage } from 'ethers';

// P4-SEC（缺陷 A）：「硬编码兜底签名密钥」已被**移除**（修前 `process.env.SECRET_KEY || 'your-secret-key-here'`）。
// 现在**缺失即 fail-fast**：没有真密钥就**不启动**（清晰错误 + 非零退出码），绝不静默用某个默认密钥起来。
// ⚠️ 本常量只用于**拒绝**，绝不参与签名（保留它是为了把「又用回公开常量」这一回归明确打死）。
const PUBLIC_FALLBACK_KEY = 'your-secret-key-here';

const resolveSecretKey = (): string => {
  const raw = String(process.env.SECRET_KEY ?? '').trim();

  if (!raw) {
    console.error(
      '[FATAL] SECRET_KEY is not set. Refusing to start: the API would either sign/verify sessions '
      + 'with an unknown key or fall back to the public placeholder, letting anyone forge a session '
      + 'token for any uID. Set SECRET_KEY in <backend-ts>/.env.local (or the process environment).',
    );
    process.exit(1);
  }

  if (raw === PUBLIC_FALLBACK_KEY) {
    console.error(
      '[FATAL] SECRET_KEY is set to the well-known public placeholder ("' + PUBLIC_FALLBACK_KEY + '"). '
      + 'Refusing to start: that value is public, so any holder could forge a session token for any uID.',
    );
    process.exit(1);
  }

  return raw;
};

const SECRET_KEY = resolveSecretKey();
// `ACCESS_TOKEN_EXPIRE_MINUTES`（缺省 30）**保留**：现役旧 token（`{sub, evm, exp}`，无 `iat`/`sst`）
// 的 TTL 只能从它反推（见 `verifySessionToken` 的 iat 回落），删掉它会让旧 token 的会话起点算错。
const ACCESS_TOKEN_EXPIRE_MINUTES = Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 30);
// P9-AUTH-RENEWAL（Kevin 2026-10-17 裁定「变体 1 · 无状态滑动续期」）：
//   · 闲置上限 = 3 天（从**最后一次鉴权活动**算）；绝对上限 = 7 天（从**首次登录**算）；两者取先到者。
//   · 续期粒度 = 1 小时（`now >= iat + 1h` 才重签）⇒ 不在每个请求上重签。
//   · 续期后必须**保留会话起点**：新 token 的 `sst` 不变、`iat = now`、`exp = min(iat + IDLE, sst + ABSOLUTE)`。
// 两个上限都可 env 覆盖（写入方式与既有常量同风格，缺省即裁定值）。
const SESSION_IDLE_MINUTES = Number(process.env.AUTH_SESSION_IDLE_MINUTES || 4320); // 3d
const SESSION_ABSOLUTE_MINUTES = Number(process.env.AUTH_SESSION_ABSOLUTE_MINUTES || 10080); // 7d
const SESSION_RENEW_GRANULARITY_SECONDS = 3600; // 1h
export const SESSION_IDLE_SECONDS = SESSION_IDLE_MINUTES * 60;
export const SESSION_ABSOLUTE_SECONDS = SESSION_ABSOLUTE_MINUTES * 60;
// 配置脚枪告警（**不拦启动**，只喊一声）：token 死在 `iat + IDLE`，若 IDLE/ABSOLUTE ≤ 续期粒度，
// 续期分支在结构上永远不可达（用户会觉得自己「被硬踢」）。实测读数见 p9 门 G10-3。
if (SESSION_IDLE_SECONDS <= SESSION_RENEW_GRANULARITY_SECONDS || SESSION_ABSOLUTE_SECONDS <= SESSION_RENEW_GRANULARITY_SECONDS) {
  console.warn(
    `[auth] sliding renewal unreachable: idle=${SESSION_IDLE_SECONDS}s absolute=${SESSION_ABSOLUTE_SECONDS}s`
    + ` <= renewal granularity=${SESSION_RENEW_GRANULARITY_SECONDS}s (tokens die before they can be renewed)`,
  );
}
/** 供门脚本 / 报告复算的安全常量自证（只读派生值，不参与任何判定分支） */
export const SESSION_POLICY = {
  idleSeconds: SESSION_IDLE_SECONDS,
  absoluteSeconds: SESSION_ABSOLUTE_SECONDS,
  renewGranularitySeconds: SESSION_RENEW_GRANULARITY_SECONDS,
  legacyAccessTokenSeconds: ACCESS_TOKEN_EXPIRE_MINUTES * 60,
} as const;
const AUTH_CHALLENGE_EXPIRE_SECONDS = Number(process.env.AUTH_CHALLENGE_EXPIRE_SECONDS || 300);
// P6-B6-PERM（批 6 · `isAdminAddress` 收敛）：本模块**不再持有任何管理员地址真源**。
// 旧第三真源（`DEFAULT_ADMIN_ADDRESS = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'`
// + env `ADMIN_EVM_ADDRESSES` + 导出的 `isAdminAddress()`）已**移除** —— 权限判定唯一真源
// = 数据层 `users.is_admin` OR EXISTS(`admin_user_role`)（DL72）。
// 该地址已下沉为**迁移种子**：见 `migrations/0022_admin_permission_seed.sql` §④
// （把该地址在库内的持有人绑到 `super_admin` 角色，故收敛后运营管理员**不丢**权限）。

type TokenPayload = Record<string, unknown> & { exp?: number };

interface AuthChallengeRecord {
  evm: string;
  issuedAt: number;
  expiresAt: number;
  message: string;
}

export interface SessionTokenInput {
  uID: number;
  evm: string;
  /**
   * 会话起点（epoch 秒）。**首次登录不传**（= 现在）；续期时**必须回传旧 token 的 `sessionStartedAt`**
   * —— 否则每次续期都会把「绝对上限 7 天」重新起算。
   */
  sessionStartedAt?: number;
}

export interface SessionTokenPayload {
  uID: number;
  evm: string;
  /** 本 token 的签发时间（epoch 秒；JWT `iat`）。旧 token 无此键 ⇒ 由 `exp - ACCESS_TOKEN_EXPIRE_MINUTES*60` 反推。 */
  iat: number;
  /** 会话起点（epoch 秒；JWT `sst`，绝对上限的起算点）。旧 token 无此键 ⇒ 回落 `iat`。 */
  sessionStartedAt: number;
}

const activeAuthChallenges = new Map<string, AuthChallengeRecord>();

const base64UrlEncode = (value: string | Buffer) => Buffer.from(value).toString('base64url');

const base64UrlDecode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

const signToken = (payload: TokenPayload) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(unsignedToken)
    .digest('base64url');

  return `${unsignedToken}.${signature}`;
};

const verifySignedToken = (token: string): TokenPayload => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(unsignedToken)
    .digest('base64url');

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TokenPayload;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp <= now) {
    throw new Error('Token expired');
  }

  return payload;
};

const buildWalletSignMessage = (evmAddress: string, nonce: string, issuedAt: number, expiresAt: number) => {
  const issuedIso = new Date(issuedAt * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  const expiresIso = new Date(expiresAt * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');

  return [
    'Seafood Wallet Sign-In',
    '',
    '请签名确认你持有该钱包地址，用于登录 Seafood。',
    '本次签名不会发起链上交易，也不会消耗 gas。',
    '',
    `钱包地址: ${evmAddress}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedIso}`,
    `Expires At: ${expiresIso}`,
  ].join('\n');
};

const pruneAuthChallenges = () => {
  const now = Math.floor(Date.now() / 1000);
  for (const [nonce, record] of activeAuthChallenges.entries()) {
    if (record.expiresAt <= now) {
      activeAuthChallenges.delete(nonce);
    }
  }
};

// P6-B6-PERM（批 6）：`isAdminAddress()` 已**删除**（第三真源收敛）。权限判定唯一真源 =
// `users.is_admin` OR EXISTS(`admin_user_role`)；地址→角色的绑定见 `migrations/0022_admin_permission_seed.sql`。

export const startWalletAuthChallenge = (evmAddress: string) => {
  const normalizedAddress = String(evmAddress || '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/i.test(normalizedAddress)) {
    throw new Error('Invalid EVM address');
  }

  pruneAuthChallenges();

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + AUTH_CHALLENGE_EXPIRE_SECONDS;
  const nonce = crypto.randomBytes(16).toString('hex');

  // SIG-VERIFY：原文消息**必须**与 challenge 记录同存 —— verify 侧要对「签发时给出的这一份原文」
  // 做 EIP-191 personal_sign 恢复（`buildWalletSignMessage` 纯函数，重算只是等价实现；同存可杜绝
  // 「模板漂移导致旧 challenge 的签名再也验不过」这一隐性回归）。
  const message = buildWalletSignMessage(normalizedAddress, nonce, issuedAt, expiresAt);

  activeAuthChallenges.set(nonce, {
    evm: normalizedAddress,
    issuedAt,
    expiresAt,
    message,
  });

  const challengeToken = signToken({
    typ: 'auth_challenge',
    evm: normalizedAddress,
    nonce,
    iat: issuedAt,
    expires_at: expiresAt,
    exp: expiresAt,
  });

  return {
    evm_address: normalizedAddress,
    message,
    challenge_token: challengeToken,
    expires_at: expiresAt,
  };
};

export const consumeWalletAuthChallenge = (payload: {
  evm_address?: string;
  signature?: string;
  challenge_token?: string;
}) => {
  const normalizedAddress = String(payload.evm_address || '').trim().toLowerCase();
  const signature = String(payload.signature || '').trim();
  const challengeToken = String(payload.challenge_token || '').trim();

  if (!normalizedAddress || !signature || !challengeToken) {
    throw new Error('evm_address, signature and challenge_token required');
  }

  const decoded = verifySignedToken(challengeToken);
  if (decoded.typ !== 'auth_challenge') {
    throw new Error('Invalid challenge token type');
  }

  const challengeAddress = String(decoded.evm || '').trim().toLowerCase();
  const nonce = String(decoded.nonce || '').trim();
  const expiresAt = Number(decoded.expires_at || 0);

  pruneAuthChallenges();

  if (challengeAddress !== normalizedAddress) {
    throw new Error('Challenge address mismatch');
  }

  const challengeRecord = activeAuthChallenges.get(nonce);
  if (!challengeRecord || challengeRecord.evm !== challengeAddress || challengeRecord.expiresAt !== expiresAt) {
    throw new Error('Challenge has been consumed or expired');
  }

  // SIG-VERIFY（HIGH 安全修复）：**对签发时给出的那份原文消息**做 EIP-191 `personal_sign` 恢复，
  // 并把恢复出的地址与 challenge 声明地址做**大小写不敏感**比对。
  // 修前此处直接 return —— 服务端从不校验 `signature`，任何地址 + 任意垃圾签名都能换到真 JWT（完整身份冒充）。
  // 语义保持：比对通过才 `delete`（消费 nonce）；比对失败**不消费**（合法用户的一次坏签名不会打掉自己的 challenge）。
  let recoveredAddress: string;
  try {
    recoveredAddress = verifyMessage(challengeRecord.message, signature);
  } catch {
    throw new Error('Invalid wallet signature');
  }

  if (recoveredAddress.toLowerCase() !== challengeAddress) {
    throw new Error('Signature does not match the claimed address');
  }

  activeAuthChallenges.delete(nonce);

  return {
    evm: normalizedAddress,
  };
};

export const createSessionToken = (payload: SessionTokenInput) => {
  const now = Math.floor(Date.now() / 1000);
  // 会话起点（sst）：首次登录 = 现在；续期 = 旧 token 的 sst。
  // **上钳到 now**：万一传入未来时刻（含旧 token 反推出的异常 iat），不得用它把绝对上限往后推。
  const declaredStartedAt = Number(payload.sessionStartedAt);
  const sessionStartedAt = Number.isFinite(declaredStartedAt) && declaredStartedAt > 0
    ? Math.min(Math.floor(declaredStartedAt), now)
    : now;
  const expiresAt = Math.min(now + SESSION_IDLE_SECONDS, sessionStartedAt + SESSION_ABSOLUTE_SECONDS);

  return signToken({
    sub: String(payload.uID),
    evm: payload.evm,
    iat: now,
    sst: sessionStartedAt,
    exp: expiresAt,
  });
};

/**
 * 续期判据（**纯函数**，零副作用）：到 1 小时粒度才重签，且**绝对上限到点后不再续**。
 * `issuedAt` = 旧 token 的 `iat`；`sessionStartedAt` = 旧 token 的 `sst`；`now` = 当前 epoch 秒。
 * 注意：过期（`exp <= now`）的 token 根本走不到这里 —— `verifySessionToken` 先抛 `Token expired`。
 */
export const shouldRenewSession = (input: {
  issuedAt: number;
  sessionStartedAt: number;
  now: number;
}): boolean => {
  const { issuedAt, sessionStartedAt, now } = input;
  if (!Number.isFinite(issuedAt) || !Number.isFinite(sessionStartedAt) || !Number.isFinite(now)) {
    return false; // 坏输入 ⇒ 不续（fail-closed，绝不因脏数据签发新 token）
  }
  if (now < issuedAt + SESSION_RENEW_GRANULARITY_SECONDS) return false; // 粒度未到
  return now < sessionStartedAt + SESSION_ABSOLUTE_SECONDS; // 绝对上限未到
};

export const verifySessionToken = (token: string): SessionTokenPayload => {
  const payload = verifySignedToken(token);
  const rawUID = Number(payload.sub || 0);
  const evm = String(payload.evm || '').trim().toLowerCase();

  if (!rawUID) {
    throw new Error('Could not validate credentials');
  }

  // 旧 token 兼容（`{sub, evm, exp}`，无 `iat`/`sst`）：语义**逐字不变**，只是把缺的键补出来
  //   · 无 `iat` ⇒ 按旧 TTL 反推 `iat = exp - ACCESS_TOKEN_EXPIRE_MINUTES*60`
  //   · 无 `sst` ⇒ `sst = iat`（会话视为从该 token 签发时开始）
  const now = Math.floor(Date.now() / 1000);
  const declaredExp = Number(payload.exp);
  const declaredIat = Number(payload.iat);
  const issuedAt = Number.isFinite(declaredIat) && declaredIat > 0
    ? Math.floor(declaredIat)
    : (Number.isFinite(declaredExp) && declaredExp > 0 ? Math.floor(declaredExp) - (ACCESS_TOKEN_EXPIRE_MINUTES * 60) : now);
  const declaredSst = Number(payload.sst);
  const sessionStartedAt = Number.isFinite(declaredSst) && declaredSst > 0
    ? Math.floor(declaredSst)
    : issuedAt;

  return {
    uID: rawUID,
    evm,
    iat: issuedAt,
    sessionStartedAt,
  };
};

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
const ACCESS_TOKEN_EXPIRE_MINUTES = Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 30);
const AUTH_CHALLENGE_EXPIRE_SECONDS = Number(process.env.AUTH_CHALLENGE_EXPIRE_SECONDS || 300);
const DEFAULT_ADMIN_ADDRESS = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0';
const ADMIN_EVM_ADDRESSES = new Set(
  [
    DEFAULT_ADMIN_ADDRESS,
    ...(process.env.ADMIN_EVM_ADDRESSES || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ],
);

type TokenPayload = Record<string, unknown> & { exp?: number };

interface AuthChallengeRecord {
  evm: string;
  issuedAt: number;
  expiresAt: number;
  message: string;
}

export interface SessionTokenPayload {
  uID: number;
  evm: string;
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

export const isAdminAddress = (evmAddress: string | null | undefined) => {
  const normalized = String(evmAddress || '').trim().toLowerCase();
  return normalized ? ADMIN_EVM_ADDRESSES.has(normalized) : false;
};

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

export const createSessionToken = (payload: SessionTokenPayload) => {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (ACCESS_TOKEN_EXPIRE_MINUTES * 60);

  return signToken({
    sub: String(payload.uID),
    evm: payload.evm,
    exp: expiresAt,
  });
};

export const verifySessionToken = (token: string): SessionTokenPayload => {
  const payload = verifySignedToken(token);
  const rawUID = Number(payload.sub || 0);
  const evm = String(payload.evm || '').trim().toLowerCase();

  if (!rawUID) {
    throw new Error('Could not validate credentials');
  }

  return {
    uID: rawUID,
    evm,
  };
};

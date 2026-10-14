/**
 * tg-bind-v2 反向短码 · 离线最小单测（无 DB / 无网络，纯断言）
 *
 * 跑法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/test-tg-bind-v2-offline.ts
 * 退出码：0 = 全过；非 0 = 有断言失败（assert 栈直接暴露失败点）。
 *
 * 覆盖（confirm 校验链的路由侧纯逻辑 + 短码形状/文案/限速；不触库、不改产品契约）：
 *   ① 短码形状闸 isValidShortBindCode（含易混字符 0/O/1/I 拒绝、长度、类型）
 *   ② 签发字符集 generateShortBindCode（32 字符集、无易混字、位长 6、批量形状）
 *   ③ bot 回复文案 shortBindIssueReplyText（双语一行含码 / 防刷固定提示）
 *   ④ confirm 结果 → 既有错误形态映射 confirmErrorForOutcome（零新错误码）
 *   ⑤ confirm 内存限速 checkConfirmRateLimit（10 次/分、滑窗、账号隔离）
 */
import assert from 'assert';
import {
  checkConfirmRateLimit,
  confirmErrorForOutcome,
  generateShortBindCode,
  isValidShortBindCode,
  SHORT_BIND_CODE_ALPHABET,
  SHORT_BIND_CODE_LENGTH,
  shortBindIssueReplyText,
} from '../src/telegram-service';
import { errorMessageOf } from '../src/ledger-errors';

let passed = 0;
const ok = (label: string): void => {
  passed += 1;
  console.log(`PASS ${label}`);
};

// ---------------------------------------------------------------- ① 形状闸
for (const good of ['ABCD23', 'ZZZZ99', 'ABCDEF', '234567', 'A2B3C4']) {
  assert.strictEqual(isValidShortBindCode(good), true, `shape gate should accept ${good}`);
}
ok('shape gate accepts 5 well-formed codes');

for (const bad of [
  '', 'abcd23', 'ABC23', 'ABCDE2345', 'ABCD20', 'ABCD2O', 'ABCD21', 'ABCD2I',
  ' ABCD2', 'ABCD234', null, undefined, 12345678, ['ABCD2345'], {}, 'ABCD2345 ',
]) {
  assert.strictEqual(isValidShortBindCode(bad), false, `shape gate should reject ${JSON.stringify(bad)}`);
}
ok('shape gate rejects 16 malformed/non-string inputs (incl. 0/O/1/I)');

// ---------------------------------------------------------------- ② 字符集 / 生成器
assert.strictEqual(SHORT_BIND_CODE_LENGTH, 6);
assert.strictEqual(SHORT_BIND_CODE_ALPHABET.length, 32);
for (const confusing of ['0', 'O', '1', 'I']) {
  assert.strictEqual(SHORT_BIND_CODE_ALPHABET.includes(confusing), false, `alphabet must exclude ${confusing}`);
}
assert.strictEqual(SHORT_BIND_CODE_ALPHABET.length === new Set(SHORT_BIND_CODE_ALPHABET).size, true);
assert.strictEqual(256 % SHORT_BIND_CODE_ALPHABET.length, 0, 'randomBytes modulo bias must be zero');
ok('alphabet = 32 unique chars, excludes 0/O/1/I, modulo bias-free');

for (let i = 0; i < 400; i += 1) {
  const code = generateShortBindCode();
  assert.strictEqual(code.length, 6);
  assert.strictEqual(/^[A-HJ-NP-Z2-9]{6}$/.test(code), true, `generated code malformed: ${code}`);
}
ok('400 generated codes all 6-char, charset-clean');

// ---------------------------------------------------------------- ③ bot 回复文案
const issuedReply = shortBindIssueReplyText({ kind: 'ok', code: 'AB3DX9' });
assert.strictEqual(issuedReply.split('AB3DX9').length - 1, 2, 'code must appear in both language halves');
assert.strictEqual(issuedReply.includes('XXXXXXXX'), false, 'placeholder must be fully substituted');
assert.ok(issuedReply.includes('绑定码'), 'must contain Chinese half');
assert.ok(issuedReply.includes('（10 分钟内有效）'));
assert.ok(issuedReply.includes('Your binding code:'));
assert.ok(issuedReply.includes('valid 10 min'));
ok('issued reply = bilingual single line with code in both halves');

const limitedReply = shortBindIssueReplyText({ kind: 'rate_limited' });
assert.strictEqual(limitedReply.includes('XXXX'), false);
assert.ok(limitedReply.length > 0 && limitedReply.includes('稍后再试'));
ok('rate-limited reply = fixed hint, no code');

// ---------------------------------------------------------------- ④ confirm 结果 → 既有错误形态
assert.strictEqual(confirmErrorForOutcome({ kind: 'ok', tg_linked_at: null }), null);
assert.strictEqual(confirmErrorForOutcome({ kind: 'replay_ok', tg_linked_at: null }), null);
assert.strictEqual(confirmErrorForOutcome({ kind: 'not_found' }), null);
ok('ok / replay_ok / not_found produce no sendMessagingError shape (404 handled at route)');

const expiredShape = confirmErrorForOutcome({ kind: 'failed', code: 'TG_CODE_INVALID', reason: 'EXPIRED' });
assert.strictEqual(expiredShape?.status, 400);
assert.strictEqual(expiredShape?.code, 'TG_CODE_INVALID');
assert.strictEqual(expiredShape?.message, errorMessageOf('TG_CODE_INVALID'));
assert.strictEqual((expiredShape?.details as { reason?: string }).reason, 'EXPIRED');

const consumedShape = confirmErrorForOutcome({ kind: 'failed', code: 'TG_CODE_INVALID', reason: 'CONSUMED' });
assert.strictEqual(consumedShape?.status, 400);
assert.strictEqual((consumedShape?.details as { reason?: string }).reason, 'CONSUMED');

const takenShape = confirmErrorForOutcome({ kind: 'failed', code: 'TG_TARGET_ACCOUNT_TAKEN' });
assert.strictEqual(takenShape?.status, 409);
assert.strictEqual(takenShape?.code, 'TG_TARGET_ACCOUNT_TAKEN');
assert.strictEqual(takenShape?.message, errorMessageOf('TG_TARGET_ACCOUNT_TAKEN'));
assert.deepStrictEqual(takenShape?.details, {});
ok('EXPIRED/CONSUMED → 400 TG_CODE_INVALID + reason; TAKEN → 409 (zero new error codes)');

// ---------------------------------------------------------------- ⑤ confirm 内存限速（固定时钟，确定断言）
const uidA = 904201;
for (let i = 0; i < 10; i += 1) {
  assert.strictEqual(checkConfirmRateLimit(uidA, 1_000_000), true, `attempt ${i + 1}/10 should pass`);
}
assert.strictEqual(checkConfirmRateLimit(uidA, 1_000_000), false, '11th attempt within window must be limited');
ok('confirm limit: 10/min pass, 11th blocked');

const uidB = 904202;
for (let i = 0; i < 10; i += 1) {
  assert.strictEqual(checkConfirmRateLimit(uidB, 2_000_000), true);
}
assert.strictEqual(checkConfirmRateLimit(uidB, 2_000_000 + 59_000), false, 'still inside 60s window');
assert.strictEqual(checkConfirmRateLimit(uidB, 2_000_000 + 61_000), true, 'window slides, allowed again');
assert.strictEqual(checkConfirmRateLimit(904203, 2_000_000), true, 'other account unaffected');
ok('confirm window slides at 60s; per-account isolation holds');

console.log(`tg-bind-v2 offline tests: ALL PASS (${passed} groups)`);
process.exit(0);

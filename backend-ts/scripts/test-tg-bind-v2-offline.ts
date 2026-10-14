/**
 * tg-bind-v2 反向短码 · 离线最小单测（无 DB / 无网络，纯断言）
 *
 * 跑法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/test-tg-bind-v2-offline.ts
 * 退出码：0 = 全过；非 0 = 有断言失败（assert 栈直接暴露失败点）。
 *
 * 覆盖（confirm 校验链的路由侧纯逻辑 + 短码形状/文案/限速；不触库、不改产品契约）：
 *   ① 短码形状闸 isValidShortBindCode（8 位纯数字；含字母拒绝、长度 7/9 拒绝；★ 0 与 1 合法）
 *   ② 签发字符集 generateShortBindCode（10 位数字集 0-9、位长 8、批量形状、十字符全覆盖）
 *   ③ bot 回复文案 shortBindIssueReplyText（双语一行含码 / 防刷固定提示）
 *   ④ confirm 结果 → 既有错误形态映射 confirmErrorForOutcome（零新错误码）
 *   ⑤ confirm 内存限速 checkConfirmRateLimit（10 次/分、滑窗、账号隔离）
 *   ⑥ confirm 形状闸 reason（Kevin 裁定：NOT_FOUND → SHAPE_INVALID）+ ★ 承重断言：形状分支 reason
 *      **必须 ≠ 查无分支 reason**（防回归同名），并静态核路由层形状分支确已走单一出口
 */
import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  checkConfirmRateLimit,
  CONFIRM_SHAPE_INVALID_REASON,
  confirmErrorForOutcome,
  confirmShapeError,
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
// ★ 承重正例：含 0 与含 1 的纯数字码必须**接受**（旧 32 字符集实现把 0/1 当非法字符剔除 ⇒ 这是真变化，
//   不是换样本；纯数字下 0/1 无法剔除也不能剔除）。
for (const good of ['10234567', '00000000', '11111111', '01234567', '98765430', '55550111']) {
  assert.strictEqual(isValidShortBindCode(good), true, `shape gate should accept ${good}`);
}
ok('shape gate accepts 6 well-formed 8-digit codes (incl. 0/1-bearing)');

// ★ 承重负例：含字母（旧字符集里合法的 A-Z 大写）现在必拒；长度 7 / 9 必拒。
for (const bad of [
  '', '1234567', '123456789', 'AB123456', '1234567a', 'a1234567', '1234 5678', '0123456', '1234567890',
  ' 12345678', '12345678 ', '0123456789', null, undefined, 12345678, ['12345678'], {}, 'ABCD23',
]) {
  assert.strictEqual(isValidShortBindCode(bad), false, `shape gate should reject ${JSON.stringify(bad)}`);
}
ok('shape gate rejects 18 malformed/non-string inputs (incl. letters and 7/9-digit lengths)');

// ---------------------------------------------------------------- ② 字符集 / 生成器
assert.strictEqual(SHORT_BIND_CODE_LENGTH, 8);
assert.strictEqual(SHORT_BIND_CODE_ALPHABET.length, 10);
assert.strictEqual(SHORT_BIND_CODE_ALPHABET, '0123456789');
// 纯数字集里 0 与 1 是合法码元（旧实现剔除它们 —— 这两条断言就是那处变化的承重点）。
assert.strictEqual(SHORT_BIND_CODE_ALPHABET.includes('0'), true, '0 is a legal digit now');
assert.strictEqual(SHORT_BIND_CODE_ALPHABET.includes('1'), true, '1 is a legal digit now');
assert.strictEqual(SHORT_BIND_CODE_ALPHABET.length === new Set(SHORT_BIND_CODE_ALPHABET).size, true);
// ★ 偏置算式（现取，别删）：10 字符集下 256 % 10 = 6 ≠ 0 ⇒ `randomBytes[i] % 10` 会让索引 0-5
//   相对多出约 4% 概率 ⇒ 生成器必须走 `crypto.randomInt(0, 10)`（或只接受 byte < 250 = 25 × 10 的拒绝采样）。
assert.strictEqual(256 % SHORT_BIND_CODE_ALPHABET.length, 6, '256 % 10 = 6 ⇒ modulo path is biased by construction');
const MODULO_BIASED_ALT = 26 / 256; // 若误改回 `% 10`：索引 0-5 的概率
assert.strictEqual(MODULO_BIASED_ALT > 1 / SHORT_BIND_CODE_ALPHABET.length, true, 'modulo path would over-weight 0-5');
ok('alphabet = 10 unique digits 0-9 (0/1 legal); 256 % 10 = 6 ⇒ randomInt path, modulo would be biased');

const seenDigits = new Set<string>();
for (let i = 0; i < 400; i += 1) {
  const code = generateShortBindCode();
  assert.strictEqual(code.length, 8);
  assert.strictEqual(/^[0-9]{8}$/.test(code), true, `generated code malformed: ${code}`);
  for (const ch of code) seenDigits.add(ch);
}
// 400 码 = 3200 位数字；十位数字全覆盖（★ 旧实现永远产不出 0/1，此断言对它必红）。
assert.strictEqual(seenDigits.size, 10, `all ten digits must be reachable, saw ${[...seenDigits].sort().join('')}`);
ok('400 generated codes all 8-digit numeric; all ten digits 0-9 observed (incl. 0 and 1)');

// ---------------------------------------------------------------- ③ bot 回复文案
const issuedReply = shortBindIssueReplyText({ kind: 'ok', code: '10234567' });
assert.strictEqual(issuedReply.split('10234567').length - 1, 2, 'code must appear in both language halves');
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

// ---------------------------------------------------------------- ⑥ confirm 形状闸 reason（Kevin 裁定 · 改名）
// ★ 形状闸（九步链第 1 闸）失败形态：错误码**仍** TG_CODE_INVALID（零新码），reason 改名 SHAPE_INVALID。
const shapeErr = confirmShapeError();
assert.strictEqual(shapeErr.status, 400);
assert.strictEqual(shapeErr.code, 'TG_CODE_INVALID');
assert.strictEqual(shapeErr.message, errorMessageOf('TG_CODE_INVALID'));
assert.strictEqual((shapeErr.details as { reason?: string }).reason, 'SHAPE_INVALID');
assert.strictEqual(CONFIRM_SHAPE_INVALID_REASON, 'SHAPE_INVALID');
ok('⑥ 形状闸 ⇒ 400 TG_CODE_INVALID + reason=SHAPE_INVALID（零新错误码）');

// ★ 承重断言（防回归同名）：形状分支 reason **必须 ≠** 查无分支 reason。
//   旧实现两者同为 'NOT_FOUND' ⇒ 客户端无法区分「码格式错（400）」与「码不存在（404）」；
//   同链其它 reason（EXPIRED / CONSUMED / RATE_LIMITED）也一律不得与形状分支撞名。
const SHAPE_REASON = (shapeErr.details as { reason: string }).reason;
const RESERVED_REASONS: Array<[string, string]> = [
  ['NOT_FOUND', '查无此码（旧形状闸 reason / 长码验签与 webhook 查无同 token）'],
  ['code_not_found', '查无此码（sendRefNotFound 404 的 ref 侧口径）'],
  ['EXPIRED', '码过期'],
  ['CONSUMED', '码已消费'],
  ['RATE_LIMITED', 'confirm 防刷'],
];
for (const [reserved, what] of RESERVED_REASONS) {
  assert.notStrictEqual(SHAPE_REASON, reserved, `shape reason must not collide with ${what}: ${reserved}`);
}
ok(`⑥ 承重：形状 reason ≠ ${RESERVED_REASONS.length} 个同链/查无 reason（防回归同名）`);

// 静态接线核对（离线读源码）：路由层形状分支必须走**单一出口** confirmShapeError()，
// 不得再内联 `details: { reason: 'NOT_FOUND' }`，且形状闸出现在服务器调用之前（第 1 闸不触库）。
const indexSrc = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf8');
const routeStart = indexSrc.indexOf("app.post('/api/telegram/bind/confirm'");
assert.ok(routeStart > 0, 'confirm route must exist in index.ts');
const routeBody = indexSrc.slice(routeStart, indexSrc.indexOf('app.post(', routeStart + 10));
assert.ok(routeBody.includes('confirmShapeError()'), 'shape branch must call confirmShapeError()');
assert.strictEqual(/reason:\s*'NOT_FOUND'/.test(routeBody), false, 'shape branch must not inline reason NOT_FOUND');
assert.ok(
  routeBody.indexOf('confirmShapeError()') < routeBody.indexOf('confirmShortBindCode('),
  'shape gate must run before the DB-facing confirm call',
);
ok('⑥ 接线：confirm 形状分支走单一出口，已无内联 NOT_FOUND，且闸在触库调用之前');

console.log(`tg-bind-v2 offline tests: ALL PASS (${passed} groups)`);
process.exit(0);

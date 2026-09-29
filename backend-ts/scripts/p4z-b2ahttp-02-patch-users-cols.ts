/* P4-B2a-HTTP: users 旧列名 → 新列名（uid/evm）。逐条断言命中数，命中数不符即中止、不写文件。 */
import fs from 'fs';
import path from 'path';

const target = path.resolve(__dirname, '../src/database.ts');
const original = fs.readFileSync(target, 'utf8');
let text = original;
const log: { name: string; expect: number; found: number; ok: boolean }[] = [];

function apply(name: string, from: string, to: string, expect: number) {
  const parts = text.split(from);
  const found = parts.length - 1;
  const ok = found === expect;
  log.push({ name, expect, found, ok });
  if (!ok) throw new Error(`PATCH_MISMATCH ${name}: expected ${expect} got ${found}`);
  text = parts.join(to);
}

// 1) normalizeUser: 增补新列回退键（uid/evm）；大写响应键不变
apply('normalizeUser-fallback-keys',
`const normalizeUser = (row: RawRow): UserRecord => ({
  uID: toNumberValue(getValue(row, 'uID', 'id')),
  EVM: toStringValue(getValue(row, 'EVM')),`,
`// P4-B2a-HTTP: users 真列名 = uid/evm（bio/is_admin/time_reg/time_login_last 同名）。
// 回退键追加在旧键之后 ⇒ 响应键集（uID/EVM/bio/is_admin/time_reg/time_login_last）逐字不变。
const normalizeUser = (row: RawRow): UserRecord => ({
  uID: toNumberValue(getValue(row, 'uID', 'uid', 'id')),
  EVM: toStringValue(getValue(row, 'EVM', 'evm')),`,
1);

// 2) getNextUserId
apply('getNextUserId',
`      SELECT COALESCE(MAX(NULLIF(BTRIM("uID"), '')::int), 0)::int + 1 AS next_id
      FROM "users"
      WHERE NULLIF(BTRIM("uID"), '') IS NOT NULL`,
`      SELECT COALESCE(MAX(uid), 0) + 1 AS next_id
      FROM public."users"`,
1);

// 3) getAllUsers ORDER BY
apply('getAllUsers-order',
`        ORDER BY COALESCE(NULLIF(BTRIM(u."uID"), '')::int, 0)`,
`        ORDER BY u.uid`,
1);

// 4) uID 谓词（getUserById / touchUserLogin / updateUserProfile 共 3 处，逐字同形）
apply('uid-predicate-x3',
`      WHERE COALESCE(NULLIF(BTRIM(u."uID"), '')::int, 0) = \${uID}`,
`      WHERE u.uid = \${uID}`,
3);

// 5) getUserByEvm 谓词（走 idx_users_evm_lower）
apply('getUserByEvm-predicate',
`      WHERE LOWER(COALESCE(u."EVM", '')) = \${normalizedAddress}`,
`      WHERE lower(u.evm) = \${normalizedAddress}`,
1);

// 6) createUserByEvm INSERT
apply('createUserByEvm-insert',
`      INSERT INTO "users" AS u ("uID", "EVM", "bio", "is_admin", "time_reg", "time_login_last")
      VALUES (\${String(nextUserId)}, \${normalizedAddress}, '', false, NOW(), NOW())`,
`      INSERT INTO public."users" AS u (uid, evm, bio, is_admin, time_reg, time_login_last)
      VALUES (\${nextUserId}, \${normalizedAddress}, '', false, NOW(), NOW())`,
1);

const outDir = process.argv[2] || '.p4-artifacts/patch';
fs.mkdirSync(outDir, { recursive: true });
if (text === original) throw new Error('NOTHING_CHANGED');
fs.writeFileSync(target, text);
fs.writeFileSync(`${outDir}/patch-log.json`, JSON.stringify({
  target: 'backend-ts/src/database.ts',
  applied: log,
  bytes_before: original.length,
  bytes_after: text.length,
  residual_old_cols: (text.match(/u\."uID"|u\."EVM"|"uID", "EVM"/g) || []),
}, null, 2));
console.log('PATCH_OK', JSON.stringify(log));
console.log('residual_old_cols =', (text.match(/u\."uID"|u\."EVM"|"uID", "EVM"/g) || []).length);

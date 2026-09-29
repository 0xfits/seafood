// P4-B2c-04 键集冻结（**静态口径**）：HEAD / 改动前(orig) / 改动后 三版本逐函数比对
// 口径自曝：本读数是**静态源码口径**（函数体逐字 + 返回对象键名提取），**不是**运行时内存夹具口径（B1 系列）。
// 但不变量成立：这 5 个函数决定 §2 母约束下的响应键集；其中 4 个（normalizeUser / normalizeSystemSettings /
// normalizePermissionGroup / getUserStats）本片**未触碰** ⇒ 逐字相等即键集相等；buildAdminAccess 本片改了签名
// 与一行判定，但返回对象的键名集合必须逐字不变。
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = path.resolve(__dirname, '..');
const RUN = process.env.P4_RUN || 'b2c-manual';
const ART = path.join(ROOT, '.p4-artifacts', RUN);

const versions: Record<string, string> = {
  HEAD: path.join(ART, 'database.HEAD.ts'),
  before: path.join(ART, 'orig', 'src_database.ts.orig'),
  after: path.join(ROOT, 'src', 'database.ts'),
};

const blocks: Array<{ name: string; start: string; end: string; returnsKeys: boolean }> = [
  { name: 'normalizeUser (→ /api/user, /api/user/all, /api/admin/user/update, admin/me)', start: 'const normalizeUser = (row: RawRow): UserRecord => ({', end: '});', returnsKeys: false },
  { name: 'normalizeSystemSettings (→ GET/POST /api/admin/settings)', start: 'const normalizeSystemSettings = (value: unknown): SystemSettingsRecord => {', end: '\n};', returnsKeys: false },
  { name: 'normalizePermissionGroup (→ GET /api/admin/permissions)', start: 'const normalizePermissionGroup = (row: RawRow): PermissionGroupRecord => ({', end: '\n});', returnsKeys: false },
  { name: 'getUserStats (→ GET /api/user/stats)', start: 'static async getUserStats(): Promise<{', end: '      avg_points: assetCount > 0 ? totalPoints / assetCount : 0,\n    };\n  }', returnsKeys: true },
  { name: 'buildAdminAccess (→ GET /api/admin/me)', start: 'static buildAdminAccess(', end: '      preferred_admin_path: preferredAdminPath,\n    };\n  }', returnsKeys: true },
];

const extract = (text: string, start: string, end: string): string | null => {
  const s = text.indexOf(start);
  if (s < 0) return null;
  const e = text.indexOf(end, s);
  if (e < 0) return null;
  return text.slice(s, e + end.length);
};

const returnKeys = (block: string): string[] => {
  const idx = block.lastIndexOf('return {');
  if (idx < 0) return [];
  const body = block.slice(idx);
  const keys: string[] = [];
  for (const line of body.split('\n')) {
    const m = /^\s{4,6}([A-Za-z_][A-Za-z0-9_]*):\s/.exec(line);
    if (m) keys.push(m[1]);
  }
  return keys;
};

const source: Record<string, string> = {};
for (const [name, file] of Object.entries(versions)) {
  source[name] = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

const rows: unknown[] = [];
let allEqual = true;
for (const block of blocks) {
  const per: Record<string, { found: boolean; sha: string | null; keys: string[] | null }> = {};
  for (const v of Object.keys(versions)) {
    const text = extract(source[v], block.start, block.end);
    per[v] = {
      found: text !== null,
      sha: text === null ? null : crypto.createHash('sha256').update(text).digest('hex').slice(0, 16),
      keys: text === null ? null : (block.returnsKeys ? returnKeys(text) : null),
    };
  }
  const shas = Object.values(per).map((p) => p.sha);
  const keysEqual = block.returnsKeys
    ? JSON.stringify(per.HEAD.keys) === JSON.stringify(per.before.keys) && JSON.stringify(per.before.keys) === JSON.stringify(per.after.keys)
    : shas.every((s) => s === shas[0]);
  if (!keysEqual || shas.some((s) => s === null)) allEqual = false;
  rows.push({ target: block.name, per_version: per, key_set_equal: keysEqual });
}

const out = {
  generated_at: new Date().toISOString(),
  caliber: 'STATIC source-text caliber (function body sha + return-object key names); NOT a runtime fixture caliber',
  versions,
  targets: rows,
  all_key_sets_equal: allEqual,
};
fs.writeFileSync(path.join(ART, 'keys-results.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

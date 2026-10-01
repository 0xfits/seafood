/**
 * P6-TR-1c-FIX2 · `i18n_status` 分母修正 离线用例（真·源码驱动，零库连接）
 * ============================================================================
 * 被测真源：`backend-ts/src/database.ts` 的 `applyI18n()`（**直接 import 真函数**，非复刻）。
 *
 * 本单口径（P6-TR-1c-FIX2）：
 *   ① 源文本为空/空白（trim 后为空）的 (字段 × 语言) 格**不计入分母**；
 *   ② `total === 0`（所有可译字段源皆空）⇒ 真空态 `ready`、**该键恒在**（spec v1.3 §10.15）；
 *   ③ 非空源的格照旧；`ready/partial/pending` 三态含义不变（只换分母）；
 *   ④ `*_<lang>` 仍**恒有值**（有 ready 译文用译文、否则回落源文，**永不空串**；
 *      唯一例外 = 源文本身为空 ⇒ 回落空串，本单不改）。
 *
 * 用例：M1/M1b/M2/M2b/M3/M3b/M4/M4b/M5/M6（覆盖派单四条的 job 与 listing 两侧）。
 * 运行：`npx ts-node --transpile-only scripts/p4z-tr1c-fix2-i18n-status-tests.ts`
 * 产物：`.p4-artifacts/p6tr1cfix2-<RUN>/result.json` + `result.md`
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import { applyI18n } from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1cfix2-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; note?: string }
const checks: Check[] = [];
function t(id: string, group: string, pass: boolean, expect: unknown, actual: unknown, note?: string): void {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual), note });
}

type Index = Map<string, Map<string, string>>;
const LANGS = ['en', 'hk', 'vn'] as const;
/** 建 `entity_id → (field\0lang) → text` 索引（仅对被列出的字段造 ready 译文）。 */
const mkIndex = (id: string, fields: string[]): Index => {
  const bucket = new Map<string, string>();
  for (const field of fields) {
    for (const lang of LANGS) bucket.set(`${field}\u0000${lang}`, `T-${field}-${lang}`);
  }
  return new Map<string, Map<string, string>>([[id, bucket]]);
};
const hasKey = (o: Record<string, unknown>, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const s = (v: unknown): string => (typeof v === 'string' ? v : `<${typeof v}>`);

const main = (): void => {
  // ---- ① job：title 有源已翻、description(=note) 源为空 ⇒ 必须 ready（不得因空源格永久 partial）
  const r1: Record<string, unknown> = { title: '招聘服务员', note: '' };
  applyI18n('job', '11', r1, mkIndex('11', ['title']));
  t('M1', 'empty-source-excluded', r1.i18n_status === 'ready', 'ready', r1.i18n_status,
    '空描述源不计入分母（原样 ⇒ partial）');
  t('M1b', 'empty-source-excluded', r1.title_en === 'T-title-en' && r1.note_en === '', 'T-title-en / ""',
    `${s(r1.title_en)} / "${s(r1.note_en)}"`, '非空源用译文；空源回落空串');

  // ---- ② 所有可译字段源均空（含纯空白）⇒ 真空态 `ready`、键**恒在**（spec v1.3 §10.15）
  //      r2a：索引桶为空 ⇒ 空源回落空串（契约唯一例外，键形态不变）；r2b：空源但索引里有译文 ⇒ 仍输出译文（值不为空串）
  const r2a: Record<string, unknown> = { title: '', note: '   ' };
  applyI18n('job', '12', r2a, mkIndex('12', []));
  t('M2', 'all-empty-source-vacuous-ready', hasKey(r2a, 'i18n_status') && r2a.i18n_status === 'ready', '键在且值=ready',
    `hasKey=${hasKey(r2a, 'i18n_status')} value=${s(r2a.i18n_status)}`,
    'total===0 ⇒ 真空态 ready（前端对 ready / 键缺省处理一致 ⇒ 不显示小标）');
  t('M2b', 'all-empty-source-vacuous-ready', hasKey(r2a, 'title_en') && r2a.title_en === '', 'title_en 键在、值为空串',
    `hasKey=${hasKey(r2a, 'title_en')} value="${s(r2a.title_en)}"`, '空源 + 无译文 ⇒ 回落空串（唯一例外，本单未改）');
  const r2b: Record<string, unknown> = { title: '', note: '' };
  applyI18n('job', '12', r2b, mkIndex('12', ['title']));
  t('M2c', 'all-empty-source-vacuous-ready', r2b.i18n_status === 'ready' && r2b.title_en === 'T-title-en', 'ready / T-title-en',
    `${s(r2b.i18n_status)} / ${s(r2b.title_en)}`, '空源格仍取已有译文（值不为空串）；分母修正只管计数');

  // ---- ③ 真 partial 保住：title 有源已翻、note 有源未翻 ⇒ total=6 / ready=3 ⇒ partial
  const r3: Record<string, unknown> = { title: '招聘服务员', note: '需要经验' };
  applyI18n('job', '13', r3, mkIndex('13', ['title']));
  t('M3', 'partial-preserved', r3.i18n_status === 'partial', 'partial', r3.i18n_status,
    '有源未翻的字段仍计入分母 ⇒ 原语义保住');
  t('M3b', 'partial-preserved', r3.note_vn === '需要经验', '需要经验', s(r3.note_vn), '有源未翻 ⇒ 回落源文');

  // ---- ④ `*_<lang>` 恒有值：源非空 + 索引缺省 ⇒ 6/6 全部非空串（回落源文）
  const r4: Record<string, unknown> = { title: '招聘服务员', note: '需要经验' };
  applyI18n('job', '14', r4, null);
  const vals: unknown[] = [];
  for (const lang of LANGS) { vals.push(r4[`title_${lang}`], r4[`note_${lang}`]); }
  t('M4', 'never-empty-string', vals.length === 6 && vals.every((v) => typeof v === 'string' && v !== ''),
    '6/6 非空串', JSON.stringify(vals), '索引缺省 ⇒ 全部回落源文、永不空串');
  t('M4b', 'never-empty-string', r4.i18n_status === 'pending', 'pending', r4.i18n_status, '一个译文也没有 ⇒ pending（未变）');

  // ---- ⑤ listing：description 源为空 ⇒ ready（对应 5 个空描述商品）
  const r5: Record<string, unknown> = { name: '海鲜套餐', description: '' };
  applyI18n('listing', '19', r5, mkIndex('19', ['name']));
  t('M5', 'listing-empty-source', r5.i18n_status === 'ready', 'ready', r5.i18n_status, 'listing 空 description 同理剔除');

  // ---- ⑥ listing 真 partial：name 已翻、description 有源未翻
  const r6: Record<string, unknown> = { name: '海鲜套餐', description: '含蟹两只' };
  applyI18n('listing', '20', r6, mkIndex('20', ['name']));
  t('M6', 'listing-partial', r6.i18n_status === 'partial', 'partial', r6.i18n_status, 'listing 真 partial 保住');

  const failed = checks.filter((c) => !c.pass);
  const groups = Array.from(new Set(checks.map((c) => c.group)));
  const summary = {
    run: RUN,
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    groups,
    checks,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'result.json'), JSON.stringify(summary, null, 2));
  const lines = [
    `# P6-TR-1c-FIX2 applyI18n 分母修正 离线用例（${RUN}）`,
    '',
    `- 真源：\`backend-ts/src/database.ts\` \`applyI18n()\`（直接 import，非复刻）`,
    `- 合计 **${checks.length}** 例：**PASS ${checks.length - failed.length} / FAIL ${failed.length}**`,
    '',
    '| id | group | pass | expect | actual | note |',
    '|---|---|---|---|---|---|',
    ...checks.map((c) => `| ${c.id} | ${c.group} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.expect} | ${c.actual} | ${c.note ?? ''} |`),
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'result.md'), lines.join('\n') + '\n');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.id} [${c.group}] expect=${c.expect} actual=${c.actual} ${c.note ?? ''}`);
  }
  console.log(`FIX2_CASES total=${checks.length} passed=${checks.length - failed.length} failed=${failed.length}`);
  console.log(`ARTIFACT_DIR=${OUT_DIR}`);
  process.exit(failed.length ? 1 : 0);
};

main();

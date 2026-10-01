/**
 * P6-TR-1a · 离线单测 / 探针（**无需任何 API key、不连库、不读 .env.local**）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p4-artifacts/p6tr1a-<RUN>/offline-tests.json
 *
 * 覆盖（每条「校验」都带判负用例）：
 *   A OpenCC 简繁（确定性，人民币 ⇒ 人民幣）
 *   B 提示词拼装
 *   C 三重校验逐条判负（JSON_PARSE / KEY_SET_MISMATCH / EMPTY_VALUE / LENGTH_RATIO ×2 / CHARSET ×2）
 *     + 豁免（vn 源无 CJK / 单字源）+ 正例
 *   D 缓存命中路径（全命中不付费 / 部分命中只请求缺的语言）
 *   E 日限额分支（超限 deferred / 边界不超限）
 *   F 单条字符上限分支
 *   G stub 模式端到端（+ 证明 stub 输出本身过不了真校验 = 刻意豁免）
 *   H deepseek 路径（正常 / 键缺 → 不写脏数据 / MODEL_NOT_AVAILABLE / 5xx 重试 / 429 重试成功 / 429×2）
 *   I backfillPending（重试成功 / 达上限不扫 / 源解析失败跳过 / 二次幂等）
 *   J 配置派生（无 key **不回落 stub** / 有 key / 显式 stub / 自定义 / **key 值零泄漏**）
 *   K 泄漏自检 + L 写路径 pending 登记（前台只登记不翻译）+ 缺 key 不写脏数据（J11-J14）
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  toTraditional,
  buildTranslationPrompt,
  validateFieldSet,
  validateValue,
  parseTranslationPayload,
  getTranslateConfig,
  translateFields,
  backfillPending,
  sha256Hex,
  hasCJK,
  asciiRatio,
  hasVietnameseDiacritics,
  stubTranslate,
  registerPendingTranslations,
  REASON,
  MAX_ATTEMPTS,
  TRANSLATE_TARGETS,
} from '../src/translate-service';
import type {
  TranslateStore,
  CacheRow,
  TranslationRow,
  TranslationStatus,
  TranslateServiceConfig,
  FetchLike,
  SourceResolver,
} from '../src/translate-service';

// ---------------------------------------------------------------- harness --
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1a-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; note?: string; }
const checks: Check[] = [];
function t(id: string, group: string, pass: boolean, expect: unknown, actual: unknown, note?: string): void {
  checks.push({
    id, group, pass: Boolean(pass),
    expect: String(expect), actual: String(actual), note,
  });
}

// ---------------------------------------------------------------- 内存 store
class MemStore implements TranslateStore {
  cache = new Map<string, CacheRow>();
  rows = new Map<string, TranslationRow>();
  cacheHits = 0;
  constructor(private todayCount = 0) {}
  private ck(h: string, s: string, t2: string) { return `${h}|${s}|${t2}`; }
  private rk(r: { entity_type: string; entity_id: string; field: string; lang: string }) {
    return `${r.entity_type}|${r.entity_id}|${r.field}|${r.lang}`;
  }
  seedCache(srcText: string, tgt: string, out: string, engine = 'deepseek') {
    this.cache.set(this.ck(sha256Hex(srcText), 'zh', tgt), {
      src_hash: sha256Hex(srcText), src_lang: 'zh', tgt_lang: tgt, text_out: out, engine,
    });
  }
  seedRow(r: TranslationRow) { this.rows.set(this.rk(r), { ...r }); }
  async getCache(h: string, s: string, t2: string) {
    const e = this.cache.get(this.ck(h, s, t2));
    if (!e) return null;
    this.cacheHits += 1;
    return e.text_out;
  }
  async putCache(row: CacheRow) { this.cache.set(this.ck(row.src_hash, row.src_lang, row.tgt_lang), { ...row }); }
  async countToday() { return this.todayCount; }
  async upsertTranslation(row: TranslationRow) {
    const k = this.rk(row);
    const prev = this.rows.get(k);
    const inc = row.status === 'ready' || row.status === 'failed' ? 1 : 0;
    this.rows.set(k, { ...row, attempts: prev ? prev.attempts + inc : 0 });
  }
  /** P6-TR-1c-A：批量 pending 登记（镜像生产语义：缺省 DO NOTHING / reset 覆盖回 pending）。 */
  async upsertPendingRows(rows: TranslationRow[], opts?: { reset?: boolean }) {
    for (const row of rows) {
      const k = this.rk(row);
      const prev = this.rows.get(k);
      if (prev && opts?.reset !== true) continue;
      this.rows.set(k, { ...row, attempts: prev ? prev.attempts : 0 });
    }
  }
  async listPending(limit: number, maxAttempts: number) {
    return Array.from(this.rows.values())
      .filter((r) => (r.status === 'pending' || r.status === 'failed') && r.attempts < maxAttempts)
      .slice(0, limit);
  }
  async readCurrent(et: string, ei: string, f: string, l: string) {
    const r = this.rows.get(`${et}|${ei}|${f}|${l}`);
    return r ? { text: r.text, status: r.status as TranslationStatus } : null;
  }
}

// ---------------------------------------------------------------- 假 fetch
interface FakeResp { status: number; body: string; }
class SeqFetch {
  calls = 0;
  lastBody = '';
  constructor(private seq: FakeResp[]) {}
  fn: FetchLike = async (_url, init) => {
    const r = this.seq[Math.min(this.calls, this.seq.length - 1)];
    this.calls += 1;
    this.lastBody = init.body;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.body };
  };
}
const envelope = (content: string): FakeResp => ({
  status: 200,
  body: JSON.stringify({ choices: [{ message: { content } }] }),
});

function mkCfg(o: Partial<TranslateServiceConfig> = {}): TranslateServiceConfig {
  return {
    engine: 'deepseek', requested_engine: 'deepseek', api_key_present: true,
    base_url: 'https://api.deepseek.com', model: 'deepseek-flash',
    max_chars_per_item: 2000, daily_item_cap: 500, fallback_reason: null, ...o,
  };
}

const SRC = '招聘服务员';          // 5 码点
const OK_RESP = JSON.stringify({ title: { en: 'Hiring staff', vn: 'Tuyển dụng' } });
/** 测试哨兵（**不是真 key**）：注入引擎用，并用于「绝不出现在产物里」的泄漏自检。 */
const TEST_KEY = 'sk-TESTKEY-DO-NOT-LEAK-9876543210';

// ---------------------------------------------------------------- main -----
async function main(): Promise<void> {
  // 仅注入**测试哨兵**（非真 key）到进程 env，使 deepseek 分支可离线驱动；
  // 真实 .env.local **不读、不打印**。
  process.env.DEEPSEEK_API_KEY = TEST_KEY;

  // ===== A OpenCC =====
  t('A1', 'opencc', toTraditional('人民币') === '人民幣', '人民幣', toTraditional('人民币'));
  t('A2', 'opencc', toTraditional('繁体化测试') === '繁體化測試', '繁體化測試', toTraditional('繁体化测试'));
  t('A3', 'opencc', toTraditional('人民币') === toTraditional('人民币'), '确定性(两次相同)', toTraditional('人民币'));
  t('A4', 'opencc', toTraditional('abc 123 $') === 'abc 123 $', 'abc 123 $', toTraditional('abc 123 $'));
  const long = '简体中文内容示例，含标点。';
  t('A5', 'opencc', toTraditional(long) === '簡體中文內容示例，含標點。', '簡體中文內容示例，含標點。', toTraditional(long));

  // ===== B 提示词 =====
  const p = buildTranslationPrompt({ title: SRC }, { title: ['en', 'vn'] });
  t('B1', 'prompt', /ONLY one single JSON object/i.test(p.system), 'system 要求只输出单个 JSON 对象', /ONLY one single JSON object/i.test(p.system));
  t('B2', 'prompt', /No markdown code fences/i.test(p.system), 'system 禁 markdown 围栏', /No markdown code fences/i.test(p.system));
  t('B3', 'prompt', !p.system.includes('```'), 'system 不含围栏字样', p.system.includes('```'));
  t('B4', 'prompt', /Preserve numbers, prices, currency symbols/i.test(p.system), 'system 要求保留数字/价格/币符号', /Preserve numbers/i.test(p.system));
  t('B5', 'prompt', /URLs/i.test(p.system), 'system 要求保留 URL', /URLs/.test(p.system));
  const uj = JSON.parse(p.user) as { fields: Record<string, string>; targets: Record<string, string[]> };
  t('B6', 'prompt', JSON.stringify(Object.keys(uj.fields)) === JSON.stringify(['title']), '["title"]', JSON.stringify(Object.keys(uj.fields)));
  t('B7', 'prompt', JSON.stringify(uj.targets.title) === JSON.stringify(['en', 'vn']), '["en","vn"]', JSON.stringify(uj.targets.title));

  // ===== C 三重校验判负 + 豁免 + 正例 =====
  const v1 = validateFieldSet({ title: SRC }, 'en', 'this is not json');
  t('C1-neg', 'validate', v1.errors.title === 'JSON_PARSE', 'JSON_PARSE', v1.errors.title);
  const v2 = validateFieldSet({ title: SRC }, 'en', JSON.stringify({ title: { en: 'Hiring' }, extra: { en: 'x' } }));
  t('C2-neg', 'validate', v2.errors.title === 'KEY_SET_MISMATCH', 'KEY_SET_MISMATCH', v2.errors.title);
  const v3 = validateFieldSet({ title: SRC }, 'en', JSON.stringify({ title: { en: '' } }));
  t('C3-neg', 'validate', v3.errors.title === 'EMPTY_VALUE', 'EMPTY_VALUE', v3.errors.title);
  const v4 = validateValue('招工招聘启事若干条说明', 'en', 'Job');
  t('C4-neg', 'validate', v4.reason === 'LENGTH_RATIO', 'LENGTH_RATIO(过短)', v4.reason);
  const v5 = validateValue('招工', 'en', 'A very long english sentence about work');
  t('C5-neg', 'validate', v5.reason === 'LENGTH_RATIO', 'LENGTH_RATIO(过长)', v5.reason);
  const v6 = validateValue(SRC, 'en', SRC);
  t('C6-neg', 'validate', v6.reason === 'CHARSET', 'CHARSET(en 非 ASCII 污染)', v6.reason);
  const v7 = validateValue(SRC, 'vn', 'tuyen dung');
  t('C7-neg', 'validate', v7.reason === 'CHARSET', 'CHARSET(vn 缺声调)', v7.reason);
  const v8 = validateValue('foo', 'vn', 'abc');
  t('C8-exempt', 'validate', v8.ok === true, 'ok(源无 CJK ⇒ 豁免)', `${v8.ok}/${v8.reason}`);
  const v9 = validateValue('店', 'vn', 'Cua');
  t('C9-exempt', 'validate', v9.ok === true, 'ok(单字源 ⇒ 豁免)', `${v9.ok}/${v9.reason}/${v9.detail}`);
  const v10 = validateValue('店铺', 'vn', 'Cua');
  t('C10-neg', 'validate', v10.reason === 'CHARSET', 'CHARSET(2 字源不豁免)', v10.reason);
  const v11 = validateValue(SRC, 'vn', 'Tuyển dụng');
  t('C11-pos', 'validate', v11.ok === true, 'ok(vn 带声调)', `${v11.ok}/${v11.reason}`);
  const v12 = validateValue(SRC, 'en', 'Hiring');
  t('C12-pos', 'validate', v12.ok === true, 'ok(en 纯 ASCII)', `${v12.ok}/${v12.reason}`);
  const v13 = validateFieldSet({ title: SRC }, 'en', '```json\n' + OK_RESP + '\n```');
  t('C13-fence', 'validate', v13.ok === true, 'ok(围栏被剥离)', `${v13.ok}/${v13.errors.title}`);
  t('C14', 'validate', parseTranslationPayload('').reason === 'JSON_PARSE', 'JSON_PARSE', parseTranslationPayload('').reason);
  t('C15', 'validate', hasCJK(SRC) && !hasCJK('abc') && asciiRatio('招聘') === 1 && hasVietnameseDiacritics('Tuyển'), '工具函数读数', `${hasCJK(SRC)}/${hasCJK('abc')}/${asciiRatio('招聘')}/${hasVietnameseDiacritics('Tuyển')}`);

  // ===== D 缓存 =====
  {
    const s = new MemStore();
    s.seedCache(SRC, 'en', 'Hiring staff');
    s.seedCache(SRC, 'vn', 'Tuyển dụng');
    const f = new SeqFetch([envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn });
    t('D1', 'cache', f.calls === 0, 'fetch.calls=0(全命中不付费)', f.calls);
    t('D2', 'cache', s.cacheHits === 2, 'cacheHits=2', s.cacheHits);
    t('D3', 'cache', r.texts.title.en === 'Hiring staff' && r.texts.title.vn === 'Tuyển dụng', '缓存译文回填', JSON.stringify(r.texts.title));
    t('D4', 'cache', r.statuses.title.en === 'ready' && r.statuses.title.vn === 'ready', 'status ready', JSON.stringify(r.statuses.title));
  }
  {
    const s = new MemStore();
    s.seedCache(SRC, 'en', 'Hiring staff');
    const f = new SeqFetch([envelope(JSON.stringify({ title: { vn: 'Tuyển dụng' } }))]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn });
    t('D5', 'cache', f.calls === 1, 'fetch.calls=1(仅缺 vn)', f.calls);
    const sent = JSON.parse(f.lastBody) as { messages: Array<{ role: string; content: string }> };
    const userObj = JSON.parse(sent.messages[1].content) as {
      fields: Record<string, string>; targets: Record<string, string[]>;
    };
    t('D6', 'cache',
      JSON.stringify(userObj.targets.title) === JSON.stringify(['vn'])
      && Object.keys(userObj.fields).join(',') === 'title',
      '请求体只含 vn / 只含 title', JSON.stringify(userObj.targets));
    t('D7', 'cache', r.texts.title.vn === 'Tuyển dụng' && r.texts.title.en === 'Hiring staff', '混合来源合流', JSON.stringify(r.texts.title));
    t('D8', 'cache', s.cache.has(`${sha256Hex(SRC)}|zh|vn`), '新译文写回缓存', s.cache.has(`${sha256Hex(SRC)}|zh|vn`));
  }

  // ===== E 日限额 =====
  {
    const s = new MemStore(500);
    const f = new SeqFetch([envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg({ daily_item_cap: 500 }), fetchImpl: f.fn });
    t('E1', 'cap', r.deferred === true && /DAILY_CAP_REACHED/.test(r.deferred_reason || ''), 'DAILY_CAP_REACHED', r.deferred_reason);
    t('E2', 'cap', f.calls === 0, 'fetch.calls=0(超限不调用)', f.calls);
    t('E3', 'cap', r.statuses.title.en === 'deferred' && r.statuses.title.vn === 'deferred', 'status=deferred', JSON.stringify(r.statuses.title));
    t('E4', 'cap', s.rows.get('job|1|title|en')!.attempts === 0, 'attempts 不烧(0)', s.rows.get('job|1|title|en')!.attempts);
  }
  {
    // 边界：used(0) + projected(3) = 3 = cap ⇒ 不超限 ⇒ 放行
    //   （TR-1b：projected = fields.length(1) × TARGET_LANGS.length(3) = 3；hk 亦占额度）
    const s = new MemStore(0);
    const f = new SeqFetch([envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg({ daily_item_cap: 3 }), fetchImpl: f.fn });
    t('E5', 'cap', r.deferred === false && f.calls === 1, '边界放行(deferred=false, calls=1)', `${r.deferred}/${f.calls}`);
  }

  // ===== F 单条字符上限 =====
  {
    const s = new MemStore();
    const f = new SeqFetch([envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg({ max_chars_per_item: 4 }), fetchImpl: f.fn });
    t('F1', 'cap', r.deferred === true && /ITEM_TOO_LONG/.test(r.deferred_reason || ''), 'ITEM_TOO_LONG', r.deferred_reason);
    t('F2', 'cap', f.calls === 0, 'fetch.calls=0', f.calls);
  }

  // ===== G stub 端到端 =====
  {
    const s = new MemStore();
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, engine: 'stub', config: mkCfg({ engine: 'stub' }), onWarn: () => undefined });
    t('G1', 'stub', r.texts.title.en === '[en] ' + SRC, `[en] ${SRC}`, r.texts.title.en);
    t('G2', 'stub', r.statuses.title.vn === 'ready' && r.texts.title.vn === '[vn] ' + SRC, 'vn ready', `${r.statuses.title.vn}/${r.texts.title.vn}`);
    t('G3', 'stub', s.cache.size === 3, '缓存写入 3 条(en/vn/hk)', s.cache.size);
    const g3hk = s.cache.get(`${sha256Hex(SRC)}|zh|hk`);
    t('G3-hk', 'stub', !!g3hk && g3hk.engine === 'opencc' && g3hk.text_out === toTraditional(SRC), "stub 路径 hk 缓存行 engine='opencc'/繁体", g3hk ? `${g3hk.engine}/${g3hk.text_out}` : 'MISSING');
    const row = s.rows.get('job|1|title|en')!;
    t('G4', 'stub', row.status === 'ready' && row.text === '[en] ' + SRC && row.attempts === 0, 'content_translation 行 = ready/有正文/attempts 0', JSON.stringify(row));
    t('G5', 'stub', stubTranslate(SRC, 'en') === '[en] ' + SRC, 'stub 确定性', stubTranslate(SRC, 'en'));
    // stub 输出本身过不了真校验 ⇒ 证明三重校验是真闸，stub 是**刻意豁免**
    const gv = validateValue(SRC, 'en', '[en] ' + SRC);
    t('G6', 'stub', gv.ok === false && gv.reason === 'CHARSET', 'stub 输出判负(证明校验非恒真)', `${gv.ok}/${gv.reason}`);
    const r2 = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, engine: 'stub', config: mkCfg({ engine: 'stub' }), onWarn: () => undefined });
    t('G7', 'stub', s.cache.size === 3 && r2.texts.title.en === '[en] ' + SRC, '二次运行幂等(缓存不变, 仍 3 条)', s.cache.size);
  }

  // ===== H deepseek 路径 =====
  {
    const s = new MemStore();
    const f = new SeqFetch([envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn });
    t('H1', 'deepseek', f.calls === 1 && r.statuses.title.en === 'ready' && r.statuses.title.vn === 'ready', 'ready/ready, calls=1', `${f.calls}/${r.statuses.title.en}/${r.statuses.title.vn}`);
    t('H2', 'deepseek', (f.lastBody.includes('json_object')) && (f.lastBody.includes('"temperature":0.2')), 'response_format=json_object + 低温度', f.lastBody.slice(0, 300));
    t('H3', 'deepseek', s.cache.size === 3, '缓存写入 3 条(en/vn/hk)', s.cache.size);
    const h3hk = s.cache.get(`${sha256Hex(SRC)}|zh|hk`);
    t('H3-hk', 'deepseek', !!h3hk && h3hk.engine === 'opencc' && h3hk.text_out === toTraditional(SRC), "hk 缓存行 engine='opencc'/繁体", h3hk ? `${h3hk.engine}/${h3hk.text_out}` : 'MISSING');
  }
  {
    // 键缺 ⇒ 不写脏数据
    const s = new MemStore();
    const f = new SeqFetch([envelope(JSON.stringify({ something_else: { en: 'x', vn: 'y' } }))]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn });
    t('H4', 'deepseek', r.statuses.title.en === 'failed' && r.errors.title.en === 'KEY_SET_MISMATCH', 'failed/KEY_SET_MISMATCH', `${r.statuses.title.en}/${r.errors.title.en}`);
    t('H5', 'deepseek', s.rows.get('job|1|title|en')!.text === null, '行正文为 NULL(不写脏数据)', String(s.rows.get('job|1|title|en')!.text));
    const h6hk = s.cache.get(`${sha256Hex(SRC)}|zh|hk`);
    t('H6', 'deepseek', s.cache.size === 1 && !!h6hk && h6hk.engine === 'opencc', '失败不写 LLM 缓存；hk 确定性转换仍写 1 条(opencc)', `${s.cache.size}/${h6hk ? h6hk.engine : 'MISSING'}`);
  }
  {
    // 模型不存在 ⇒ MODEL_NOT_AVAILABLE（且不阻塞、不抛穿）
    const s = new MemStore();
    const f = new SeqFetch([{ status: 400, body: JSON.stringify({ error: { message: 'Model deepseek-v4-flash not exist' } }) }]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn });
    t('H7', 'deepseek', r.errors.title.en === REASON.MODEL_NOT_AVAILABLE && r.errors.title.vn === REASON.MODEL_NOT_AVAILABLE, 'MODEL_NOT_AVAILABLE 两侧齐', `${r.errors.title.en}/${r.errors.title.vn}`);
    t('H8', 'deepseek', f.calls === 1, '400 不重试(calls=1)', f.calls);
  }
  {
    // 500 ⇒ 重试一次
    const s = new MemStore();
    const f = new SeqFetch([{ status: 503, body: 'upstream down' }, { status: 503, body: 'upstream down' }]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn });
    t('H9', 'deepseek', f.calls === 2, '5xx 重试一次(calls=2)', f.calls);
    t('H10', 'deepseek', r.errors.title.en === REASON.HTTP_ERROR, 'HTTP_ERROR', r.errors.title.en);
  }
  {
    // 429 → 200 ⇒ 重试成功
    const s = new MemStore();
    const f = new SeqFetch([{ status: 429, body: '{}' }, envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn });
    t('H11', 'deepseek', f.calls === 2 && r.statuses.title.en === 'ready', '429 后重试成功', `${f.calls}/${r.statuses.title.en}`);
  }
  {
    // 429 ×2 ⇒ 不写脏数据
    const s = new MemStore();
    const f = new SeqFetch([{ status: 429, body: '{}' }, { status: 429, body: '{}' }]);
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn });
    t('H12', 'deepseek', f.calls === 2 && r.errors.title.en === REASON.RATE_LIMITED, 'RATE_LIMITED', `${f.calls}/${r.errors.title.en}`);
    t('H13', 'deepseek', s.rows.get('job|1|title|vn')!.text === null, '行正文 NULL', String(s.rows.get('job|1|title|vn')!.text));
  }
  {
    // 显式注入 apiKey 路径（覆盖 env）
    const s = new MemStore();
    const f = new SeqFetch([envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, {
      entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn, apiKey: TEST_KEY,
    });
    t('H14', 'deepseek', f.calls === 1 && r.statuses.title.en === 'ready', 'apiKey 注入生效', `${f.calls}/${r.statuses.title.en}`);
  }
  {
    // 无 key ⇒ 不调用引擎、不写脏数据、机读 NO_API_KEY
    const s = new MemStore();
    const f = new SeqFetch([envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, {
      entityType: 'job', entityId: '1', store: s, config: mkCfg(), fetchImpl: f.fn, apiKey: '',
    });
    t('H15', 'deepseek', f.calls === 0 && r.errors.title.en === REASON.NO_API_KEY, 'NO_API_KEY + 不调用', `${f.calls}/${r.errors.title.en}`);
  }

  // ===== HK hk 维度正向断言（TR-1b：hk = OpenCC 确定性简繁转换，不走 LLM、不付费） =====
  {
    const s = new MemStore();
    const f = new SeqFetch([envelope(OK_RESP)]); // OK_RESP 仅含 en/vn 译文
    const r = await translateFields({ title: SRC }, { entityType: 'job', entityId: 'hk1', store: s, config: mkCfg(), fetchImpl: f.fn });
    const hkRow = s.rows.get('job|hk1|title|hk')!;
    t('HK1', 'hk', hkRow.status === 'ready' && hkRow.text === toTraditional(SRC), 'hk 行落库 ready 且为繁体', `${hkRow.status}/${hkRow.text}`);
    t('HK2', 'hk', hkRow.text === '招聘服務員', '繁体「招聘服務員」', String(hkRow.text));
    t('HK3', 'hk', r.statuses.title.hk === 'ready' && r.texts.title.hk === '招聘服務員', 'hk texts/status ready', `${r.statuses.title.hk}/${r.texts.title.hk}`);
    const hkCache = s.cache.get(`${sha256Hex(SRC)}|zh|hk`);
    t('HK4', 'hk', !!hkCache && hkCache.engine === 'opencc', "hk 缓存行 engine='opencc'", hkCache ? hkCache.engine : 'MISSING');
    // LLM 目标集不含 hk ⇒ 一次调用只服务 en/vn ⇒ hk 零 LLM 调用、零付费
    t('HK5', 'hk', f.calls === 1 && (TRANSLATE_TARGETS as ReadonlyArray<string>).indexOf('hk') === -1, 'hk 不产生 LLM 调用(calls=1; LLM 目标集无 hk)', `${f.calls}/[${(TRANSLATE_TARGETS as ReadonlyArray<string>).join(',')}]`);
  }

  // ===== I backfillPending =====
  {
    const s = new MemStore();
    s.seedRow({ entity_type: 'job', entity_id: '5', field: 'title', lang: 'en', text: null, status: 'pending', attempts: 0, last_error: null });
    s.seedRow({ entity_type: 'job', entity_id: '5', field: 'title', lang: 'vn', text: null, status: 'pending', attempts: 0, last_error: null });
    const f = new SeqFetch([envelope(OK_RESP)]);
    const resolver: SourceResolver = async () => SRC;
    const rep = await backfillPending(10, { store: s, resolveSource: resolver, config: mkCfg(), fetchImpl: f.fn });
    t('I1', 'backfill', rep.scanned === 2 && rep.ready === 2 && rep.failed === 0, 'scanned=2/ready=2/failed=0', JSON.stringify(rep));
    t('I2', 'backfill', s.rows.get('job|5|title|en')!.attempts === 1 && s.rows.get('job|5|title|en')!.status === 'ready', 'attempts→1 / ready', JSON.stringify(s.rows.get('job|5|title|en')));
    const rep2 = await backfillPending(10, { store: s, resolveSource: resolver, config: mkCfg(), fetchImpl: f.fn });
    t('I3', 'backfill', rep2.scanned === 0, '二次幂等(scanned=0)', JSON.stringify(rep2));
  }
  {
    const s = new MemStore();
    s.seedRow({ entity_type: 'job', entity_id: '6', field: 'title', lang: 'en', text: null, status: 'failed', attempts: MAX_ATTEMPTS, last_error: 'x' });
    const f = new SeqFetch([envelope(OK_RESP)]);
    const rep = await backfillPending(10, { store: s, resolveSource: async () => SRC, config: mkCfg(), fetchImpl: f.fn });
    t('I4', 'backfill', rep.scanned === 0 && f.calls === 0, '达上限不扫(calls=0)', `${rep.scanned}/${f.calls}`);
  }
  {
    const s = new MemStore();
    s.seedRow({ entity_type: 'job', entity_id: '7', field: 'title', lang: 'en', text: null, status: 'pending', attempts: 0, last_error: null });
    const f = new SeqFetch([envelope(OK_RESP)]);
    const rep = await backfillPending(10, { store: s, resolveSource: async () => null, config: mkCfg(), fetchImpl: f.fn });
    t('I5', 'backfill', rep.skipped === 1 && f.calls === 0 && s.rows.get('job|7|title|en')!.status === 'pending', '源解析失败⇒跳过且不动行', JSON.stringify(rep));
  }

  // ===== J 配置 =====
  {
    const c = getTranslateConfig({} as NodeJS.ProcessEnv);
    t('J1', 'config', c.engine === 'deepseek' && c.requested_engine === 'deepseek' && c.api_key_present === false, 'deepseek/无回落(不落 stub)', `${c.engine}/${c.requested_engine}/${c.api_key_present}`);
    t('J2', 'config', /NO_API_KEY/.test(c.fallback_reason || ''), 'fallback_reason 含 NO_API_KEY', c.fallback_reason);
    t('J3', 'config', c.base_url === 'https://api.deepseek.com' && c.model === 'deepseek-flash', '默认 base/model', `${c.base_url}/${c.model}`);
    t('J4', 'config', c.max_chars_per_item === 2000 && c.daily_item_cap === 500, '默认闸 2000/500', `${c.max_chars_per_item}/${c.daily_item_cap}`);
  }
  const SENTINEL = 'sk-SENTINEL-DO-NOT-LEAK-0123456789';
  {
    const c = getTranslateConfig({ DEEPSEEK_API_KEY: SENTINEL } as NodeJS.ProcessEnv);
    t('J5', 'config', c.engine === 'deepseek' && c.api_key_present === true && c.fallback_reason === null, 'deepseek/就位/无回落', `${c.engine}/${c.api_key_present}/${c.fallback_reason}`);
    t('J6', 'config', JSON.stringify(c).includes(SENTINEL) === false, 'config 对象不含 key 值', JSON.stringify(c).includes(SENTINEL));
  }
  {
    const c = getTranslateConfig({ DEEPSEEK_API_KEY: SENTINEL, TRANSLATE_ENGINE: 'stub', DEEPSEEK_BASE_URL: 'https://x.example/v1/', DEEPSEEK_MODEL: 'm-custom', TRANSLATE_MAX_CHARS_PER_ITEM: '7', TRANSLATE_DAILY_ITEM_CAP: '9' } as NodeJS.ProcessEnv);
    t('J7', 'config', c.engine === 'stub' && c.requested_engine === 'stub', '显式 stub 生效', `${c.engine}/${c.requested_engine}`);
    t('J8', 'config', c.base_url === 'https://x.example/v1' && c.model === 'm-custom' && c.max_chars_per_item === 7 && c.daily_item_cap === 9, '自定义生效+尾斜杠剥离', `${c.base_url}/${c.model}/${c.max_chars_per_item}/${c.daily_item_cap}`);
  }
  t('J9', 'config', !Object.prototype.hasOwnProperty.call(getTranslateConfig({ DEEPSEEK_API_KEY: SENTINEL } as NodeJS.ProcessEnv), 'api_key'), 'config 无 api_key 字段', Object.keys(getTranslateConfig({ DEEPSEEK_API_KEY: SENTINEL } as NodeJS.ProcessEnv)).join(','));

  // ===== J10-J14 引擎回落反转（P6-TR-1c-A：缺 key ⇒ 不翻译、不写脏数据）=====
  {
    const c = getTranslateConfig({ TRANSLATE_ENGINE: 'stub' } as NodeJS.ProcessEnv);
    t('J10', 'config', c.engine === 'stub' && c.requested_engine === 'stub' && c.api_key_present === false, 'stub 显式启用(无 key 亦可)', `${c.engine}/${c.requested_engine}/${c.api_key_present}`);
  }
  {
    // 缺 key（config.api_key_present=false，未显式 stub）⇒ 一律不翻译：不调用引擎、不写缓存、不写正文
    const s = new MemStore();
    const f = new SeqFetch([envelope(OK_RESP)]);
    const r = await translateFields({ title: SRC }, {
      entityType: 'job', entityId: 'nokey', store: s, fetchImpl: f.fn, onWarn: () => undefined,
      config: mkCfg({ api_key_present: false, fallback_reason: 'NO_API_KEY: test' }),
    });
    t('J11', 'noKey', f.calls === 0, '不调用引擎(calls=0)', f.calls);
    t('J12', 'noKey', s.cache.size === 0, '不写 translation_cache(0)', s.cache.size);
    const st = r.statuses.title as Record<string, string | undefined>;
    const er = r.errors.title as Record<string, string | undefined>;
    t('J13', 'noKey', ['en', 'vn', 'hk'].every((l) => st[l] === 'pending' && er[l] === REASON.NO_API_KEY), 'pending+NO_API_KEY ×3', `${JSON.stringify(st)}/${JSON.stringify(er)}`);
    t('J14', 'noKey', ['en', 'vn', 'hk'].every((l) => { const row = s.rows.get(`job|nokey|title|${l}`); return !!row && row.text === null; }), 'content_translation 正文 NULL ×3', JSON.stringify(Array.from(s.rows.values()).map((x) => `${x.lang}:${x.text}`)));
  }

  // ===== L 写路径 pending 登记（P6-TR-1c-A 前台：只登记不翻译）=====
  {
    const s = new MemStore();
    await registerPendingTranslations(
      { entityType: 'listing', entityId: 'L1', fields: { title: SRC, description: '描述文本' } },
      { store: s },
    );
    const pend = Array.from(s.rows.values()).filter((r) => r.status === 'pending');
    t('L1', 'pending', pend.length === 6 && s.cache.size === 0, '6 行 pending(2 字段×3 语言)/零缓存', `${pend.length}/${s.cache.size}`);
    t('L2', 'pending', pend.every((r) => r.text === null && r.attempts === 0), '正文 NULL / attempts 0', JSON.stringify(pend.map((r) => `${r.field}:${r.lang}=${r.status}/${r.attempts}`)));
  }
  {
    const s = new MemStore();
    s.seedRow({ entity_type: 'listing', entity_id: 'L2', field: 'title', lang: 'en', text: 'ready-text', status: 'ready', attempts: 1, last_error: null });
    await registerPendingTranslations({ entityType: 'listing', entityId: 'L2', fields: { title: SRC } }, { store: s });
    t('L3', 'pending', s.rows.get('listing|L2|title|en')!.status === 'ready', '缺省不降级(ready 保持)', s.rows.get('listing|L2|title|en')!.status);
    await registerPendingTranslations({ entityType: 'listing', entityId: 'L2', fields: { title: SRC } }, { store: s, reset: true });
    t('L4', 'pending', s.rows.get('listing|L2|title|en')!.status === 'pending' && s.rows.get('listing|L2|title|en')!.text === null, 'reset=true 覆盖回 pending/NULL', JSON.stringify(s.rows.get('listing|L2|title|en')));
  }

  // ===== K 泄漏自检（产物不得含任何 key 值 / Bearer 令牌） =====
  {
    const pre = JSON.stringify(checks, null, 1);
    t('K1', 'secure', pre.includes(TEST_KEY) === false && pre.includes(SENTINEL) === false, '产物不含任何 key 值', pre.includes(TEST_KEY) || pre.includes(SENTINEL));
    t('K2', 'secure', /Bearer\s+[A-Za-z0-9._-]{8,}/.test(pre) === false, '产物不含 Bearer 令牌', /Bearer\s+[A-Za-z0-9._-]{8,}/.test(pre));
  }

  // ---------------------------------------------------------------- 结论 --
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P6-TR-1a',
    generated_at: new Date().toISOString(),
    run: RUN,
    offline: true,
    db_connections: 0,
    api_calls: 0,
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
  };
  const text = JSON.stringify(report, null, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'offline-tests.json'), text + '\n', 'utf8');
  console.log(text);
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'offline-tests.json')}`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error('OFFLINE_TESTS_CRASHED', (e as Error)?.message);
  process.exit(2);
});

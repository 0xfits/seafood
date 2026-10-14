/**
 * 站内信通知预览 · 离线最小单测（无 DB / 无网络，纯断言）
 * ---------------------------------------------------------------------------
 * 跑法：cd backend-ts && npx ts-node --transpile-only scripts/test-msg-preview-offline.ts
 * 退出码：0 = 全过；非 0 = 有断言失败（assert 栈直接暴露失败点）。
 *
 * 预算口径（Kevin 裁定）：通知预览 = 正文**首 6 个显示宽单位**；汉字 / CJK 统一表意（含扩展 A）
 * 与全角标点计 2，emoji（含代理对与 ZWJ 整簇）计 2，其它（拉丁 / 数字 / 越南语 / 空白）计 1；
 * 超预算末尾加 `…`，正好用满 6 单位不加；空正文 / 不可用 ⇒ `''`（调用处不追加预览段）。
 *
 * 覆盖（≥6 条承重用例 + 不变量）：
 *   ① 纯汉字 3 字满额不省略   ② 4 汉字截 3 加省略号   ③ 6 拉丁不省略   ④ 7 拉丁截 6 加省略
 *   ⑤ 混合中英（满额 / 截断两向）  ⑥ emoji 不拆（代理对 + ZWJ 整簇，且无孤立代理半体）
 *   ⑦ 全角标点计 2 + 越南语计 1    ⑧ 边界：空 / 全空白 / 非串 / 首尾去空白 / 正文内换行
 *   ⑨ 不变量：语料逐条「输出(去省略号)单位数 ≤ 6」且「输出 ≤ 输入」
 *   ⑩ 通知正文逐字冻结（模板字面以规范册 §41.7 为准：无预览 = 原句零位移；有预览 = 预览紧随右括号
 *      并包中文引号「」、英文半段一字不改、预览不重复；另逐字回读规范册 §41.7 模板行自证同源）
 */
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { buildMessageNotificationText, buildMessagePreview, MSG_PREVIEW_MAX_WIDTH_UNITS } from '../src/messages-service';

let passed = 0;
const ok = (label: string): void => {
  passed += 1;
  console.log(`PASS ${label}`);
};

/** 测试侧独立的小尺子（按字素簇：宽簇 2 单位、其余簇 1），用于不变量复核（不复用被测实现）。 */
const unitsOf = (s: string): number => {
  const Seg = (Intl as unknown as {
    Segmenter?: new (locale: string, options: { granularity: string }) => { segment(input: string): Iterable<{ segment: string }> };
  }).Segmenter;
  const clusters = Seg ? [...new Seg('en', { granularity: 'grapheme' }).segment(s)].map((p) => p.segment) : Array.from(s);
  let units = 0;
  for (const cluster of clusters) {
    // 簇内**任**码点落在宽集 ⇒ 整簇 2 单位（与「整簇计 2」口径对齐；国旗/键帽簇亦如此）。
    let wide = false;
    for (const ch of cluster) {
      const cp = ch.codePointAt(0) as number;
      if (
        (cp >= 0x1100 && cp <= 0x115f) ||
        (cp >= 0x2e80 && cp <= 0x303f) ||
        (cp >= 0x3041 && cp <= 0x33ff) ||
        (cp >= 0x3400 && cp <= 0x4dbf) ||
        (cp >= 0x4e00 && cp <= 0x9fff) ||
        (cp >= 0xa000 && cp <= 0xa4cf) ||
        (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe10 && cp <= 0xfe4f) ||
        (cp >= 0xff01 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f000 && cp <= 0x1faff) ||
        (cp >= 0x2600 && cp <= 0x27bf) ||
        (cp >= 0x1f1e6 && cp <= 0x1f1ff)
      ) {
        wide = true;
        break;
      }
    }
    units += wide ? 2 : 1;
  }
  return units;
};

const ELLIPSIS = '…';
const stripTail = (s: string): string => (s.endsWith(ELLIPSIS) ? s.slice(0, -ELLIPSIS.length) : s);

assert.strictEqual(MSG_PREVIEW_MAX_WIDTH_UNITS, 6);

// ---------------------------------------------------------------- ① 纯汉字 3 字：6 单位满额 ⇒ 不加省略号
assert.strictEqual(buildMessagePreview('你好吗'), '你好吗');
assert.strictEqual(buildMessagePreview('你好吗').endsWith(ELLIPSIS), false);
ok('① 纯汉字 3 字（3×2 = 6 单位，正好用满）⇒ 原文、无省略号');

// ---------------------------------------------------------------- ② 4 汉字：超预算 ⇒ 截 3 加省略号
assert.strictEqual(buildMessagePreview('你好吗呀'), `你好吗${ELLIPSIS}`);
assert.strictEqual(buildMessagePreview('这里有一只大螃蟹'), `这里有${ELLIPSIS}`);
ok('② 汉字超预算（4 字与 8 字两例）⇒ 取首 3 字 + 省略号');

// ---------------------------------------------------------------- ③ 6 拉丁字符：满额 ⇒ 不加省略号
assert.strictEqual(buildMessagePreview('abcdef'), 'abcdef');
assert.strictEqual(buildMessagePreview('123456'), '123456');
ok('③ 6 个拉丁字母 / 数字（各 1 单位）⇒ 不加省略号');

// ---------------------------------------------------------------- ④ 7 拉丁字符：超预算 ⇒ 截 6 加省略号
assert.strictEqual(buildMessagePreview('abcdefg'), `abcdef${ELLIPSIS}`);
ok('④ 7 个拉丁字母 ⇒ 截 6 + 省略号');

// ---------------------------------------------------------------- ⑤ 混合中英：满额整段不加省略 / 满额仍有余量即截断
assert.strictEqual(buildMessagePreview('ok你好'), 'ok你好'); // 1+1+2+2 = 6 且正文到底 ⇒ 不加省略号
assert.strictEqual(buildMessagePreview('ab你好cd'), `ab你好${ELLIPSIS}`); // 用满 6 后仍有 'cd' ⇒ 加省略号
assert.strictEqual(buildMessagePreview('你好abc'), `你好ab${ELLIPSIS}`);
assert.strictEqual(buildMessagePreview('ok好的ok'), `ok好的${ELLIPSIS}`);
ok('⑤ 混合中英：正文正好 6 单位不省略 / 满额后仍有余量即截断加省略号');

// ---------------------------------------------------------------- ⑥ emoji：整簇不拆、计 2 单位、无孤立半体
assert.strictEqual(buildMessagePreview('😀😀😀'), '😀😀😀'); // 3 × 2 = 6 单位满额
assert.strictEqual(buildMessagePreview('😀😀😀😀'), `😀😀😀${ELLIPSIS}`);
assert.strictEqual(buildMessagePreview('👨‍👩‍👧‍👦x'), '👨‍👩‍👧‍👦x'); // ZWJ 家庭 emoji = 1 字素簇（2 单位）+ 'x'
for (const out of [buildMessagePreview('😀😀😀'), buildMessagePreview('😀😀😀😀'), buildMessagePreview('👨‍👩‍👧‍👦x'), buildMessagePreview('你好🐟🐟🐟🐟')]) {
  // 孤立代理半体（U+FFFD 替换符 / 未配对代理）必不出现 —— 「不拆代理对」的机械判据。
  assert.strictEqual(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out), false, `lone high surrogate in ${out}`);
  assert.strictEqual(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out), false, `lone low surrogate in ${out}`);
  assert.strictEqual(out.includes('\uFFFD'), false);
}
assert.strictEqual(buildMessagePreview('你好🐟🐟🐟🐟'), `你好🐟${ELLIPSIS}`); // 2+2+2 = 6 ⇒ 第 2 条鱼起截断
assert.strictEqual(buildMessagePreview('🇻🇳🇻🇳🇻🇳🇻🇳'), `🇻🇳🇻🇳🇻🇳${ELLIPSIS}`); // 国旗 = 区域指示符对（1 簇 2 单位）
ok('⑥ emoji 计 2 单位、整簇不拆（代理对 + ZWJ 族）、输出无孤立代理半体');

// ---------------------------------------------------------------- ⑦ 全角标点计 2 / 越南语计 1
assert.strictEqual(buildMessagePreview('！！！'), '！！！'); // 3 × 2 = 6
assert.strictEqual(buildMessagePreview('！！！！'), `！！！${ELLIPSIS}`);
assert.strictEqual(buildMessagePreview('tiếngviệt'), `tiếngv${ELLIPSIS}`); // 越南语（含 ế）逐字符计 1 ⇒ 截 6
assert.strictEqual(buildMessagePreview('tiếng'), 'tiếng');
ok('⑦ 全角标点（～/！）计 2；越南语含变音字母计 1');

// ---------------------------------------------------------------- ⑧ 边界：空 / 全空白 / 非串 / 去首尾空白 / 内部换行
for (const emptyish of ['', '   ', '\n\t ', '　', undefined, null, 0, 42, {}, [], true]) {
  assert.strictEqual(buildMessagePreview(emptyish), '', `unavailable body must yield empty preview: ${JSON.stringify(emptyish)}`);
}
assert.strictEqual(buildMessagePreview('　  '), '', '全角空格（U+3000）属空白 ⇒ 去空白后为空');
assert.strictEqual(buildMessagePreview('  你好  '), '你好', '先去掉首尾空白');
assert.strictEqual(buildMessagePreview('ab\ncdefg'), `ab\ncde${ELLIPSIS}`, '正文内换行保留、计 1 单位');
assert.strictEqual(buildMessagePreview('你好'), '你好', '正好 4 单位 ⇒ 不省略');
ok('⑧ 边界：空/全空白/非串 ⇒ 空预览；首尾去空白；内部换行计 1 且保留');

// ---------------------------------------------------------------- ⑨ 不变量（语料逐条复核）
const corpus = [
  '你好吗', '你好吗呀', 'abcdef', 'abcdefg', 'ab你好cd', '你好abc', 'ok好的ok',
  '😀😀😀', '😀😀😀😀', '👨‍👩‍👧‍👦x', '你好🐟🐟🐟🐟', '！！！', '！！！！', 'tiếngviệt',
  ' 55' + '00000000', 'Seafood 闲置物品 #42', 'a', '中', '🇻🇳🇻🇳🇻🇳🇻🇳', 'olá你好',
];
for (const input of corpus) {
  const out = buildMessagePreview(input);
  const head = stripTail(out);
  assert.ok(unitsOf(head) <= MSG_PREVIEW_MAX_WIDTH_UNITS, `preview overflow for ${input}: ${out}`);
  assert.ok(out.length <= input.trim().length + ELLIPSIS.length, `preview longer than input for ${input}`);
  if (input.trim() !== '') assert.ok(out !== '', `non-empty body must yield non-empty preview: ${input}`);
}
ok(`⑨ 不变量：${corpus.length} 条语料逐条「去省略号后 ≤ 6 单位」且「不超原文长度」`);

// ---------------------------------------------------------------- ⑩ 通知正文（逐字冻结）
const SITE = 'https://0xseafood.com';
const MASKED = 'Fresh crab for sale…';
const OLD_SENTENCE = `Seafood Club：你有新消息（来自会话：${MASKED}），打开 ${SITE}/messages 查看 / You have a new message, open ${SITE}/messages`;

// 无预览 ⇒ 回落**原句逐字**（旧行为零位移；不填占位）。
assert.strictEqual(
  buildMessageNotificationText({ siteName: 'Seafood Club', site: SITE, maskedTitle: MASKED }),
  OLD_SENTENCE,
);
assert.strictEqual(
  buildMessageNotificationText({ siteName: 'Seafood Club', site: SITE, maskedTitle: MASKED, preview: '' }),
  OLD_SENTENCE,
);

// ⑩-a 规范册同源自证：直读 docs/route-layer.spec.md §41.7 的「模板 = …」行，逐字比对模板字面
// （锚点取自现册原文、不转述；册面该行一字改动 ⇒ 本锚当场红）。
const specPath = path.resolve(__dirname, '../../docs/route-layer.spec.md');
const specLine = fs.readFileSync(specPath, 'utf8').split('\n').find((line) => line.includes('你有新消息')) ?? '';
assert.notStrictEqual(specLine, '', `§41.7 模板行必须在册：${specPath}`);
assert.strictEqual(
  specLine.includes('模板 = 「<站点名>：你有新消息（来自会话：<商品标题掩码>）「<消息开头预览>」，打开 <站点域名>/messages 查看 / You have a new message, open <site>/messages」'),
  true,
  '§41.7 模板字面（逐字）：预览紧随右括号、包中文引号「」',
);

// 有预览 ⇒ 规范册 §41.7 模板字面（逐字）：预览在「来自会话：{掩码标题}」右括号之后、包中文引号「」内，
// 其后接「，打开 {site}/messages 查看」；英文半段一字不改。
const withPreview = buildMessageNotificationText({ siteName: 'Seafood Club', site: SITE, maskedTitle: MASKED, preview: '你好吗' });
assert.strictEqual(
  withPreview,
  `Seafood Club：你有新消息（来自会话：${MASKED}）「你好吗」，打开 ${SITE}/messages 查看 / You have a new message, open ${SITE}/messages`,
);
assert.strictEqual(
  withPreview.includes(`（来自会话：${MASKED}）「你好吗」，打开 `),
  true,
  '§41.7：预览紧随右括号、包中文引号「」、其后即「，打开 …」',
);
assert.strictEqual(
  withPreview.includes(`来自会话：${MASKED}：`),
  false,
  '§41.7：右括号后不再以「：」引出预览（作废形态，不得回潮）',
);
assert.strictEqual(withPreview.endsWith(`，打开 ${SITE}/messages 查看 / You have a new message, open ${SITE}/messages`), true);
assert.strictEqual(withPreview.split('你好吗').length - 1, 1, 'preview must appear exactly once (English half carries no preview)');
assert.strictEqual(withPreview.includes('new message, open'), true);
ok('⑩ 通知正文逐字：无预览 = 原句零位移；有预览 = §41.7 模板字面（）「」，英文半段一字不改（预览不重复）');

console.log(`msg preview offline tests: ALL PASS (${passed} groups)`);
process.exit(0);

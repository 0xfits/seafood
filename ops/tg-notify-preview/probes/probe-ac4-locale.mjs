/**
 * AC-4-a 四语 telegram.desc 文案核对（只读 JSON 源文件 + 只读 docs 注册表）
 * 跑法：node /Users/kevin/bistro/seafood/ops/tg-notify-preview/probes/probe-ac4-locale.mjs
 * 口径：现行 = 「带消息开头摘要/预览」；旧串「不包含消息内容」（四语各形）必须为 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = '/Users/kevin/bistro/seafood';
const LOC = `${REPO}/frontend/src/locales`;
const OUT = `${REPO}/ops/tg-notify-preview/readings/ac4-frontend.json`;
const LOCALES = ['zh', 'hk', 'en', 'vn'];
const NEW_TOKEN = {
  zh: '含消息开头摘要',
  hk: '含訊息開頭摘要',
  en: 'includes a preview of the message opening',
  vn: 'kèm trích đoạn đầu tin nhắn',
};
const OLD_TOKEN = {
  zh: '不包含消息内容',
  hk: '不包含消息內容',
  en: 'content not included',
  vn: 'không kèm nội dung',
};

const findTelegramDesc = (obj, out = []) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') findTelegramDesc(v, out);
    else if (k === 'desc' && typeof v === 'string' && /telegram/i.test(String(Object.keys(obj).length ? '' : ''))) out.push(v);
  }
  return out;
};
// 直读 telegram 节点下的 desc（结构稳定：locales/<lang>.json → telegram.desc）
const pick = (obj) => {
  const node = obj.telegram ?? obj.profile?.settings?.telegram ?? null;
  return node && typeof node.desc === 'string' ? node.desc : null;
};

const head = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const checks = [];
const chk = (id, pass, detail) => checks.push({ id, pass, detail });
const perLocale = {};

for (const lang of LOCALES) {
  const p = path.join(LOC, `${lang}.json`);
  const raw = fs.readFileSync(p, 'utf8');
  let json = null;
  try { json = JSON.parse(raw); } catch (e) { chk(`${lang} JSON 可解析`, false, String(e).slice(0, 120)); continue; }
  const desc = pick(json);
  const allOld = [...raw.matchAll(new RegExp(OLD_TOKEN[lang], 'g'))].length;
  perLocale[lang] = {
    file: `frontend/src/locales/${lang}.json`,
    desc,
    new_token: NEW_TOKEN[lang],
    desc_has_new_token: desc ? desc.includes(NEW_TOKEN[lang]) : false,
    old_token: OLD_TOKEN[lang],
    old_token_count_in_file: allOld,
    whole_file_has_old_fragment: raw.includes(OLD_TOKEN[lang]),
  };
  chk(`${lang}：telegram.desc 存在且 JSON 可解析`, desc !== null && json !== null, { desc });
  chk(`${lang}：telegram.desc 含新串「${NEW_TOKEN[lang]}」`, perLocale[lang].desc_has_new_token, desc);
  chk(`${lang}：旧串「${OLD_TOKEN[lang]}」全文件计数 = 0`, allOld === 0, allOld);
}

// 全仓四语文件 grep 交叉（独立于上面的 JSON 解析）
const grepOld = execFileSync('bash', ['-lc',
  `cd ${REPO} && for f in frontend/src/locales/{zh,hk,en,vn}.json; do printf '%s=' "$f"; grep -c -e '不包含消息内容' -e '不包含消息內容' -e 'content not included' -e 'không kèm nội dung' "$f" || true; done`],
  { encoding: 'utf8' });
chk('全仓 grep 四语旧串总计数 = 0', !/[1-9]/.test(grepOld), grepOld.trim().split('\n'));

const result = {
  ac: 'AC-4-a', at: new Date().toISOString(), head_under_test: head,
  locales: perLocale, grep_old: grepOld.trim(), checks,
  verdict: checks.every((c) => c.pass) ? 'PASS' : 'FAIL',
  browser: null,
};
fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ verdict: result.verdict, failed: checks.filter((c) => !c.pass), descs: Object.fromEntries(LOCALES.map((l) => [l, perLocale[l]?.desc])), grep: grepOld.trim() }, null, 2));

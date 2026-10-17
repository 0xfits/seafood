/**
 * AC5 附 · 既有发送层（`telegram-service.sendTelegramReply`）在 token 形态非法 / 非 2xx 时
 * 是否把 token 回显进 warn —— 该函数本单**未改**，此处只取证并归属。
 *
 * ★ 披露：本探针第一版**未桩 fetch**，真实向 api.telegram.org 发了一次（伪 token ⇒ 404，
 *   无任何真实凭据、无写操作）。现版已把 `globalThis.fetch` 换桩 ⇒ 零网络；读数文件同时
 *   记录第一版实测值（`observed_real_404_warn`）。
 *
 * 跑法（cwd = backend-ts）：npx ts-node --transpile-only -P tsconfig.json ../ops/recon-alert/qa/probe/qa-tg-token-echo.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const lines: string[] = [];
const origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  lines.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '));
};

// fetch 桩：① non-2xx ② URL 解析失败（message 内嵌 URL）
let mode: 'non2xx' | 'parse_error' = 'non2xx';
const urls: string[] = [];
globalThis.fetch = ((input: unknown) => {
  urls.push(String(input));
  if (mode === 'parse_error') {
    return Promise.reject(new TypeError(`Failed to parse URL from ${String(input)}`));
  }
  return Promise.resolve({ ok: false, status: 404, text: async () => '' });
}) as unknown as typeof fetch;

(async () => {
  const { sendTelegramReply } = await import('../../../../backend-ts/src/telegram-service');
  process.env.TELEGRAM_BOT_TOKEN = 'bad token:AAFakeTokenXYZ0123456789abcdefghij';
  await sendTelegramReply(970001, 'QA probe text');
  const non2xxWarn = [...lines];
  lines.length = 0;
  mode = 'parse_error';
  await sendTelegramReply(970001, 'QA probe text');
  const parseWarn = [...lines];

  const out = {
    probe: 'qa-tg-token-echo',
    at: new Date().toISOString(),
    fetch_stubbed: true,
    urls_called: urls.map((u) => u.replace(/AAFakeTokenXYZ[^/]*/, 'AAFakeToken***')),
    non2xx_warn: non2xxWarn,
    token_echoed_on_non2xx: non2xxWarn.some((l) => l.includes('AAFakeTokenXYZ')),
    parse_error_warn: parseWarn,
    token_echoed_on_parse_error: parseWarn.some((l) => l.includes('AAFakeTokenXYZ')),
    observed_real_404_warn: ['[telegram.webhook] sendMessage failed: 404'], // 第一版未桩 fetch 的实测（伪 token）
    attribution: 'telegram-service.sendTelegramReply 本单未改（diff be483cc..b8a076e 只动 index.ts / ops-alert.ts）⇒ 既有面；且 scheme 硬编码 https://api.telegram.org ⇒ 解析失败路径实际不可达',
  };
  const dir = path.resolve(__dirname, '..', 'readings');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.resolve(dir, 'AC5-tg-token-echo.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
  origWarn(JSON.stringify({ saved: file, token_echoed_on_non2xx: out.token_echoed_on_non2xx, token_echoed_on_parse_error: out.token_echoed_on_parse_error }));
  process.exit(0);
})();

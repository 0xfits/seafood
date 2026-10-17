/**
 * Neng 独立质检 · AC7 已知限制核实（只登记、不判负、不建议本单改码）
 * --------------------------------------------------------------------------------
 * 事实面（全部只读）：
 *   ① `ops-alert.ts` 判据 `chatId <= 0 ⇒ 无效` ⇒ Telegram **群组** chat_id（`-100…`）被拒；
 *   ② 现收件人写入路径唯一真源 = webhook `message.from.id`（1:1 用户 ID）⇒ 结构性为正；
 *   ③ `migrations/0046` 无符号 CHECK（库里可以出现负数，但绑定路径不会写负数）；
 *   ④ 对比：既有 `messages-service` 推送口不做符号校验（两条路径口径不同 —— 仅登记）；
 *   ⑤ 行为面：负数 chat_id 被静默拒发（探针 M14 臂）。
 * 另附 dev 只读取证（`qa-ac7-dev-read.ts` 产物）。
 *
 * 跑法：node ops/recon-alert/qa/probe/qa-ac7-known-limit.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(QA_ROOT, '../../..');
const BACKEND = path.join(REPO, 'backend-ts');

const alerts = fs.readFileSync(path.join(BACKEND, 'src/ops-alert.ts'), 'utf8');
const indexSrc = fs.readFileSync(path.join(BACKEND, 'src/index.ts'), 'utf8');
const telegram = fs.readFileSync(path.join(BACKEND, 'src/telegram-service.ts'), 'utf8');
const messages = fs.readFileSync(path.join(BACKEND, 'src/messages-service.ts'), 'utf8');
const mig = fs.readFileSync(path.join(BACKEND, 'migrations/0046_telegram_binding.sql'), 'utf8');

const assertions = [];
const t = (id, pass, detail) => assertions.push({ id, pass: Boolean(pass), detail });

// ① 守卫形态
t('AC7-1_guard_is_le_zero', /chatId\s*<=\s*0/.test(alerts) && /not a valid numeric chat id/.test(alerts),
  'ops-alert.ts 判据为 chatId <= 0 ⇒ 拒绝（负数群组 id 一并被拒）');
t('AC7-2_contrast_zero_only_absent', !/chatId\s*===\s*0/.test(alerts),
  'ops-alert.ts 内无 chatId === 0 的宽松形态');

// ② 现收件人写入路径
const webhookFromId = /const chatId = from \? Number\(from\.id\) : NaN;/.test(indexSrc);
const bindUpdate = /UPDATE public\.users SET tg_user_id = \$2, tg_linked_at = now\(\)/.test(telegram);
t('AC7-3_tg_user_id_from_message_from_id', webhookFromId && bindUpdate,
  'webhook: chatId = Number(from.id) ⇒ consumeBindCode ⇒ UPDATE users SET tg_user_id（Telegram 用户 ID，结构性为正）');
t('AC7-4_webhook_guard_allows_negative', /Number\.isFinite\(chatId\) \|\| chatId === 0/.test(indexSrc),
  'webhook 侧只拒 chatId === 0；但 from.id 是发送者用户 ID，1:1 绑定路径实际取不到负数');

// ③ schema 无符号 CHECK
t('AC7-5_migration_no_sign_check', !/CHECK\s*\(\s*tg_user_id/i.test(mig),
  '0046 仅 bigint + 部分唯一索引，无符号约束（库里可出现负数，但绑定路径不写负数）');

// ④ 既有推送口对比（仅登记，不判负）
t('AC7-6_existing_push_has_no_sign_guard', /chat_id: rows\[0\]\.tg_user_id/.test(messages) && !/tg_user_id\s*<=\s*0/.test(messages),
  'messages-service 推送口直接透传 tg_user_id（无符号校验）⇒ 两条推送路径口径不同');

// ⑤ 行为面：负数 chat_id 被拒（读数来自 baseline 探针 M14 臂）
const baseFile = path.join(QA_ROOT, 'readings', 'qa-behavior-baseline.json');
let m14 = null;
if (fs.existsSync(baseFile)) {
  const d = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  m14 = (d.arms ?? []).find((a) => a.id === 'M14_tg_negative_group') ?? null;
}
t('AC7-7_negative_chat_id_silently_rejected', Boolean(m14) && m14.tg_calls === 0 && m14.status === 200 && m14.ok === false,
  m14 ? `tg=${m14.tg_calls} status=${m14.status} ok=${m14.ok}（不发、不改回执）` : 'M14 arm missing');

// ⑥ dev 只读取证（产物由 qa-ac7-dev-read.ts 落盘）
const devFile = path.join(QA_ROOT, 'readings', 'AC7-dev-read.json');
const dev = fs.existsSync(devFile) ? JSON.parse(fs.readFileSync(devFile, 'utf8')) : { ok: false, note: 'not run' };
const devBound = Number(dev?.sign?.bound ?? 0);
const devHasData = Boolean(dev.ok) && devBound > 0;

const out = {
  probe: 'qa-ac7-known-limit',
  at: new Date().toISOString(),
  conclusion: {
    limitation: 'notifyOps 判据 chatId <= 0 ⇒ 拒绝；Telegram 群组 chat_id 为负（-100…）⇒「发到群」被堵',
    current_scope_affected: false,
    why: '收件人口径 = OPS_ALERT_UID 指向的站内用户，tg_user_id 唯一写入源 = webhook message.from.id（Telegram 用户 ID，结构性为正）⇒ 现口径不会触发该判据',
    register_for_future: '若将来要发群（chat_id = -100…），判据需改为 chatId !== 0（群组 id 为负是合法值）；本单不建议改码',
    severity: 'known-limitation（不影响现口径）',
  },
  dev_readonly_probe: dev,
  env_limited: devHasData
    ? ['prod users.tg_user_id 实际取值属 Zang 环境，Neng 未读']
    : ['dev 无任何绑定行（bound=0）⇒ 无实数据可证符号；生产 users.tg_user_id 属 Zang 环境，Neng 未读 ⇒ 结论仅由绑定写入路径（from.id）推定'],
  assertions,
  failed: assertions.filter((a) => !a.pass).map((a) => a.id),
  all_pass: assertions.every((a) => a.pass),
};
const file = path.join(QA_ROOT, 'readings', 'AC7-known-limit.json');
fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
console.log(JSON.stringify({ saved: file, all_pass: out.all_pass, failed: out.failed, dev_bound: devBound }));
process.exit(0);

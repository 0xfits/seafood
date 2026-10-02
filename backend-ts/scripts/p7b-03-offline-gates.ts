/**
 * p7b-03 · 离线判据（**零 DB / 零网络**）：AC-13 actor 分流 + AC-14 分类器 + AC-12/AC-10 静态
 * ---------------------------------------------------------------------------
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts
 * 读数：`.p7b-artifacts/p7b-03-*`（run-tagged）
 *
 * ★ 本脚本**不连库**（只 import 纯函数 + 读文件文本）⇒ 与「离线 126/126 套件」同族，
 *   是本单对 AC-13（可离线复算的六正向 + 两判负）与 AC-14 分类器面的执行面。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, save, REPO_BACKEND, REPO_ROOT } from './p7b-lib';
import { resolveRefundActorRoute, REFUND_ACTOR_SCOPE, REFUND_ROLLS_BACK_STOCK } from '../src/listing-funds-service';
import type { RefundActorInput } from '../src/listing-funds-service';
import { normalizeLedgerError, LEDGER_ERROR_CODES } from '../src/ledger-errors';

const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const SQL_0024 = fs.readFileSync(path.resolve(REPO_BACKEND, 'migrations/0024_admin_refund_audit.sql'), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const LF_SERVICE = readSrc('backend-ts/src/listing-funds-service.ts');

/** 取出 0024 里编排函数的**函数体**（`AS $$ … $$;`） */
const fnBodyOf = (sql: string): string => {
  const head = sql.indexOf('CREATE OR REPLACE FUNCTION public.listing_refund_post_event(payload jsonb) RETURNS jsonb');
  if (head < 0) return '';
  const start = sql.indexOf('$$', head) + 2;
  const end = sql.indexOf('$$;', start);
  return sql.slice(start, end);
};
const FN_BODY = fnBodyOf(SQL_0024);

const base: RefundActorInput = { actorUid: 500, sellerUid: 7, buyerUid: 8, canAccessAdmin: false, isAdmin: false, permissions: [] };

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'scripts/p7b-03-offline-gates.ts', fn_body_bytes: FN_BODY.length };

  // ======================================================================== AC-13 六正向
  const cases: Array<{ id: string; what: string; input: RefundActorInput; expect: 'seller' | 'admin' | string }> = [
    { id: 'AC13-1', what: '① 卖方（非 admin）⇒ 卖方路（**不经** admin 闸）', input: { ...base, actorUid: 7 }, expect: 'seller' },
    { id: 'AC13-2', what: '② 管理员（非卖方、非买方，is_admin=true）⇒ 管理员路', input: { ...base, actorUid: 900001, canAccessAdmin: true, isAdmin: true, permissions: [] }, expect: 'admin' },
    { id: 'AC13-2b', what: '②′ 管理员（非卖方非买方，经**角色行**持 manage_points，is_admin=false）⇒ 管理员路', input: { ...base, actorUid: 900002, canAccessAdmin: true, isAdmin: false, permissions: ['manage_points'] }, expect: 'admin' },
    { id: 'AC13-3', what: '③ 管理员**兼买方** ⇒ 403 ACTOR_NOT_ALLOWED', input: { ...base, actorUid: 8, canAccessAdmin: true, isAdmin: true, permissions: ['manage_points'] }, expect: 'ACTOR_NOT_ALLOWED' },
    { id: 'AC13-4', what: '④ 非卖方非 admin（第三方）⇒ 403 ACTOR_NOT_ALLOWED', input: { ...base, actorUid: 900003 }, expect: 'ACTOR_NOT_ALLOWED' },
    { id: 'AC13-5', what: '⑤ admin 但**缺** manage_points ⇒ 403 PERMISSION_NOT_GRANTED', input: { ...base, actorUid: 900004, canAccessAdmin: true, isAdmin: false, permissions: ['review_tasks'] }, expect: 'PERMISSION_NOT_GRANTED' },
    { id: 'AC13-6', what: '⑥ 非 admin（can_access_admin=false）⇒ 403 NOT_ADMIN（构造上不可达分支，仅映射保留）', input: { ...base, actorUid: 900005, canAccessAdmin: false, isAdmin: false, permissions: ['manage_points'] }, expect: 'NOT_ADMIN' },
  ];
  const caseRead: Array<Record<string, unknown>> = [];
  for (const c of cases) {
    const d = resolveRefundActorRoute(c.input);
    const got = d.ok ? d.route : String(d.err.details.reason);
    const status = d.ok ? 200 : d.err.status;
    const code = d.ok ? null : d.err.code;
    const authDomain = d.ok ? null : (d.err as { authDomain?: boolean }).authDomain === true;
    caseRead.push({ id: c.id, got, status, code, authDomain, expect: c.expect, pass: got === c.expect });
    ck.t(c.id, c.what, got === c.expect, `got=${got} status=${status} code=${code}`);
    if (!d.ok) {
      ck.t(`${c.id}-shape`, `${c.id} 403 形状 = R107 AUTH_FORBIDDEN + auth 域 + reason 闭集`,
        d.err.status === 403 && d.err.code === 'AUTH_FORBIDDEN' && authDomain === true && ['ACTOR_NOT_ALLOWED', 'NOT_ADMIN', 'PERMISSION_NOT_GRANTED'].includes(String(d.err.details.reason)),
        JSON.stringify({ status: d.err.status, code: d.err.code, reason: d.err.details.reason, authDomain }));
    }
  }
  out.ac13_cases = caseRead;

  // ======================================================================== AC-13 判负（变异 ⇒ 必红）
  // 变异①：把卖方路也要求 admin 权限（= 未做 actor 分流，直接 requireAdmin('manage_points') 全覆盖）
  const flatAdminMutant = (i: RefundActorInput) =>
    i.canAccessAdmin && (i.isAdmin || i.permissions.includes('manage_points')) ? 'admin' : 'DENIED_NOT_ADMIN';
  const m1 = flatAdminMutant({ ...base, actorUid: 7 });
  ck.t('AC13-NEG-1', '★ 判负①：若卖方路也要求 admin 闸 ⇒ 卖方（非 admin）被拦 ⇒ 变体必红', m1 !== 'seller', `mutant got=${m1}`);
  // 变异②：删掉兼买方禁令 ⇒ 管理员兼买方放行 ⇒ 变体必红
  const noBuyerBanMutant = (i: RefundActorInput) =>
    i.actorUid === i.sellerUid ? 'seller' : (i.canAccessAdmin && (i.isAdmin || i.permissions.includes('manage_points')) ? 'admin' : 'DENIED');
  const m2 = noBuyerBanMutant({ ...base, actorUid: 8, canAccessAdmin: true, isAdmin: true, permissions: ['manage_points'] });
  ck.t('AC13-NEG-2', '★ 判负②：若删兼买方禁令 ⇒「管理员兼买方」被放行 ⇒ 变体必红', m2 === 'admin', `mutant got=${m2}`);
  // 变异③：把 reason 值域扩成第 4 个值 ⇒ 判负（§12.3 闭集 3 值）
  ck.t('AC13-NEG-3', '★ 判负③：源码 `AUTH_REASONS` 闭集仍恰 3 值（未新增第 4 个 reason）',
    /const AUTH_REASONS = \['ACTOR_NOT_ALLOWED', 'NOT_ADMIN', 'PERMISSION_NOT_GRANTED'\] as const;/.test(INDEX_TS),
    (INDEX_TS.match(/const AUTH_REASONS = \[[^\]]*\]/) ?? ['<none>'])[0]);
  // 变异④：把 reason 换成闭集外的值 ⇒ 本面的 reason 闭集判据必红（自证判据可证伪）
  const outOfSet = caseRead.map((c) => String(c.got)).filter((g) => g !== 'seller' && g !== 'admin');
  ck.t('AC13-NEG-4', '★ 判负④：本面所有 403 reason 均在闭集 {ACTOR_NOT_ALLOWED, NOT_ADMIN, PERMISSION_NOT_GRANTED} 内',
    outOfSet.every((r) => ['ACTOR_NOT_ALLOWED', 'NOT_ADMIN', 'PERMISSION_NOT_GRANTED'].includes(r)),
    `reasons=${JSON.stringify(outOfSet)}`);

  // ======================================================================== AC-14（离线：分类器）
  const cls = [
    ['53300', 'too_many_connections'],
    ['XX000', 'internal_error'],
    ['58030', 'io_error'],
  ] as const;
  const clsRead: Array<Record<string, unknown>> = [];
  for (const [code, _r] of cls) {
    const n = normalizeLedgerError({ code, message: `p7b probe ${code}` });
    clsRead.push({ injected: code, code: n.code, http: n.httpStatus });
    ck.t(`AC14-cls-${code}`, `注入 ${code} ⇒ 既有分类器归 503 LEDGER_TX_TIMEOUT（**绝不得** 409/rejected_state）`,
      n.httpStatus === 503 && n.code === 'LEDGER_TX_TIMEOUT', JSON.stringify({ code: n.code, http: n.httpStatus }));
  }
  out.ac14_classifier = clsRead;

  // ======================================================================== AC-12 / AC-14 静态（0024 函数体）
  const stat: Array<[string, string, boolean, string]> = [
    ['AC12-s1', 'position(purchase_refund) = 0（不得复制退款资金腿）', FN_BODY.indexOf('purchase_refund') === -1, `pos=${FN_BODY.indexOf('purchase_refund')}`],
    ['AC12-s2', 'position(public.listing_post_event() <> 0（必须复用资金路径）', FN_BODY.indexOf('public.listing_post_event(') !== -1, `pos=${FN_BODY.indexOf('public.listing_post_event(')}`],
    ['AC12-s3', 'position(admin_refund_audit_log) <> 0（同语句审计）', FN_BODY.indexOf('admin_refund_audit_log') !== -1, `pos=${FN_BODY.indexOf('admin_refund_audit_log')}`],
    ['AC14-s1', 'position(WHEN OTHERS) = 0（禁兜底子句）', FN_BODY.indexOf('WHEN OTHERS') === -1, `pos=${FN_BODY.indexOf('WHEN OTHERS')}`],
    ['AC14-s2', 'position(EXCEPTION) <> 0 且 position(LD011) <> 0（白名单捕获块）', FN_BODY.indexOf('EXCEPTION') !== -1 && FN_BODY.indexOf('LD011') !== -1, `exc=${FN_BODY.indexOf('EXCEPTION')} ld011=${FN_BODY.indexOf('LD011')}`],
    ['Z3-s1', 'position(RAISE) = 0（函数不得主动抛）', FN_BODY.indexOf('RAISE') === -1, `pos=${FN_BODY.indexOf('RAISE')}`],
    ['Z4b-s1', 'position(pg_advisory) = 0（不取 advisory lock）', FN_BODY.indexOf('pg_advisory') === -1, `pos=${FN_BODY.indexOf('pg_advisory')}`],
    ['H4-s1', "键格式串 biz:listing:refund: 在场", FN_BODY.indexOf('biz:listing:refund:') !== -1, `pos=${FN_BODY.indexOf('biz:listing:refund:')}`],
    ['Z3-s2', "可空 txid / 拒绝令牌 rejected_state 在场", FN_BODY.indexOf('rejected_state') !== -1 && /txid\s+bigint/.test(SQL_0024), 'ok'],
  ];
  for (const [id, what, pass, reading] of stat) ck.t(id, what, pass, reading);

  // ======================================================================== AC-10（闭集 / 形状 / 注册点）
  ck.t('AC10-1', '错误码闭集 33 不动', LEDGER_ERROR_CODES.length === 33, `codes=${LEDGER_ERROR_CODES.length}`);
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  ck.t('AC10-2', '注册点 = 68 不变（本单零新注册点）', regs === 68, `registration_points=${regs}`);
  ck.t('AC10-3', '退款路由仍**复用同路径**（无 `/api/admin/listing-orders`）', !/\/api\/admin\/listing-orders/.test(INDEX_TS) && /app\.post\('\/api\/listing-orders\/:orderId\/refund'/.test(INDEX_TS), 'ok');
  ck.t('AC10-4', '对外出口 = 既有 `sendSuccess` + `sendVerbError`（R107；无新增顶层响应键）',
    INDEX_TS.indexOf("sendSuccess(res, result.view, result.replay ? 'Listing order refunded") !== -1 &&
    /if \(!result\.ok\) return sendVerbError\(res, result\);\n    return sendSuccess\(res, result\.view, result\.replay \? 'Listing order refunded/.test(INDEX_TS), 'ok');
  const stripComments = (s: string) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const lfCode = stripComments(LF_SERVICE);
  const idxCode = stripComments(INDEX_TS);
  ck.t('AC10-5', '不许选：`REFUND_ACTOR_IS_SELLER_ONLY` 已**从代码面消失**（只在注释里留痕；单点常量不作并行真源）',
    !/REFUND_ACTOR_IS_SELLER_ONLY\s*=/.test(lfCode) && lfCode.indexOf('REFUND_ACTOR_IS_SELLER_ONLY') === -1 && idxCode.indexOf('REFUND_ACTOR_IS_SELLER_ONLY') === -1,
    `code_refs service=${lfCode.indexOf('REFUND_ACTOR_IS_SELLER_ONLY')} index=${idxCode.indexOf('REFUND_ACTOR_IS_SELLER_ONLY')} (comment_refs service=${LF_SERVICE.split('REFUND_ACTOR_IS_SELLER_ONLY').length - 1})`);
  ck.t('AC10-6', '准入真源唯一（`resolveRefundActorRoute` 是唯一 403 判定点）',
    (LF_SERVICE.match(/resolveRefundActorRoute/g) ?? []).length >= 2 && !/AUTH_FORBIDDEN/.test(INDEX_TS.slice(INDEX_TS.indexOf("app.post('/api/listing-orders/:orderId/refund'"), INDEX_TS.indexOf("app.post('/api/listing-orders/:orderId/refund'") + 1200)),
    'ok');
  ck.t('AC10-7', '初始化常量：REFUND_ACTOR_SCOPE / REFUND_ROLLS_BACK_STOCK 取值冻结',
    REFUND_ACTOR_SCOPE === 'seller_or_admin' && REFUND_ROLLS_BACK_STOCK === false, `${REFUND_ACTOR_SCOPE}/${REFUND_ROLLS_BACK_STOCK}`);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p7b-03-offline-gates', out);
  console.log(JSON.stringify({ saved: f, summary: out.summary, cases: out.ac13_cases, ac14: out.ac14_classifier }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});

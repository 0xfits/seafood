// p4z-b3afix2-01-gen-0020.ts — P4-B3a-FIX-A2：从 **live** pg_get_functiondef 原件派生 migrations/0020
// 用法：npx ts-node --transpile-only scripts/p4z-b3afix2-01-gen-0020.ts <artifactsRunDir>
// 纪律：唯一改动 = 从 hold 家族 IN 列表里删掉 `,'listing_deposit'`；其余字节必须逐字相同（脚本内断言）。
//       生成前用 live md5(prosrc) 自证「dollar-quote 内文本 == prosrc」这一假设（否则迁移内 md5 断言会是假检）。
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const runDir = path.resolve(process.argv[2] || '');
if (!runDir || !fs.existsSync(runDir)) throw new Error('BAD_RUN_DIR ' + process.argv[2]);

for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}
/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
const sql = neon(String(process.env.DATABASE_URL || ''));

const md5 = (s: string) => crypto.createHash('md5').update(s, 'utf8').digest('hex');
const OPEN = 'AS $function$';
const CLOSE = '$function$';

const main = async () => {
  const preDef = fs.readFileSync(path.join(runDir, 'pre-ledger_post_event.def.sql'), 'utf8');
  const openIdx = preDef.indexOf(OPEN);
  const closeIdx = preDef.lastIndexOf(CLOSE);
  if (openIdx < 0 || closeIdx <= openIdx) throw new Error('NO_DOLLAR_QUOTED_BODY');
  const preBody = preDef.slice(openIdx + OPEN.length, closeIdx);

  const OLD = "('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')";
  const NEW = "('hold','hold_release','job_escrow','job_escrow_refund')";
  const occ = preBody.split(OLD).length - 1;
  if (occ !== 1) throw new Error(`EXPECTED_EXACTLY_1_IN_LIST_OCCURRENCE got=${occ}`);
  if (preBody.split('listing_deposit').length - 1 !== 1) throw new Error('listing_deposit_occurrence_count != 1 (派单前提被证伪)');

  const postBody = preBody.replace(OLD, NEW);
  const postDef = preDef.slice(0, openIdx + OPEN.length) + postBody + preDef.slice(closeIdx);
  if (postDef.length !== preDef.length - 18) throw new Error(`LENGTH_DELTA_MISMATCH ${preDef.length} -> ${postDef.length} (expect -18 = len(",'listing_deposit'"))`);

  // --- 自证：dollar-quote 内文本 == prosrc（用 live 读数，只读） ---
  const live = (await sql(`SELECT md5(p.prosrc) AS prosrc_md5, length(p.prosrc)::int AS prosrc_len,
                                  md5(pg_get_functiondef(p.oid)) AS def_md5,
                                  position('listing_deposit' in p.prosrc) AS ld_pos
                             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                            WHERE p.proname = 'ledger_post_event' AND n.nspname = 'public'`)) as Array<Record<string, unknown>>;
  const selfCheck = {
    live_prosrc_md5: live[0].prosrc_md5,
    extracted_body_md5: md5(preBody),
    extracted_body_len: preBody.length,
    live_prosrc_len: live[0].prosrc_len,
    live_def_md5: live[0].def_md5,
    live_listing_deposit_pos_in_prosrc: live[0].ld_pos,
    body_md5_equal: live[0].prosrc_md5 === md5(preBody),
    body_len_equal: Number(live[0].prosrc_len) === preBody.length,
  };
  if (!selfCheck.body_md5_equal) throw new Error('ASSUMPTION_FAILED: dollar-quote body != prosrc（迁移内 md5 断言会假检，先修探针）');

  const postDefMd5 = md5(postDef);
  const postBodyMd5 = md5(postBody);

  // --- diff 落盘（仅用于报告取证） ---
  const preLines = preDef.split('\n');
  const postLines = postDef.split('\n');
  const diffLines: string[] = [];
  if (preLines.length !== postLines.length) throw new Error('LINE_COUNT_CHANGED');
  for (let i = 0; i < preLines.length; i++) {
    if (preLines[i] !== postLines[i]) {
      diffLines.push(`- ${preLines[i]}`, `+ ${postLines[i]}`);
    }
  }
  if (diffLines.length !== 2) throw new Error(`EXPECTED_1_CHANGED_LINE got=${diffLines.length / 2}`);

  const header = [
    '-- ============================================================================',
    '-- 0020_ledger_post_event_hold_family_drop_listing_deposit.sql',
    '--   · P4-B3a-FIX-A2：`ledger_post_event` 函数体内 hold 家族 IN 列表去 `listing_deposit`',
    '-- ============================================================================',
    '-- 【本单授权 · 裁定 #14 的**单次解禁】**',
    '--   裁定 #14 = 「禁触 `ledger_post_event` 函数体」。本单**仅**解禁一处：',
    '--   把函数体内 hold 家族 IN 列表里的 `\'listing_deposit\'` 删掉，**其余一字不动**。',
    '--   依据（已冻结、只兑现不推导）：',
    '--     · docs/ledger.spec.md §3.1 R31（v0.2，`:79`）：保证金 = **消耗不可退**',
    '--     · docs/ledger.spec.md v0.3 修订说明（`:12-13`/`:191`）：保证金**在上市时即消耗**',
    '--     · docs/data-layer.spec.md **DL67**（`:454`）【已冻结】：上市账务含 `listing_deposit`（消耗、入 `uid = −1`）',
    '--     · docs/data-layer.spec.md **DL88**（`:530`）【已冻结】：`listing_deposit` 上市即消耗',
    '--       （`balance → uid −1`）、不可退、无罚没、无退还 kind',
    '--',
    '-- 【为什么必须解禁（不改就是「永久不可达的静默欠款」）】',
    '--   `ledger_post_event` 内第二处 hold 家族列表（live `pg_get_functiondef` 第 520 行）要求',
    '--   「hold 家族 kind 每个 (uid,cid,kind) 组**恰好 2 条**」= **同账户**搬运；',
    '--   而 R31/DL67/DL88 要求保证金是**跨账户消耗**（用户 balance 减 → `uid = -1` balance 增）。',
    '--   两者互斥 ⇒ 任何合规的上市入账都会被 `LEDGER_AMOUNT_INVALID / reason=HOLD_PAIR_REQUIRED` 拒。',
    '--   0003（kind 关闭集 20）+ 0019（`-1` credit 白名单接纳 `listing_deposit`）都已落库，',
    '--   剩下的唯一阻塞就是函数体里的这张列表 ⇒ 本迁移是最后一块。',
    '--',
    '-- 【本迁移做什么】',
    '--   1) `CREATE OR REPLACE FUNCTION public.ledger_post_event(payload jsonb)` —— 函数体**逐字**复制',
    '--      live `pg_get_functiondef` 原件，**唯一**差异是从 hold 家族 IN 列表删除 `,\'listing_deposit\'`',
    '--      （原 `...\'job_escrow_refund\',\'listing_deposit\')` → `...\'job_escrow_refund\')`）。',
    '--      其余函数体字节、参数（`payload jsonb`）、返回类型（`jsonb`）、语言、幂等/错误映射/断言全部不动。',
    '--   2) 自检（静态 + 行为，缺一不算通过）：',
    '--      ① `prosrc` 里 `listing_deposit` 出现次数 = 0（改前 = 1）',
    '--      ② 列表其余 4 项与闭合括号逐字仍在：`(\'hold\',\'hold_release\',\'job_escrow\',\'job_escrow_refund\')`',
    '--      ③ 同账户 2 腿守卫本体仍在：`HOLD_PAIR_REQUIRED` + `HAVING count(*) <> 2`',
    '--      ④ `prosrc` md5 = 生成时对**逐字新函数体**算的 md5（字节级身份证明）',
    '--      ⑤ 签名/返回类型仍是 `<payload jsonb> -> jsonb`',
    '--      ⑥ kind 关闭集仍 20 个；`-1` credit 白名单（0019）：`listing_deposit` 放行 / `commission` 拒 / `-1` debit 拒；',
    '--         `-2` / `-3` 的 `listing_deposit` credit 仍拒（不得被顺带放宽）',
    '--',
    '-- 【本迁移不做什么】',
    '--   · 不新增/删除 kind（关闭集恒 20）；不改 `-1`/`-2`/`-3`/`0` 任何白名单格',
    '--   · 不改任何表结构、触发器、索引；**不写任何业务表**',
    '--   · **禁 `DELETE` / `TRUNCATE` / `DROP` 业务数据**（本文件不含这三个词对业务对象的任何使用）',
    '--   · 不改 `0001`–`0019` 任何文件（改它们 ⇒ checksum 漂移 ⇒ `scripts/migrate.ts` 整链 ABORT/exit 3）',
    '--',
    '-- 【生成口径（可复核）】',
    `--   函数体来源 = live \`pg_get_functiondef(\'public.ledger_post_event\'::regproc)\`（改前 md5 \`${md5(preDef)}\`，`
      + `${preDef.split('\n').length} 行 / ${preDef.length} 字节）。`,
    `--   改后函数体预期 md5（pg_get_functiondef）= \`${postDefMd5}\`；prosrc md5 = \`${postBodyMd5}\`。`,
    '--   生成器：`backend-ts/scripts/p4z-b3afix2-01-gen-0020.ts`（脚本内断言：仅 1 行变化、字节差 = 17、',
    '--   dollar-quote 内文本 == live `prosrc` 已用 md5 自证）。改动前的原件与 diff 落盘：',
    '--   `backend-ts/.p4-artifacts/b3afix2-20260930T014937/{pre,post}-ledger_post_event.def.sql` + `fn-def.diff`。',
    '--',
    '-- 幂等 / 可重入：`CREATE OR REPLACE FUNCTION` + 纯只读 `DO` 自检；重复应用（含独立重跑本文件）',
    '--   读数一致、不报错、不留痕。',
    '-- ============================================================================',
    '',
    // pg_get_functiondef 输出**不带结尾分号**，多语句文件必须补一个（否则下一条 DO 解析失败：42601 near "DO"）
    postDef + ';',
    '',
    '-- ---------------------------------------------------------------------------',
    '-- 自检：静态身份 + 行为（缺一不算通过）',
    '-- ---------------------------------------------------------------------------',
    'DO $$',
    'DECLARE',
    '  v_def text;',
    '  v_n   int;',
    'BEGIN',
    '  SELECT p.prosrc INTO v_def',
    '    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace',
    "   WHERE p.proname = 'ledger_post_event' AND n.nspname = 'public';",
    "  IF v_def IS NULL THEN RAISE EXCEPTION '0020 self-check FAILED: ledger_post_event not found in public'; END IF;",
    '',
    '  -- ① 本次唯一变更：函数体里不得再出现 listing_deposit（改前恰 1 处，就在那张 IN 列表里）',
    "  IF position('listing_deposit' in v_def) > 0 THEN",
    "    RAISE EXCEPTION '0020 self-check FAILED: listing_deposit still present in ledger_post_event body';",
    '  END IF;',
    '',
    '  -- ② 列表其余 4 项 + 闭合括号必须逐字保留（证明只删了那一个 token，没顺手改别处）',
    "  IF position('''hold'',''hold_release'',''job_escrow'',''job_escrow_refund'')' in v_def) = 0 THEN",
    "    RAISE EXCEPTION '0020 self-check FAILED: hold-family IN list not found verbatim (hold/hold_release/job_escrow/job_escrow_refund)';",
    '  END IF;',
    '',
    '  -- ③ 同账户恰好 2 腿的守卫本体不许被顺带删掉（负向用例：其它 hold 家族 kind 仍必须成对）',
    "  IF position('HOLD_PAIR_REQUIRED' in v_def) = 0 THEN",
    "    RAISE EXCEPTION '0020 self-check FAILED: HOLD_PAIR_REQUIRED guard disappeared';",
    '  END IF;',
    "  IF position('HAVING count(*) <> 2' in v_def) = 0 THEN",
    "    RAISE EXCEPTION '0020 self-check FAILED: HAVING count(*) <> 2 guard disappeared';",
    '  END IF;',
    '',
    '  -- ④ 字节级身份：函数体 md5 必须等于生成时对逐字新函数体算出的 md5',
    `  IF md5(v_def) <> '${postBodyMd5}' THEN`,
    "    RAISE EXCEPTION '0020 self-check FAILED: body md5 mismatch got=% expected=%', md5(v_def), " + `'${postBodyMd5}'` + ';',
    '  END IF;',
    '',
    '  -- ⑤ 签名 / 返回类型不变',
    "  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace",
    "       WHERE p.proname = 'ledger_post_event' AND n.nspname = 'public'",
    "         AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb'",
    "         AND pg_get_function_result(p.oid) = 'jsonb') <> 1 THEN",
    "    RAISE EXCEPTION '0020 self-check FAILED: ledger_post_event signature/return type changed';",
    '  END IF;',
    '',
    '  -- ⑥ kind 关闭集仍 20 个（本迁移不得动它）',
    "  SELECT count(*) INTO v_n FROM pg_constraint",
    "   WHERE conrelid = 'public.ledger_entry'::regclass AND conname = 'ledger_kind_enum' AND contype = 'c';",
    "  IF v_n <> 1 THEN RAISE EXCEPTION '0020 self-check FAILED: expected exactly 1 ledger_kind_enum CHECK, got %', v_n; END IF;",
    "  SELECT count(*) INTO v_n",
    "    FROM unnest(ARRAY['mint','burn','transfer','hold','hold_release','hold_forfeit',",
    "                      'job_escrow','job_escrow_refund','job_payout','job_fee','commission',",
    "                      'purchase','sale','purchase_refund','trade','trade_fee',",
    "                      'listing_fee','listing_deposit','currency_create_fee','reversal']) AS t(k)",
    "   WHERE strpos((SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c",
    "                  WHERE c.conrelid = 'public.ledger_entry'::regclass",
    "                    AND c.conname = 'ledger_kind_enum' AND c.contype = 'c'),",
    "                quote_literal(k)) > 0;",
    "  IF v_n <> 20 THEN RAISE EXCEPTION '0020 self-check FAILED: ledger_kind_enum no longer covers all 20 kinds (matched %)', v_n; END IF;",
    '',
    '  -- ⑦ 0019 的 `-1` credit 白名单必须仍然生效（本迁移不得回退它）',
    "  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'credit');",
    '  BEGIN',
    "    PERFORM ledger_assert_platform_mutation(-1::bigint, 'commission', 'credit');",
    "    RAISE EXCEPTION '0020 self-check FAILED: -1 credit commission WAS NOT rejected';",
    "  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;",
    '  END;',
    '  BEGIN',
    "    PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'debit');",
    "    RAISE EXCEPTION '0020 self-check FAILED: -1 debit listing_deposit WAS NOT rejected';",
    "  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;",
    '  END;',
    '',
    '  -- ⑧ `-2` / `-3` 的既有格未被顺带放宽（负向各一例）',
    '  BEGIN',
    "    PERFORM ledger_assert_platform_mutation(-2::bigint, 'listing_deposit', 'credit');",
    "    RAISE EXCEPTION '0020 self-check FAILED: -2 credit listing_deposit WAS NOT rejected';",
    "  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;",
    '  END;',
    '  BEGIN',
    "    PERFORM ledger_assert_platform_mutation(-3::bigint, 'listing_deposit', 'credit');",
    "    RAISE EXCEPTION '0020 self-check FAILED: -3 credit listing_deposit WAS NOT rejected';",
    "  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;",
    '  END;',
    'END $$;',
    '',
  ].join('\n');

  const migPath = path.join(REPO, 'migrations', '0020_ledger_post_event_hold_family_drop_listing_deposit.sql');
  if (fs.existsSync(migPath)) throw new Error('REFUSE_OVERWRITE_EXISTING ' + migPath);
  fs.writeFileSync(migPath, header);
  fs.writeFileSync(path.join(runDir, 'post-ledger_post_event.def.sql'), postDef);
  fs.writeFileSync(path.join(runDir, 'fn-def.diff'), diffLines.join('\n') + '\n');
  fs.writeFileSync(path.join(runDir, 'gen-0020-report.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    migration_path: migPath,
    migration_bytes: fs.statSync(migPath).size,
    pre_def: { md5: md5(preDef), bytes: preDef.length, lines: preLines.length },
    post_def_expected: { md5: postDefMd5, bytes: postDef.length, lines: postLines.length },
    body: { pre_md5: md5(preBody), post_md5: postBodyMd5, delta_bytes: preBody.length - postBody.length },
    changed_lines: diffLines,
    self_check_prosrc_assumption: selfCheck,
  }, null, 1));

  console.log('WROTE ' + migPath + ' (' + fs.statSync(migPath).size + ' bytes)');
  console.log('PRE_DEF_MD5 ' + md5(preDef));
  console.log('POST_DEF_MD5_EXPECTED ' + postDefMd5);
  console.log('POST_BODY_MD5 ' + postBodyMd5);
  console.log('ASSUMPTION ' + JSON.stringify(selfCheck));
  console.log('CHANGED_LINES ' + JSON.stringify(diffLines, null, 0));
};

main().catch((e) => { console.error('FATAL ' + String((e as Error)?.message || e)); process.exit(2); });

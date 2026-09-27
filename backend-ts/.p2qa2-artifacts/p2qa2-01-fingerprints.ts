/**
 * p2qa2-01 · 盘==库 三向一致 + 库内函数指纹 + 闸/锁/余额闸/ON CONFLICT 四位置 + moneyGuard 基线
 * 只读（除 moneyGuard 无写入）。
 * 落盘：.p2qa2-artifacts/p2qa2-01-fingerprints-<RUN>.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, raw1, save, sha256File, md5, fnFingerprint, moneyGuard, NET_RETRIES, RUN, DIRECT_URL, md5 as m5 } from './p2qa2-lib';

(async () => {
  const p = mkPool(3);
  try {
    const MIG = path.resolve(__dirname, '..', 'migrations');
    const files = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
    const disk = files.map((f) => {
      const buf = fs.readFileSync(path.join(MIG, f));
      return {
        file: f, version: (f.match(/^(\d+)/) || [, f])[1],
        size: buf.length,
        md5: m5(buf.toString('utf8')),   // 与 migrate.ts 同口径：对 utf8 文本求 sha256
        sha256_of_utf8_text: sha256File(path.join(MIG, f)),
        sha256_of_raw_bytes: require('crypto').createHash('sha256').update(buf).digest('hex'),
      };
    });

    const appliedRows = await raw(p, `SELECT version, name, checksum, applied_at FROM schema_migration ORDER BY version`);
    const appliedByVersion = new Map<string, Record<string, unknown>>(appliedRows.map((r) => [String(r.version), r]));

    const threeWay = disk.map((d) => {
      const ap = appliedByVersion.get(d.version as string) ?? null;
      return {
        version: d.version, file: d.file, disk_size: d.size, disk_md5: d.md5,
        disk_sha256_utf8: d.sha256_of_utf8_text, disk_sha256_bytes: d.sha256_of_raw_bytes,
        db_checksum: ap ? String(ap.checksum) : null,
        db_name: ap ? String(ap.name) : null,
        applied_at: ap ? String(ap.applied_at) : null,
        MATCH_disk_utf8_vs_db: ap ? String(ap.checksum) === d.sha256_of_utf8_text : null,
        MATCH_disk_bytes_equals_utf8: d.sha256_of_raw_bytes === d.sha256_of_utf8_text,
      };
    });

    const fp = await fnFingerprint(p);
    const guard = await moneyGuard(p);

    // 额外只读：身份表名、pg_indexes、函数身份参数、ledger_entry 列
    const identArgs = await raw(p, `SELECT p.oid::text, pg_get_function_identity_arguments(p.oid) AS args,
        pg_get_function_result(p.oid) AS ret, l.lanname, p.prosecdef AS secdef, p.provolatile
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
      WHERE n.nspname='public' AND p.proname='ledger_post_event'`);
    const idx = await raw(p, `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='ledger_entry'`);
    const tables = await raw(p, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`);
    const ledCols = await raw(p, `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_entry' ORDER BY ordinal_position`);
    const usersCols = await raw(p, `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
    const acctCols = await raw(p, `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='account' ORDER BY ordinal_position`);

    const out = {
      run: RUN, phase: process.env.P2QA2_PHASE ?? 'after',
      direct_url_host: DIRECT_URL.replace(/:[^:@]*@/, ':***@').replace(/\?.*$/, ''),
      disk_files: disk, three_way: threeWay,
      all_disk_db_match: threeWay.every((t) => t.MATCH_disk_utf8_vs_db === true && t.MATCH_disk_bytes_equals_utf8 === true),
      schema_version: fp.schema_version,
      fn: {
        prosrc_len: fp.prosrc_len, prosrc_md5: fp.prosrc_md5,
        pos_pre_gate: fp.pos_pre_gate, pos_c4_account_lock: fp.pos_c4_account_lock,
        pos_c5_balance_section: fp.pos_c5_balance_section, pos_r80_balance_gate: fp.pos_r80_balance_gate,
        pos_on_conflict_probe: fp.pos_on_conflict_probe,
        order_ok_gate_after_lock_before_balance: fp.pos_pre_gate >= 0 && fp.pos_pre_gate > fp.pos_c4_account_lock
          && fp.pos_pre_gate < fp.pos_c5_balance_section && fp.pos_pre_gate < fp.pos_r80_balance_gate,
        on_conflict_still_after_gate: fp.pos_on_conflict_probe > fp.pos_pre_gate,
        all_gate_markers: fp.all_gate_markers,
        gate_body_bytes: fp.gate_body ? fp.gate_body.length : null,
        gate_body_stripped_bytes: fp.gate_body_stripped ? fp.gate_body_stripped.length : null,
        gate_body_write_tokens: fp.gate_body_write_tokens,
      },
      money_guard_baseline: guard,
      pg_proc_identity: identArgs, ledger_indexes: idx, base_tables: tables,
      ledger_entry_columns: ledCols, users_columns: usersCols, account_columns: acctCols,
      net_retries: { ...NET_RETRIES },
    };
    const f = save('p2qa2-01-fingerprints', out);
    console.log(JSON.stringify({ file: f, all_disk_db_match: out.all_disk_db_match, schema_version: out.schema_version,
      fn: out.fn, money_guard_baseline: out.money_guard_baseline, net_retries: NET_RETRIES, ident: identArgs }, null, 2));
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });

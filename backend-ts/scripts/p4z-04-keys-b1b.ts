// p4z-04-keys-b1b.ts — P4-B1-b key-contract fixture (task→job, task_progress→job_application+job_submission).
// Zero-dependency, in-memory, NO DB access, NO DB writes. Feeds identical synthetic rows to the
// PRE-change mappers (HEAD snapshot copy, exports appended) and the POST-change mappers (working-tree
// snapshot copy, exports appended) and asserts the returned KEY SETS are identical per case
// (values are NOT compared). Mirrors p4z-03-keys.ts (B1-a) in caliber.
// Usage: ts-node --transpile-only scripts/p4z-04-keys-b1b.ts <outJson> <snapshotDir>
import * as fs from 'fs';
import * as path from 'path';

const [, , outPath, snapshotDir] = process.argv;
if (!outPath || !snapshotDir) {
  console.error('USAGE: <outJson> <snapshotDir>');
  process.exit(2);
}

/* eslint-disable @typescript-eslint/no-var-requires */
const HEAD = require(path.resolve(snapshotDir, 'database.HEAD.ts'));
const NEW = require(path.resolve(snapshotDir, 'database.NEW.ts'));

const keys = (v: unknown) => Object.keys(v as Record<string, unknown>).sort();

// old-shape row: pre-migration `task` columns as consumed by the HEAD-side normalizeTask
const oldTaskRow = {
  tID: 1, title: 't', note: 'n', refcode: 'r', link0: 'a', linkA: 'b', linkB: 'c', points: 10, type: 1,
  time_start: 0, time_end: 0, time_created: 0, time_updated: 0, is_open: true, participants_count: 2,
};
// old-shape row: pre-migration `task_progress` columns as consumed by the HEAD-side normalizeTaskProgress
const oldProgressRow = {
  jID: 7, tID: 1, uID: 3, info_input: 'proof',
  time_created: 100, time_submitted: 200, time_checked: 300, time_claimed: 400, points_claimed: 10,
};
// new-shape row: `job` columns (post-migration) + participants_count as produced by the new listTasks/getTask SQL
const jobRow = {
  job_id: 1, employer_uid: 2, worker_uid: 3, cid: 1, reward: 10, title: 't', description: 'd', status: 'open',
  create_key: 'k', escrow_txid: null, settle_txid: null, ledger_event_keys: [],
  time_created: 0, time_updated: 0, participants_count: 2,
};
// new-shape row: synthesized job_application+job_submission output aliases as produced by the new
// getTaskProgress / listTaskProgressByUser / listPendingVerification SQL
const synthProgressRow = {
  jID: 7, tID: 1, uID: 3, info_input: 'deliverable',
  time_created: 100, time_submitted: 200, time_checked: 300, time_claimed: null, points_claimed: 0,
};

type MapperModule = {
  normalizeTask: (row: unknown, participantsCount?: number) => Record<string, unknown>;
  normalizeTaskProgress: (row: unknown) => Record<string, unknown>;
};

type Case = { name: string; fn: (m: MapperModule) => Record<string, unknown> };

const CASES: Case[] = [
  { name: 'task:empty_row', fn: (m) => m.normalizeTask({}, 0) },
  { name: 'task:old_task_row', fn: (m) => m.normalizeTask(oldTaskRow, 2) },
  { name: 'task:new_job_row', fn: (m) => m.normalizeTask(jobRow, 2) },
  { name: 'task:new_job_row_minimal', fn: (m) => m.normalizeTask({ job_id: 9, reward: 5, title: 'x' }, 0) },
  { name: 'task_progress:empty_row', fn: (m) => m.normalizeTaskProgress({}) },
  { name: 'task_progress:old_row', fn: (m) => m.normalizeTaskProgress(oldProgressRow) },
  { name: 'task_progress:new_synth_row', fn: (m) => m.normalizeTaskProgress(synthProgressRow) },
  { name: 'pending_verification:old_enriched', fn: (m) => ({ ...m.normalizeTaskProgress(oldProgressRow), task: null, user: null }) },
  { name: 'pending_verification:new_enriched', fn: (m) => ({ ...m.normalizeTaskProgress(synthProgressRow), task: null, user: null }) },
];

let allEqual = true;
const results = CASES.map((c) => {
  const oldKeys = keys(c.fn(HEAD as MapperModule));
  const newKeys = keys(c.fn(NEW as MapperModule));
  const equal = JSON.stringify(oldKeys) === JSON.stringify(newKeys);
  if (!equal) allEqual = false;
  return {
    case: c.name,
    equal,
    old_keys: oldKeys,
    new_keys: newKeys,
    only_old: oldKeys.filter((k) => !newKeys.includes(k)),
    only_new: newKeys.filter((k) => !oldKeys.includes(k)),
  };
});

const out = {
  generated_at: new Date().toISOString(),
  caliber: 'zero-dependency in-memory fixture; mappers required from HEAD snapshot vs working-tree snapshot (both with appended export lines); NO DB access, NO DB writes; key sets compared, values not',
  pre_source: path.resolve(snapshotDir, 'database.HEAD.ts'),
  post_source: path.resolve(snapshotDir, 'database.NEW.ts'),
  all_key_sets_equal: allEqual,
  cases: results,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ all_key_sets_equal: allEqual, cases: results.map((r) => `${r.case}:${r.equal ? 'EQ' : 'DIFF'}`) }));
process.exit(allEqual ? 0 : 1);

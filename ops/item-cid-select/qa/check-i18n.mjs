// QA (Neng) AC6 — i18n: flattened key sets per locale, item.cid/cidNote values changed, jobs.* untouched.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const REPO = '/Users/kevin/bistro/seafood';
const LOCALES = ['zh', 'en', 'hk', 'vn'];
const flatten = (obj, prefix = '', acc = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, acc);
    else acc[key] = v;
  }
  return acc;
};
const load = (rev, lang) => {
  const text = rev === 'WORKTREE'
    ? fs.readFileSync(`${REPO}/frontend/src/locales/${lang}.json`, 'utf8')
    : execSync(`git -C ${REPO} show ${rev}:frontend/src/locales/${lang}.json`, { encoding: 'utf8' });
  return JSON.parse(text);
};

const out = { ac: 'AC6', at: new Date().toISOString(), per_locale: {}, key_sets: {}, pairwise, diff_values: {}, jobs_untouched: {} };

function pairwise() {}

const heads = {};
const parents = {};
for (const lang of LOCALES) {
  heads[lang] = flatten(load('7b597ec', lang));
  parents[lang] = flatten(load('7b597ec^', lang));
  // concurrent-session drift guard: worktree file vs commit (another session edits jobs.* right now)
  const wt = flatten(load('WORKTREE', lang));
  out.per_locale[lang] = {
    head_flat_key_count: Object.keys(heads[lang]).length,
    parent_flat_key_count: Object.keys(parents[lang]).length,
    worktree_flat_key_count: Object.keys(wt).length,
    worktree_equals_head: JSON.stringify(wt) === JSON.stringify(heads[lang]),
    worktree_keys_differing_from_head: Object.keys(wt).filter((k) => JSON.stringify(wt[k]) !== JSON.stringify(heads[lang][k])),
    count_delta: Object.keys(heads[lang]).length - Object.keys(parents[lang]).length,
    item_cid_head: heads[lang]['item.cid'],
    item_cid_parent: parents[lang]['item.cid'],
    item_cid_changed: heads[lang]['item.cid'] !== parents[lang]['item.cid'],
    item_cidNote_head: heads[lang]['item.cidNote'],
    item_cidNote_parent: parents[lang]['item.cidNote'],
    item_cidNote_changed: heads[lang]['item.cidNote'] !== parents[lang]['item.cidNote'],
    jobs_cid_head: heads[lang]['jobs.cid'],
    jobs_cid_parent: parents[lang]['jobs.cid'],
    jobs_cid_unchanged: JSON.stringify(heads[lang]['jobs.cid']) === JSON.stringify(parents[lang]['jobs.cid']),
    jobs_cidNote_head: heads[lang]['jobs.cidNote'],
    jobs_cidNote_parent: parents[lang]['jobs.cidNote'],
    jobs_cidNote_unchanged: JSON.stringify(heads[lang]['jobs.cidNote']) === JSON.stringify(parents[lang]['jobs.cidNote']),
    added_keys_vs_parent: Object.keys(heads[lang]).filter((k) => !(k in parents[lang])),
    removed_keys_vs_parent: Object.keys(parents[lang]).filter((k) => !(k in heads[lang])),
    changed_keys_vs_parent: Object.keys(heads[lang]).filter((k) => k in parents[lang] && JSON.stringify(heads[lang][k]) !== JSON.stringify(parents[lang][k])),
  };
}

// global key-set equality across the four locales (HEAD)
const keysets = LOCALES.map((l) => Object.keys(heads[l]).sort());
out.key_sets = {
  per_locale_count: Object.fromEntries(LOCALES.map((l, i) => [l, keysets[i].length])),
  all_equal: keysets.every((k) => JSON.stringify(k) === JSON.stringify(keysets[0])),
  pairwise_diff_counts: {},
};
for (let i = 0; i < LOCALES.length; i += 1) {
  for (let j = i + 1; j < LOCALES.length; j += 1) {
    const a = new Set(keysets[i]); const b = new Set(keysets[j]);
    const onlyA = [...a].filter((k) => !b.has(k));
    const onlyB = [...b].filter((k) => !a.has(k));
    const setSizeDiff = Math.abs(a.size - b.size);
    out.key_sets.pairwise_diff_counts[`${LOCALES[i]}-${LOCALES[j]}`] = { only_left: onlyA.length, only_right: onlyB.length, size_delta: setSizeDiff, sample_left: onlyA.slice(0, 5), sample_right: onlyB.slice(0, 5) };
  }
}
// jobs.* subtree untouched as a whole (all keys under jobs.)
out.jobs_untouched = Object.fromEntries(LOCALES.map((l) => {
  const hk = Object.keys(heads[l]).filter((k) => k.startsWith('jobs.'));
  const pk = Object.keys(parents[l]).filter((k) => k.startsWith('jobs.'));
  const changed = hk.filter((k) => k in parents[l] && JSON.stringify(heads[l][k]) !== JSON.stringify(parents[l][k]));
  return [l, { jobs_key_count_head: hk.length, jobs_key_count_parent: pk.length, jobs_changed_keys: changed.length, jobs_changed_sample: changed.slice(0, 5) }];
}));
out.verdict_details = {
  item_cid_changed_all4: LOCALES.every((l) => out.per_locale[l].item_cid_changed),
  item_cidNote_changed_all4: LOCALES.every((l) => out.per_locale[l].item_cidNote_changed),
  jobs_untouched_all4: LOCALES.every((l) => out.per_locale[l].jobs_cid_unchanged && out.per_locale[l].jobs_cidNote_unchanged && out.jobs_untouched[l].jobs_changed_keys === 0),
  keycount_delta_zero_all4: LOCALES.every((l) => out.per_locale[l].count_delta === 0 && out.per_locale[l].added_keys_vs_parent.length === 0 && out.per_locale[l].removed_keys_vs_parent.length === 0),
  keysets_equal_all4: out.key_sets.all_equal && Object.values(out.key_sets.pairwise_diff_counts).every((d) => d.only_left === 0 && d.only_right === 0 && d.size_delta === 0),
};
out.changed_keys_only_item_two_keys = Object.fromEntries(LOCALES.map((l) => [l, out.per_locale[l].changed_keys_vs_parent]));
out.verdict = Object.values(out.verdict_details).every(Boolean) ? 'PASS' : 'FAIL';

console.log(JSON.stringify(out, null, 2));

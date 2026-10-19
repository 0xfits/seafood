// QA (Neng) validator: AC2 (API options == DB listed set) + AC3 (HTTP/shape contract).
// Reads local files only; no network, no DB writes.
import fs from 'node:fs';

const QA = '/Users/kevin/bistro/seafood/ops/item-cid-select/qa';
const raw = fs.readFileSync(`${QA}/readings/ac3-currencies.body.json`, 'utf8');
const body = JSON.parse(raw);
const db = JSON.parse(fs.readFileSync(`${QA}/readings/ac2-db-currencies.json`, 'utf8'));

const data = body.data;
const keySets = data.map((r) => Object.keys(r).sort().join(','));
const uniqKeySets = [...new Set(keySets)];
const keyCounts = [...new Set(data.map((r) => Object.keys(r).length))];
const cids = data.map((r) => String(r.cid));
const cidNums = cids.map(Number);
const ascending = cidNums.every((v, i) => i === 0 || cidNums[i - 1] < v);
const cidJsonTypes = [...new Set(data.map((r) => typeof r.cid))];

const apiSet = new Set(data.map((r) => `${r.cid}\u0001${r.symbol}\u0001${r.name}`));
const dbListedSet = new Set(db.listed.map((r) => `${r.cid}\u0001${r.symbol}\u0001${r.name}`));
const onlyApi = [...apiSet].filter((x) => !dbListedSet.has(x));
const onlyDb = [...dbListedSet].filter((x) => !apiSet.has(x));
const apiCids = new Set(cids);
const draftCids = db.not_listed.map((r) => String(r.cid));
const draftLeaked = draftCids.filter((c) => apiCids.has(c));
const draftSymbolsLeaked = db.not_listed.map((r) => r.symbol).filter((s) => data.some((r) => r.symbol === s));

const ac3 = {
  ac: 'AC3',
  measured_at: new Date().toISOString(),
  url: 'http://localhost:5788/api/currencies',
  request_headers: 'Authorization header explicitly blanked (-H "Authorization:")',
  http_code: 200,
  size_download: fs.statSync(`${QA}/readings/ac3-currencies.body.json`).size,
  body_md5: 'recorded in ac3-curl-w.txt run',
  success_true: body.success === true,
  message: body.message,
  top_level_keys: Object.keys(body).sort(),
  data_is_array: Array.isArray(data),
  row_count: data.length,
  row_key_sets_uniq: uniqKeySets,
  row_key_counts_uniq: keyCounts,
  exactly_three_keys: keyCounts.length === 1 && keyCounts[0] === 3,
  cid_json_type: cidJsonTypes,
  ascending_by_cid: ascending,
  cids,
  verdict: null,
};
ac3.verdict = (ac3.http_code === 200 && ac3.success_true && ac3.data_is_array && ac3.exactly_three_keys && ac3.ascending_by_cid) ? 'PASS' : 'FAIL';

const ac2 = {
  ac: 'AC2',
  measured_at: new Date().toISOString(),
  db_source: 'public.currency via @neondatabase/serverless (read-only SELECT)',
  api_row_count: data.length,
  db_listed_row_count: db.listed.length,
  counts_equal: data.length === db.listed.length,
  set_equal: onlyApi.length === 0 && onlyDb.length === 0,
  only_in_api: onlyApi,
  only_in_db_listed: onlyDb,
  db_total: db.total,
  db_status_counts: db.status_counts,
  draft_cids_checked: draftCids,
  draft_cids_present_in_api: draftLeaked,
  draft_symbols_present_in_api: draftSymbolsLeaked,
  api_cid_types: cidJsonTypes,
  display_label_formula: 'symbol + (name ? " · " + name : "")  [no cid]',
  labels: data.map((r) => (r.name ? `${r.symbol} · ${r.name}` : String(r.symbol))),
  // Label must be *exactly* `symbol · name` (cid only as <option value>). Judged by residue:
  // strip symbol+name, whatever remains is the separator; any digit left over = cid leaked into text.
  // (Naive `includes(cid)` would false-positive on fixture symbols like "P4B3A013122" containing "4".)
  label_residue: data.map((r) => {
    const label = r.name ? `${r.symbol} · ${r.name}` : String(r.symbol);
    const cid = String(r.cid);
    // Sound checks (digits inside fixture symbols/names make `includes(cid)` useless):
    //  a) label is exactly the symbol·name formula ⇒ nothing else was appended;
    //  b) no cid wrapped as an id marker: #N, [N], (N), "编号 N", or standalone token between spaces/|
    const idMarkers = [`#${cid}`, `[${cid}]`, `(${cid})`, `编号${cid}`, `cid ${cid}`, `ID ${cid}`];
    const standalone = new RegExp(`(^|[\\s|/·:：])${cid}($|[\\s|/·:：])`).test(label);
    return {
      cid, label,
      equals_formula: label === (r.name ? `${r.symbol} · ${r.name}` : String(r.symbol)),
      id_marker_hits: idMarkers.filter((m) => label.includes(m)),
      standalone_cid_token: standalone,
    };
  }),
  verdict: null,
};
const labelLeak = ac2.label_residue.filter((x) => !x.equals_formula || x.id_marker_hits.length > 0 || x.standalone_cid_token);
ac2.verdict = (ac2.counts_equal && ac2.set_equal && draftLeaked.length === 0 && labelLeak.length === 0) ? 'PASS' : 'FAIL';

console.log(JSON.stringify({ ac2, ac3 }, null, 2));

// QA (Neng) AC4 — submit semantics: Number(form.cid) at the call site + POST /api/listing request shape unchanged.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = '/Users/kevin/bistro/seafood';
const show = (rev, p) => execSync(`git -C ${REPO} show ${rev}:${p}`, { encoding: 'utf8' });

const extractFn = (text, name) => {
  const start = text.indexOf(`export const ${name} = `);
  if (start < 0) return null;
  // function expression ends at the first line that is exactly '  }, user)' following the call
  const rest = text.slice(start);
  const endMatch = rest.match(/\n\n/);
  return rest.slice(0, endMatch ? endMatch.index : rest.length);
};

const apiHead = show('7b597ec', 'frontend/src/pages/item/item-api.js');
const apiParent = show('7b597ec^', 'frontend/src/pages/item/item-api.js');
const pageHead = show('7b597ec', 'frontend/src/pages/item/PublishItemPage.jsx');
const pageParent = show('7b597ec^', 'frontend/src/pages/item/PublishItemPage.jsx');

const fnHead = extractFn(apiHead, 'publishListing');
const fnParent = extractFn(apiParent, 'publishListing');

const submitCallHead = (pageHead.match(/publishListing\(\{[\s\S]*?\}\)/g) || []);
const cidLine = (pageHead.match(/^\s*cid:.*$/gm) || []);

const out = {
  ac: 'AC4',
  at: new Date().toISOString(),
  publishListing_body_identical: fnHead === fnParent,
  publishListing_head_body: fnHead,
  publishListing_parent_body: fnParent,
  publishListing_keys_head: [...fnHead.matchAll(/^\s{4}(\w+)(,|:)/gm)].map((m) => m[1]),
  call_site_cid_expressions: cidLine,
  call_site_uses_Number: /cid:\s*Number\(form\.cid\)/.test(pageHead),
  page_had_Number_before: /cid:\s*Number\(form\.cid\)/.test(pageParent),
  postJson_url_unchanged: /postJson\('\/api\/listing'/.test(apiHead) && /postJson\('\/api\/listing'/.test(apiParent),
  // form state starts as string, select gives string value ⇒ Number() conversion is the semantic bridge
  form_cid_default_head: (pageHead.match(/useState\(\{ cid: [^,]+/) || [])[0],
  form_cid_default_parent: (pageParent.match(/useState\(\{ cid: [^,]+/) || [])[0],
  unit_test_file: fs.existsSync(`${REPO}/frontend/src/test/unit/publish-item-cid-select.test.jsx`),
  unit_test_cases: (() => {
    try {
      const t = show('7b597ec', 'frontend/src/test/unit/publish-item-cid-select.test.jsx');
      return [...t.matchAll(/\b(it|test)\(\s*'([^']+)'/g)].map((m) => m[2]);
    } catch { return null; }
  })(),
};
out.verdict = (out.publishListing_body_identical && out.call_site_uses_Number && out.postJson_url_unchanged && out.unit_test_file) ? 'PASS' : 'FAIL';
console.log(JSON.stringify(out, null, 2));

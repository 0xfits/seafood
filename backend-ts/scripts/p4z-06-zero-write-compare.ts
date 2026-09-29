// p4z-06-zero-write-compare.ts — compare two p4z-02 counts.json snapshots (read-only, ZERO DB access).
// Usage: ts-node --transpile-only scripts/p4z-06-zero-write-compare.ts <before.json> <after.json> <out.json>
import * as fs from 'fs';

const [beforePath, afterPath, outPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !outPath) {
  console.error('USAGE: <before.json> <after.json> <out.json>');
  process.exit(2);
}

const before = JSON.parse(fs.readFileSync(beforePath, 'utf8')) as {
  row_counts: Record<string, unknown>;
  relations: string[];
};
const after = JSON.parse(fs.readFileSync(afterPath, 'utf8')) as {
  row_counts: Record<string, unknown>;
  relations: string[];
};

const diffs: Record<string, [unknown, unknown]> = {};
const keys = new Set([...Object.keys(before.row_counts), ...Object.keys(after.row_counts)]);
for (const k of keys) {
  if (JSON.stringify(before.row_counts[k]) !== JSON.stringify(after.row_counts[k])) {
    diffs[k] = [before.row_counts[k], after.row_counts[k]];
  }
}

const out = {
  generated_at: new Date().toISOString(),
  caliber: 'neon() HTTP driver, read-only SELECT/catalog; counts before vs after GET sweep + code change',
  identical: Object.keys(diffs).length === 0,
  diffs,
  relations_before: before.relations.length,
  relations_after: after.relations.length,
  row_counts_before: before.row_counts,
  row_counts_after: after.row_counts,
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`IDENTICAL=${out.identical} DIFFS=${Object.keys(diffs).length} REL_BEFORE=${before.relations.length} REL_AFTER=${after.relations.length}`);

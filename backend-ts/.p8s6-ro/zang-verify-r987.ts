// Zang 独立复核 R-9-87（只读，不造夹具）：真数据撞号点必须解到「本人」
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { DatabaseService } from '../src/database';

(async () => {
  const cases: Array<[number, number, string]> = [
    [11, 6, 'X=11：app_id=11 属 uid1(job15) ⇄ job_id=11 属 uid6(app 9) ⇒ 应 self/app 9'],
    [4, 3, 'X=4：app_id=4 属 uid970002(job3) ⇄ job_id=4 属 uid3(app 5)? ⇒ 期望 self'],
    [23, 12, 'X=23：app_id=23 无 ⇄ job_id=23 属 uid12(app 24) ⇒ 期望 self/app 24'],
    [24, 12, 'X=24：app_id=24 属 uid12(job23) ⇒ self/app 24'],
    [999999, 6, 'X=999999：无任何候选 ⇒ null'],
  ];
  const out: Record<string, unknown> = {};
  for (const [identifier, uid, desc] of cases) {
    const r = await DatabaseService.resolveJobApplication(identifier, uid);
    out[`id=${identifier},uid=${uid}`] = { got: r, expect: desc };
    console.log(`id=${identifier} uid=${uid} =>`, JSON.stringify(r), '|', desc);
  }
  console.log('\nRAW_JSON=' + JSON.stringify(out));
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });

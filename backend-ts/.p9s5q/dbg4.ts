import { withTransaction, closePools, TxClient } from '../src/db';
import { planJobSettlement } from '../src/commission';
const evmOf=(u:number)=>`0x${u.toString(16).padStart(40,'0')}`;
(async()=>{
 await withTransaction(async (tx:TxClient)=>{
  const mk=async(us:number[])=>{for(const uid of us) await tx.query(`INSERT INTO public.users (uid,evm,bio,is_admin,time_reg,time_login_last) VALUES ($1,$2,'',false,now(),now())`,[uid,evmOf(uid)]);};
  const bind=(c:number,p:number)=>tx.query(`SELECT public.referral_bind($1::bigint,$2::bigint)`,[c,p]);
  await mk([9800031,9800032,9800033,9800034,9800035,9800036,9800037,9800038]);
  await bind(9800032,9800031); await bind(9800033,9800032); await bind(9800034,9800033);
  await bind(9800035,9800034); await bind(9800036,9800035); await bind(9800037,9800036); await bind(9800038,9800034);
  const up=await tx.query(`SELECT child_uid::text c,parent_uid::text p FROM referral WHERE parent_uid=9800034 OR child_uid=9800034`);
  console.log('EDGES_OF_W6',JSON.stringify(up.rows));
  const all=await tx.query(`SELECT child_uid::text c,parent_uid::text p,depth FROM referral ORDER BY child_uid`);
  console.log('ALLREF',JSON.stringify(all.rows));
  const plan=await planJobSettlement({jobId:'9890001',employerUid:970001,workerUid:9800034,cid:1,gross:100000,ex:tx});
  console.log('PLAN M',plan.M,'fee',plan.fee,'layers',JSON.stringify(plan.layers.map(l=>({lv:l.level,dir:l.direction,dist:l.distance,uid:l.beneficiary_uid,x:l.x,sh:l.layer_share}))));
  throw new Error('SENT');
 }).catch(e=>{if(String((e as Error).message)!=='SENT')throw e;});
 await closePools();
})().catch(async e=>{console.error('FATAL',e); try{await closePools()}catch{}; process.exit(1)});

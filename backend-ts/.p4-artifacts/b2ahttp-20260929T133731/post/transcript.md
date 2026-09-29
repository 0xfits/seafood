# 终端实测逐字转录（P4-B2a-HTTP, run b2ahttp-20260929T133731）

口径：本文件是 **agent 终端实测输出的逐字转录**（非二次推断），用于让报告里的「实测」断言可 grep。
源：`seafood-api`（5788）+ 面板 `/api/logs/seafood-api`（5555）+ neon HTTP 探针。
**不含 token / 密钥 / 连接串**（JWT 三段式首段前缀即 `e`,`y`,`J` 三连字符计数 = 0）。

## 1) 库侧 schema 真值（13:38Z，`pre/probe.json` 由同批探针落盘）

```
assert_users_table = [{"users_regclass":"users","has_uid":"uid","has_bad_uid":null,"has_evm":"evm","has_bad_evm":null}]
users cols = [{"column_name":"uid","data_type":"bigint","is_nullable":"NO"},
              {"column_name":"evm","data_type":"text","is_nullable":"NO"},
              {"column_name":"bio","data_type":"text","is_nullable":"NO"},
              {"column_name":"is_admin","data_type":"boolean","is_nullable":"NO"},
              {"column_name":"time_reg","data_type":"timestamp with time zone","is_nullable":"NO"},
              {"column_name":"time_login_last","data_type":"timestamp with time zone","is_nullable":"NO"}]
job_application indexes: job_application_create_key_uniq(create_key), job_application_job_worker_uniq(job_id,worker_uid),
                         uniq_job_application_accepted(job_id) WHERE status='accepted'
job_submission indexes:  job_submission_create_key_uniq(create_key)
users indexes:           users_pk(uid), users_evm_uniq(evm), idx_users_evm_lower(lower(evm))
fixtures: users 970001/970002(evm 0x9700…0000 / 0x9700…0000), job 2=open/employer 970001, job 3=accepted/worker 970002,
          job_application [1:job2/970002/applied/cli:p4b2:app:A2, 4:job3/970002/accepted/cli:p4b2:app:B2],
          job_submission = [], account 4 行 sum(balance)=0, ledger_entry 0 行
```

## 2) 补丁自证（`pre/patch-log.json`）

```
PATCH_OK [{normalizeUser-fallback-keys:1/1},{getNextUserId:1/1},{getAllUsers-order:1/1},
          {uid-predicate-x3:3/3},{getUserByEvm-predicate:1/1},{createUserByEvm-insert:1/1}]
residual_old_cols = 0
tsc --noEmit => exit 0 ;  grep -cE '^app\.(get|post|put|patch|delete)\(' src/index.ts => 51
```

## 3) 重启与健康（面板单服务路由，未用 pkill）

```
POST http://127.0.0.1:5555/api/restart -d {"sid":"seafood-api"}
 -> {"sid":"seafood-api","ok":true,"state":"running","pid":89702,"msg":"已启动"}
health=200 after 34s
GET /health -> {"ok":true,"db_version":"PostgreSQL 18.6 ...","schema_version":"0017","time":"2026-09-29T13:42:01.965Z"}
```

## 4) 服务端日志（重启后，`GET 5555/api/logs/seafood-api` 尾部）—— 旧病已消

```
[29/9/2026, 9:42:21 pm] [ERR] Failed to resolve actor: Error: Invalid token signature
    at verifySignedToken (src/auth.ts:68:11) <- verifySessionToken (auth.ts:200:19)
    at resolveActor (src/index.ts:110:39) <- requireActor (src/index.ts:132:23) <- (src/index.ts:343:23)   [= GET /api/user]
[29/9/2026, 9:42:35 pm] （同上，第二条；两条均来自负对照探针：错签名 / .env.local 密钥）
【无】NeonDbError: column u.uID does not exist  —— 重启后再未出现（grep 0 命中）
```

## 5) 鉴权面 + 批 2a 写分支（round#1，13:43Z）

```
[A1_unauth_401]            GET  /api/user                        -> 401
[A2_GET_/api/user]         GET  /api/user       (token 970001)   -> 200   data_keys=[uID,EVM,bio,is_admin,time_reg,time_login_last,points,requires_profile_completion]
[A3_GET_task-progress]     GET  /api/task-progress               -> 200
[A4_GET_admin-me]          GET  /api/admin/me                    -> 200
[A5_bad_signature_401]     GET  /api/user       (错签名)          -> 401
[B1_POST_/api/job/2/apply] POST /api/job/2/apply                 -> 404   （路径未注册）
[B2_POST_/api/job/2/accept]POST /api/job/2/accept                -> 404   （路径未注册）
[B3_submit_J3_worker]      POST /api/task-progress/4/submit      -> 200   （首次落行：job_submission 0->1）
[B4_submit_same_key_replay]POST /api/task-progress/4/submit      -> 200 (replay, idempotent_replay:true)
[B5_submit_other_worker_403]POST/api/task-progress/4/submit      -> 403
[B6_submit_miss_404]       POST /api/task-progress/999999/submit -> 404
[B7 ...]                   POST /api/task-progress/1/submit      -> 15s 超时（Neon 抖动；round#3 复测 = 409）
```

## 6) 库侧落点（13:45Z 读）

```
subs:  [{"submission_id":"1","job_id":"3","worker_uid":"970002","review_status":"pending",
         "create_key":"cli:p4b2:submit:J3A","deliverable":"cli:p4b2:deliverable:J3A"}]     <- 恰 1 行
job:   [{"job_id":"2","status":"open","worker_uid":null},{"job_id":"3","status":"submitted","worker_uid":"970002"}]
apps:  [{"application_id":"1","job_id":"2","worker_uid":"970002","status":"applied"},
        {"application_id":"4","job_id":"3","worker_uid":"970002","status":"accepted"}]      <- 未变
```

## 7) round#3 复测（13:50Z；同键重投幂等再证）

```
[A4_GET_admin-me] -> 200   [A5_bad_signature_401] -> 401
[B1_POST_/api/job/2/apply] -> 404     [B2_POST_/api/job/2/accept] -> 404
[B3_submit_J3_worker] -> 200 (replay) [B4_submit_J3_same_key_replay] -> 200 (replay)
[B5_submit_other_worker_403] -> 403   [B6_submit_miss_404] -> 404
[B7_submit_applied_state_409] -> 409   <-- 上一轮「超时」的真语义（非死循环）
[B8_POST_/api/user/profile_same_bio] -> 200   （updateUserProfile 谓词改后可用；写同值 bio ⇒ 无净变更）
[B9_GET_user-asset] -> 200
尾部异常：NeonDbError: Error connecting to database: fetch failed / cause: ConnectTimeoutError UND_ERR_CONNECT_TIMEOUT
        ⇒ 该轮 before/after 快照未落盘（探针侧网络面），已在报告 §5 登记为 NOT_MEASURED
```

## 8) 最终库侧快照（`post/final-snapshot.json`，含重试 5 次）

```
SNAP_OK
account={"n":4,"sb":"0","sf":"0"}   dump=7516d8c6a9a30f96eb95417652e07dbd
ledger=0   users=2   job=2   app=2   sub=1   ns_sub(create_key LIKE 'cli:p4b2:%')=1
subs=[{"submission_id":"1","job_id":"3","worker_uid":"970002","review_status":"pending","create_key":"cli:p4b2:submit:J3A"}]
jobs=[{"job_id":"2","status":"open","worker_uid":null},{"job_id":"3","status":"submitted","worker_uid":"970002"}]
```

## 9) 探针自曝（两处 node -e 自伤）

```
①  CAST(${","} AS text)  ->  NeonDbError: column ":" does not exist (42703)
②  ":" 当 SQL 字面量     ->  NeonDbError: column ":" does not exist (42703)
修法：chr(58)/chr(44) 拼接。两次均发生在写产物之前，未污染任何读数。
```

# P6-TR-1c-FIX2 applyI18n 分母修正 离线用例（20261001T050427Z）

- 真源：`backend-ts/src/database.ts` `applyI18n()`（直接 import，非复刻）
- 合计 **11** 例：**PASS 11 / FAIL 0**

| id | group | pass | expect | actual | note |
|---|---|---|---|---|---|
| M1 | empty-source-excluded | PASS | ready | ready | 空描述源不计入分母（原样 ⇒ partial） |
| M1b | empty-source-excluded | PASS | T-title-en / "" | T-title-en / "" | 非空源用译文；空源回落空串 |
| M2 | all-empty-source-vacuous-ready | PASS | 键在且值=ready | hasKey=true value=ready | total===0 ⇒ 真空态 ready（前端对 ready / 键缺省处理一致 ⇒ 不显示小标） |
| M2b | all-empty-source-vacuous-ready | PASS | title_en 键在、值为空串 | hasKey=true value="" | 空源 + 无译文 ⇒ 回落空串（唯一例外，本单未改） |
| M2c | all-empty-source-vacuous-ready | PASS | ready / T-title-en | ready / T-title-en | 空源格仍取已有译文（值不为空串）；分母修正只管计数 |
| M3 | partial-preserved | PASS | partial | partial | 有源未翻的字段仍计入分母 ⇒ 原语义保住 |
| M3b | partial-preserved | PASS | 需要经验 | 需要经验 | 有源未翻 ⇒ 回落源文 |
| M4 | never-empty-string | PASS | 6/6 非空串 | ["招聘服务员","需要经验","招聘服务员","需要经验","招聘服务员","需要经验"] | 索引缺省 ⇒ 全部回落源文、永不空串 |
| M4b | never-empty-string | PASS | pending | pending | 一个译文也没有 ⇒ pending（未变） |
| M5 | listing-empty-source | PASS | ready | ready | listing 空 description 同理剔除 |
| M6 | listing-partial | PASS | partial | partial | listing 真 partial 保住 |

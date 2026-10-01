# P6-TR-1c-FIX2 applyI18n 分母修正 离线用例（20261001T050217Z）

- 真源：`backend-ts/src/database.ts` `applyI18n()`（直接 import，非复刻）
- 合计 **10** 例：**PASS 9 / FAIL 1**

| id | group | pass | expect | actual | note |
|---|---|---|---|---|---|
| M1 | empty-source-excluded | PASS | ready | ready | 空描述源不计入分母（原样 ⇒ partial） |
| M1b | empty-source-excluded | PASS | T-title-en / "" | T-title-en / "" | 非空源用译文；空源回落空串 |
| M2 | all-empty-source-no-key | PASS | 键缺省 | 键缺省 | total===0 ⇒ 不输出 i18n_status（前端不显示小标） |
| M2b | all-empty-source-no-key | FAIL | title_en 键在、值为空串 | hasKey=true value="T-title-en" | 空源回落空串 = 契约唯一例外（键形态不变） |
| M3 | partial-preserved | PASS | partial | partial | 有源未翻的字段仍计入分母 ⇒ 原语义保住 |
| M3b | partial-preserved | PASS | 需要经验 | 需要经验 | 有源未翻 ⇒ 回落源文 |
| M4 | never-empty-string | PASS | 6/6 非空串 | ["招聘服务员","需要经验","招聘服务员","需要经验","招聘服务员","需要经验"] | 索引缺省 ⇒ 全部回落源文、永不空串 |
| M4b | never-empty-string | PASS | pending | pending | 一个译文也没有 ⇒ pending（未变） |
| M5 | listing-empty-source | PASS | ready | ready | listing 空 description 同理剔除 |
| M6 | listing-partial | PASS | partial | partial | listing 真 partial 保住 |

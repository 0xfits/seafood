// ============================================================================
// src/verb-shape.ts — 业务 verb 的统一错误/结果形状（R107）· **无领域语义**
// ============================================================================
// 由来：2026-10-21 job 域下线（migration 0070）。原 `job-service.ts` 承载三类东西：
//   ① 招工 verb（submitWork / applyToJob / acceptApplication）—— 随 job 域一并删除；
//   ② 创建键解析（resolveJobCreateKey）—— 仅招工写口使用，同删；
//   ③ **共享形状助手**（`ledgerErrorBody` / `sendGone` / `sendVerbError` / Verb 结果类型）
//      —— listing / currency / market / project / campaign / compliance 等**多域**在 import
//      （现取 9 个文件）⇒ 按 Kevin 裁定「保留被其它面引用的纯函数」抽出到本文件。
//
// 本文件零 DB、零 job 语义：只做响应体拼装与类型收敛。
// ============================================================================
import type { Response } from 'express';

// ---- R107 错误体（§3.3-1：{error:{code,message,i18n_key,details}}）-----------
// ★ A5 收口：i18n 域扩展 'msg' / 'tg'（MSG_* / TG_* 新码域，route 册 §41.5；既有 'ledger' / 'auth' 不变）。
export const ledgerErrorBody = (
  code: string,
  message: string,
  details: Record<string, unknown>,
  i18nDomain: 'ledger' | 'auth' | 'msg' | 'tg' = 'ledger',
) => ({
  error: {
    code,
    message,
    i18n_key: `${i18nDomain}.err.${code}`,
    details,
  },
});

/** `410` 弃用面（§5.1 统一要求：形状对齐 R107，code = LEDGER_REF_NOT_FOUND，**必须**登记过期日） */
export const sendGone = (res: Response, refId: string, sunset: string) =>
  res.status(410).json(ledgerErrorBody(
    'LEDGER_REF_NOT_FOUND',
    `endpoint deprecated: ${refId}`,
    { ref_type: 'endpoint', ref_id: refId, http_status: 410, sunset },
  ));

// ---- 业务 verb 结果（§3.2 逐码）---------------------------------------------
export interface VerbOk {
  ok: true;
  replay: boolean;
  view: Record<string, unknown>;
}

export interface VerbErr {
  ok: false;
  status: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
  authDomain?: boolean;
}

export type VerbResult = VerbOk | VerbErr;

/** 路由层统一出口：400/404/409 → ledger 域码；403 → AUTH_FORBIDDEN（§3.3-6：auth 键独立域） */
export const sendVerbError = (res: Response, err: VerbErr) =>
  res.status(err.status).json(ledgerErrorBody(err.code, err.message, err.details, err.authDomain ? 'auth' : 'ledger'));

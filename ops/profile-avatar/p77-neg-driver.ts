/**
 * p77-neg-driver · 负控子进程（`backend-ts/scripts/p77-00-profile-avatar-gate.ts` F1 专用）
 * -------------------------------------------------------------------------------------------
 * 职责：加载「路由里的 `USER_AVATAR_URL_PATTERN` 已短路成 `/^[\s\S]*$/`」的 mutant 入口
 *   `backend-ts/src/index.p77neg.ts`（由门在运行前生成、跑完即删）并起 HTTP
 *   （端口取 env P77_NEG_PORT，**只许 5793–5799 段** —— p7b-lib 自起实例纪律）。
 * VERCEL=1 ⇒ index 不自 listen；由本驱动显式 `app.listen(port)`。
 * 判据不在本进程：门（父进程）对 5796 真跑六类非法形态，断言「字符串五类不再 400」
 *   ⇒ C 段谓词必红 ⇒ 证明 C 绿是真由形态闸驱动。
 * 运行：cd backend-ts && P77_NEG_PORT=5796 \
 *        npx ts-node --transpile-only ../ops/profile-avatar/p77-neg-driver.ts
 */
process.env.VERCEL = '1';

const port = Number(process.env.P77_NEG_PORT || 5796);
if (!Number.isInteger(port) || port < 5793 || port > 5799) {
  throw new Error(`P77_NEG_PORT must be in 5793..5799, got ${port}`);
}

import('../../backend-ts/src/index.p77neg')
  .then((mod: { default: { listen: (port: number) => unknown } }) => {
    mod.default.listen(port);
    console.log(`P77_NEG_READY ${port}`);
  })
  .catch((e: unknown) => {
    console.error('P77_NEG_DRIVER_FAILED', e);
    process.exit(2);
  });

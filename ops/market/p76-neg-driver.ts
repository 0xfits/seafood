/**
 * p76-neg-driver · 负控子进程（p76-00-taker-match-gate.ts N1 专用）
 * ---------------------------------------------------------------------------
 * 职责：加载「路由里的 matchTakerOrderLoop 调用已注掉」的 mutant 入口
 *   `backend-ts/src/index.p76neg.ts`（由门在运行前生成、跑完即删）并起 HTTP
 *   （端口取 env P76_NEG_PORT，**只许 5793–5799 段** —— p7b-lib 自起实例纪律）。
 * VERCEL=1 ⇒ index 不会自 listen；由本驱动显式 `app.listen(port)`。
 * 判据不在本进程：门（父进程）对 5797 真跑 S1 流，断言「无 matches ⇒ S1 必红」。
 * 运行：cd backend-ts && P76_NEG_PORT=5797 \
 *        npx ts-node --transpile-only ../ops/market/p76-neg-driver.ts
 */
process.env.VERCEL = '1';

const port = Number(process.env.P76_NEG_PORT || 5797);
if (!Number.isInteger(port) || port < 5793 || port > 5799) {
  throw new Error(`P76_NEG_PORT must be in 5793..5799, got ${port}`);
}

// mutant 入口（门生成；相对路径自本文件解析 ⇒ 与真 app 同一棵 src 树）
import('../../backend-ts/src/index.p76neg')
  .then((mod: { default: { listen: (port: number) => unknown } }) => {
    const app = mod.default;
    app.listen(port);
    console.log(`P76_NEG_READY ${port}`);
  })
  .catch((e: unknown) => {
    console.error('P76_NEG_DRIVER_FAILED', e);
    process.exit(2);
  });

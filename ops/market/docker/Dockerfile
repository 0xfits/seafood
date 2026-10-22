# syntax=docker/dockerfile:1
# ============================================================================
# seafood 做市机器人镜像（P1 托管化 · 无常驻 HTTP 业务，仅 /healthz 供平台探活）
#   构建（**上下文必须是仓库根**：下面 COPY 取 backend-ts/scripts/*.mjs）：
#     cd <repo root>
#     docker build -f ops/market/docker/Dockerfile -t seafood-mm .
#   运行（配置可整体走平台 secrets；也可把 mm.env 放卷里）：
#     docker run --rm -e MM_PRIVATE_KEY=0x… -e MM_BASE_CID=4 -e MM_HEALTH_PORT=8080 \
#       -v mm_data:/data seafood-mm
#   急停：docker exec <cid> node market-mm-kill.mjs --env /data/mm.env --dry-run（先演练）
# ============================================================================
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# 运行期唯一依赖：ethers（MM 登录要 personal_sign；node 内置 crypto 不做可恢复签名）
# 固定版本 ⇒ 无 lockfile 也不会漂移；无 devDeps ⇒ 镜像只多 ~1 层 node_modules
COPY ops/market/docker/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# 只拷 3 个 mjs：决策核（纯函数）/ 长跑 bot / 急停
COPY backend-ts/scripts/market-mm-quotes.mjs ./market-mm-quotes.mjs
COPY backend-ts/scripts/market-mm-bot.mjs ./market-mm-bot.mjs
COPY backend-ts/scripts/market-mm-kill.mjs ./market-mm-kill.mjs

# /data = state + metrics + kill flag + 可选 mm.env（托管平台挂 volume）
RUN mkdir -p /data && chown -R node:node /app /data
USER node

# 探活：读本地 state/指标（age > MM_STATUS_MAX_AGE_S ⇒ 非 200 ⇒ unhealthy）
# 需要 MM_HEALTH_PORT（fly.toml 已置 8080）；未开探活端口时此检查不适用
HEALTHCHECK --interval=60s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MM_HEALTH_PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "market-mm-bot.mjs", "--env", "/data/mm.env"]

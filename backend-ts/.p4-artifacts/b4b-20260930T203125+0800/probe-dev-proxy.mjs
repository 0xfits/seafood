// P4-B4b-i · 必验②探针：前端 dev server 能起 + 能经 vite 代理拉到后端 `/api/home`
// §5.7 硬口径：本机无 `timeout`/`gtimeout` ⇒ **限时由本脚本自管**（AbortController + 轮询预算）；
// **禁 `pkill`/`killall`** ⇒ 只 kill 自己 spawn 的 child（PID 精确），且 SIGTERM 后仍在者补 SIGKILL
// （**不留常驻进程**）。既有 5787 会话（他会话）**不动**：本脚本另起 5797。
import { spawn } from 'node:child_process'

const FRONTEND = '/Users/kevin/bistro/seafood/frontend'
const BACKEND = '/Users/kevin/bistro/seafood/backend-ts'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const httpGet = async (url, timeoutMs = 10000) => {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ac.signal })
    const body = await res.text()
    return { url, status: res.status, bytes: body.length, body_head: body.slice(0, 180) }
  } catch (e) {
    return { url, status: null, error: String(e?.message || e) }
  } finally {
    clearTimeout(timer)
  }
}

const waitFor = async (url, budgetMs) => {
  const t0 = Date.now()
  let last = null
  while (Date.now() - t0 < budgetMs) {
    const r = await httpGet(url, 5000)
    if (r.status) return { url, status: r.status, waited_ms: Date.now() - t0, body_head: r.body_head }
    last = r.error
    await sleep(600)
  }
  return { url, status: null, waited_ms: Date.now() - t0, last_error: last }
}

const children = []
const spawnLogged = (cmd, args, cwd) => {
  // ★ 自曝修正（首次运行的读数暴露缺陷）：`npx` 是 wrapper ⇒ SIGTERM/SIGKILL 打到 wrapper，
  //   真正的 `node …/ts-node|vite` 会**被 init 收养**（PPID=1）而继续监听端口。
  //   正解 = `detached: true` 建**进程组** ⇒ 收尾时 `process.kill(-pid)` 打整组。
  const child = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    detached: true,
  })
  const buf = []
  child.stdout.on('data', (d) => buf.push(String(d)))
  child.stderr.on('data', (d) => buf.push(String(d)))
  child.logTail = (n = 500) => buf.join('').slice(-n)
  children.push(child)
  return child
}

const killGroup = (child, signal) => {
  try { process.kill(-child.pid, signal); return true } catch { /* noop */ }
  try { child.kill(signal); return true } catch { return false }
}

const results = { run: process.argv[2] || null, steps: [] }
const backend = spawnLogged('npx', ['ts-node', 'src/index.ts'], BACKEND)
const vite = spawnLogged('npx', ['vite', '--port', '5797', '--strictPort', '--host', '127.0.0.1'], FRONTEND)

try {
  const be = await waitFor('http://127.0.0.1:5788/api/home', 90000)
  results.steps.push({ step: 'backend_direct_api_home', ...be })

  const feRoot = await waitFor('http://127.0.0.1:5797/', 60000)
  results.steps.push({ step: 'vite_dev_server_root', ...feRoot })

  const viaProxy = await httpGet('http://127.0.0.1:5797/api/home', 10000)
  results.steps.push({ step: 'vite_proxy_api_home', ...viaProxy })

  results.backend_start_log = backend.logTail(600)
  results.vite_start_log = vite.logTail(400)
} catch (e) {
  results.probe_error = String(e?.message || e)
} finally {
  for (const c of children) killGroup(c, 'SIGTERM')
  await sleep(1500)
  const stubborn = children.filter((c) => c.exitCode === null)
  for (const c of stubborn) killGroup(c, 'SIGKILL')
  results.orphans_killed_sigkill = stubborn.map((c) => c.pid)
  await sleep(500)
  results.children_exit_codes = children.map((c) => ({ pid: c.pid, exit_code: c.exitCode, signal: c.signalCode }))
}

console.log(JSON.stringify(results, null, 2))
process.exit(0)

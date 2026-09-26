#!/usr/bin/env node
// Checks a running WebView2 (started with --remote-debugging-port) through the
// Chrome DevTools Protocol, without injecting anything into the page: reloads
// once start-up work has settled, then reports CSP violations, exceptions and
// console warnings/errors, plus a few facts. Exit 1 if there are problems.
// Usage: node scripts/perf/cdp-check.mjs [port=9229]
const port = process.argv[2] ?? '9229'
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')
if (!page) throw new Error('no page target')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))

let id = 0
const pending = new Map()
const events = []
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method) events.push(msg)
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id
    pending.set(i, resolve)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')
await sleep(6000) // let start-up requests finish, so the reload doesn't interrupt them
await send('Page.reload', { ignoreCache: true })
await sleep(8000)

const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value
const facts = {
  origin: await evaluate('location.origin'),
  prototypeFrozen: await evaluate('Object.isFrozen(Object.prototype)'),
  rendered: await evaluate('document.body.innerText.length > 0'),
}
const problems = events
  .filter(
    (e) =>
      (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)) ||
      e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type)),
  )
  .map((e) =>
    e.method === 'Log.entryAdded'
      ? `[${e.params.entry.source}] ${e.params.entry.text}`
      : e.method === 'Runtime.exceptionThrown'
        ? `[exception] ${e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text}`
        : `[console.${e.params.type}] ${e.params.args.map((a) => a.value ?? a.description).join(' ')}`,
  )
console.log(JSON.stringify({ facts, problems }, null, 2))
ws.close()
process.exit(problems.length ? 1 : 0)

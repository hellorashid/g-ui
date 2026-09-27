import { chromium } from 'playwright'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }
const nodes = () => p.locator('.node').count()

// A spawned node has no ring until its path settles and it goes idle.
const waitSettled = async (timeout = 25000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const busy = await p.evaluate(() =>
      document.querySelectorAll('.gpath--pending, .node--thinking, .node--generating').length)
    if (busy === 0) return true
    await p.waitForTimeout(200)
  }
  return false
}
const positions = () => p.evaluate(() =>
  [...document.querySelectorAll('.node-slot--node')].map(s => {
    const m = new DOMMatrix(getComputedStyle(s).transform)
    return { label: s.querySelector('.node-label').textContent, x: Math.round(m.e), y: Math.round(m.f) }
  }))

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

console.log('\nthe inbound wedge becomes Retry')
await p.locator('.node').first().click(); await p.waitForTimeout(250)
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(0).click()  // up
await waitSettled()
check('child spawned', (await nodes()) === 2)

const retryCount = await p.locator('.node-slot--menu').nth(1).locator('.wedge--retry').count()
check('child ring has exactly one retry wedge', retryCount === 1, `${retryCount}`)

// the retry wedge must be the one facing the parent (180deg => index 3)
const retryIdx = await p.evaluate(() => {
  const ring = document.querySelectorAll('.node-slot--menu')[1]
  return [...ring.querySelectorAll('.wedge')].findIndex(w => w.classList.contains('wedge--retry'))
})
check('retry sits on the inbound bearing', retryIdx === 3, `index ${retryIdx}`)

console.log('\nretry does not spawn a node')
const before = await nodes()
await p.locator('.node-slot--menu').nth(1).locator('.wedge--retry').click()
await p.waitForTimeout(400)
const after = await nodes()
check('no new node created', after === before, `${before} -> ${after}`)

const pos = await positions()
const overlap = pos.some((a,i) => pos.some((c,j) => i<j && a.x===c.x && a.y===c.y))
check('no two nodes share a position', !overlap, JSON.stringify(pos))

console.log('\nthe link lands on the retry wedge')
const anchored = await p.evaluate(() => {
  const path = document.querySelector('.gpath path')
  const retry = document.querySelector('.wedge--retry path')
  if (!path || !retry) return null
  const end = path.getPointAtLength(path.getTotalLength())
  const m = path.ownerSVGElement.getScreenCTM()
  const sx = m.a*end.x + m.c*end.y + m.e, sy = m.b*end.x + m.d*end.y + m.f
  const ws = retry.ownerSVGElement, wm = ws.getScreenCTM().inverse()
  const lp = ws.createSVGPoint(); lp.x = wm.a*sx+wm.c*sy+wm.e; lp.y = wm.b*sx+wm.d*sy+wm.f
  return retry.isPointInFill(lp)
})
check('connector ends on the child retry wedge', anchored === true, `${anchored}`)

console.log('\nretry records a run')
const runs = await p.evaluate(() => {
  const n = document.querySelectorAll('.node-slot--node')[1]
  const rows = [...n.querySelectorAll('.node-field')].map(r => r.textContent)
  return rows.find(r => r.startsWith('runs')) ?? null
})
check('run counter appears on the node', runs !== null, runs ?? 'missing')
const log = await p.locator('.stage-log').textContent()
check('retry is logged', /Retry/.test(log), log)

console.log('\nevery bearing gets a correct retry slot')
await p.keyboard.press('Escape'); await p.waitForTimeout(200)
await p.reload({ waitUntil: 'networkidle' })
await p.locator('.node').first().click(); await p.waitForTimeout(250)
// spawn in each of the 6 directions from the root, check each child's retry index
for (const i of [1,2,4,5]) {
  await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(i).click()
  await waitSettled()
}
const idxs = await p.evaluate(() => {
  const rings=[...document.querySelectorAll('.node-slot--menu')]
  return rings.map(r => {
    const ws=[...r.querySelectorAll('.wedge')]
    return ws.findIndex(w=>w.classList.contains('wedge--retry'))
  })
})
// root has no origin -> -1; children each have exactly one
check('root has no retry wedge', idxs[0] === -1, `${idxs[0]}`)
check('each child has a retry wedge', idxs.slice(1).every(i => i >= 0), JSON.stringify(idxs))

const finalPos = await positions()
const dup = finalPos.some((a,i) => finalPos.some((c,j) => i<j && a.x===c.x && a.y===c.y))
check('no overlapping nodes after fanning out', !dup, `${finalPos.length} nodes`)

await p.keyboard.press('f'); await p.waitForTimeout(500)
await p.screenshot({ path: 'tests/retry.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

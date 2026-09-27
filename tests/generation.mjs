import { chromium } from 'playwright'
import { seedGraph } from './helpers.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }

const dots = () => p.locator('.gpath').last().locator('.thought').count()
const pending = () => p.locator('.gpath--pending').count()

// A chain of n thoughts takes n x (1-3s); wait for the real signal
// rather than guessing a fixed budget.
const waitSettled = async (timeout = 25000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if ((await pending()) === 0) return true
    await p.waitForTimeout(250)
  }
  return false
}

await p.goto('http://localhost:5173/?speed=6', { waitUntil: 'networkidle' })
await seedGraph(p)
await p.locator('.node:not(.node--input)').first().click(); await p.waitForTimeout(250)

console.log('\na path starts empty and pending')
const t0 = Date.now()
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(2).click()  // transform, 6 thoughts
await p.waitForTimeout(150)
check('path exists immediately', (await p.locator('.gpath').count()) === 2,
  `${await p.locator('.gpath').count()} paths`)
check('no thoughts yet', (await dots()) === 0, `${await dots()} dots`)
check('path is marked pending', (await pending()) === 1)
check('target node is thinking', (await p.locator('.node--thinking').count()) === 1)

console.log('\nthoughts land one at a time')
const timeline = []
let last = 0
const deadline = Date.now() + 25000
while (Date.now() < deadline) {
  const n = await dots()
  if (n !== last) { timeline.push({ n, at: Date.now() - t0 }); last = n }
  if (n >= 6) break
  await p.waitForTimeout(150)
}
check('thoughts arrived incrementally', timeline.length >= 4,
  timeline.map(t => `${t.n}@${(t.at/1000).toFixed(1)}s`).join(' '))
check('landed one at a time', timeline.every((t,i) => i === 0 || t.n === timeline[i-1].n + 1),
  timeline.map(t => t.n).join(','))

const gaps = timeline.slice(1).map((t,i) => t.at - timeline[i].at)
// Running at speed=6, so the 1-3s window becomes ~167-500ms. Allow
// slack for sampling resolution at either end.
const inRange = gaps.every(g => g >= 100 && g <= 900)
check('gaps fall in the scaled 1-3s window', inRange,
  gaps.map(g => g + 'ms').join(' ') + ' (expect ~167-500ms at 6x)')

console.log('\nthe path settles when the chain completes')
const settledOk = await waitSettled()
check('path settles within its budget', settledOk)
check('all 6 thoughts present', (await dots()) === 6, `${await dots()}`)
check('path no longer pending', (await pending()) === 0)
check('node no longer thinking', (await p.locator('.node--thinking').count()) === 0)

console.log('\nthe path grows as thoughts arrive')
await p.keyboard.press('Escape'); await p.waitForTimeout(200)
await p.reload({ waitUntil: 'networkidle' })
await seedGraph(p)
await p.locator('.node:not(.node--input)').first().click(); await p.waitForTimeout(250)
// Distance of the newest node from the one it was spawned off.
const distTo = () => p.evaluate(() => {
  const slots = [...document.querySelectorAll('.node-slot--node')]
  if (slots.length < 2) return 0
  const at = e => { const m = new DOMMatrix(getComputedStyle(e).transform); return [m.e, m.f] }
  const [lx, ly] = at(slots[slots.length - 1])
  const [px, py] = at(slots[slots.length - 2])
  return Math.round(Math.hypot(lx - px, ly - py))
})
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(2).click()
await p.waitForTimeout(300)
const early = await distTo()
await waitSettled()
const settled = await distTo()
check('node pushes outward as the chain grows', settled > early, `${early}px -> ${settled}px`)

console.log('\nconcurrent paths generate independently')
await p.reload({ waitUntil: 'networkidle' })
await seedGraph(p)
await p.locator('.node:not(.node--input)').first().click(); await p.waitForTimeout(250)
// Spawn from the same ring twice. The first click re-renders the
// canvas, so re-target the parent's ring before the second.
const ring = () => p.locator('.node-slot--menu').first()
await ring().locator('.wedge').nth(2).click()  // 6 thoughts
await p.waitForTimeout(80)
// Avoid the retry wedge, which re-runs rather than spawning.
await ring().locator('.wedge:not(.wedge--retry)').nth(3).click()
await p.waitForTimeout(80)
check('two paths pending at once', (await pending()) === 2, `${await pending()} pending`)
check('both settled', await waitSettled(), `${await pending()} still pending`)
const counts = await p.evaluate(() =>
  [...document.querySelectorAll('.gpath')].map(g => g.querySelectorAll('.thought').length).sort((a,b)=>a-b))
// The seeded output path plus the two spawned here.
check('each got its own full chain', counts.length === 3 && counts.includes(6),
  JSON.stringify(counts))

await p.keyboard.press('f'); await p.waitForTimeout(600)
await p.screenshot({ path: 'tests/generation.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

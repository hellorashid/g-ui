import { chromium } from 'playwright'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }

const dots = () => p.locator('.thought').count()
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

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await p.locator('.node').first().click(); await p.waitForTimeout(250)

console.log('\na path starts empty and pending')
const t0 = Date.now()
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(2).click()  // transform, 6 thoughts
await p.waitForTimeout(150)
check('path exists immediately', (await p.locator('.gpath').count()) === 1)
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
const inRange = gaps.every(g => g >= 800 && g <= 3600)
check('gaps fall in the 1-3s window', inRange, gaps.map(g => (g/1000).toFixed(1)+'s').join(' '))

console.log('\nthe path settles when the chain completes')
const settledOk = await waitSettled()
check('path settles within its budget', settledOk)
check('all 6 thoughts present', (await dots()) === 6, `${await dots()}`)
check('path no longer pending', (await pending()) === 0)
check('node no longer thinking', (await p.locator('.node--thinking').count()) === 0)

console.log('\nthe path grows as thoughts arrive')
await p.keyboard.press('Escape'); await p.waitForTimeout(200)
await p.reload({ waitUntil: 'networkidle' })
await p.locator('.node').first().click(); await p.waitForTimeout(250)
const distTo = () => p.evaluate(() => {
  const s = document.querySelectorAll('.node-slot--node')[1]
  if (!s) return 0
  const m = new DOMMatrix(getComputedStyle(s).transform)
  return Math.round(Math.hypot(m.e, m.f))
})
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(2).click()
await p.waitForTimeout(300)
const early = await distTo()
await waitSettled()
const settled = await distTo()
check('node pushes outward as the chain grows', settled > early, `${early}px -> ${settled}px`)

console.log('\nconcurrent paths generate independently')
await p.reload({ waitUntil: 'networkidle' })
await p.locator('.node').first().click(); await p.waitForTimeout(250)
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(0).click()
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(2).click()
await p.waitForTimeout(400)
check('two paths pending at once', (await pending()) === 2, `${await pending()}`)
check('both settled', await waitSettled(), `${await pending()} still pending`)
const counts = await p.evaluate(() =>
  [...document.querySelectorAll('.gpath')].map(g => g.querySelectorAll('.thought').length).sort())
check('each got its own full chain', JSON.stringify(counts) === '[2,6]', JSON.stringify(counts))

await p.keyboard.press('f'); await p.waitForTimeout(600)
await p.screenshot({ path: 'tests/generation.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

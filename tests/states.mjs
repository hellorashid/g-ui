import { chromium } from 'playwright'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }
const count = (sel) => p.locator(sel).count()

const waitFor = async (fn, timeout = 25000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) { if (await fn()) return true; await p.waitForTimeout(150) }
  return false
}

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await p.locator('.node').first().click(); await p.waitForTimeout(250)

console.log('\nthinking: small placeholder, no actions')
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(2).click()  // transform
await p.waitForTimeout(300)
check('child is thinking', (await count('.node--thinking')) === 1)
const size = await p.evaluate(() => {
  const el = document.querySelector('.node--thinking')
  return Math.round(el.getBoundingClientRect().width)
})
check('thinking node is small', size < 90, `${size}px wide (full node is 200px)`)
check('thinking node has a spinner', (await count('.node-spinner')) === 1)
check('only the parent ring is open', (await count('.node-slot--menu')) === 1,
  `${await count('.node-slot--menu')} rings`)

console.log('\nclicking a thinking node does nothing')
await p.locator('.node--thinking').click({ force: true }); await p.waitForTimeout(250)
check('still one ring after clicking it', (await count('.node-slot--menu')) === 1,
  `${await count('.node-slot--menu')} rings`)

console.log('\ngenerating: settled, actions not yet available')
const sawGenerating = await waitFor(async () => (await count('.node--generating')) === 1, 25000)
check('node enters the generating state', sawGenerating)
if (sawGenerating) {
  check('no ring while generating', (await count('.node-slot--menu')) === 1,
    `${await count('.node-slot--menu')} rings`)
  check('not thinking any more', (await count('.node--thinking')) === 0)
}

console.log('\nidle: actions appear')
const reachedIdle = await waitFor(async () =>
  (await count('.node--thinking')) === 0 && (await count('.node--generating')) === 0)
check('node reaches idle', reachedIdle)
check('ring now available', (await count('.node-slot--menu')) === 2,
  `${await count('.node-slot--menu')} rings`)
check('node is full size', await p.evaluate(() => {
  const els = [...document.querySelectorAll('.node')]
  return els.every(e => Math.round(e.getBoundingClientRect().width) === 200)
}), 'all nodes 200px')

console.log('\nthoughts appear on the path, not off it')
await p.reload({ waitUntil: 'networkidle' })
await p.locator('.node').first().click(); await p.waitForTimeout(250)
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(2).click()
await waitFor(async () => (await count('.thought')) >= 1)
// Sample the dot's position repeatedly during its entry animation.
const drift = await p.evaluate(async () => {
  const NUM = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi
  const g = document.querySelector('.thought')
  const read = () => {
    const m = g.getAttribute('transform').match(NUM).map(Number)
    const dot = g.querySelector('.thought-dot').getBoundingClientRect()
    return { tx: m[0], ty: m[1], cx: dot.left + dot.width/2, cy: dot.top + dot.height/2 }
  }
  const samples = []
  for (let i = 0; i < 8; i++) {
    samples.push(read())
    await new Promise(r => requestAnimationFrame(r))
  }
  // The dot's screen centre must not move while it animates in.
  const first = samples[0]
  return Math.max(...samples.map(s => Math.hypot(s.cx-first.cx, s.cy-first.cy)))
})
check('dot does not travel as it appears', drift < 1.5, `max drift ${drift.toFixed(2)}px`)

await p.screenshot({ path: 'tests/states.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

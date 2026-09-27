import { chromium } from 'playwright'
import { seedGraph } from './helpers.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }

// Paths generate progressively; wait for every chain to land.
const waitSettled = async (timeout = 25000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if ((await p.locator('.gpath--pending').count()) === 0) return true
    await p.waitForTimeout(250)
  }
  return false
}

await p.goto('http://localhost:5173/?speed=20', { waitUntil: 'networkidle' })
await seedGraph(p)
await p.locator('.node:not(.node--input)').first().click(); await p.waitForTimeout(250)
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(1).click()  // Inspect
await waitSettled()

console.log('\nthoughts render along the path')
const dots = await p.locator('.gpath').last().locator('.thought').count()
check('path has 3-4 thoughts', dots >= 3 && dots <= 4, `${dots} dots`)

const icons = await p.locator('.gpath').last().locator('.thought text').allTextContents()
check('each dot carries an icon', icons.every(i => i.trim().length > 0), JSON.stringify(icons))

console.log('\ndots sit on the path, in order, clear of the endpoints')
const geo = await p.evaluate(() => {
  const g = [...document.querySelectorAll('.gpath')].pop()
  const path = g.querySelector('path')
  const NUM = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi
  const d = path.getAttribute('d').match(NUM).map(Number)
  const [x1,y1,x2,y2] = d
  const pts = [...g.querySelectorAll('.thought')].map(g => {
    const m = g.getAttribute('transform').match(NUM).map(Number)
    return { x: m[0], y: m[1] }
  })
  const len = Math.hypot(x2-x1, y2-y1)
  // distance of each dot from the start, and perpendicular offset from the line
  return pts.map(pt => {
    const along = ((pt.x-x1)*(x2-x1) + (pt.y-y1)*(y2-y1)) / len
    const perp = Math.abs((pt.x-x1)*(y2-y1) - (pt.y-y1)*(x2-x1)) / len
    return { along: +along.toFixed(1), perp: +perp.toFixed(3) }
  }).concat([{ len: +len.toFixed(1) }])
})
const spans = geo.slice(0, -1)
const len = geo[geo.length-1].len
check('all dots lie on the line', spans.every(s => s.perp < 0.01), `max perp ${Math.max(...spans.map(s=>s.perp))}`)
check('dots are in order', spans.every((s,i) => i===0 || s.along > spans[i-1].along), JSON.stringify(spans.map(s=>s.along)))
check('dots clear both endpoints', spans[0].along > 5 && spans[spans.length-1].along < len-5,
  `first ${spans[0].along}, last ${spans[spans.length-1].along}, len ${len}`)

console.log('\nhovering a dot shows its tooltip')
check('no tooltip initially', (await p.locator('.thought-tip').count()) === 0)
await p.locator('.gpath').last().locator('.thought').nth(1).hover()
await p.waitForTimeout(250)
check('tooltip appears on hover', (await p.locator('.thought-tip').count()) === 1)
const kind = (await p.locator('.thought-tip-kind').textContent()).trim()
const text = (await p.locator('.thought-tip-text').textContent()).trim()
check('tooltip names the thought type', kind.length > 1, kind)
check('tooltip carries a description', text.length > 10, text.slice(0,50)+'…')

await p.mouse.move(40, 900); await p.waitForTimeout(250)
check('tooltip hides on leave', (await p.locator('.thought-tip').count()) === 0)

console.log('\nchains differ per action')
await p.locator('.node:not(.node--input)').first().click(); await p.waitForTimeout(200)
await p.locator('.node:not(.node--input)').first().click(); await p.waitForTimeout(200)
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(4).click()  // Filter
await waitSettled()
const perPath = await p.evaluate(() =>
  [...document.querySelectorAll('.gpath')].map(g => g.querySelectorAll('.thought').length))
check('every path has its own chain', perPath.length === 3 && perPath.every(n => n >= 2), JSON.stringify(perPath))

console.log('\npath length grows with the chain')
await p.keyboard.press('Escape'); await p.waitForTimeout(200)
await p.reload({ waitUntil: 'networkidle' })
await seedGraph(p)
await p.locator('.node:not(.node--input)').first().click(); await p.waitForTimeout(250)
for (const i of [0,1,2,4]) {
  await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(i).click()
  await p.waitForTimeout(280)
}
await waitSettled()
const runs = await p.evaluate(() => {
  const NUM = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi
  const at = e => { const m = new DOMMatrix(getComputedStyle(e).transform); return [m.e, m.f] }
  const slots = [...document.querySelectorAll('.node-slot--node')].map(at)
  const near = (x, y) => slots.reduce((b, p) =>
    Math.hypot(p[0]-x, p[1]-y) < Math.hypot(b[0]-x, b[1]-y) ? p : b, slots[0])
  return [...document.querySelectorAll('.gpath')].map(g => {
    const [x1, y1, x2, y2] = g.querySelector('path').getAttribute('d').match(NUM).map(Number)
    const a = near(x1, y1), b = near(x2, y2)
    // Centre-to-centre span of this path alone, so branches are comparable.
    return { thoughts: g.querySelectorAll('.thought').length,
             dist: Math.round(Math.hypot(b[0]-a[0], b[1]-a[1])) }
  }).sort((a, b) => a.thoughts - b.thoughts)
})
check('chains vary in length', new Set(runs.map(r=>r.thoughts)).size >= 3,
  JSON.stringify(runs.map(r=>r.thoughts)))
check('more thoughts means a longer path',
  runs.every((r,i) => i === 0 || r.dist > runs[i-1].dist),
  runs.map(r => `${r.thoughts}t=${r.dist}px`).join(' '))
// Compare consecutive pairs: each extra thought adds one PER_THOUGHT.
const steps = runs.slice(1).map((r, i) =>
  (r.dist - runs[i].dist) / (r.thoughts - runs[i].thoughts))
check('each thought adds a consistent length',
  steps.every(s => Math.abs(s - 26) < 1.5),
  steps.map(s => s.toFixed(1)).join(', ') + 'px per thought')

await p.keyboard.press('f'); await p.waitForTimeout(550)
await p.locator('.gpath').last().locator('.thought').nth(1).hover(); await p.waitForTimeout(300)
await p.screenshot({ path: 'tests/thoughts.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

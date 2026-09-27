import { chromium } from 'playwright'
import { seedGraph } from './helpers.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }

// Paths generate progressively; measure only once they have settled.
const waitSettled = async (timeout = 25000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if ((await p.locator('.gpath--pending').count()) === 0) return true
    await p.waitForTimeout(250)
  }
  return false
}

const positions = () => p.evaluate(() =>
  Object.fromEntries([...document.querySelectorAll('.node-slot--node')].map(s => {
    const m = new DOMMatrix(getComputedStyle(s).transform)
    return [s.querySelector('.node-label').textContent, [Math.round(m.e), Math.round(m.f)]]
  })))

// Drive a labelled slider to an exact value.
// The sidebar starts collapsed; open it before reaching for a slider.
const openPanel = async () => {
  if ((await p.locator('.sidebar--collapsed').count()) > 0) {
    await p.locator('.sidebar--collapsed .icon-btn').first().click()
    await p.waitForTimeout(200)
  }
}

const setSlider = async (label, v) => {
  await openPanel()
  const field = p.locator('.field', { has: p.locator('.field-label', { hasText: label }) })
  await field.locator('input[type=range]').evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
  await p.waitForTimeout(250)
  return (await field.locator('.field-value').textContent()).trim()
}

await p.goto('http://localhost:5173/?speed=20', { waitUntil: 'networkidle' })
await seedGraph(p)
await p.locator('.node:not(.node--input)').first().click(); await p.waitForTimeout(250)
// Skip the retry wedge, which re-runs instead of spawning.
await p.locator('.node-slot--menu').first().locator('.wedge:not(.wedge--retry)').first().click()
await waitSettled()

// Layout constants, mirrored from src/layout.ts.
const NODE_R = 100, MENU_R = 180, BASE = 3, PER = 26
// The path just created, and the span it should produce.
const thoughts = await p.locator('.gpath').last().locator('.thought').count()

/** Centre-to-centre span of the newest path, independent of origin. */
const span = () => p.evaluate(() => {
  const NUM = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi
  const at = e => { const m = new DOMMatrix(getComputedStyle(e).transform); return [m.e, m.f] }
  const slots = [...document.querySelectorAll('.node-slot--node')].map(at)
  const near = (x, y) => slots.reduce((b, q) =>
    Math.hypot(q[0]-x, q[1]-y) < Math.hypot(b[0]-x, b[1]-y) ? q : b, slots[0])
  const g = [...document.querySelectorAll('.gpath')].pop()
  const [x1, y1, x2, y2] = g.querySelector('path').getAttribute('d').match(NUM).map(Number)
  const a = near(x1, y1), b = near(x2, y2)
  return Math.round(Math.hypot(b[0]-a[0], b[1]-a[1]))
})
// reach = menuRadius + nodeRadius + gapFor(thoughts, spawnGap)
const reachAt = (gap, nodeR = NODE_R) =>
  MENU_R + nodeR + Math.max(90, gap + (thoughts - BASE) * PER)

console.log('\nspawn gap moves existing nodes')
const shown190 = await setSlider('Spawn gap', 190)
const at190 = await span()
check('label reflects the value', shown190 === '190px', shown190)
check('child sits at the computed reach', at190 === reachAt(190),
  `${at190} vs ${reachAt(190)} (${thoughts} thoughts)`)

const shown320 = await setSlider('Spawn gap', 320)
const at320 = await span()
check('label updates', shown320 === '320px', shown320)
check('EXISTING node re-flows with the slider', at320 === reachAt(320),
  `${at190} -> ${at320} (expect ${reachAt(320)})`)

const shown120 = await setSlider('Spawn gap', 120)
const at120 = await span()
check('slider pulls nodes back in', at120 === reachAt(120),
  `${at320} -> ${at120} (expect ${reachAt(120)})`)

console.log('\nnode radius also re-flows the graph')
await setSlider('Spawn gap', 190)
const beforeR = await span()
await setSlider('Node radius', 140)
const afterR = await span()
check('larger nodes push children out', afterR > beforeR, `${beforeR} -> ${afterR}`)
await setSlider('Node radius', NODE_R)

console.log('\ndeep chains stay consistent')
// Branch again so the graph is three deep, then check the invariant
// on every path at once: span == menu + node + gap(its own thoughts).
// Bring everything on screen first; a node under the sidebar or off
// the viewport cannot be clicked.
await p.keyboard.press('f'); await p.waitForTimeout(600)
await p.locator('.node:not(.node--input)').last().click({ force: true })
await p.waitForTimeout(300)
await p.locator('.node-slot--menu').last().locator('.wedge:not(.wedge--retry)').first().click()
await waitSettled()

const allSpans = () => p.evaluate(() => {
  const NUM = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi
  const at = e => { const m = new DOMMatrix(getComputedStyle(e).transform); return [m.e, m.f] }
  const slots = [...document.querySelectorAll('.node-slot--node')].map(at)
  const near = (x, y) => slots.reduce((b, q) =>
    Math.hypot(q[0]-x, q[1]-y) < Math.hypot(b[0]-x, b[1]-y) ? q : b, slots[0])
  return [...document.querySelectorAll('.gpath')].map(g => {
    const [x1, y1, x2, y2] = g.querySelector('path').getAttribute('d').match(NUM).map(Number)
    const a = near(x1, y1), b = near(x2, y2)
    return { thoughts: g.querySelectorAll('.thought').length,
             span: Math.round(Math.hypot(b[0]-a[0], b[1]-a[1])) }
  })
})

await setSlider('Spawn gap', 190)
const chain = await allSpans()
check('the graph has several paths', chain.length >= 2, `${chain.length} paths`)
check('with differing chain lengths',
  new Set(chain.map(c => c.thoughts)).size >= 2,
  chain.map(c => c.thoughts + 't').join(' '))
const predicted = (t, gap) => MENU_R + NODE_R + Math.max(90, gap + (t - BASE) * PER)
check('every path spans its own thought count',
  chain.every(c => Math.abs(c.span - predicted(c.thoughts, 190)) <= 1),
  chain.map(c => `${c.thoughts}t=${c.span}(want ${predicted(c.thoughts,190)})`).join(' '))

await setSlider('Spawn gap', 260)
const moved = await allSpans()
check('whole chain re-flows together',
  moved.every(c => Math.abs(c.span - predicted(c.thoughts, 260)) <= 1),
  moved.map(c => `${c.thoughts}t=${c.span}`).join(' '))

await p.keyboard.press('f'); await p.waitForTimeout(500)
await p.screenshot({ path: 'tests/layout.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

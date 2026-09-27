import { chromium } from 'playwright'
import { seedGraph } from './helpers.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
const fails = []
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails.push(name)
}
// Paths generate progressively; the graph keeps re-flowing until
// every chain has landed, so settle before measuring positions.
const waitSettled = async (timeout = 25000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if ((await p.locator('.gpath--pending').count()) === 0) return true
    await p.waitForTimeout(250)
  }
  return false
}

const vp = () => p.evaluate(() => {
  const el = document.querySelector('.stage-surface')
  const m = new DOMMatrix(getComputedStyle(el).transform)
  return { x: +m.e.toFixed(1), y: +m.f.toFixed(1), zoom: +m.a.toFixed(3) }
})
const nodeCentre = (i = 0) => p.evaluate((i) => {
  const r = document.querySelectorAll('.node')[i].getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}, i)

await p.goto('http://localhost:5173/?speed=20', { waitUntil: 'networkidle' })
await seedGraph(p)

console.log('\nzoom')
const before = await vp()
check('starts at 1x', before.zoom === 1, JSON.stringify(before))

// ctrl+wheel = pinch zoom, anchored at the cursor
const anchor = { x: 400, y: 300 }
const worldBefore = await p.evaluate(({x,y}) => {
  const el=document.querySelector('.stage'); const r=el.getBoundingClientRect()
  const s=document.querySelector('.stage-surface'); const m=new DOMMatrix(getComputedStyle(s).transform)
  return { wx:(x-r.left-r.width/2-m.e)/m.a, wy:(y-r.top-r.height/2-m.f)/m.a }
}, anchor)
await p.mouse.move(anchor.x, anchor.y)
await p.keyboard.down('Control')
await p.mouse.wheel(0, -240)
await p.keyboard.up('Control')
await p.waitForTimeout(250)
const zoomed = await vp()
check('ctrl+wheel zooms in', zoomed.zoom > before.zoom, `${before.zoom} -> ${zoomed.zoom}`)

const worldAfter = await p.evaluate(({x,y}) => {
  const el=document.querySelector('.stage'); const r=el.getBoundingClientRect()
  const s=document.querySelector('.stage-surface'); const m=new DOMMatrix(getComputedStyle(s).transform)
  return { wx:(x-r.left-r.width/2-m.e)/m.a, wy:(y-r.top-r.height/2-m.f)/m.a }
}, anchor)
const drift = Math.hypot(worldAfter.wx-worldBefore.wx, worldAfter.wy-worldBefore.wy)
check('zoom anchored at cursor', drift < 1.5, `world drift ${drift.toFixed(2)}px`)

console.log('\npan')
await p.keyboard.press('0'); await p.waitForTimeout(400)
const p0 = await vp()
await p.mouse.move(300, 700); await p.mouse.down()
await p.mouse.move(420, 760, { steps: 8 }); await p.mouse.up()
await p.waitForTimeout(150)
const p1 = await vp()
check('drag pans the canvas', Math.abs(p1.x-p0.x) > 80 && Math.abs(p1.y-p0.y) > 30,
  `d=(${(p1.x-p0.x).toFixed(0)}, ${(p1.y-p0.y).toFixed(0)})`)

// wheel without modifier pans
const p2a = await vp()
await p.mouse.move(600, 400); await p.mouse.wheel(0, 120); await p.waitForTimeout(150)
const p2b = await vp()
check('wheel pans vertically', Math.abs(p2b.y - p2a.y) > 50, `dy=${(p2b.y-p2a.y).toFixed(0)}`)

console.log('\nreset + fit')
await p.keyboard.press('0'); await p.waitForTimeout(450)
const reset = await vp()
check('0 resets view', reset.zoom === 1 && Math.abs(reset.x) < 1 && Math.abs(reset.y) < 1, JSON.stringify(reset))

// build a graph that extends well past the viewport, then fit
await p.locator('.node:not(.node--input)').first().click(); await p.waitForSelector('.wedge')
// Pick distinct actions: re-picking a used one reveals its node
// instead of spawning a second.
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(1).click()
await waitSettled()
await p.locator('.node-slot--menu').nth(1).locator('.wedge').nth(2).click()
await waitSettled()
const n = await p.locator('.node').count()
check('graph grew', n === 4, `${n} nodes`)

await p.keyboard.press('f'); await p.waitForTimeout(500)
const fit = await vp()
const vis = await p.evaluate(() => {
  const f = document.querySelector('.stage').getBoundingClientRect()
  const fits = (r) => r.left >= f.left-1 && r.right <= f.right+1 && r.top >= f.top-1 && r.bottom <= f.bottom+1
  const nodes = [...document.querySelectorAll('.node')].map(e => e.getBoundingClientRect())
  const rings = [...document.querySelectorAll('.radial')].map(e => e.getBoundingClientRect())
  return { nodes: nodes.every(fits), rings: rings.every(fits),
           offNodes: nodes.filter(r=>!fits(r)).length, offRings: rings.filter(r=>!fits(r)).length }
})
check('F fits all nodes on screen', vis.nodes, `zoom ${fit.zoom}, ${vis.offNodes} off-screen`)
check('F fits open rings too', vis.rings, `${vis.offRings} rings off-screen`)

console.log('\nfocus')
await waitSettled()
await p.locator('.node').nth(2).dblclick(); await p.waitForTimeout(500)
const c = await nodeCentre(2)
const frame = await p.evaluate(() => { const r=document.querySelector('.stage').getBoundingClientRect()
  return { cx:r.left+r.width/2, cy:r.top+r.height/2 } })
const off = Math.hypot(c.x-frame.cx, c.y-frame.cy)
check('double-click centres a node', off < 3, `off by ${off.toFixed(1)}px`)

console.log('\nclamps')
await p.mouse.move(700, 450)
await p.keyboard.down('Control')
for (let i=0;i<40;i++) await p.mouse.wheel(0, 200)
await p.keyboard.up('Control'); await p.waitForTimeout(250)
const zmin = await vp()
check('zoom clamped at min', zmin.zoom >= 0.2 - 1e-6, `${zmin.zoom}`)
await p.keyboard.down('Control')
for (let i=0;i<60;i++) await p.mouse.wheel(0, -200)
await p.keyboard.up('Control'); await p.waitForTimeout(250)
const zmax = await vp()
check('zoom clamped at max', zmax.zoom <= 2.5 + 1e-6, `${zmax.zoom}`)

await p.keyboard.press('f'); await p.waitForTimeout(500)
await p.screenshot({ path: 'tests/viewport.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

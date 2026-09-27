import { chromium } from 'playwright'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }

const positions = () => p.evaluate(() =>
  Object.fromEntries([...document.querySelectorAll('.node-slot--node')].map(s => {
    const m = new DOMMatrix(getComputedStyle(s).transform)
    return [s.querySelector('.node-label').textContent, [Math.round(m.e), Math.round(m.f)]]
  })))

// Drive a labelled slider to an exact value.
const setSlider = async (label, v) => {
  const field = p.locator('.field', { has: p.locator('.field-label', { hasText: label }) })
  await field.locator('input[type=range]').evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
  await p.waitForTimeout(250)
  return (await field.locator('.field-value').textContent()).trim()
}

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await p.locator('.node').first().click(); await p.waitForTimeout(250)
await p.locator('.node-slot--menu').nth(0).locator('.wedge').nth(0).click()  // straight up
await p.waitForTimeout(350)

console.log('\nspawn gap moves existing nodes')
const shown190 = await setSlider('Spawn gap', 190)
const at190 = await positions()
check('label reflects the value', shown190 === '190px', shown190)
check('child at reach 440', at190.link[1] === -440, JSON.stringify(at190.link))

const shown320 = await setSlider('Spawn gap', 320)
const at320 = await positions()
check('label updates', shown320 === '320px', shown320)
check('EXISTING node re-flows with the slider', at320.link[1] === -570,
  `${at190.link[1]} -> ${at320.link[1]} (expect -570)`)

const shown120 = await setSlider('Spawn gap', 120)
const at120 = await positions()
check('slider pulls nodes back in', at120.link[1] === -370,
  `${at320.link[1]} -> ${at120.link[1]} (expect -370)`)

console.log('\nnode radius also re-flows the graph')
await setSlider('Spawn gap', 190)
const beforeR = (await positions()).link[1]
await setSlider('Node radius', 100)
const afterR = (await positions()).link[1]
check('larger nodes push children out', afterR < beforeR, `${beforeR} -> ${afterR}`)
await setSlider('Node radius', 72)

console.log('\ndeep chains stay consistent')
await p.locator('.node-slot--menu').nth(1).locator('.wedge').nth(1).click()
await p.waitForTimeout(350)
const chain = await positions()
check('three nodes placed', Object.keys(chain).length === 3, JSON.stringify(chain))
// grandchild = child + one reach along its own bearing
const reach = 178 + 72 + 190
const expX = Math.round(chain.link[0] + Math.cos((60-90)*Math.PI/180) * reach)
const expY = Math.round(chain.link[1] + Math.sin((60-90)*Math.PI/180) * reach)
const gk = Object.keys(chain).find(k => k !== 'input' && k !== 'link')
check('grandchild placed off its own parent', Math.abs(chain[gk][0]-expX) <= 1 && Math.abs(chain[gk][1]-expY) <= 1,
  `${JSON.stringify(chain[gk])} vs expected [${expX}, ${expY}]`)

await setSlider('Spawn gap', 260)
const moved = await positions()
check('whole chain re-flows together', moved[gk][1] !== chain[gk][1] && moved.link[1] !== chain.link[1],
  `link ${chain.link[1]}->${moved.link[1]}, leaf ${chain[gk][1]}->${moved[gk][1]}`)

await p.keyboard.press('f'); await p.waitForTimeout(500)
await p.screenshot({ path: 'tests/layout.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

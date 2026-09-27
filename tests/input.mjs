import { chromium } from 'playwright'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }
const count = (s) => p.locator(s).count()

const waitSettled = async (timeout = 20000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const busy = await p.evaluate(() =>
      document.querySelectorAll('.gpath--pending, .node--thinking, .node--generating').length)
    if (busy === 0) return true
    await p.waitForTimeout(100)
  }
  return false
}

await p.goto('http://localhost:5173/?speed=5', { waitUntil: 'networkidle' })

console.log('\nthe canvas starts with an input node')
check('one node', (await count('.node')) === 1, `${await count('.node')}`)
check('it is an input node', (await count('.node--input')) === 1)
check('it has a text field', (await count('.node-input')) === 1)
check('the field starts empty', (await p.locator('.node-input').inputValue()) === '')
check('no ring on an input node', (await count('.node-slot--menu')) === 0)

console.log('\nthe plus button creates another input')
check('plus button exists', (await count('.stage-add')) === 1)
await p.locator('.stage-add').click(); await p.waitForTimeout(500)
check('a second input appeared', (await count('.node--input')) === 2, `${await count('.node--input')}`)
const apart = await p.evaluate(() => {
  const pts = [...document.querySelectorAll('.node-slot--node')].map(s => {
    const m = new DOMMatrix(getComputedStyle(s).transform); return [m.e, m.f]
  })
  return Math.hypot(pts[1][0]-pts[0][0], pts[1][1]-pts[0][1])
})
check('inputs do not stack', apart > 200, `${Math.round(apart)}px apart`)

console.log('\ntyping a prompt and running it')
const field = p.locator('.node-input').first()
await field.click()
await field.fill('summarise the sensor feed')
check('field holds the text', (await field.inputValue()) === 'summarise the sensor feed')

const before = await count('.node')
await p.locator('.node-run').first().click()
await p.waitForTimeout(120)
check('running spawned an output node', (await count('.node')) === before + 1,
  `${before} -> ${await count('.node')}`)
check('the new node is thinking', (await count('.node--thinking')) === 1,
  `${await count('.node--thinking')}`)
check('a path is generating', (await count('.gpath--pending')) === 1,
  `${await count('.gpath--pending')}`)

console.log('\nthe output settles with actions')
check('everything settles', await waitSettled())
check('output node is full size', await p.evaluate(() => {
  const n = [...document.querySelectorAll('.node')].find(e => !e.classList.contains('node--input'))
  return Math.round(n.getBoundingClientRect().width) === 200
}))
check('its ring is available', (await count('.node-slot--menu')) === 1,
  `${await count('.node-slot--menu')} rings`)
check('the path carries thoughts', (await count('.thought')) >= 2, `${await count('.thought')}`)

console.log('\nEnter runs the prompt too')
await p.locator('.stage-add').click(); await p.waitForTimeout(400)
const fresh = p.locator('.node--input .node-input').last()
await fresh.click()
await fresh.fill('second prompt')
const n2 = await count('.node')
await fresh.press('Enter')
await p.waitForTimeout(400)
check('Enter spawned an output', (await count('.node')) === n2 + 1, `${n2} -> ${await count('.node')}`)

console.log('\nan empty prompt does nothing')
await p.locator('.stage-add').click(); await p.waitForTimeout(400)
const n3 = await count('.node')
const runBtn = p.locator('.node-run').last()
check('Run is disabled on an empty prompt',
  (await runBtn.getAttribute('aria-disabled')) === 'true')
// force past the disabled guard to prove the handler also refuses
await runBtn.click({ force: true }); await p.waitForTimeout(400)
check('empty prompt spawns nothing', (await count('.node')) === n3, `${n3} -> ${await count('.node')}`)

await waitSettled()
await p.keyboard.press('f'); await p.waitForTimeout(600)
await p.screenshot({ path: 'tests/input.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

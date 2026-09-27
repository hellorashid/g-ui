import { chromium } from 'playwright'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const fails = []
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails.push(name)
}
const rings = () => p.locator('.radial').count()

// A spawned node has no actions until its path settles and it reaches
// idle, so wait for generation before counting rings.
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
const nodes = () => p.locator('.node').count()
// Click a wedge belonging to the ring of node index `n`.
const wedge = async (n, i) => {
  const ring = p.locator('.node-slot--menu').nth(n)
  await ring.locator('.wedge').nth(i).click()
  await waitSettled()
}

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

console.log('\nrule 1: clicking a node opens its radial menu')
check('no rings initially', (await rings()) === 0)
await p.locator('.node').first().click(); await p.waitForTimeout(300)
check('click opens a ring', (await rings()) === 1, `${await rings()} rings`)

console.log('\nrule 2: selecting an action opens its connected node')
await wedge(0, 1)
check('spawned a node', (await nodes()) === 2, `${await nodes()} nodes`)
check('child ring opens once it settles', (await rings()) === 2, `${await rings()} rings`)

console.log('\nrule 3: selected items stay open; others hide')
// Open a third node from the child, then click a plain node.
await wedge(1, 2)
check('chain grew to 3', (await nodes()) === 3, `${await nodes()} nodes`)
const beforePins = await rings()
check('three rings open along the chain', beforePins === 3, `${beforePins} rings`)

// Which node owns each open ring, matched by slot transform.
const openOn = () => p.evaluate(() => {
  const slots = [...document.querySelectorAll('.node-slot--node')]
  const menus = [...document.querySelectorAll('.node-slot--menu')]
  const key = e => getComputedStyle(e).transform
  return menus.map(m => {
    const s = slots.find(s => key(s) === key(m))
    return s ? s.querySelector('.node-label').textContent : '?'
  })
})

// Clicking the ORIGINAL node drops the browsing ring, keeps the pinned ones.
await p.locator('.node').first().click(); await p.waitForTimeout(350)
const owners = await openOn()
check('clicking original keeps pinned rings', owners.length === 2, `open on ${JSON.stringify(owners)}`)
check('the two pinned rings are the ones with selections',
  owners.includes('input') && owners.includes('inspect'), JSON.stringify(owners))
check('the leaf browsing ring closed', !owners.includes('transform'), JSON.stringify(owners))

console.log('\nrule 4: re-selecting a used action reveals its node')
const before = await nodes()
await wedge(0, 1)   // same wedge as the first selection
const after = await nodes()
check('no duplicate node spawned', after === before, `${before} -> ${after}`)

console.log('\nescape clears everything')
await p.keyboard.press('Escape'); await p.waitForTimeout(250)
check('Escape closes all rings', (await rings()) === 0, `${await rings()} rings`)

await p.keyboard.press('f'); await p.waitForTimeout(500)
await p.screenshot({ path: 'tests/actions.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

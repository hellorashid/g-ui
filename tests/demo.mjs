import { chromium } from 'playwright'
import { waitSettled } from './helpers.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: CHROME })
const p = await b.newPage({ viewport: { width: 1700, height: 1050 } })
const fails = []
const check = (n, c, x='') => { console.log(`${c?'  ok  ':' FAIL '} ${n}${x?' — '+x:''}`); if(!c) fails.push(n) }
const count = (s) => p.locator(s).count()
const labels = () => p.evaluate(() =>
  [...document.querySelectorAll('.node-label')].map(e => e.textContent))

/** Click a wedge by its visible label. */
/** Bring the whole thread on screen; it grows past the viewport. */
const fit = async () => { await p.keyboard.press('f'); await p.waitForTimeout(650) }

/** Make sure the newest turn's ring is open. */
const openLast = async () => {
  await fit()
  if ((await p.locator('.node-slot--menu').count()) === 0) {
    await p.locator('.node:not(.node--input)').last().click({ force: true })
    await p.waitForTimeout(250)
  }
}

const pick = async (label) => {
  await openLast()
  const ring = p.locator('.node-slot--menu').last()
  const wedges = await ring.locator('.wedge').count()
  for (let i = 0; i < wedges; i++) {
    const w = ring.locator('.wedge').nth(i)
    await w.hover()
    await p.waitForTimeout(60)
    const shown = (await p.locator('.radial-label').textContent().catch(() => '')) ?? ''
    if (shown.trim() === label) { await w.click(); await waitSettled(p); return true }
  }
  return false
}

await p.goto('http://localhost:5173/?speed=20', { waitUntil: 'networkidle' })

console.log('\ntyping the trigger starts the scripted thread')
await p.locator('.stage-add').click(); await p.waitForTimeout(300)
const field = p.locator('.node-input').first()
await field.click(); await field.fill('order food')
await p.locator('.node-run').first().click()
await waitSettled(p)
check('first turn spawned', (await count('.node')) === 2, `${await count('.node')} nodes`)
check('it is the scripted opening', (await labels()).includes('order food'),
  JSON.stringify(await labels()))
check('the reply is shown on the node', (await count('.node-detail')) >= 1)

console.log('\nthe opening offers the scripted actions')
await openLast()
const wedgeCount = await p.locator('.node-slot--menu').last().locator('.wedge').count()
// Three scripted actions plus the retry wedge facing the input.
check('three actions plus retry', wedgeCount === 4, `${wedgeCount} wedges`)
const selfCount = await p.locator('.wedge--self').count()
check('one is marked self-serve', selfCount === 1, `${selfCount} self actions`)

console.log('\nhovering an action shows its phrasing')
await p.locator('.node-slot--menu').last().locator('.wedge--self').hover()
await p.waitForTimeout(200)
const detail = (await p.locator('.radial-detail').textContent()) ?? ''
check('tooltip carries the action text', detail.includes('connected food delivery'),
  detail.trim().slice(0, 60))

console.log('\nwalking the happy path to a placed order')
check('picked Check Connections', await pick('Check Connections'))
check('DoorDash turn appeared', (await labels()).includes('connections'),
  JSON.stringify(await labels()))

check('picked Use DoorDash', await pick('Use DoorDash'))
check('craving turn appeared', (await labels()).includes('craving'),
  JSON.stringify(await labels()))

check('picked Browse Thai Spots', await pick('Browse Thai Spots'))
check('restaurants turn appeared', (await labels()).includes('nearby'),
  JSON.stringify(await labels()))

check('picked Order Tofu Panang', await pick('Order Tofu Panang'))
const final = await labels()
check('order was placed', final.includes('ordered'), JSON.stringify(final))
const total = await p.evaluate(() =>
  [...document.querySelectorAll('.node-value')].map(e => e.textContent))
check('the placed order shows a total', total.includes('$18.40'), JSON.stringify(total))

console.log('\nthe thread is one connected chain')
const chain = await p.evaluate(() => ({
  nodes: document.querySelectorAll('.node').length,
  paths: document.querySelectorAll('.gpath').length,
  thoughts: document.querySelectorAll('.thought').length,
}))
check('five turns plus the input', chain.nodes === 6, JSON.stringify(chain))
check('each turn has its own path', chain.paths === 5, JSON.stringify(chain))
check('every path carries reasoning', chain.thoughts >= 15, `${chain.thoughts} thoughts`)

console.log('\nthe check email demo runs its own script')
await p.locator('.stage-add').click(); await p.waitForTimeout(300)
const ef = p.locator('.node-input').last()
await ef.click(); await ef.fill('check email')
await ef.press('Enter')
await waitSettled(p)
check('inbox turn spawned', (await labels()).includes('check email'),
  JSON.stringify(await labels()))
const inboxValue = await p.evaluate(() =>
  [...document.querySelectorAll('.node-value')].map(e => e.textContent))
check('it shows the unread count', inboxValue.includes('12 new'), JSON.stringify(inboxValue))

check('the inbox offers five actions', await p.evaluate(() =>
  [...document.querySelectorAll('.node-slot--menu')].pop()
    ?.querySelectorAll('.wedge:not(.wedge--retry)').length === 5),
  `${await p.locator('.wedge:not(.wedge--retry)').count()} non-retry wedges`)

// A deeper walk: inbox -> what needs me -> backstory -> root cause
// -> draft -> read it -> send.
check('picked Show What Needs Me', await pick('Show What Needs Me'))
check('urgent turn appeared', (await labels()).includes('needs you'),
  JSON.stringify(await labels()))
check('picked Get The Backstory', await pick('Get The Backstory'))
check('backstory turn appeared', (await labels()).includes('backstory'),
  JSON.stringify(await labels()))
check('picked Find The Root Cause', await pick('Find The Root Cause'))
check('root cause turn appeared', (await labels()).includes('root cause'),
  JSON.stringify(await labels()))
check('picked Draft A Reply', await pick('Draft A Reply'))
check('draft turn appeared', (await labels()).includes('draft'),
  JSON.stringify(await labels()))
check('picked Read It First', await pick('Read It First'))
check('preview turn appeared', (await labels()).includes('draft text'),
  JSON.stringify(await labels()))
check('picked Send It', await pick('Send It'))
check('reply was sent', (await labels()).includes('sent'),
  JSON.stringify(await labels()))

const emailChain = await p.evaluate(() => {
  const gs = [...document.querySelectorAll('.gpath')]
  return { paths: gs.length,
           longest: Math.max(...gs.map(g => g.querySelectorAll('.thought').length)) }
})
check('the email thread runs several turns deep', emailChain.paths >= 10,
  JSON.stringify(emailChain))
check('some chains reach seven or more thoughts', emailChain.longest >= 7,
  `longest ${emailChain.longest}`)

console.log('\nthe two demos stay separate')
const mixed = await p.evaluate(() =>
  [...document.querySelectorAll('.node-label')].map(e => e.textContent))
check('both threads are on the canvas',
  mixed.includes('ordered') && mixed.includes('sent'), JSON.stringify(mixed))

console.log('\na normal prompt still uses the generic flow')
await p.locator('.stage-add').click(); await p.waitForTimeout(300)
const f2 = p.locator('.node-input').last()
await f2.click(); await f2.fill('something else entirely')
await f2.press('Enter')
await waitSettled(p)
check('generic output spawned', (await labels()).includes('output'),
  JSON.stringify(await labels()))

await p.keyboard.press('f'); await p.waitForTimeout(700)
await p.screenshot({ path: 'tests/demo.png' })
await b.close()
console.log(fails.length ? `\n${fails.length} failing: ${fails.join(', ')}` : '\nall passed')
process.exit(fails.length ? 1 : 0)

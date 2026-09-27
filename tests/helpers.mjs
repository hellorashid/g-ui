/** Shared helpers for driving the canvas in tests. */

/** Wait until nothing is generating. */
export const waitSettled = async (p, timeout = 20000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const busy = await p.evaluate(() =>
      document.querySelectorAll('.gpath--pending, .node--thinking, .node--generating').length)
    if (busy === 0) return true
    await p.waitForTimeout(100)
  }
  return false
}

/**
 * The canvas starts with an empty input node. Run a prompt through it
 * so there is a settled, derived node with an action ring to work with.
 */
export const seedGraph = async (p, prompt = 'test prompt') => {
  const field = p.locator('.node-input').first()
  await field.click()
  await field.fill(prompt)
  await p.locator('.node-run').first().click()
  await waitSettled(p)
  // Running leaves the output's ring open; start from a clean slate.
  await p.keyboard.press('Escape')
  await p.waitForTimeout(150)
  // The derived output, not the input node.
  return p.locator('.node:not(.node--input)').first()
}

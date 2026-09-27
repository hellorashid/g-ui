import type { GNode } from './types'

export interface Placed extends GNode {
  x: number
  y: number
}

interface Metrics {
  nodeRadius: number
  menuRadius: number
  spawnGap: number
}

/**
 * Resolve every node's position from its origin chain.
 *
 * A node sits one `reach` along its parent's bearing, so the whole
 * graph re-flows when the layout metrics change — that is what makes
 * the spawn-gap and radius sliders move existing nodes rather than
 * only affecting the next spawn.
 */
export function layout(nodes: GNode[], m: Metrics): Placed[] {
  const reach = m.menuRadius + m.nodeRadius + m.spawnGap
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const done = new Map<string, Placed>()

  const place = (node: GNode, seen: Set<string>): Placed => {
    const cached = done.get(node.id)
    if (cached) return cached

    // A root — or a cycle, which we refuse to follow — sits at the origin.
    if (!node.origin || seen.has(node.id)) {
      const root = { ...node, x: 0, y: 0 }
      done.set(node.id, root)
      return root
    }

    const parent = byId.get(node.origin.parentId)
    if (!parent) {
      const orphan = { ...node, x: 0, y: 0 }
      done.set(node.id, orphan)
      return orphan
    }

    seen.add(node.id)
    const base = place(parent, seen)
    const rad = ((node.origin.angle - 90) * Math.PI) / 180
    const placed = {
      ...node,
      x: base.x + Math.cos(rad) * reach,
      y: base.y + Math.sin(rad) * reach,
    }
    done.set(node.id, placed)
    return placed
  }

  return nodes.map((n) => place(n, new Set()))
}

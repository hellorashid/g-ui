import type { GNode, GPath } from './types'

export interface Placed extends GNode {
  x: number
  y: number
}

interface Metrics {
  nodeRadius: number
  menuRadius: number
  /** Gap for a path carrying the baseline number of thoughts. */
  spawnGap: number
}

/**
 * A path's length grows with the reasoning it carries, so a longer
 * chain of thoughts visibly takes longer to travel. `spawnGap` is the
 * gap at BASE_THOUGHTS; each thought above or below shifts it by
 * PER_THOUGHT, floored so a short chain still clears the rings.
 */
const BASE_THOUGHTS = 3
const PER_THOUGHT = 52
const MIN_GAP = 90

/** Gap for a path with `count` thoughts. */
export function gapFor(count: number, spawnGap: number) {
  return Math.max(MIN_GAP, spawnGap + (count - BASE_THOUGHTS) * PER_THOUGHT)
}

/**
 * Resolve every node's position from its origin chain.
 *
 * A node sits one reach along its parent's bearing, so the whole graph
 * re-flows when the layout metrics change — that is what makes the
 * spawn-gap and radius sliders move existing nodes rather than only
 * affecting the next spawn. Reach is per-path: it grows with the
 * number of thoughts on the path that produced the node.
 */
export function layout(nodes: GNode[], paths: GPath[], m: Metrics): Placed[] {
  // Thought count for the path that produced each node.
  const thoughtsByNode = new Map(paths.map((p) => [p.to, p.thoughts.length]))
  const reachFor = (id: string) =>
    m.menuRadius +
    m.nodeRadius +
    gapFor(thoughtsByNode.get(id) ?? BASE_THOUGHTS, m.spawnGap)

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const done = new Map<string, Placed>()

  const place = (node: GNode, seen: Set<string>): Placed => {
    const cached = done.get(node.id)
    if (cached) return cached

    // A root — or a cycle, which we refuse to follow — sits where it
    // was seeded, defaulting to the origin.
    if (!node.origin || seen.has(node.id)) {
      const root = { ...node, x: node.seed?.x ?? 0, y: node.seed?.y ?? 0 }
      done.set(node.id, root)
      return root
    }

    const parent = byId.get(node.origin.parentId)
    if (!parent) {
      const orphan = { ...node, x: node.seed?.x ?? 0, y: node.seed?.y ?? 0 }
      done.set(node.id, orphan)
      return orphan
    }

    seen.add(node.id)
    const base = place(parent, seen)
    const rad = ((node.origin.angle - 90) * Math.PI) / 180
    const reach = reachFor(node.id)
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

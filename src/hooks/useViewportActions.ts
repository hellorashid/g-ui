import { useCallback } from 'react'
import type { GNode } from '../types'
import { MAX_ZOOM, MIN_ZOOM, type Viewport } from './useViewport'

interface Options {
  ref: React.RefObject<HTMLElement | null>
  nodes: GNode[]
  nodeRadius: number
  /** Outer radius of an open ring, so fitting clears the menus too. */
  menuRadius: number
  openIds: Set<string>
  animateTo: (target: Viewport, ms?: number) => void
}

/** Fit-to-content and focus-a-node, in the viewport's coordinate space. */
export function useViewportActions({
  ref,
  nodes,
  nodeRadius,
  menuRadius,
  openIds,
  animateTo,
}: Options) {
  /** Frame every node — and any open ring — with a comfortable margin. */
  const fitAll = useCallback(() => {
    const el = ref.current
    if (!el || nodes.length === 0) return
    const r = el.getBoundingClientRect()
    const margin = 48

    // Each node's extent is its own radius, or its ring's when open.
    const reach = (n: GNode) =>
      (openIds.has(n.id) ? menuRadius : nodeRadius) + margin
    const minX = Math.min(...nodes.map((n) => n.x - reach(n)))
    const maxX = Math.max(...nodes.map((n) => n.x + reach(n)))
    const minY = Math.min(...nodes.map((n) => n.y - reach(n)))
    const maxY = Math.max(...nodes.map((n) => n.y + reach(n)))

    const w = maxX - minX
    const h = maxY - minY
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(r.width / w, r.height / h)))

    // Centre of content, in world space, pulled to the viewport centre.
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    animateTo({ zoom, x: -cx * zoom, y: -cy * zoom })
  }, [ref, nodes, nodeRadius, menuRadius, openIds, animateTo])

  /** Centre one node, keeping the current zoom unless it is very far out. */
  const focusNode = useCallback(
    (node: GNode, zoom?: number) => {
      const z = zoom ?? 1
      animateTo({ zoom: z, x: -node.x * z, y: -node.y * z })
    },
    [animateTo],
  )

  const resetView = useCallback(() => {
    animateTo({ x: 0, y: 0, zoom: 1 })
  }, [animateTo])

  return { fitAll, focusNode, resetView }
}

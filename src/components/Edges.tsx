import type { GEdge, GNode } from '../types'
import './Edges.css'

interface Props {
  nodes: GNode[]
  edges: GEdge[]
  radius: number
  /** Nodes whose radial menus are open. */
  openIds: Set<string>
  /** Outer radius of an open ring. */
  menuRadius: number
  /** Surface size, so the viewBox can centre on the node origin. */
  width: number
  height: number
}

/**
 * Links between nodes, drawn in the same centered coordinate space.
 * A link leaves its parent at the wedge that spawned it, so the eye
 * can trace node -> radial item -> node -> radial item.
 */
export default function Edges({
  nodes,
  edges,
  radius,
  openIds,
  menuRadius,
  width,
  height,
}: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Nothing to project onto before the surface has been measured.
  if (width <= 0 || height <= 0) return null

  // viewBox centred on 0,0 so these coords match the nodes' space.
  const viewBox = `${-width / 2} ${-height / 2} ${width} ${height}`

  return (
    <svg className="edges" viewBox={viewBox} aria-hidden="true">
      <g>
        {edges.map((edge) => {
          const a = byId.get(edge.from)
          const b = byId.get(edge.to)
          if (!a || !b) return null

          const live = openIds.has(edge.from)

          // Children sit on their wedge's bearing, so the run from the
          // ring to the node is a straight radial line — keep it straight
          // and the ring-to-node path reads as one continuous stroke.
          const rad = ((edge.angle - 90) * Math.PI) / 180
          const ux = Math.cos(rad)
          const uy = Math.sin(rad)

          const start = (live ? menuRadius : radius) + 4
          const x1 = a.x + ux * start
          const y1 = a.y + uy * start
          const x2 = b.x - ux * (radius + 4)
          const y2 = b.y - uy * (radius + 4)

          return (
            <g className={live ? 'edge edge--live' : 'edge'} key={edge.id}>
              <path d={`M ${x1} ${y1} L ${x2} ${y2}`} />
              {/* Anchor dot on the wedge rim it departs from. */}
              {live && <circle className="edge-root" cx={x1} cy={y1} r={3.5} />}
              <circle className="edge-cap" cx={x2} cy={y2} r={3} />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

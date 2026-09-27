import type { Placed } from '../layout'
import { THOUGHT_KINDS, type GPath, type Thought } from '../types'
import './PathLayer.css'

interface Props {
  nodes: Placed[]
  paths: GPath[]
  radius: number
  /** Nodes whose radial menus are open. */
  openIds: Set<string>
  /** Outer radius of an open ring. */
  menuRadius: number
  /** Raised when a thought dot is hovered, for the tooltip layer. */
  onHoverThought: (hit: HoveredThought | null) => void
  /** Surface size, so the viewBox can centre on the node origin. */
  width: number
  height: number
}

/**
 * Links between nodes, drawn in the same centered coordinate space.
 * A link leaves its parent at the wedge that spawned it, so the eye
 * can trace node -> radial item -> node -> radial item.
 */
export interface HoveredThought {
  thought: Thought
  /** World-space position of the dot. */
  x: number
  y: number
}

export default function PathLayer({
  nodes,
  paths,
  radius,
  openIds,
  menuRadius,
  width,
  height,
  onHoverThought,
}: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Nothing to project onto before the surface has been measured.
  if (width <= 0 || height <= 0) return null

  // viewBox centred on 0,0 so these coords match the nodes' space.
  const viewBox = `${-width / 2} ${-height / 2} ${width} ${height}`

  return (
    <svg className="paths" viewBox={viewBox} aria-hidden="true">
      <g>
        {paths.map((gpath) => {
          const a = byId.get(gpath.from)
          const b = byId.get(gpath.to)
          if (!a || !b) return null

          const live = openIds.has(gpath.from)

          // Children sit on their wedge's bearing, so the run from the
          // ring to the node is a straight radial line — keep it straight
          // and the ring-to-node path reads as one continuous stroke.
          const rad = ((gpath.angle - 90) * Math.PI) / 180
          const ux = Math.cos(rad)
          const uy = Math.sin(rad)

          // Leave the parent at its selected wedge, and arrive on the
          // child's retry wedge — the one facing back this way — so the
          // link joins action to action rather than action to circle.
          const start = (live ? menuRadius : radius) + 4
          // Land just inside the ring's outer rim so the cap sits on
          // the wedge itself rather than floating off its rim.
          const end = openIds.has(gpath.to) ? menuRadius - 10 : radius + 4
          const x1 = a.x + ux * start
          const y1 = a.y + uy * start
          const x2 = b.x - ux * end
          const y2 = b.y - uy * end

          // Space the thoughts along the run, clear of both endpoints.
          const span = Math.hypot(x2 - x1, y2 - y1)
          const n = gpath.thoughts.length
          const inset = Math.min(26, span * 0.18)
          const usable = span - inset * 2

          return (
            <g
              className={[
                'gpath',
                live && 'gpath--live',
                gpath.status === 'pending' && 'gpath--pending',
              ]
                .filter(Boolean)
                .join(' ')}
              key={gpath.id}
            >
              <path d={`M ${x1} ${y1} L ${x2} ${y2}`} />
              {/* Anchor dot on the wedge rim it departs from. */}
              {live && <circle className="path-root" cx={x1} cy={y1} r={3.5} />}
              {gpath.status === 'pending' ? (
                // A pulsing head at the frontier of the reasoning.
                <circle className="path-head" cx={x2} cy={y2} r={4} />
              ) : (
                <circle className="path-cap" cx={x2} cy={y2} r={3} />
              )}

              {n > 0 &&
                gpath.thoughts.map((t, i) => {
                  // Evenly spaced; a lone thought sits at the midpoint.
                  const f = n === 1 ? 0.5 : i / (n - 1)
                  const d = inset + usable * f
                  const tx = x1 + ux * d
                  const ty = y1 + uy * d
                  return (
                    <g
                      className="thought"
                      key={t.id}
                      transform={`translate(${tx} ${ty})`}
                      onPointerEnter={() =>
                        onHoverThought({ thought: t, x: tx, y: ty })
                      }
                      onPointerLeave={() => onHoverThought(null)}
                    >
                      <circle className="thought-hit" r={13} />
                      <g className="thought-in">
                        <circle className="thought-dot" r={9} />
                        <text dy="0.35em">{THOUGHT_KINDS[t.type].icon}</text>
                      </g>
                    </g>
                  )
                })}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

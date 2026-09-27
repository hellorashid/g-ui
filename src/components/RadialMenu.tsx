import { useState } from 'react'
import type { RadialAction } from '../types'
import './RadialMenu.css'

interface Props {
  actions: RadialAction[]
  /** Outer radius of the ring, in px. */
  radius: number
  /** Inner radius — the hole the node sits in. */
  innerRadius: number
  /** `angle` is the wedge's center bearing, degrees clockwise from 12 o'clock. */
  onSelect: (action: RadialAction, angle: number) => void
  onDismiss: () => void
  /** Actions already spawned from this node; their wedges stay lit. */
  selectedIds: string[]
}

const polar = (r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) }
}

/** An annular sector path, centered on 0,0. */
function wedgePath(r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0
  const o0 = polar(r1, a0)
  const o1 = polar(r1, a1)
  const i1 = polar(r0, a1)
  const i0 = polar(r0, a0)
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ')
}

export default function RadialMenu({
  actions,
  radius,
  innerRadius,
  onSelect,
  onDismiss,
  selectedIds,
}: Props) {
  const [focused, setFocused] = useState<RadialAction | null>(null)

  // A hair of padding between wedges so the ring reads as segments.
  const step = 360 / actions.length
  const pad = 1.5
  const size = radius * 2 + 8

  return (
    <div className="radial" style={{ width: size, height: size }}>
      <button
        className="radial-scrim"
        aria-label="Close menu"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
      />

      <svg
        className="radial-svg"
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        onPointerLeave={() => setFocused(null)}
      >
        {actions.map((action, i) => {
          const a0 = i * step - step / 2 + pad
          const a1 = a0 + step - pad * 2
          const mid = polar((innerRadius + radius) / 2, i * step)
          const active = focused?.id === action.id
          const selected = selectedIds.includes(action.id)

          return (
            <g
              key={action.id}
              className={[
                'wedge',
                active && 'wedge--active',
                selected && 'wedge--selected',
                action.retry && 'wedge--retry',
                action.self && 'wedge--self',
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerEnter={() => setFocused(action)}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(action, i * step)
              }}
            >
              <path d={wedgePath(innerRadius, radius, a0, a1)} />
              <text x={mid.x} y={mid.y} dy="0.36em">
                {action.icon}
              </text>
            </g>
          )
        })}
      </svg>

      <div
        className="radial-center"
        style={{ ['--center-drop' as string]: `${innerRadius * 0.62}px` }}
      >
        {focused ? (
          <>
            <span className="radial-label">{focused.label}</span>
            {focused.detail && (
              <span className="radial-detail">“{focused.detail}”</span>
            )}
            <span
              className={
                focused.self ? 'radial-hint radial-hint--self' : 'radial-hint'
              }
            >
              {focused.hint}
            </span>
          </>
        ) : (
          <span className="radial-hint">Esc to close</span>
        )}
      </div>

    </div>
  )
}

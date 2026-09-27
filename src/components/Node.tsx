import type { GNode } from '../types'
import './Node.css'

interface Props {
  node: GNode
  radius: number
  open: boolean
  onPress: () => void
  /** Double-click centres the view on this node. */
  onFocus: () => void
}

export default function Node({ node, radius, open, onPress, onFocus }: Props) {
  // Content has to fit the inscribed square, not the circle.
  const inner = radius * Math.SQRT2 - 8
  // Below this there is no room for the detail rows.
  const roomy = radius >= 58

  return (
    <button
      className={[
        'node',
        open && 'node--open',
        node.status === 'pending' && 'node--pending',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: radius * 2, height: radius * 2 }}
      onClick={(e) => {
        e.stopPropagation()
        onPress()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onFocus()
      }}
      aria-haspopup="menu"
      aria-expanded={open}
    >
      <span className="node-port node-port--in" />
      <span className="node-port node-port--out" />

      <span className="node-body" style={{ width: inner, maxHeight: inner }}>
        <span className="node-label">{node.label}</span>
        <span className="node-value">{node.value}</span>
        <span className="node-kind">{node.kind}</span>

        {roomy && node.fields.length > 0 && (
          <span className="node-fields">
            {node.fields.map((f) => (
              <span className="node-field" key={f.key}>
                <span className="node-field-key">{f.key}</span>
                <span className="node-field-value">{f.value}</span>
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  )
}

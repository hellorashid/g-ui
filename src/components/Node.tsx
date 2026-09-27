import { THINKING_RADIUS, type GNode } from '../types'
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
  const thinking = node.status === 'thinking'
  const generating = node.status === 'generating'

  // A thinking node is a placeholder, not yet the thing it will become.
  const r = thinking ? THINKING_RADIUS : radius
  // Content has to fit the inscribed square, not the circle.
  const inner = r * Math.SQRT2 - 8
  // Below this there is no room for the detail rows.
  const roomy = !thinking && r >= 58

  return (
    <button
      className={[
        'node',
        open && 'node--open',
        thinking && 'node--thinking',
        generating && 'node--generating',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: r * 2, height: r * 2 }}
      onClick={(e) => {
        e.stopPropagation()
        if (!thinking) onPress()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onFocus()
      }}
      aria-busy={thinking || generating}
      aria-haspopup={thinking ? undefined : 'menu'}
      aria-expanded={thinking ? undefined : open}
    >
      {thinking ? (
        <span className="node-spinner" aria-label="Thinking" />
      ) : (
        <>
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
        </>
      )}
    </button>
  )
}

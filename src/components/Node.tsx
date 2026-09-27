import { THINKING_RADIUS, type GNode } from '../types'
import './Node.css'

interface Props {
  node: GNode
  radius: number
  open: boolean
  onPress: () => void
  /** Double-click centres the view on this node. */
  onFocus: () => void
  /** Edit an input node's prompt. */
  onChangeValue?: (value: string) => void
  /** Run an input node's prompt, spawning its first output. */
  onSubmit?: () => void
}

export default function Node({
  node,
  radius,
  open,
  onPress,
  onFocus,
  onChangeValue,
  onSubmit,
}: Props) {
  const thinking = node.status === 'thinking'
  const generating = node.status === 'generating'
  const isInput = node.nodeKind === 'input'

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
        isInput && 'node--input',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: r * 2, height: r * 2 }}
      onClick={(e) => {
        e.stopPropagation()
        // An input node's ring opens from its own controls, not the
        // body, so a click can land in the text field.
        if (!thinking && !isInput) onPress()
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
      ) : isInput ? (
        <>
          <span className="node-port node-port--out" />
          <span className="node-body" style={{ width: inner, maxHeight: inner }}>
            <span className="node-label">{node.label}</span>
            <textarea
              className="node-input"
              value={node.value}
              rows={3}
              placeholder="Ask something…"
              spellCheck={false}
              onChange={(e) => onChangeValue?.(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation()
                // Enter runs it; Shift+Enter makes a new line.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSubmit?.()
                }
              }}
            />
            <span
              className="node-run"
              role="button"
              tabIndex={0}
              aria-disabled={!node.value.trim()}
              onClick={(e) => {
                e.stopPropagation()
                onSubmit?.()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  e.preventDefault()
                  onSubmit?.()
                }
              }}
            >
              Run ↵
            </span>
          </span>
        </>
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

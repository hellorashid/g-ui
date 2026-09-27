export type Density = 'compact' | 'comfortable' | 'spacious'

export interface UiSettings {
  showGrid: boolean
  gridSize: number
  density: Density
  accent: string
  nodeRadius: number
  menuRadius: number
  /** Distance between a parent's ring and the node it spawns. */
  spawnGap: number
}

/**
 * A data input/output on the canvas.
 *
 * Position is derived, not stored: a node's place is its parent's
 * place plus one reach along `origin.angle`. Keeping the graph in
 * polar terms means layout settings (spawn gap, radii) re-flow every
 * node the moment they change.
 */
export interface GNode {
  id: string
  label: string
  /** Whatever this node currently holds; rendered inside the circle. */
  value: string
  /** Shown under the value — the node's data type. */
  kind: string
  /** Extra rows rendered inside the circle when there is room. */
  fields: { key: string; value: string }[]
  /**
   * How this node came to exist. The wedge facing back along `angle`
   * is the inbound link, so it becomes a retry of `actionId` rather
   * than a spawn that would land on top of the parent.
   */
  origin?: {
    parentId: string
    actionId: string
    /** Bearing from the parent that produced this node. */
    angle: number
  }
}

/**
 * One step of reasoning along a path. Thoughts are the chain that
 * produced the path's target node: read end to end, they explain how
 * the graph got from one node to the next.
 */
export interface Thought {
  id: string
  type: ThoughtType
  /** One line, shown on hover. */
  description: string
}

export type ThoughtType =
  | 'observe'
  | 'retrieve'
  | 'infer'
  | 'decide'
  | 'verify'

/** Icon and label per thought type, used by the dots and tooltips. */
export const THOUGHT_KINDS: Record<ThoughtType, { icon: string; label: string }> = {
  observe: { icon: '◎', label: 'Observe' },
  retrieve: { icon: '⌸', label: 'Retrieve' },
  infer: { icon: '∴', label: 'Infer' },
  decide: { icon: '⟐', label: 'Decide' },
  verify: { icon: '✓', label: 'Verify' },
}

/** A link between two nodes, drawn as a curve. */
export interface GPath {
  id: string
  from: string
  to: string
  /** The action that produced this link. */
  label: string
  /** Which radial action spawned it — used to keep that wedge lit. */
  actionId: string
  /** Bearing of the wedge it came from, degrees clockwise from 12 o'clock. */
  angle: number
  /** The reasoning chain that produced the target node. */
  thoughts: Thought[]
}

/** One wedge of a radial menu. */
export interface RadialAction {
  id: string
  label: string
  icon: string
  /** Shown while the wedge is focused. */
  hint: string
  /** Re-runs the action that produced this node instead of spawning. */
  retry?: boolean
}

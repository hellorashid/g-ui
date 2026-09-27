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

/** A data input/output on the canvas. */
export interface GNode {
  id: string
  x: number
  y: number
  label: string
  /** Whatever this node currently holds; rendered inside the circle. */
  value: string
  /** Shown under the value — the node's data type. */
  kind: string
  /** Extra rows rendered inside the circle when there is room. */
  fields: { key: string; value: string }[]
}

/** A link between two nodes, drawn as a curve. */
export interface GEdge {
  id: string
  from: string
  to: string
  /** The action that produced this link. */
  label: string
  /** Which radial action spawned it — used to keep that wedge lit. */
  actionId: string
  /** Bearing of the wedge it came from, degrees clockwise from 12 o'clock. */
  angle: number
}

/** One wedge of a radial menu. */
export interface RadialAction {
  id: string
  label: string
  icon: string
  /** Shown while the wedge is focused. */
  hint: string
}

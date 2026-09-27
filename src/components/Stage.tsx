import { useEffect, useRef, useState } from 'react'
import { useViewport } from '../hooks/useViewport'
import { useViewportActions } from '../hooks/useViewportActions'
import Edges from './Edges'
import Node from './Node'
import RadialMenu from './RadialMenu'
import { layout } from '../layout'
import type { GEdge, GNode, RadialAction, UiSettings } from '../types'
import './Stage.css'

interface Props {
  settings: UiSettings
}

const ACTIONS: RadialAction[] = [
  { id: 'connect', label: 'Connect', icon: '⤳', hint: 'Link to a new node' },
  { id: 'inspect', label: 'Inspect', icon: '◉', hint: 'Read the value' },
  { id: 'transform', label: 'Transform', icon: 'ƒ', hint: 'Apply a function' },
  { id: 'duplicate', label: 'Duplicate', icon: '⧉', hint: 'Clone this node' },
  { id: 'filter', label: 'Filter', icon: '⋔', hint: 'Gate the values' },
  { id: 'output', label: 'Output', icon: '⇥', hint: 'Send downstream' },
]

/** What each action produces when it spawns a node. */
const SPAWN: Record<string, { label: string; kind: string; value: string }> = {
  connect: { label: 'link', kind: 'ref', value: '—' },
  inspect: { label: 'inspect', kind: 'view', value: '42' },
  transform: { label: 'transform', kind: 'fn', value: 'ƒ(x)' },
  duplicate: { label: 'copy', kind: 'number', value: '42' },
  filter: { label: 'filter', kind: 'gate', value: '>0' },
  output: { label: 'output', kind: 'sink', value: '→' },
}

/** Thinnest the action ring may get before wedges stop being clickable. */
const MIN_BAND = 56

/**
 * The wedge pointing back at a node's parent is the inbound link, so
 * spawning there would drop a node on top of the parent. That slot
 * becomes a retry of the action that produced this node instead.
 */
const RETRY: RadialAction = {
  id: 'retry',
  label: 'Retry',
  icon: '↻',
  hint: 'Run this step again',
  retry: true,
}

/** Action ring for one node, with the inbound wedge swapped for Retry. */
function actionsFor(node: GNode): RadialAction[] {
  if (!node.origin) return ACTIONS
  // The inbound direction is the reverse of the bearing we arrived on.
  const back = (node.origin.angle + 180) % 360
  const step = 360 / ACTIONS.length
  const slot = Math.round(back / step) % ACTIONS.length
  return ACTIONS.map((a, i) => (i === slot ? RETRY : a))
}

const ROOT: GNode = {
  id: 'n1',
  label: 'input',
  value: '42',
  kind: 'number',
  fields: [
    { key: 'source', value: 'sensor.a' },
    { key: 'updated', value: '2s ago' },
    { key: 'out', value: '0 links' },
  ],
}

/**
 * The main desktop: where the visual interface gets rendered.
 * No chrome — the surface runs edge to edge.
 */
export default function Stage({ settings }: Props) {
  const [nodes, setNodes] = useState<GNode[]>([ROOT])
  const [edges, setEdges] = useState<GEdge[]>([])
  /**
   * Rings come in two flavours:
   *  - pinned: a node whose ring has a selected action, or which was
   *    reached by selecting one. These survive clicks elsewhere.
   *  - browsing: opened by a plain click, closed when focus moves on.
   */
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [browsingId, setBrowsingId] = useState<string | null>(null)
  const openIds = new Set(pinnedIds)
  if (browsingId) openIds.add(browsingId)
  const [log, setLog] = useState<string | null>(null)
  const seq = useRef(1)
  const frameRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Keep a usable ring even when the node is scaled up past the menu.
  const holeRadius = settings.nodeRadius + 14
  const menuRadius = Math.max(settings.menuRadius, holeRadius + MIN_BAND)

  const placed = layout(nodes, {
    nodeRadius: settings.nodeRadius,
    menuRadius,
    spawnGap: settings.spawnGap,
  })

  const { viewport, animateTo, panning } = useViewport({ ref: frameRef })
  const { fitAll, resetView, focusNode } = useViewportActions({
    ref: frameRef,
    nodes: placed,
    nodeRadius: settings.nodeRadius,
    menuRadius,
    openIds,
    animateTo,
  })

  // The edge layer needs pixel dimensions to centre its viewBox.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore while typing in the sidebar.
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.isContentEditable) return

      if (e.key === 'Escape') {
        setPinnedIds(new Set())
        setBrowsingId(null)
      }
      else if (e.key === 'f' || e.key === 'F') fitAll()
      else if (e.key === '0') resetView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fitAll, resetView])

  /**
   * Clicking a node opens its ring and drops whichever ring was merely
   * being browsed. Rings pinned by a selected action always survive —
   * they anchor a link, so hiding one would orphan its connector.
   */
  const pressNode = (id: string) => {
    setBrowsingId((prev) => (prev === id ? null : id))
  }

  const handleSelect = (parent: GNode, action: RadialAction, angle: number) => {
    // Only the bearing is stored; layout() turns it into a position.
    const spec = SPAWN[action.id] ?? SPAWN.connect
    const id = `n${++seq.current}`

    const child: GNode = {
      id,
      label: spec.label,
      value: spec.value,
      kind: spec.kind,
      fields: [
        { key: 'from', value: parent.label },
        { key: 'via', value: action.label.toLowerCase() },
      ],
      origin: { parentId: parent.id, actionId: action.id, angle },
    }

    setNodes((prev) => [...prev, child])
    setEdges((prev) => [
      ...prev,
      {
        id: `e${id}`,
        from: parent.id,
        to: id,
        label: action.label,
        actionId: action.id,
        angle,
      },
    ])
    // The parent's ring is now anchoring a link, so pin it; the new
    // node's own ring opens so the chain can be continued immediately.
    setPinnedIds((prev) => new Set(prev).add(parent.id))
    setBrowsingId(id)
    setLog(`${action.label} → ${child.label}`)
  }

  /**
   * Re-run the step that produced this node. A placeholder for now:
   * it bumps a counter and re-stamps the node so the action is visibly
   * repeated; eventually this regenerates the value itself.
   */
  const handleRetry = (node: GNode) => {
    if (!node.origin) return
    const { actionId } = node.origin
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== node.id) return n
        const runs = Number(n.fields.find((f) => f.key === 'runs')?.value ?? 1) + 1
        const kept = n.fields.filter((f) => f.key !== 'runs')
        return { ...n, fields: [...kept, { key: 'runs', value: String(runs) }] }
      }),
    )
    setLog(`Retry → ${node.label} (${actionId})`)
  }

  /** Selecting an action that already spawned a node re-opens that node. */
  const handleReselect = (parent: GNode, action: RadialAction) => {
    const existing = edges.find(
      (e) => e.from === parent.id && e.actionId === action.id,
    )
    if (!existing) return false
    setBrowsingId(existing.to)
    const target = placed.find((n) => n.id === existing.to)
    if (target) focusNode(target)
    setLog(`${action.label} → ${target?.label ?? existing.to}`)
    return true
  }

  return (
    <main
      ref={frameRef}
      className={panning ? 'stage stage--panning' : 'stage'}
      data-grid={settings.showGrid || undefined}
      style={{
        // Grid lives on the frame so it can scroll and scale with the view.
        backgroundSize: `${settings.gridSize * viewport.zoom}px ${settings.gridSize * viewport.zoom}px`,
        backgroundPosition: `calc(50% + ${viewport.x}px) calc(50% + ${viewport.y}px)`,
      }}
    >
      <div
        ref={surfaceRef}
        className="stage-surface"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        <Edges
          nodes={placed}
          edges={edges}
          radius={settings.nodeRadius}
          openIds={openIds}
          menuRadius={menuRadius}
          width={size.width}
          height={size.height}
        />

        {/* Rings: beneath the link layer. */}
        {placed
          .filter((node) => openIds.has(node.id))
          .map((node) => (
            <div
              className="node-slot node-slot--menu"
              key={node.id}
              style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            >
              <RadialMenu
                actions={actionsFor(node)}
                radius={menuRadius}
                innerRadius={holeRadius}
                onSelect={(action, angle) => {
                  if (action.retry) {
                    handleRetry(node)
                  } else if (!handleReselect(node, action)) {
                    // Re-picking a used action reveals its node
                    // instead of spawning a duplicate.
                    handleSelect(node, action, angle)
                  }
                }}
                onDismiss={() => pressNode(node.id)}
                selectedIds={edges
                  .filter((e) => e.from === node.id)
                  .map((e) => e.actionId)}
              />
            </div>
          ))}

        {/* Nodes: above the link layer. */}
        {placed.map((node) => (
          <div
            className="node-slot node-slot--node"
            key={node.id}
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
          >
            <Node
              node={node}
              radius={settings.nodeRadius}
              open={openIds.has(node.id)}
              onPress={() => pressNode(node.id)}
              onFocus={() => focusNode(node)}
            />
          </div>
        ))}
      </div>

      <div className="stage-controls">
        <button onClick={fitAll} title="Fit all (F)">
          ⤢
        </button>
        <button onClick={resetView} title="Reset view (0)">
          ⌖
        </button>
        <span className="stage-zoom">{Math.round(viewport.zoom * 100)}%</span>
      </div>

      {log && <div className="stage-log">{log}</div>}
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useViewport } from '../hooks/useViewport'
import { useViewportActions } from '../hooks/useViewportActions'
import PathLayer, { type HoveredThought } from './PathLayer'
import Node from './Node'
import RadialMenu from './RadialMenu'
import { layout, type Placed } from '../layout'
import { useGeneration } from '../hooks/useGeneration'
import { thoughtsFor } from '../thoughts'
import { DEMO_PROMPTS, DEMOS, demoFor, demoThoughts, type DemoTurn } from '../demo'
import { THOUGHT_KINDS, type GPath, type GNode, type RadialAction, type UiSettings } from '../types'
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

/** A node offers actions only once it has settled. */
const isIdle = (n: GNode) => (n.status ?? 'idle') === 'idle'

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

/** Turn a scripted turn's actions into ring wedges. */
function demoActions(turn: DemoTurn): RadialAction[] {
  return turn.actions.map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon,
    hint: a.self ? 'I can do this' : 'Needs your input',
    detail: a.action,
    self: a.self,
    next: a.next,
  }))
}

/** Action ring for one node, with the inbound wedge swapped for Retry. */
function actionsFor(node: GNode): RadialAction[] {
  // A scripted node offers exactly what its turn allows.
  if (node.turnId && node.demoId) {
    const turn = DEMOS[node.demoId]?.[node.turnId]
    const acts = turn ? demoActions(turn) : []
    return node.origin ? [...acts, RETRY] : acts
  }
  if (!node.origin) return ACTIONS
  // The inbound direction is the reverse of the bearing we arrived on.
  const back = (node.origin.angle + 180) % 360
  const step = 360 / ACTIONS.length
  const slot = Math.round(back / step) % ACTIONS.length
  return ACTIONS.map((a, i) => (i === slot ? RETRY : a))
}

/** A fresh input node, ready for a prompt. */
const makeInput = (id: string, x = 0, y = 0): GNode => ({
  id,
  label: 'input',
  value: '',
  kind: 'prompt',
  nodeKind: 'input',
  fields: [],
  seed: { x, y },
})

/**
 * The main desktop: where the visual interface gets rendered.
 * No chrome — the surface runs edge to edge.
 */
export default function Stage({ settings }: Props) {
  // The canvas starts empty; the plus button adds the first input.
  const [nodes, setNodes] = useState<GNode[]>([])
  const [paths, setPaths] = useState<GPath[]>([])
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
  const [hovered, setHovered] = useState<HoveredThought | null>(null)
  const seq = useRef(1)
  const frameRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Keep a usable ring even when the node is scaled up past the menu.
  const holeRadius = settings.nodeRadius + 14
  const menuRadius = Math.max(settings.menuRadius, holeRadius + MIN_BAND)

  const placed = layout(nodes, paths, {
    nodeRadius: settings.nodeRadius,
    menuRadius,
    spawnGap: settings.spawnGap,
  })

  const { generate } = useGeneration({ setPaths, setNodes })

  const { viewport, animateTo, panning } = useViewport({ ref: frameRef })
  const { fitAll, resetView, focusNode } = useViewportActions({
    ref: frameRef,
    nodes: placed,
    nodeRadius: settings.nodeRadius,
    menuRadius,
    openIds,
    animateTo,
  })

  // The gpath layer needs pixel dimensions to centre its viewBox.
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
    // A scripted action advances the conversation to its next turn.
    if (action.next && parent.demoId) {
      const turn = DEMOS[parent.demoId]?.[action.next]
      if (turn) {
        spawnTurn(parent, turn, angle, action.id, action.label, parent.demoId)
        setLog(`${action.label} → ${turn.label}`)
        return
      }
    }
    // An action with no follow-on is a scripted dead end.
    if (parent.turnId) {
      setLog(`${action.label} — nothing scripted past here`)
      return
    }

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
      status: 'thinking',
    }

    // The path starts empty and fills in: thoughts arrive one by one
    // until the chain is complete and the node settles.
    const pathId = `e${id}`
    const chain = thoughtsFor(action.id, pathId)

    setNodes((prev) => [...prev, child])
    setPaths((prev) => [
      ...prev,
      {
        id: pathId,
        from: parent.id,
        to: id,
        label: action.label,
        actionId: action.id,
        angle,
        thoughts: [],
        status: 'pending',
      },
    ])
    generate(pathId, id, chain)
    // The parent's ring is now anchoring a link, so pin it. The child
    // is marked as browsing too, but its ring stays hidden until the
    // node reaches idle — see isIdle in the render.
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

  const setValue = (id: string, value: string) =>
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, value } : n)))

  /**
   * Run an input node's prompt: spawn the first output below it and
   * start generating the path that leads there.
   */
  /**
   * Spawn a scripted turn off `parent` along `angle`, and start
   * generating the path that leads to it.
   */
  const spawnTurn = (
    parent: GNode,
    turn: DemoTurn,
    angle: number,
    actionId: string,
    label: string,
    demoId: string,
  ) => {
    const id = `n${++seq.current}`
    const pathId = `e${id}`

    setNodes((prev) => [
      ...prev,
      {
        id,
        label: turn.label,
        value: turn.value,
        kind: turn.kind,
        detail: turn.response,
        fields: turn.fields ?? [],
        origin: { parentId: parent.id, actionId, angle },
        status: 'thinking',
        turnId: turn.id,
        demoId,
      },
    ])
    setPaths((prev) => [
      ...prev,
      {
        id: pathId,
        from: parent.id,
        to: id,
        label,
        actionId,
        angle,
        thoughts: [],
        status: 'pending',
      },
    ])
    generate(pathId, id, demoThoughts(turn, pathId))
    setBrowsingId(id)
    return id
  }

  const runInput = (node: Placed) => {
    if (!node.value.trim()) return
    // One output per input; re-running reveals the existing one.
    const already = paths.find((p) => p.from === node.id)
    if (already) {
      setBrowsingId(already.to)
      return
    }

    // A recognised prompt plays the scripted conversation instead.
    const key = node.value.trim().toLowerCase()
    const script = demoFor(node.value)
    if (script) {
      spawnTurn(node, script.start, 180, 'start', 'Start', key)
      setLog(`Run → ${node.value.trim()}`)
      return
    }

    const id = `n${++seq.current}`
    const pathId = `e${id}`
    const chain = thoughtsFor('output', pathId)
    // Straight down, so a prompt reads top to bottom.
    const angle = 180

    setNodes((prev) => [
      ...prev,
      {
        id,
        label: 'output',
        value: '…',
        kind: 'result',
        fields: [{ key: 'from', value: node.label }],
        origin: { parentId: node.id, actionId: 'output', angle },
        status: 'thinking',
      },
    ])
    setPaths((prev) => [
      ...prev,
      {
        id: pathId,
        from: node.id,
        to: id,
        label: 'Output',
        actionId: 'output',
        angle,
        thoughts: [],
        status: 'pending',
      },
    ])
    generate(pathId, id, chain)
    setBrowsingId(id)
    setLog(`Run → ${node.value.trim().slice(0, 40)}`)
  }

  /**
   * Drop a fresh input node clear of everything already placed.
   * Outputs grow downward, so new inputs go to the right — otherwise
   * a new prompt would land on top of an existing node's output.
   */
  const addInput = (prompt = '') => {
    const id = `n${++seq.current}`
    const right = placed.length
      ? Math.max(...placed.map((n) => n.x)) + menuRadius + settings.nodeRadius + 180
      : 0
    const top = placed.length ? Math.min(...placed.map((n) => n.y)) : 0
    setNodes((prev) => [...prev, { ...makeInput(id, right, top), value: prompt }])
    setBrowsingId(null)
    focusNode({ ...makeInput(id, right, top), x: right, y: top })
    setLog('New input')
  }

  /** Selecting an action that already spawned a node re-opens that node. */
  const handleReselect = (parent: GNode, action: RadialAction) => {
    const existing = paths.find(
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
        <PathLayer
          nodes={placed}
          paths={paths}
          radius={settings.nodeRadius}
          openIds={openIds}
          menuRadius={menuRadius}
          width={size.width}
          height={size.height}
          onHoverThought={setHovered}
        />

        {/* Tooltip rides in the surface's space so it tracks pan/zoom. */}
        {hovered && (
          <div
            className="thought-tip"
            style={{ transform: `translate(${hovered.x}px, ${hovered.y}px)` }}
          >
            <span className="thought-tip-kind">
              {THOUGHT_KINDS[hovered.thought.type].icon}{' '}
              {THOUGHT_KINDS[hovered.thought.type].label}
            </span>
            <span className="thought-tip-text">{hovered.thought.description}</span>
          </div>
        )}

        {/* Rings: beneath the link layer. Only an idle node has
            actions — one still being reasoned toward has none yet. */}
        {placed
          .filter((node) => openIds.has(node.id) && isIdle(node))
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
                selectedIds={paths
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
              open={openIds.has(node.id) && isIdle(node)}
              onPress={() => pressNode(node.id)}
              onFocus={() => focusNode(node)}
              onChangeValue={(v) => setValue(node.id, v)}
              onSubmit={() => runInput(node)}
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

      {placed.length === 0 && (
        <div className="stage-empty">
          <button className="stage-empty-start" onClick={() => addInput()}>
            <span className="stage-empty-mark">+</span>
            <span className="stage-empty-text">Start with an input</span>
          </button>
          <div className="stage-empty-hints">
            <span className="stage-empty-try">Try</span>
            {DEMO_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="stage-empty-demo"
                onClick={() => addInput(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className="stage-add"
        onClick={() => addInput()}
        title="New input node"
      >
        +
      </button>

      {log && <div className="stage-log">{log}</div>}
    </main>
  )
}

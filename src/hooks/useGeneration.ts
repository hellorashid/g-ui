import { useCallback, useEffect, useRef } from 'react'
import type { GNode, GPath, Thought } from '../types'

/** Delay before the next thought lands, in ms. */
const MIN_DELAY = 1000
const MAX_DELAY = 3000

/** How long a settled node spends working out its actions. */
const MIN_ACTIONS = 600
const MAX_ACTIONS = 1400

/**
 * Scales every generation delay. Tests pass ?speed=20 so a chain that
 * takes seconds in the app settles in milliseconds; the app itself
 * always runs at 1.
 */
const speed = () => {
  if (typeof window === 'undefined') return 1
  const raw = Number(new URLSearchParams(window.location.search).get('speed'))
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

const delay = () => (MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)) / speed()
const actionDelay = () =>
  (MIN_ACTIONS + Math.random() * (MAX_ACTIONS - MIN_ACTIONS)) / speed()

interface Options {
  setPaths: React.Dispatch<React.SetStateAction<GPath[]>>
  setNodes: React.Dispatch<React.SetStateAction<GNode[]>>
  /** Called once a path's whole chain has landed. */
  onSettled?: (pathId: string) => void
}

/**
 * Feeds a path its thoughts one at a time, so reasoning appears to be
 * worked out rather than arriving whole. The path stays `pending` —
 * and its target node provisional — until the last thought lands.
 */
export function useGeneration({ setPaths, setNodes, onSettled }: Options) {
  // Timers are keyed by path so a path can be cancelled independently.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const cancel = useCallback((pathId: string) => {
    const t = timers.current.get(pathId)
    if (t) clearTimeout(t)
    timers.current.delete(pathId)
  }, [])

  /** Start dripping `chain` into the path with the given id. */
  const generate = useCallback(
    (pathId: string, nodeId: string, chain: Thought[]) => {
      cancel(pathId)

      const step = (i: number) => {
        // Land one thought.
        setPaths((prev) =>
          prev.map((p) =>
            p.id === pathId
              ? {
                  ...p,
                  thoughts: chain.slice(0, i + 1),
                  status: i + 1 >= chain.length ? 'settled' : 'pending',
                }
              : p,
          ),
        )

        if (i + 1 >= chain.length) {
          // The chain is complete. The node stops thinking and starts
          // working out which actions it can offer.
          setNodes((prev) =>
            prev.map((n) =>
              n.id === nodeId ? { ...n, status: 'generating' } : n,
            ),
          )
          onSettled?.(pathId)

          timers.current.set(
            pathId,
            setTimeout(() => {
              timers.current.delete(pathId)
              setNodes((prev) =>
                prev.map((n) => (n.id === nodeId ? { ...n, status: 'idle' } : n)),
              )
            }, actionDelay()),
          )
          return
        }

        timers.current.set(pathId, setTimeout(() => step(i + 1), delay()))
      }

      // First thought lands after a beat, so the path visibly starts empty.
      timers.current.set(pathId, setTimeout(() => step(0), delay()))
    },
    [cancel, setPaths, setNodes, onSettled],
  )

  // Drop every pending timer when the canvas goes away.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  return { generate, cancel }
}

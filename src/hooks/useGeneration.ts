import { useCallback, useEffect, useRef } from 'react'
import type { GNode, GPath, Thought } from '../types'

/** Delay before the next thought lands, in ms. */
const MIN_DELAY = 1000
const MAX_DELAY = 3000

const delay = () => MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)

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
          timers.current.delete(pathId)
          // The chain is complete: the node is no longer provisional.
          setNodes((prev) =>
            prev.map((n) => (n.id === nodeId ? { ...n, status: 'settled' } : n)),
          )
          onSettled?.(pathId)
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

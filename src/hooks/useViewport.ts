import { useCallback, useEffect, useRef, useState } from 'react'

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2.5

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

interface Options {
  /** Element that receives wheel/drag input. */
  ref: React.RefObject<HTMLElement | null>
}

/**
 * Pan and zoom over a centred coordinate space.
 *
 * Screen position of a world point is:
 *   screen = centre + (world * zoom) + pan
 * so inverting gives the world point under the cursor, which is what
 * keeps zoom anchored where the pointer is rather than at the middle.
 */
export function useViewport({ ref }: Options) {
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [panning, setPanning] = useState(false)
  /** Set while an animated transition is running. */
  const [animating, setAnimating] = useState(false)
  const raf = useRef<number | null>(null)

  const stopAnimation = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    setAnimating(false)
  }, [])

  /** Convert a screen point to world coordinates. */
  const toWorld = useCallback(
    (clientX: number, clientY: number, vp: Viewport) => {
      const el = ref.current
      if (!el) return { x: 0, y: 0 }
      const r = el.getBoundingClientRect()
      const cx = clientX - r.left - r.width / 2 - vp.x
      const cy = clientY - r.top - r.height / 2 - vp.y
      return { x: cx / vp.zoom, y: cy / vp.zoom }
    },
    [ref],
  )

  /** Ease to a target viewport instead of snapping. */
  const animateTo = useCallback(
    (target: Viewport, ms = 320) => {
      stopAnimation()
      setAnimating(true)
      const from = { ...viewportRef.current }
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ms)
        // easeOutCubic
        const e = 1 - Math.pow(1 - t, 3)
        setViewport({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          zoom: from.zoom + (target.zoom - from.zoom) * e,
        })
        if (t < 1) raf.current = requestAnimationFrame(tick)
        else {
          raf.current = null
          setAnimating(false)
        }
      }
      raf.current = requestAnimationFrame(tick)
    },
    [stopAnimation],
  )

  // Kept in a ref so animateTo always eases from the live value.
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  /** Zoom by a factor, holding a screen point fixed. */
  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      setViewport((vp) => {
        const zoom = clampZoom(vp.zoom * factor)
        if (zoom === vp.zoom) return vp
        const el = ref.current
        if (!el) return { ...vp, zoom }
        const r = el.getBoundingClientRect()
        // Keep the world point under the cursor pinned there.
        const sx = clientX - r.left - r.width / 2
        const sy = clientY - r.top - r.height / 2
        const world = { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom }
        return { zoom, x: sx - world.x * zoom, y: sy - world.y * zoom }
      })
    },
    [ref],
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      stopAnimation()
      // Trackpad pinch arrives as ctrl+wheel; plain wheel scrolls/pans.
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
      } else {
        setViewport((vp) => ({ ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY }))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, zoomAt, stopAnimation])

  // Drag to pan: middle mouse, space-drag, or empty-canvas drag.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let id: number | null = null
    let last = { x: 0, y: 0 }

    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      // Only start a pan on blank canvas or with the middle button.
      const onBlank = target === el || target.classList.contains('stage-surface')
      if (e.button !== 1 && !(e.button === 0 && onBlank)) return
      stopAnimation()
      id = e.pointerId
      last = { x: e.clientX, y: e.clientY }
      el.setPointerCapture(e.pointerId)
      setPanning(true)
    }
    const onMove = (e: PointerEvent) => {
      if (id !== e.pointerId) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last = { x: e.clientX, y: e.clientY }
      setViewport((vp) => ({ ...vp, x: vp.x + dx, y: vp.y + dy }))
    }
    const onUp = (e: PointerEvent) => {
      if (id !== e.pointerId) return
      id = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      setPanning(false)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [ref, stopAnimation])

  useEffect(() => stopAnimation, [stopAnimation])

  return { viewport, setViewport, zoomAt, animateTo, toWorld, panning, animating }
}

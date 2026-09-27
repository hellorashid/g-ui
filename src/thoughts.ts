import type { Thought, ThoughtType } from './types'

/**
 * Placeholder reasoning chains, one per action. Eventually these come
 * from the model that actually performs the step; for now they give
 * the path something real to render and hover.
 */
const CHAINS: Record<string, [ThoughtType, string][]> = {
  connect: [
    ['observe', 'Source node holds a scalar value of 42'],
    ['decide', 'Linking as a direct reference, no coercion needed'],
  ],
  inspect: [
    ['observe', 'Value is stable across the last 5 samples'],
    ['retrieve', 'Pulled the type signature from sensor.a'],
    ['infer', 'Numeric range suggests a temperature reading'],
    ['verify', 'Confirmed units match the declared schema'],
  ],
  transform: [
    ['observe', 'Input arrives as an unbounded number'],
    ['retrieve', 'Loaded the downstream stage’s accepted range'],
    ['infer', 'A clamp is needed before the next stage'],
    ['decide', 'Applying ƒ(x) = min(max(x, 0), 100)'],
    ['verify', 'Output stays within the expected domain'],
    ['verify', 'Re-ran against 200 historical samples, no clipping'],
  ],
  duplicate: [
    ['observe', 'Node has no side effects to preserve'],
    ['decide', 'Copying value and type, dropping upstream links'],
  ],
  filter: [
    ['observe', 'Stream contains occasional negative spikes'],
    ['retrieve', 'Compared against the sensor’s rated floor'],
    ['infer', 'Spikes are sensor noise, not signal'],
    ['decide', 'Gating on x > 0'],
    ['verify', '94% of samples pass the gate'],
  ],
  output: [
    ['observe', 'Downstream consumer expects a single value'],
    ['retrieve', 'Resolved the sink target from config'],
    ['decide', 'Emitting on change rather than on interval'],
  ],
}

const FALLBACK: [ThoughtType, string][] = [
  ['observe', 'Read the current node state'],
  ['infer', 'Determined the next step from context'],
  ['decide', 'Applied the selected action'],
]

/** Build the chain for one path. */
export function thoughtsFor(actionId: string, pathId: string): Thought[] {
  const chain = CHAINS[actionId] ?? FALLBACK
  return chain.map(([type, description], i) => ({
    id: `${pathId}-t${i}`,
    type,
    description,
  }))
}

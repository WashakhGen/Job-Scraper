import { useEffect, useState } from 'react'

interface Props {
  steps: string[]
  active: boolean
  stepDurationMs?: number
  tone?: 'pending' | 'current'
}

/** Small inline status-dot + cycling mono label — e.g. "UPLOADING CV" then
 * "ANALYZING CV". Purely cosmetic: steps advance on a timer, not tied to
 * real backend progress. Matches the pipeline-run status-pill language. */
export default function StepLoader({ steps, active, stepDurationMs = 1400, tone = 'current' }: Props) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setIndex(0)
      return
    }
    const id = setInterval(() => {
      setIndex((i) => Math.min(i + 1, steps.length - 1))
    }, stepDurationMs)
    return () => clearInterval(id)
  }, [active, stepDurationMs, steps.length])

  if (!active) return null

  return (
    <span className="inline-flex items-center gap-2 font-mono text-[0.8em] font-medium uppercase tracking-wide">
      <span
        className={`status-pulse h-2 w-2 shrink-0 rounded-[2px] ${
          tone === 'pending' ? 'bg-status-pending' : 'bg-current'
        }`}
      />
      {steps[index]}
    </span>
  )
}

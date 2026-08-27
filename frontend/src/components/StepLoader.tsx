import { useEffect, useState } from 'react'

interface Props {
  steps: string[]
  active: boolean
  stepDurationMs?: number
}

/** Small inline spinner + cycling label — e.g. "Uploading CV…" then "Analyzing CV…".
 * Purely cosmetic: steps advance on a timer, not tied to real backend progress. */
export default function StepLoader({ steps, active, stepDurationMs = 1400 }: Props) {
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
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {steps[index]}
    </span>
  )
}

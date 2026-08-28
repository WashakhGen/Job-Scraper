import { useEffect, useRef, useState } from 'react'
import { scoreTone } from '../lib/format'

interface Props {
  score: number
  size?: number
}

const TONE_STROKE: Record<string, string> = {
  success: 'stroke-status-success',
  teal: 'stroke-brand-teal',
  idle: 'stroke-status-idle',
}

const TONE_TEXT: Record<string, string> = {
  success: 'text-status-success',
  teal: 'text-brand-teal',
  idle: 'text-status-idle',
}

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ScoreRing({ score, size = 56 }: Props) {
  const radius = size / 2 - 5
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, score))
  const center = size / 2
  const tone = scoreTone(clamped)

  // instrument-true reading: the number counts up to its value like a
  // physical gauge settling, instead of snapping straight in
  const [displayed, setDisplayed] = useState(prefersReducedMotion ? clamped : 0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayed(clamped)
      return
    }
    const start = performance.now()
    const duration = 600
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) * (1 - t) * (1 - t)
      setDisplayed(Math.round(clamped * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped])

  const offset = circumference * (1 - displayed / 100)

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="stroke-brand-border"
          strokeWidth="5"
          fill="none"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          className={`${TONE_STROKE[tone]} transition-[stroke-dashoffset] duration-150 ease-linear`}
          strokeWidth="5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={`tabular-nums absolute font-mono text-xs font-semibold ${TONE_TEXT[tone]}`}>
        {displayed}%
      </span>
    </div>
  )
}

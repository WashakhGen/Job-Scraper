import { useRef, useState } from 'react'

interface Props {
  value: number
  onChange: (value: number) => void
}

const SIZE = 110
const RADIUS = 46
const STROKE = 10
const CENTER = SIZE / 2

function angleFromPoint(cx: number, cy: number, x: number, y: number): number {
  // degrees, 0 = 12 o'clock, clockwise
  const deg = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90
  return deg < 0 ? deg + 360 : deg
}

export default function ScoreDial({ value, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)

  function updateFromPoint(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const deg = angleFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, clientX, clientY)
    onChange(Math.min(100, Math.max(0, Math.round((deg / 360) * 100))))
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (dragging) updateFromPoint(e.clientX, e.clientY)
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    onChange(Math.min(100, Math.max(0, value + (e.deltaY > 0 ? -1 : 1))))
  }

  const circumference = 2 * Math.PI * RADIUS
  const offset = circumference * (1 - value / 100)

  return (
    <svg
      ref={svgRef}
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDragging(false)}
      onWheel={handleWheel}
    >
      <circle cx={CENTER} cy={CENTER} r={RADIUS} className="stroke-brand-border" strokeWidth={STROKE} fill="none" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        className="stroke-brand-coral"
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
      <text
        x={CENTER}
        y={CENTER}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-brand-teal font-mono text-2xl font-semibold tabular-nums"
      >
        {value}
      </text>
    </svg>
  )
}

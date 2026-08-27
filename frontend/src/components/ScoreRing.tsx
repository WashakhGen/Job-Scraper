interface Props {
  score: number
  size?: number
}

export default function ScoreRing({ score, size = 56 }: Props) {
  const radius = size / 2 - 5
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100)
  const center = size / 2

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} className="stroke-brand-border" strokeWidth="5" fill="none" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="stroke-brand-coral"
          strokeWidth="5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-bold text-brand-teal">{Math.round(score)}%</span>
    </div>
  )
}

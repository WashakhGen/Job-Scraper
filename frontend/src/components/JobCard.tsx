import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setApplied } from '../api/client'
import { matchLabel, timeAgo } from '../lib/format'
import ScoreRing from './ScoreRing'

export interface CardJob {
  id: number
  title: string
  company: string
  location: string
  source: string
  posted_at: string | null
  score?: number
  applied?: boolean
}

interface Props {
  job: CardJob
  onAppliedChange?: (jobId: number, applied: boolean) => void
}

export default function JobCard({ job, onAppliedChange }: Props) {
  const navigate = useNavigate()
  const [marking, setMarking] = useState(false)

  function goToDetail() {
    navigate(`/job/${job.id}`)
  }

  async function handleToggleApplied(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !job.applied
    setMarking(true)
    try {
      await setApplied(job.id, next)
      onAppliedChange?.(job.id, next)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div
      onClick={goToDetail}
      className="flex h-full cursor-pointer flex-col rounded-xl border border-brand-border bg-brand-surface p-4 transition hover:border-brand-coral hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 min-h-12 font-semibold text-brand-text">{job.title}</h3>
          <p className="mt-1 text-sm text-brand-muted">{job.company}</p>
        </div>
        {job.score !== undefined && (
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={job.score} size={56} />
            <span className="text-center text-[10px] font-medium leading-tight text-brand-muted">
              {matchLabel(job.score)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-brand-muted">
        <span className="truncate rounded-full bg-brand-bg px-2 py-1 font-medium text-brand-teal">
          {job.source}
        </span>
        <span className="truncate pl-2">{job.location}</span>
      </div>

      {job.posted_at && <p className="mt-2 text-[11px] text-brand-muted">{timeAgo(job.posted_at)}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            goToDetail()
          }}
          className="rounded-full bg-brand-coral px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-coral-dark"
        >
          Apply Now
        </button>

        <button
          type="button"
          onClick={handleToggleApplied}
          disabled={marking}
          title={job.applied ? 'Mark as not applied' : 'Mark as applied'}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            job.applied
              ? 'border-brand-teal bg-brand-teal text-white'
              : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
          }`}
        >
          {marking ? '…' : job.applied ? '✓ Applied' : 'Mark Applied'}
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setApplied } from '../api/client'
import { matchLabel, scoreTone, timeAgo } from '../lib/format'
import StatusPill from './StatusPill'

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
  /** grid position — drives the check-in stagger, purely cosmetic */
  index?: number
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.8}>
      <path
        d="M12 2 3 11v2l9 9 9-9V4a2 2 0 0 0-2-2h-7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.2" />
    </svg>
  )
}

export default function JobCard({ job, onAppliedChange, index = 0 }: Props) {
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

  const tone = job.score !== undefined ? scoreTone(job.score) : 'idle'
  const scoreToneText =
    tone === 'success' ? 'text-status-success' : tone === 'teal' ? 'text-brand-teal' : 'text-status-idle'

  return (
    <div
      onClick={goToDetail}
      className="row-check-in group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-white/70 bg-white/65 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_28px_-12px_rgba(15,23,42,0.18)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-white/90 hover:bg-white/80 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_20px_36px_-14px_rgba(15,23,42,0.22)]"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      {/* glass sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-white/40 blur-2xl" />

      {job.applied && (
        <div className="absolute -left-9 top-3 -rotate-45 bg-status-success px-9 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
          Applied
        </div>
      )}

      <h3 className="line-clamp-2 min-h-11 font-semibold leading-snug text-brand-text">{job.title}</h3>

      <div className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-surface px-2 py-1 font-mono text-[11px] text-brand-teal">
          <TagIcon />
          {job.source}
        </span>
        {job.posted_at && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-brand-muted">
            <ClockIcon />
            {timeAgo(job.posted_at)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-brand-border-strong bg-brand-bg p-2.5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-brand-muted">
            Match Score
          </p>
          {job.score !== undefined ? (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`font-mono text-lg font-bold tabular-nums ${scoreToneText}`}>
                {Math.round(job.score)}%
              </span>
              <span className="text-xs font-semibold text-brand-muted">
                {matchLabel(job.score).replace(' Match', '')}
              </span>
            </div>
          ) : (
            <div className="mt-1.5">
              <StatusPill tone="idle">Queued</StatusPill>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-brand-border-strong bg-brand-bg p-2.5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-brand-muted">Status</p>
          <div className="mt-1.5">
            {job.applied ? (
              <StatusPill tone="success">Applied</StatusPill>
            ) : job.score !== undefined ? (
              <StatusPill tone={tone === 'idle' ? 'idle' : tone === 'success' ? 'success' : 'teal'}>
                Ready
              </StatusPill>
            ) : (
              <StatusPill tone="idle">Pending</StatusPill>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-brand-border pt-3">
        <div>
          <p className="truncate font-semibold text-brand-text">{job.company}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-brand-muted">
            <PinIcon />
            {job.location}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goToDetail()
            }}
            className="flex-1 rounded-md bg-brand-coral px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-brand-coral-dark"
          >
            Apply Now
          </button>
          <button
            type="button"
            onClick={handleToggleApplied}
            disabled={marking}
            className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
              job.applied
                ? 'border-status-success bg-status-success-bg text-status-success'
                : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
            }`}
          >
            {marking ? '…' : job.applied ? '✓ Applied' : 'Mark Applied'}
          </button>
        </div>
      </div>
    </div>
  )
}

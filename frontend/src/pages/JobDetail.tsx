import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, useParams } from 'react-router-dom'
import { coverLetterPdfUrl, generateCoverLetter, getJobDetail, setApplied } from '../api/client'
import type { JobDetail as JobDetailType } from '../api/types'
import { matchLabel, timeAgo } from '../lib/format'
import ScoreRing from '../components/ScoreRing'
import StatusPill from '../components/StatusPill'
import StepLoader from '../components/StepLoader'

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-brand-text">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-brand-border bg-brand-surface p-5 ${className}`}>
      {children}
    </div>
  )
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
      {children}
    </h2>
  )
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<JobDetailType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!id) return
    getJobDetail(Number(id))
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load job'))
  }, [id])

  async function handleToggleApplied() {
    if (!job) return
    const next = !job.applied
    setMarking(true)
    try {
      await setApplied(job.job_id, next)
      setJob({ ...job, applied: next })
    } finally {
      setMarking(false)
    }
  }

  function copyCoverLetter() {
    if (!job?.cover_letter) return
    navigator.clipboard.writeText(job.cover_letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleGenerateCoverLetter() {
    if (!job) return
    setGenerating(true)
    try {
      const updated = await generateCoverLetter(job.job_id)
      setJob(updated)
    } finally {
      setGenerating(false)
    }
  }

  if (error) {
    return <div className="p-6 text-status-danger">{error}</div>
  }

  if (job === null) {
    return <div className="p-6 font-mono text-sm text-brand-muted">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 text-sm font-medium text-brand-teal hover:underline"
      >
        ← Back
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* main column */}
        <div className="col-span-2 flex flex-col gap-6">
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-brand-text">{job.title}</h1>
                <p className="mt-1 text-brand-muted">{job.company}</p>
              </div>
              {job.applied && (
                <StatusPill tone="success" dot className="shrink-0">
                  Applied
                </StatusPill>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-brand-faint">
              <span className="rounded border border-brand-border bg-brand-bg px-2 py-1 font-medium text-brand-teal">
                {job.source}
              </span>
              <span>{job.location}</span>
              {job.posted_at && <span>· {timeAgo(job.posted_at)}</span>}
            </div>
          </Panel>

          {job.cover_letter ? (
            <Panel className="border-brand-coral bg-brand-coral-bg/40">
              <div className="flex items-center justify-between">
                <PanelTitle>Cover Letter</PanelTitle>
                <button
                  type="button"
                  onClick={copyCoverLetter}
                  className="text-xs font-medium text-brand-coral hover:underline"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 text-sm leading-relaxed text-brand-text">
                <ReactMarkdown components={markdownComponents}>{job.cover_letter}</ReactMarkdown>
              </div>
              <a
                href={coverLetterPdfUrl(job.job_id)}
                className="mt-4 inline-block rounded-md border border-brand-coral px-3 py-1.5 text-xs font-semibold text-brand-coral transition hover:bg-brand-coral hover:text-white"
              >
                Download PDF
              </a>
            </Panel>
          ) : (
            <Panel className="text-center">
              <p className="text-sm text-brand-muted">
                No cover letter yet — this job wasn't recommended, so one wasn't generated
                automatically.
              </p>
              <button
                type="button"
                onClick={handleGenerateCoverLetter}
                disabled={generating}
                className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-coral px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-coral-dark disabled:opacity-50"
              >
                {generating ? (
                  <StepLoader steps={['Reviewing match…', 'Writing cover letter…']} active={generating} />
                ) : (
                  'Generate Cover Letter'
                )}
              </button>
            </Panel>
          )}

          {job.rationale && (
            <Panel>
              <PanelTitle>Why This Score</PanelTitle>
              <p className="mt-2 text-sm text-brand-muted">{job.rationale}</p>

              {(job.matched.length > 0 || job.missing.length > 0) && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {job.matched.length > 0 && (
                    <div>
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-faint">
                        Matched
                      </p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {job.matched.map((m) => (
                          <li key={m}>
                            <StatusPill tone="success" shape="chip">
                              {m}
                            </StatusPill>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {job.missing.length > 0 && (
                    <div>
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-faint">
                        Missing
                      </p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {job.missing.map((m) => (
                          <li key={m}>
                            <StatusPill tone="idle" shape="chip">
                              {m}
                            </StatusPill>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}

          <Panel>
            <PanelTitle>Job Description</PanelTitle>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-muted">
              {job.description}
            </p>
          </Panel>
        </div>

        {/* sidebar */}
        <div className="flex flex-col gap-4">
          <Panel>
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md bg-brand-coral px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-coral-dark"
            >
              Apply Now ↗
            </a>
            <button
              type="button"
              onClick={handleToggleApplied}
              disabled={marking}
              className={`mt-2 w-full rounded-md border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                job.applied
                  ? 'border-status-success bg-status-success-bg text-status-success'
                  : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
              }`}
            >
              {marking ? '…' : job.applied ? '✓ Applied' : 'Mark Applied'}
            </button>
          </Panel>

          {job.score !== null && job.score !== undefined && (
            <Panel className="flex flex-col items-center gap-1">
              <ScoreRing score={job.score} size={80} />
              <span className="mt-1 text-sm font-medium text-brand-muted">{matchLabel(job.score)}</span>
            </Panel>
          )}

          <Panel className="text-sm">
            <PanelTitle>Job Overview</PanelTitle>
            <dl className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-brand-muted">Source</dt>
                <dd className="font-medium text-brand-text">{job.source}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-brand-muted">Location</dt>
                <dd className="font-medium text-brand-text">{job.location}</dd>
              </div>
              {job.posted_at && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-brand-muted">Posted</dt>
                  <dd className="font-medium text-brand-text">{timeAgo(job.posted_at)}</dd>
                </div>
              )}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}

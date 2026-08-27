import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, useParams } from 'react-router-dom'
import { coverLetterPdfUrl, generateCoverLetter, getJobDetail, setApplied } from '../api/client'
import type { JobDetail as JobDetailType } from '../api/types'
import { matchLabel, timeAgo } from '../lib/format'
import ScoreRing from '../components/ScoreRing'

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
    return <div className="p-6 text-red-600">{error}</div>
  }

  if (job === null) {
    return <div className="p-6 text-brand-muted">Loading…</div>
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
          <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
            <h1 className="text-xl font-bold text-brand-text">{job.title}</h1>
            <p className="mt-1 text-brand-muted">{job.company}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-brand-muted">
              <span className="rounded-full bg-brand-bg px-2 py-1 font-medium text-brand-teal">
                {job.source}
              </span>
              <span>{job.location}</span>
              {job.posted_at && <span>· {timeAgo(job.posted_at)}</span>}
            </div>
          </div>

          {job.cover_letter ? (
            <div className="rounded-xl border border-brand-coral bg-orange-50 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-brand-text">Cover Letter</h2>
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
                className="mt-4 inline-block rounded-full border border-brand-coral px-3 py-1.5 text-xs font-semibold text-brand-coral transition hover:bg-brand-coral hover:text-white"
              >
                Download PDF
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5 text-center">
              <p className="text-sm text-brand-muted">
                No cover letter yet — this job wasn't recommended, so one wasn't generated
                automatically.
              </p>
              <button
                type="button"
                onClick={handleGenerateCoverLetter}
                disabled={generating}
                className="mt-3 rounded-full bg-brand-coral px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-coral-dark disabled:opacity-50"
              >
                {generating ? 'Generating…' : 'Generate Cover Letter'}
              </button>
            </div>
          )}

          {job.rationale && (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
              <h2 className="font-semibold text-brand-text">Why This Score</h2>
              <p className="mt-2 text-sm text-brand-muted">{job.rationale}</p>

              {(job.matched.length > 0 || job.missing.length > 0) && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {job.matched.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                        Matched
                      </p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {job.matched.map((m) => (
                          <li key={m} className="flex items-start gap-1.5 text-sm text-brand-text">
                            <span className="text-green-600">✓</span> {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {job.missing.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                        Missing
                      </p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {job.missing.map((m) => (
                          <li key={m} className="flex items-start gap-1.5 text-sm text-brand-text">
                            <span className="text-red-500">✕</span> {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
            <h2 className="font-semibold text-brand-text">Job Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-muted">
              {job.description}
            </p>
          </div>
        </div>

        {/* sidebar */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-full bg-brand-coral px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-coral-dark"
            >
              Apply Now ↗
            </a>
            <button
              type="button"
              onClick={handleToggleApplied}
              disabled={marking}
              className={`mt-2 w-full rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                job.applied
                  ? 'border-brand-teal bg-brand-teal text-white'
                  : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
              }`}
            >
              {marking ? '…' : job.applied ? '✓ Applied' : 'Mark Applied'}
            </button>
          </div>

          {job.score !== null && job.score !== undefined && (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-brand-border bg-brand-surface p-5">
              <ScoreRing score={job.score} size={80} />
              <span className="mt-1 text-sm font-medium text-brand-muted">{matchLabel(job.score)}</span>
            </div>
          )}

          <div className="rounded-xl border border-brand-border bg-brand-surface p-5 text-sm">
            <h2 className="font-semibold text-brand-text">Job Overview</h2>
            <dl className="mt-3 flex flex-col gap-2">
              <div className="flex justify-between">
                <dt className="text-brand-muted">Source</dt>
                <dd className="font-medium text-brand-text">{job.source}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-brand-muted">Location</dt>
                <dd className="font-medium text-brand-text">{job.location}</dd>
              </div>
              {job.posted_at && (
                <div className="flex justify-between">
                  <dt className="text-brand-muted">Posted</dt>
                  <dd className="font-medium text-brand-text">{timeAgo(job.posted_at)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

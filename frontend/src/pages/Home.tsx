import { useEffect, useState } from 'react'
import { listJobs, listRecommended } from '../api/client'
import type { JobOut, JobRecommendation } from '../api/types'
import GlassCardGrid from '../components/GlassCardGrid'
import JobCard, { type CardJob } from '../components/JobCard'

function toCard(job: JobRecommendation | JobOut, appliedOverride?: boolean): CardJob {
  if ('job_id' in job) {
    return {
      id: job.job_id,
      title: job.title,
      company: job.company,
      location: job.location,
      source: job.source,
      posted_at: job.posted_at,
      score: job.score,
      applied: appliedOverride ?? job.applied,
    }
  }
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    source: job.source,
    posted_at: job.posted_at,
    applied: appliedOverride ?? false,
  }
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-text">{label}</h2>
      <span className="font-mono text-xs text-brand-faint">{count}</span>
    </div>
  )
}

export default function Home() {
  const [recommended, setRecommended] = useState<JobRecommendation[] | null>(null)
  const [allJobs, setAllJobs] = useState<JobOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [appliedOverrides, setAppliedOverrides] = useState<Record<number, boolean>>({})

  useEffect(() => {
    Promise.all([listRecommended(), listJobs()])
      .then(([rec, all]) => {
        setRecommended(rec)
        setAllJobs(all)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load jobs'))
  }, [])

  if (error) {
    return <div className="p-6 text-status-danger">{error}</div>
  }

  if (recommended === null || allJobs === null) {
    return <div className="p-6 font-mono text-sm text-brand-muted">Loading…</div>
  }

  const top9 = recommended.slice(0, 9)
  const shownIds = new Set(top9.map((j) => j.job_id))
  const otherJobs = allJobs.filter((j) => !shownIds.has(j.id))

  function handleAppliedChange(jobId: number, applied: boolean) {
    if (applied) {
      setRecommended((prev) => prev?.filter((j) => j.job_id !== jobId) ?? prev)
    }
    setAppliedOverrides((prev) => ({ ...prev, [jobId]: applied }))
  }

  return (
    <div className="p-6">
      <section>
        <SectionHeader label="Top Recommended" count={top9.length} />
        {top9.length === 0 ? (
          <p className="rounded-lg border border-dashed border-brand-border px-4 py-6 text-center text-sm text-brand-muted">
            No recommendations yet — trigger a fetch to get started.
          </p>
        ) : (
          <GlassCardGrid>
            {top9.map((job, i) => (
              <JobCard
                key={job.job_id}
                job={toCard(job, appliedOverrides[job.job_id])}
                onAppliedChange={handleAppliedChange}
                index={i}
              />
            ))}
          </GlassCardGrid>
        )}
      </section>

      <section className="mt-10">
        <SectionHeader label="All Jobs" count={otherJobs.length} />
        {otherJobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-brand-border px-4 py-6 text-center text-sm text-brand-muted">
            Nothing else yet.
          </p>
        ) : (
          <GlassCardGrid>
            {otherJobs.map((job, i) => (
              <JobCard
                key={job.id}
                job={toCard(job, appliedOverrides[job.id])}
                onAppliedChange={handleAppliedChange}
                index={i}
              />
            ))}
          </GlassCardGrid>
        )}
      </section>
    </div>
  )
}

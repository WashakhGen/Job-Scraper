import { useEffect, useState } from 'react'
import { listJobs, listRecommended } from '../api/client'
import type { JobOut, JobRecommendation } from '../api/types'
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
    return <div className="p-6 text-red-600">{error}</div>
  }

  if (recommended === null || allJobs === null) {
    return <div className="p-6 text-brand-muted">Loading…</div>
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
        <h2 className="mb-4 text-lg font-bold text-brand-teal">Top Recommended</h2>
        {top9.length === 0 ? (
          <p className="text-sm text-brand-muted">
            No recommendations yet — trigger a scrape to get started.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {top9.map((job) => (
              <JobCard
                key={job.job_id}
                job={toCard(job, appliedOverrides[job.job_id])}
                onAppliedChange={handleAppliedChange}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-brand-teal">All Jobs</h2>
        {otherJobs.length === 0 ? (
          <p className="text-sm text-brand-muted">Nothing else yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {otherJobs.map((job) => (
              <JobCard
                key={job.id}
                job={toCard(job, appliedOverrides[job.id])}
                onAppliedChange={handleAppliedChange}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

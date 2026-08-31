import { useEffect, useState } from 'react'
import { listManualJobs } from '../api/client'
import type { JobRecommendation } from '../api/types'
import GlassCardGrid from '../components/GlassCardGrid'
import JobCard from '../components/JobCard'

export default function MyJobs() {
  const [jobs, setJobs] = useState<JobRecommendation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listManualJobs()
      .then(setJobs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load jobs'))
  }, [])

  // this list is a standing inventory, not a filtered queue — applying
  // updates the badge in place instead of removing the job, unlike Recommended
  function handleAppliedChange(jobId: number, applied: boolean) {
    setJobs((prev) => prev?.map((j) => (j.job_id === jobId ? { ...j, applied } : j)) ?? prev)
  }

  if (error) {
    return <div className="p-6 text-status-danger">{error}</div>
  }

  if (jobs === null) {
    return <div className="p-6 font-mono text-sm text-brand-muted">Loading…</div>
  }

  return (
    <div className="p-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-text">My Jobs</h2>
        <span className="font-mono text-xs text-brand-faint">{jobs.length}</span>
      </div>
      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-border px-4 py-6 text-center text-sm text-brand-muted">
          Nothing here yet — use "Bring Your own Job" to add one.
        </p>
      ) : (
        <GlassCardGrid>
          {jobs.map((job, i) => (
            <JobCard
              key={job.job_id}
              job={{
                id: job.job_id,
                title: job.title,
                company: job.company,
                location: job.location,
                source: job.source,
                posted_at: job.posted_at,
                score: job.score,
                applied: job.applied,
              }}
              onAppliedChange={handleAppliedChange}
              index={i}
            />
          ))}
        </GlassCardGrid>
      )}
    </div>
  )
}

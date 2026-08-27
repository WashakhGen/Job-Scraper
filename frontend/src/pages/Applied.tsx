import { useEffect, useState } from 'react'
import { listApplied } from '../api/client'
import type { JobRecommendation } from '../api/types'
import JobCard from '../components/JobCard'

export default function Applied() {
  const [jobs, setJobs] = useState<JobRecommendation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listApplied()
      .then(setJobs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load jobs'))
  }, [])

  function handleAppliedChange(jobId: number, applied: boolean) {
    // unmarking here means it belongs back on Recommended, not this list
    if (!applied) {
      setJobs((prev) => prev?.filter((j) => j.job_id !== jobId) ?? prev)
    }
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  if (jobs === null) {
    return <div className="p-6 text-brand-muted">Loading…</div>
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-bold text-brand-teal">Applied Jobs</h2>
      {jobs.length === 0 ? (
        <p className="text-sm text-brand-muted">Nothing applied yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {jobs.map((job) => (
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { listRecommended } from '../api/client'
import type { JobRecommendation } from '../api/types'
import JobCard from '../components/JobCard'

export default function Recommended() {
  const [jobs, setJobs] = useState<JobRecommendation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRecommended()
      .then(setJobs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load jobs'))
  }, [])

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  if (jobs === null) {
    return <div className="p-6 text-brand-muted">Loading…</div>
  }

  function handleAppliedChange(jobId: number, applied: boolean) {
    // marking applied here means it moves off Recommended onto Applied
    if (applied) {
      setJobs((prev) => prev?.filter((j) => j.job_id !== jobId) ?? prev)
    }
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-bold text-brand-teal">Recommended Jobs</h2>
      {jobs.length === 0 ? (
        <p className="text-sm text-brand-muted">
          No recommendations yet — trigger a scrape to get started.
        </p>
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

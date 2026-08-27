import type { AppSettings, CandidateProfile, CV, JobDetail, JobOut, JobRecommendation } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail ?? `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── CV ──────────────────────────────────────────────
export const listCvs = () => request<CV[]>('/cv')

export const uploadCv = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return request<CV>('/cv', { method: 'POST', body: form })
}

export const activateCv = (id: number) => request<CV>(`/cv/${id}/activate`, { method: 'PUT' })

export const deleteCv = (id: number) => request<void>(`/cv/${id}`, { method: 'DELETE' })

export const updateCvKeywords = (id: number, keywords: string[]) =>
  request<CV>(`/cv/${id}/keywords`, {
    method: 'PUT',
    body: JSON.stringify({ keywords }),
  })

export const getProfile = () => request<CandidateProfile>('/cv/profile')

export const updateProfile = (profile: CandidateProfile) =>
  request<CandidateProfile>('/cv/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  })

// ── Jobs ────────────────────────────────────────────
export const listJobs = () => request<JobOut[]>('/jobs')

export const listRecommended = (cvId?: number) =>
  request<JobRecommendation[]>(`/jobs/recommended${cvId ? `?cv_id=${cvId}` : ''}`)

export const listApplied = (cvId?: number) =>
  request<JobRecommendation[]>(`/jobs/applied${cvId ? `?cv_id=${cvId}` : ''}`)

export const getJobDetail = (jobId: number, cvId?: number) =>
  request<JobDetail>(`/jobs/detail/${jobId}${cvId ? `?cv_id=${cvId}` : ''}`)

export const setApplied = (jobId: number, applied: boolean) =>
  request<JobRecommendation>(`/jobs/${jobId}/applied`, {
    method: 'PUT',
    body: JSON.stringify({ applied }),
  })

export const generateCoverLetter = (jobId: number, cvId?: number) =>
  request<JobDetail>(`/jobs/${jobId}/cover-letter${cvId ? `?cv_id=${cvId}` : ''}`, {
    method: 'POST',
  })

// server-rendered file, not fetched as JSON — used directly as a link href
export const coverLetterPdfUrl = (jobId: number, cvId?: number) =>
  `/api/jobs/${jobId}/cover-letter.pdf${cvId ? `?cv_id=${cvId}` : ''}`

// ── Settings ────────────────────────────────────────
export const getSettings = () => request<AppSettings>('/jobs/settings')

export const updateSettings = (minScore: number, locations: string[]) =>
  request<AppSettings>('/jobs/settings', {
    method: 'PUT',
    body: JSON.stringify({ min_score: minScore, locations }),
  })

// ── Scrape ──────────────────────────────────────────
export const triggerScrape = (source: string, location?: string, limit?: number) =>
  request<{ status: string; source: string }>(`/scrape/${source}`, {
    method: 'POST',
    body: JSON.stringify({ location, limit }),
  })

export const triggerScrapeAll = (location?: string, limit?: number) =>
  request<{ status: string; source: string }>('/scrape/all', {
    method: 'POST',
    body: JSON.stringify({ location, limit }),
  })

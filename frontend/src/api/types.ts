export interface CV {
  id: number
  filename: string
  keywords: string[]
  is_active: boolean
  uploaded_at: string
}

export interface JobOut {
  id: number
  source: string
  external_id: string
  title: string
  company: string
  location: string
  url: string
  description: string
  posted_at: string | null
  scraped_at: string
}

export interface JobRecommendation {
  job_id: number
  title: string
  company: string
  location: string
  url: string
  source: string
  posted_at: string | null
  score: number
  rationale: string
  matched: string[]
  missing: string[]
  cover_letter: string | null
  scored_at: string
  applied: boolean
}

export interface JobDetail {
  job_id: number
  title: string
  company: string
  location: string
  url: string
  source: string
  description: string
  posted_at: string | null
  scraped_at: string
  score: number | null
  rationale: string | null
  matched: string[]
  missing: string[]
  cover_letter: string | null
  applied: boolean
  scored_at: string | null
}

export interface AppSettings {
  min_score: number
  locations: string[]
}

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

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export interface ScheduleConfig {
  enabled: boolean
  frequency: ScheduleFrequency
  hour: number
  minute: number
  day_of_week: number | null // 0=Mon..6=Sun, weekly only
  day_of_month: number | null // 1-28, monthly only
  limit: number
  last_run_at: string | null
  next_run_at: string | null
}

export interface CandidateProfile {
  name: string
  headline: string
  location: string
  phone: string
  email: string
  links: string[]
}

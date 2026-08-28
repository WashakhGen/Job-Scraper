export function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

export function matchLabel(score: number): string {
  if (score >= 90) return 'Excellent Match'
  if (score >= 75) return 'Strong Match'
  if (score >= 60) return 'Good Match'
  return 'Weak Match'
}

export function formatRelative(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const diffMs = date.getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60000)
  const abs = Math.abs(diffMin)
  const unit = abs < 60 ? `${abs}m` : abs < 1440 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`
  return diffMin >= 0 ? `in ${unit}` : `${unit} ago`
}

export type ScoreTone = 'success' | 'teal' | 'idle'

/** Shared score→color-role mapping so the ring and every status pill agree. */
export function scoreTone(score: number): ScoreTone {
  if (score >= 75) return 'success'
  if (score >= 60) return 'teal'
  return 'idle'
}

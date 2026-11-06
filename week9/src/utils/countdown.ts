import { Assignment, UrgencyInfo } from '../types'

export function getUrgency(assignment: Assignment): UrgencyInfo {
  if (assignment.completed) return { daysRemaining: 999, colorClass: 'future' }

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(assignment.dueDate + 'T00:00:00')
  const diff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  let colorClass: UrgencyInfo['colorClass']
  if (diff < 0) colorClass = 'overdue'
  else if (diff <= 2) colorClass = 'due-soon'
  else if (diff <= 7) colorClass = 'this-week'
  else colorClass = 'future'

  return { daysRemaining: diff, colorClass }
}

interface LabelTranslations {
  done: string
  overdue: (days: number) => string
  dueYesterday: string
  dueToday: string
  dueTomorrow: string
  dueInDays: (days: number) => string
}

export function formatUrgencyLabel(urgency: UrgencyInfo, completed: boolean, t: LabelTranslations): string {
  if (completed) return t.done
  const days = urgency.daysRemaining
  if (days < -1) return t.overdue(-days)
  if (days === -1) return t.dueYesterday
  if (days === 0) return t.dueToday
  if (days === 1) return t.dueTomorrow
  return t.dueInDays(days)
}

export function urgencyColor(urgency: UrgencyInfo, dark: boolean): { bg: string; fg: string } {
  if (dark) {
    switch (urgency.colorClass) {
      case 'overdue': return { bg: '#3D1F1F', fg: '#D94F4F' }
      case 'due-soon': return { bg: '#3D2F1A', fg: '#E0A040' }
      case 'this-week': return { bg: '#2A3D2A', fg: '#6E916E' }
      case 'future': return { bg: 'transparent', fg: '#F0EAE5' }
    }
  }
  switch (urgency.colorClass) {
    case 'overdue': return { bg: '#FDEDEC', fg: '#8B1D15' }
    case 'due-soon': return { bg: '#FEF5E7', fg: '#9A5410' }
    case 'this-week': return { bg: '#EDF3ED', fg: '#3D563D' }
    case 'future': return { bg: 'transparent', fg: '#2B2622' }
  }
}

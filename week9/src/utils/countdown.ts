import { Assignment, UrgencyInfo } from '../types'

export function getUrgency(assignment: Assignment): UrgencyInfo {
  if (assignment.completed) return { daysRemaining: 999, label: 'Done', colorClass: 'future' }

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(assignment.dueDate + 'T00:00:00')
  const diff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  let colorClass: UrgencyInfo['colorClass']
  if (diff < 0) colorClass = 'overdue'
  else if (diff <= 2) colorClass = 'due-soon'
  else if (diff <= 7) colorClass = 'this-week'
  else colorClass = 'future'

  return { daysRemaining: diff, label: formatLabel(diff), colorClass }
}

function formatLabel(days: number): string {
  if (days < -1) return `${-days}d overdue`
  if (days === -1) return 'Due yesterday'
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
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

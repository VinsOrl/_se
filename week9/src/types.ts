export interface Assignment {
  id: string
  name: string
  dueDate: string
  completed: boolean
  createdAt: number
}

export type Filter = 'all' | 'pending' | 'completed'

export interface UrgencyInfo {
  daysRemaining: number
  label: string
  colorClass: 'overdue' | 'due-soon' | 'this-week' | 'future'
}

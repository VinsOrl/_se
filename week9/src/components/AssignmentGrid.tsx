import { Assignment } from '../types'
import AssignmentCard from './AssignmentCard'

interface AssignmentGridProps {
  assignments: Assignment[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}

export default function AssignmentGrid({ assignments, onToggle, onRemove }: AssignmentGridProps) {
  if (!assignments.length) return null

  return (
    <div className="px-6 pb-12">
      <div className="page-container grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-fr">
        {assignments.map(a => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            onToggle={() => onToggle(a.id)}
            onRemove={() => onRemove(a.id)}
          />
        ))}
      </div>
    </div>
  )
}

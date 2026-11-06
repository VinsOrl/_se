import { useState, useEffect } from 'react'
import { Assignment } from '../types'
import { getUrgency, urgencyColor } from '../utils/countdown'
import { clsx } from 'clsx'
import { motion } from 'motion/react'
import { Check, Trash2 } from 'lucide-react'

interface AssignmentCardProps {
  assignment: Assignment
  onToggle: () => void
  onRemove: () => void
}

export default function AssignmentCard({ assignment, onToggle, onRemove }: AssignmentCardProps) {
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(!!document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const urgency = getUrgency(assignment)
  const colors = urgencyColor(urgency, dark)

  const dateStr = new Date(assignment.dueDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, margin: 0 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-card group relative overflow-hidden"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Urgency indicator bar */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: colors.fg, opacity: assignment.completed ? 0.2 : 0.5 }}
      />

      <div className="p-5 flex flex-col gap-3">
        {/* Header: name + delete */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`font-heading text-lg font-medium leading-snug ${assignment.completed ? 'line-through opacity-50' : ''} dark:text-ink-light`}
          >
            {assignment.name}
          </h3>
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-black/10 transition-all"
            title="Remove"
          >
            <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
          </button>
        </div>

        {/* Due date */}
        <span className="text-sm font-body leading-relaxed opacity-70">
          {dateStr}
        </span>

        {/* Divider */}
        <hr className="border-line/50 dark:border-white/10" />

        {/* Footer: urgency + toggle */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span
            className="text-sm font-bold tracking-wide dark:text-ink-light"
            style={{ color: colors.fg }}
          >
            {urgency.label}
          </span>
          <button
            onClick={onToggle}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all hover:-translate-y-[3px]',
              assignment.completed
                ? 'bg-sage/80 text-white'
                : 'border border-sage/60 text-ink dark:text-ink-light hover:bg-sage/10'
            )}
          >
            <Check className="w-4 h-4" />
            <span>{assignment.completed ? 'Done' : 'Pending'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

import { useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import AddAssignment from './components/AddAssignment'
import FilterBar from './components/FilterBar'
import AssignmentGrid from './components/AssignmentGrid'
import EmptyState from './components/EmptyState'
import { useAssignments } from './hooks/use-assignments'
import { getUrgency } from './utils/countdown'
import { motion, AnimatePresence } from 'motion/react'

export default function App() {
  const { assignments, add, toggle, remove } = useAssignments()
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [showAdd, setShowAdd] = useState(false)

  // Sort: urgency first (overdue → due-soon → this-week → future), then by date, completed sink
  const sorted = [...assignments].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    const urgOrder: Record<string, number> = { overdue: 0, 'due-soon': 1, 'this-week': 2, future: 3 }
    const ua = getUrgency(a).colorClass
    const ub = getUrgency(b).colorClass
    return (urgOrder[ua] - urgOrder[ub]) || (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  })

  const filtered = filter === 'all' ? sorted : sorted.filter(a => a.completed === (filter === 'completed'))

  const counts = {
    all: assignments.length,
    pending: assignments.filter(a => !a.completed).length,
    completed: assignments.filter(a => a.completed).length,
  }

  return (
    <div className="min-h-screen bg-paper dark:bg-paper-dark transition-colors">
      <Navbar onAdd={() => setShowAdd(true)} />
      {!showAdd && <Hero />}
      {showAdd && <AddAssignment onAdd={(name, date) => { add(name, date); setShowAdd(false) }} onClose={() => setShowAdd(false)} />}

      <AnimatePresence>
        {assignments.length > 0 ? (
          <>
            <FilterBar filter={filter} onFilter={setFilter} counts={counts} />
            <AssignmentGrid assignments={filtered} onToggle={toggle} onRemove={remove} />
          </>
        ) : !showAdd ? (
          <EmptyState onAdd={() => setShowAdd(true)} />
        ) : null}
      </AnimatePresence>

      {/* Always-visible floating add button when items exist */}
      {assignments.length > 0 && !showAdd && (
        <motion.button
          onClick={() => setShowAdd(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 bg-sage hover:bg-emerald-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50 transition-colors"
        >
          <motion.div initial={false} animate={{ rotate: showAdd ? 45 : 0 }}>
            <svg width="24" height="24" viewBox="6 6 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="9" x2="12" y2="15" />
              <line x1="9" y1="12" x2="15" y2="12" />
            </svg>
          </motion.div>
        </motion.button>
      )}
    </div>
  )
}

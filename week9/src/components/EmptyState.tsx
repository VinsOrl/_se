import { motion } from 'motion/react'

interface EmptyStateProps {
  onAdd: () => void
}

export default function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-6 py-20 text-center"
    >
      <div className="page-container">
        <p className="text-muted dark:text-muted-dark text-lg mb-4">
          No assignments yet. Add your first one!
        </p>
        <button
          onClick={onAdd}
          className="rounded-full bg-sage hover:bg-emerald-700 text-white font-bold py-3 px-8 transition-all hover:-translate-y-[2px]"
        >
          Add Assignment
        </button>
      </div>
    </motion.section>
  )
}

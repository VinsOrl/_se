import { motion } from 'motion/react'
import { useLang } from '../i18n'

interface EmptyStateProps {
  onAdd: () => void
}

export default function EmptyState({ onAdd }: EmptyStateProps) {
  const { t } = useLang()

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-6 py-20 text-center"
    >
      <div className="page-container">
        <p className="text-muted dark:text-muted-dark text-lg mb-4">
          {t.emptyTitle}
        </p>
        <button
          onClick={onAdd}
          className="rounded-full bg-sage hover:bg-emerald-700 text-white font-bold py-3 px-8 transition-all hover:-translate-y-[2px]"
        >
          {t.addAssignment}
        </button>
      </div>
    </motion.section>
  )
}

import { useState } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { useLang } from '../i18n'

interface AddAssignmentProps {
  onAdd: (name: string, dueDate: string) => void
  onClose: () => void
}

export default function AddAssignment({ onAdd, onClose }: AddAssignmentProps) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !dueDate) return
    onAdd(name.trim(), dueDate)
    setName('')
    setDueDate('')
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="px-6 pb-8"
    >
      <div className="page-container">
        <div className="bg-blush dark:bg-muted-dark rounded-card p-6 max-w-lg mx-auto">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              className="w-full px-4 py-3 rounded-xl bg-paper dark:bg-paper-dark border border-line/50 text-ink dark:text-ink-light placeholder-muted dark:placeholder-muted-dark outline-none focus:border-sage transition-colors text-[18px] leading-relaxed"
            />
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-paper dark:bg-paper-dark border border-line/50 text-ink dark:text-ink-light outline-none focus:border-sage transition-colors text-[18px] leading-relaxed"
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!name.trim() || !dueDate}
                className="flex-1 rounded-full bg-sage hover:bg-emerald-700 disabled:bg-muted/30 text-white font-bold py-3 px-6 transition-all hover:-translate-y-[2px] disabled:hover:translate-y-0 disabled:cursor-not-allowed"
              >
                {t.add}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-transparent border border-ink/30 text-ink dark:text-ink-light hover:bg-blush dark:hover:bg-muted-dark px-6 transition-all hover:-translate-y-[2px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.section>
  )
}

import { motion } from 'motion/react'
import { CalendarPlus2 } from 'lucide-react'

interface NavbarProps {
  onAdd: () => void
}

export default function Navbar({ onAdd }: NavbarProps) {
  return (
    <nav className="h-[76px] flex items-center justify-between bg-paper dark:bg-ink-dark px-6">
      <div className="page-container flex items-center gap-2">
        <span className="font-heading text-xl font-medium text-ink dark:text-ink-light">
          Deadlinetracker
        </span>
        <span className="text-sage text-lg">.</span>
      </div>
      <motion.button
        onClick={onAdd}
        whileHover={{ y: -2 }}
        className="flex items-center gap-1.5 rounded-full bg-transparent border border-ink/30 px-4 py-2 text-sm font-bold text-ink dark:text-ink-light hover:bg-blush dark:hover:bg-muted-dark transition-colors"
      >
        <CalendarPlus2 className="w-4 h-4" />
        <span className="hidden sm:inline">Add</span>
      </motion.button>
    </nav>
  )
}

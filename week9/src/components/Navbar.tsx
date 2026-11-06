import { motion } from 'motion/react'
import { CalendarPlus2, Languages } from 'lucide-react'
import { useLang } from '../i18n'

interface NavbarProps {
  onAdd: () => void
}

export default function Navbar({ onAdd }: NavbarProps) {
  const { t, lang, toggle } = useLang()

  return (
    <nav className="h-[76px] flex items-center justify-between bg-paper dark:bg-paper-dark px-6">
      <div className="page-container flex items-center gap-2">
        <span className="font-heading text-xl font-medium text-ink dark:text-ink-light">
          {t.appName}
        </span>
        <span className="text-sage text-lg">.</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          title={lang === 'en' ? '切換到中文' : 'Switch to English'}
          className="flex items-center gap-1.5 rounded-full bg-transparent border border-ink/30 px-3 py-2 text-sm font-bold text-ink dark:text-ink-light hover:bg-blush dark:hover:bg-muted-dark transition-colors"
        >
          <Languages className="w-4 h-4" />
          <span>{lang === 'en' ? '中' : 'EN'}</span>
        </button>
        <motion.button
          onClick={onAdd}
          whileHover={{ y: -2 }}
          className="flex items-center gap-1.5 rounded-full bg-transparent border border-ink/30 px-4 py-2 text-sm font-bold text-ink dark:text-ink-light hover:bg-blush dark:hover:bg-muted-dark transition-colors"
        >
          <CalendarPlus2 className="w-4 h-4" />
          <span className="hidden sm:inline">{t.add}</span>
        </motion.button>
      </div>
    </nav>
  )
}

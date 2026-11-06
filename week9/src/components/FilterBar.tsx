import { clsx } from 'clsx'
import { Filter } from '../types'
import { useLang } from '../i18n'

interface FilterBarProps {
  filter: Filter
  onFilter: (f: Filter) => void
  counts: Record<'all' | 'pending' | 'completed', number>
}

export default function FilterBar({ filter, onFilter, counts }: FilterBarProps) {
  const { t } = useLang()

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `${t.filterAll} (${counts.all})` },
    { key: 'pending', label: `${t.filterPending} (${counts.pending})` },
    { key: 'completed', label: `${t.filterCompleted} (${counts.completed})` },
  ]

  return (
    <div className="px-6 pb-6">
      <div className="page-container flex gap-2 justify-center flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => onFilter(f.key)}
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-bold transition-all',
              filter === f.key
                ? 'bg-sage text-white'
                : 'bg-transparent border border-ink/30 text-ink dark:text-ink-light hover:bg-blush dark:hover:bg-muted-dark'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}

import { createContext, useContext, useState, ReactNode } from 'react'

export type Lang = 'en' | 'zh-TW'

interface Translations {
  appName: string
  add: string
  heroTitle1: string
  heroTitleEm: string
  heroSubtitle: string
  namePlaceholder: string
  filterAll: string
  filterPending: string
  filterCompleted: string
  remove: string
  done: string
  pending: string
  emptyTitle: string
  addAssignment: string
  overdue: (days: number) => string
  dueYesterday: string
  dueToday: string
  dueTomorrow: string
  dueInDays: (days: number) => string
}

const translations: Record<Lang, Translations> = {
  en: {
    appName: 'Deadlinetracker',
    add: 'Add',
    heroTitle1: 'Your semester, ',
    heroTitleEm: 'tracked',
    heroSubtitle: 'Track assignments and deadlines at a glance. Everything saved locally — no account needed.',
    namePlaceholder: 'Assignment name (e.g., Math Chapter 12)',
    filterAll: 'All',
    filterPending: 'Pending',
    filterCompleted: 'Completed',
    remove: 'Remove',
    done: 'Done',
    pending: 'Pending',
    emptyTitle: 'No assignments yet. Add your first one!',
    addAssignment: 'Add Assignment',
    overdue: (d) => `${d}d overdue`,
    dueYesterday: 'Due yesterday',
    dueToday: 'Due today',
    dueTomorrow: 'Due tomorrow',
    dueInDays: (d) => `Due in ${d} days`,
  },
  'zh-TW': {
    appName: '截止日期追蹤器',
    add: '新增',
    heroTitle1: '你的學期，',
    heroTitleEm: '一目了然',
    heroSubtitle: '一眼掌握所有作業與截止日期。資料儲存在本機，不需要註冊帳號。',
    namePlaceholder: '作業名稱（例如：數學第12章）',
    filterAll: '全部',
    filterPending: '待完成',
    filterCompleted: '已完成',
    remove: '刪除',
    done: '已完成',
    pending: '待完成',
    emptyTitle: '目前還沒有作業，新增第一筆吧！',
    addAssignment: '新增作業',
    overdue: (d) => `已逾期 ${d} 天`,
    dueYesterday: '昨天截止',
    dueToday: '今天截止',
    dueTomorrow: '明天截止',
    dueInDays: (d) => `還有 ${d} 天截止`,
  },
}

const STORAGE_KEY = 'deadlinetracker_lang'

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh-TW') return saved
  } catch {
    // localStorage unavailable, fall through to browser detection
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en'
}

interface LangContextValue {
  lang: Lang
  t: Translations
  toggle: () => void
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang)

  const toggle = () => {
    const next: Lang = lang === 'en' ? 'zh-TW' : 'en'
    setLang(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable, language choice won't persist this session
    }
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], toggle }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}

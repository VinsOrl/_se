import { useState, useEffect, useCallback } from 'react'
import { Assignment } from '../types'

const STORAGE_KEY = 'deadlinetracker_assignments'

function load(): Assignment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(assignments: Assignment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
}

export function useAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>(load)

  useEffect(() => {
    save(assignments)
  }, [assignments])

  const add = useCallback((name: string, dueDate: string) => {
    setAssignments(prev => [
      ...prev,
      { id: crypto.randomUUID(), name, dueDate, completed: false, createdAt: Date.now() }
    ])
  }, [])

  const toggle = useCallback((id: string) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, completed: !a.completed } : a))
  }, [])

  const remove = useCallback((id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id))
  }, [])

  return { assignments, add, toggle, remove }
}

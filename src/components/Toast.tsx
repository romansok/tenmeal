'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

interface ToastOptions {
  message: string
  undoLabel?: string
  onUndo?: () => void
  duration?: number
}

interface ToastState extends ToastOptions {
  id: number
}

interface ToastApi {
  show: (opts: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([])
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const handle = timers.current[id]
    if (handle) { clearTimeout(handle); delete timers.current[id] }
  }, [])

  const show = useCallback((opts: ToastOptions) => {
    const id = nextId.current++
    const duration = opts.duration ?? 5000
    setToasts((prev) => [...prev, { ...opts, id }])
    timers.current[id] = setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout)
    timers.current = {}
  }, [])

  const api = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-host" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast-pill">
              <span className="toast-pill-message">{t.message}</span>
              {t.onUndo && (
                <button
                  type="button"
                  className="toast-pill-action"
                  onClick={() => { t.onUndo?.(); dismiss(t.id) }}
                >
                  {t.undoLabel ?? 'בטל'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

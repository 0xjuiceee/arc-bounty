import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** "sheet" slides in from the right on desktop and up from the bottom on mobile. */
  variant?: 'center' | 'sheet'
  children: ReactNode
}

export function Modal({ open, onClose, title, subtitle, variant = 'center', children }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  const sheet = variant === 'sheet'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 flex ${sheet ? 'items-end justify-end sm:items-stretch' : 'items-end justify-center sm:items-center'} p-0 ${sheet ? '' : 'sm:p-6'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <button
            aria-label="Close dialog"
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-white/10 bg-ink-800 shadow-2xl outline-none ${
              sheet ? 'rounded-t-3xl sm:h-full sm:max-h-none sm:max-w-xl sm:rounded-none sm:rounded-l-3xl' : 'rounded-t-3xl sm:max-w-lg sm:rounded-3xl'
            }`}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold tracking-tight text-mist text-balance">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-mist-muted">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-mist-muted transition hover:bg-white/5 hover:text-mist"
              >
                <X size={18} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

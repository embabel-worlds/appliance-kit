import { type RefObject, useEffect, useRef } from 'react'

const TABBABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  "input:not([disabled]):not([type='hidden'])",
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]',
  "[contenteditable='true']",
].join(',')

export function getTabbable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    (element) => element.tabIndex !== -1,
  )
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      getTabbable(container)[0]?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return

      const tabbable = getTabbable(container)
      if (tabbable.length === 0) return

      const first = tabbable[0]
      const last = tabbable[tabbable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const container = containerRef.current
    container?.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      container?.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [active])

  return containerRef
}

import { useEffect } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

export function useFocusTrap(containerRef, isActive, onRequestClose){
  useEffect(() => {
    if (!isActive) return
    const node = containerRef?.current
    if (!node) return

    const previouslyFocused = document.activeElement

    const focusFirst = () => {
      const focusable = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR))
      if (focusable.length){
        focusable[0].focus()
      } else {
        node.setAttribute('tabindex', '-1')
        node.focus()
      }
    }

    focusFirst()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape'){
        event.preventDefault()
        if (typeof onRequestClose === 'function') onRequestClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR))
      if (!focusable.length) {
        event.preventDefault()
        node.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey){
        if (activeElement === first || !node.contains(activeElement)){
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (activeElement === last){
        event.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', handleKeyDown)

    return () => {
      node.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [containerRef, isActive, onRequestClose])
}

export default useFocusTrap

import { useEffect, useState } from 'react'

/**
 * Floating controls overlaid on scrollable kid views:
 *  - a Back button (top-left), shown when `onBack` is provided, and
 *  - a "to top" button (bottom-right) that appears once the page is scrolled.
 */
export function FloatingControls({ onBack }: { onBack?: () => void }) {
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {onBack && (
        <button className="fab fab-back" onClick={onBack} aria-label="Back">◀</button>
      )}
      {showTop && (
        <button
          className="fab fab-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
    </>
  )
}

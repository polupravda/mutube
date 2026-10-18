/**
 * Fixed bottom-centre pill that swaps between the two kid home views: on the
 * Mix (suggested feed) it offers Collections, and on Collections it offers Mix.
 * Same spot and style on both, so it reads as one toggle.
 */
export function ViewToggle({ target, onClick }: { target: 'mix' | 'collections'; onClick: () => void }) {
  return (
    <button className="fab-view" onClick={onClick}>
      {target === 'mix' ? <MixIcon /> : <CollectionsIcon />}
      {target === 'mix' ? 'Mix' : 'Collections'}
    </button>
  )
}

const iconProps = {
  viewBox: '0 0 24 24', width: 26, height: 26, 'aria-hidden': true, fill: 'none',
  stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
} as const

/** Stacked cards: a "browse collections" glyph. */
function CollectionsIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="9" width="18" height="12" rx="2.5" fill="currentColor" fillOpacity="0.25" />
      <path d="M5.5 6h13M8 3h8" />
      <path d="M10.5 12.5v5l4-2.5z" fill="currentColor" />
    </svg>
  )
}

/** Crossing arrows: a "shuffled mix" glyph. */
function MixIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8c1.1 1.6 2.3 2.6 4.3 2.6H21" />
      <path d="M3 17h3.5c1.4 0 2.4-.5 3.2-1.3M14.3 8.3C15.1 7.5 16.1 7 17.5 7H21" />
      <path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
    </svg>
  )
}

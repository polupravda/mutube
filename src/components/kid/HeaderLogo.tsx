import logoUrl from '../../assets/Logo.svg'

/** Centered header logo, always a Home button. */
export function HeaderLogo({ onHome }: { onHome: () => void }) {
  return (
    <button className="header-logo" onClick={onHome} aria-label="Home">
      <img src={logoUrl} alt="Home" />
    </button>
  )
}

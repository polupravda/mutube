import logoUrl from '../../assets/Logo.svg'

/**
 * Centered header logo. Rendered as a Home button when `onHome` is given
 * (sub-pages), or a plain image on the home screen itself.
 */
export function HeaderLogo({ onHome }: { onHome?: () => void }) {
  if (onHome) {
    return (
      <button className="header-logo" onClick={onHome} aria-label="Home">
        <img src={logoUrl} alt="Home" />
      </button>
    )
  }
  return <img className="header-logo" src={logoUrl} alt="Mutube" />
}

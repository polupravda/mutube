import { useEffect, useRef, useState } from 'react'

/** Hardcoded admin PIN (placeholder — see session feature notes). */
const ADMIN_PIN = '4321'

/** A 4-digit PIN modal. The PIN is typed on the keyboard (autofocused input);
 *  it submits automatically at 4 digits or on Enter. Calls onSuccess for 4321. */
export function PinPad({ title, onSuccess, onCancel }: { title: string; onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function check(value: string) {
    if (value === ADMIN_PIN) onSuccess()
    else { setError(true); setPin('') }
  }

  return (
    <div className="pin-backdrop" onClick={onCancel}>
      <div className="pin-pad" onClick={(e) => e.stopPropagation()}>
        <h2 className="pin-title">{title}</h2>
        <input
          ref={inputRef}
          className={`pin-input${error ? ' error' : ''}`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          placeholder="••••"
          aria-label={title}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4)
            setError(false)
            setPin(v)
            if (v.length === 4) check(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check(pin)
            else if (e.key === 'Escape') onCancel()
          }}
        />
        {error && <p className="pin-error">Wrong PIN</p>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

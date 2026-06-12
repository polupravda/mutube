import { useState } from 'react'
import { useSession } from '../../state/useSession'
import { PinPad } from './PinPad'

/**
 * "5 minutes left" warning popup. Rendered globally (App shell) so it shows in
 * either mode — including the admin "test popup" button.
 */
export function SessionWarningPopup() {
  const { phase, warningActive } = useSession()
  if (!warningActive || phase === 'over') return null
  return (
    <div className="session-popup warning">
      <p>5 minutes left</p>
    </div>
  )
}

/**
 * Blocking "Session is over" screen (kid mode). Dismissed with the admin PIN,
 * which ends the session and returns home via `onExit`.
 */
export function SessionOverScreen({ onExit }: { onExit: () => void }) {
  const { phase, endSession } = useSession()
  const [pin, setPin] = useState(false)
  if (phase !== 'over') return null
  return (
    <div className="session-popup over">
      <p>Session is over</p>
      {pin ? (
        <PinPad
          title="Enter PIN to exit"
          onSuccess={() => { setPin(false); endSession(); onExit() }}
          onCancel={() => setPin(false)}
        />
      ) : (
        <button className="big-btn session-exit" onClick={() => setPin(true)}>Parent: end session</button>
      )}
    </div>
  )
}

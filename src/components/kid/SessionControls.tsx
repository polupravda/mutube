import { useState } from 'react'
import { useSession } from '../../state/useSession'
import { PinPad } from './PinPad'

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`
}

/** Header cluster: start a timed session (with editable minutes) and reset the
 *  per-session blacklist limit (PIN-gated). */
export function SessionControls() {
  const { phase, remainingMs, paused, defaultDurationMin, blacklistUsed, start, stop, resetBlacklist } = useSession()
  const [openStart, setOpenStart] = useState(false)
  const [minutes, setMinutes] = useState(defaultDurationMin)
  const [pin, setPin] = useState(false)

  return (
    <div className="session-controls">
      {phase === 'running' ? (
        <>
          <span
            className={`session-timer${paused ? ' paused' : ''}`}
            title={paused ? 'Paused — only counts while a video plays' : 'Time left (counts while watching)'}
          >
            ⏱ {fmt(remainingMs ?? 0)}{paused ? ' ❚❚' : ''}
          </span>
          <button className="ghost" onClick={stop} title="Stop the session timer">
            ⏹ <span className="btn-label">Stop</span>
          </button>
        </>
      ) : openStart ? (
        <span className="session-start-form">
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            aria-label="Session minutes"
          />
          <button onClick={() => { start(minutes); setOpenStart(false) }}>Start</button>
        </span>
      ) : (
        <button className="ghost" onClick={() => { setMinutes(defaultDurationMin); setOpenStart(true) }} title="Start a session">
          ▶ <span className="btn-label">Start session</span>
        </button>
      )}

      <button
        className="ghost"
        onClick={() => setPin(true)}
        title={blacklistUsed ? 'Reset the one-video limit (PIN)' : 'No limit to reset yet'}
      >
        🔓{blacklistUsed ? ' •' : ''} <span className="btn-label">Reset limit</span>
      </button>

      {pin && (
        <PinPad
          title="Enter PIN to reset limit"
          onSuccess={() => { resetBlacklist(); setPin(false) }}
          onCancel={() => setPin(false)}
        />
      )}
    </div>
  )
}

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Kid-mode "session": a countdown timer plus the per-session blacklist allowance.
 * Persisted to localStorage so a page refresh can't reset the timer or re-unlock
 * a used-up blacklist video.
 *
 *  - 5 minutes before the end: a warning popup shows for 3s and the video pauses.
 *  - At 0: the session is "over" (video stops, a blocking screen appears).
 *  - One blacklisted video per session, counted when it finishes.
 */

const KEY = 'mutube.session.v1'
const DEFAULT_MIN = 90
const WARNING_MS = 5 * 60 * 1000
const POPUP_MS = 3000

type Persisted = {
  startedAt: number | null
  /** When set, the timer is frozen at this instant (a break). */
  pausedAt: number | null
  durationMin: number
  defaultDurationMin: number
  warningShown: boolean
  blacklistUsed: boolean
}

function load(): Persisted {
  const fallback: Persisted = {
    startedAt: null,
    pausedAt: null,
    durationMin: DEFAULT_MIN,
    defaultDurationMin: DEFAULT_MIN,
    warningShown: false,
    blacklistUsed: false,
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<Persisted>) }
  } catch {
    /* ignore */
  }
  return fallback
}

type Phase = 'idle' | 'running' | 'over'

type SessionValue = {
  phase: Phase
  remainingMs: number | null
  paused: boolean
  defaultDurationMin: number
  blacklistUsed: boolean
  warningActive: boolean
  /** True while a video must stay paused (warning popup / break / over). */
  sessionPause: boolean
  start: (min?: number) => void
  /** Drive the timer from playback: it advances only while a video is playing. */
  setWatching: (on: boolean) => void
  /** Stop the timer entirely (ends the session). */
  stop: () => void
  endSession: () => void
  setDefaultDuration: (min: number) => void
  markBlacklistUsed: () => void
  resetBlacklist: () => void
  testWarning: () => void
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load)
  const [now, setNow] = useState(() => Date.now())
  const [warningActive, setWarningActive] = useState(false)
  const popupTimer = useRef<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])

  // Tick once a second while a session is running.
  useEffect(() => {
    if (state.startedAt == null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [state.startedAt])

  // While paused the clock is frozen at `pausedAt`.
  const effectiveNow = state.pausedAt ?? now
  const remainingMs =
    state.startedAt == null ? null : state.durationMin * 60_000 - (effectiveNow - state.startedAt)
  const phase: Phase = state.startedAt == null ? 'idle' : remainingMs! <= 0 ? 'over' : 'running'
  const paused = state.pausedAt != null

  function showPopup() {
    setWarningActive(true)
    if (popupTimer.current) window.clearTimeout(popupTimer.current)
    popupTimer.current = window.setTimeout(() => setWarningActive(false), POPUP_MS)
  }

  // Fire the 5-minutes-left warning exactly once per session.
  useEffect(() => {
    if (phase === 'running' && remainingMs != null && remainingMs <= WARNING_MS && !state.warningShown) {
      setState((s) => ({ ...s, warningShown: true }))
      showPopup()
    }
  }, [phase, remainingMs, state.warningShown])

  const value: SessionValue = {
    phase,
    remainingMs,
    paused,
    defaultDurationMin: state.defaultDurationMin,
    blacklistUsed: state.blacklistUsed,
    warningActive,
    // Forces the *player* to pause (warning / over). The timer freeze is driven
    // separately by setWatching, so it isn't included here.
    sessionPause: warningActive || phase === 'over',
    start: (min) =>
      setState((s) => {
        const t = Date.now()
        // Start frozen: the clock only advances once a video is actually playing.
        return {
          ...s,
          startedAt: t,
          pausedAt: t,
          durationMin: min && min > 0 ? min : s.defaultDurationMin,
          warningShown: false,
          blacklistUsed: false,
        }
      }),
    setWatching: (on) =>
      setState((s) => {
        if (s.startedAt == null) return s
        if (on && s.pausedAt != null) {
          return { ...s, startedAt: s.startedAt + (Date.now() - s.pausedAt), pausedAt: null }
        }
        if (!on && s.pausedAt == null) return { ...s, pausedAt: Date.now() }
        return s
      }),
    stop: () => {
      setWarningActive(false)
      setState((s) => ({ ...s, startedAt: null, pausedAt: null, warningShown: false }))
    },
    endSession: () => {
      setWarningActive(false)
      setState((s) => ({ ...s, startedAt: null, pausedAt: null, warningShown: false }))
    },
    setDefaultDuration: (min) =>
      setState((s) => ({ ...s, defaultDurationMin: min > 0 ? min : s.defaultDurationMin })),
    markBlacklistUsed: () => setState((s) => ({ ...s, blacklistUsed: true })),
    resetBlacklist: () => setState((s) => ({ ...s, blacklistUsed: false })),
    testWarning: showPopup,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession must be used within a SessionProvider')
  return ctx
}

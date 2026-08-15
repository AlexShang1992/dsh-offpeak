/**
 * Inline SVG icons for the off-peak surface. Tiny, theme-aware (inherit
 * `currentColor`), and dependency-free.
 */
import type { ReactElement } from 'react'

interface IconProps {
  readonly className?: string
}

/** Crescent moon for off-peak hours. */
export function MoonIcon({ className }: IconProps): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M13.2 9.8A5.6 5.6 0 0 1 6.2 2.8a5.6 5.6 0 1 0 7 7Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Sun for peak hours. */
export function SunIcon({ className }: IconProps): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
      </g>
    </svg>
  )
}

/** Small pulsing dot used as the live indicator. */
export function PulseDot({ className }: IconProps): ReactElement {
  return (
    <span className={className} aria-hidden="true">
      <span className="dsh_offpeak_pulseRing" />
      <span className="dsh_offpeak_pulseCore" />
    </span>
  )
}

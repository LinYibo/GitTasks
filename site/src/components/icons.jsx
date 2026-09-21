/**
 * Hand-rolled icon set (24x24, currentColor). Keeps the site free of an icon
 * dependency and visually consistent with the app's 1.75px stroke weight.
 */
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Stroke({ className = 'h-5 w-5', children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...strokeProps}>
      {children}
    </svg>
  )
}

export function IconGithub({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.2.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

export function IconDownload({ className = 'h-5 w-5' }) {
  return (
    <Stroke className={className}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </Stroke>
  )
}

export function IconFileText({ className = 'h-5 w-5' }) {
  return (
    <Stroke className={className}>
      <path d="M14 3v5h5" />
      <path d="M6 3h8l5 5v13H6z" />
      <path d="M9 13h6M9 17h6" />
    </Stroke>
  )
}

export function IconCommit({ className = 'h-5 w-5' }) {
  return (
    <Stroke className={className}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M3 12h5.75M15.25 12H21" />
    </Stroke>
  )
}

export function IconLock({ className = 'h-5 w-5' }) {
  return (
    <Stroke className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.75a4 4 0 0 1 8 0v2.75" />
    </Stroke>
  )
}

export function IconTag({ className = 'h-5 w-5' }) {
  return (
    <Stroke className={className}>
      <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" />
      <path d="M7.5 7.5h.01" />
    </Stroke>
  )
}

export function IconSync({ className = 'h-5 w-5' }) {
  return (
    <Stroke className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.7 9.7 0 0 0-6.7 2.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.7 9.7 0 0 0 6.7-2.7L21 16" />
      <path d="M16 16h5v5" />
    </Stroke>
  )
}

export function IconShieldCheck({ className = 'h-5 w-5' }) {
  return (
    <Stroke className={className}>
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z" />
      <path d="m9 12 2 2 4-4" />
    </Stroke>
  )
}

/** Feature card order must match `features.items` in the dictionaries. */
export const FEATURE_ICONS = [
  IconFileText,
  IconCommit,
  IconLock,
  IconTag,
  IconSync,
  IconShieldCheck,
]

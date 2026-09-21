import type { ButtonHTMLAttributes } from 'react'

/** The small icon-only control used for a row's hover actions and the footer. */
export function IconButton({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      {...props}
    />
  )
}

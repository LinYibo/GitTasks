/** Small shared primitives: the layout rhythm and button styles of the page. */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const BUTTON_VARIANTS = {
  primary: 'h-11 bg-primary px-5 text-primary-fg hover:bg-primary/90',
  ghost: 'h-11 border border-border bg-surface px-5 text-fg hover:border-border-strong hover:bg-elevated',
}

export function LinkButton({ href, variant = 'primary', className = '', children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </a>
  )
}

export function Section({ id, className = '', children }) {
  return (
    <section id={id} className={`mx-auto w-full max-w-5xl px-5 py-16 sm:py-24 ${className}`}>
      {children}
    </section>
  )
}

export function SectionHead({ title, subtitle }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-3 text-sm text-muted sm:text-base">{subtitle}</p> : null}
    </div>
  )
}

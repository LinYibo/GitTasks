/**
 * The fixed background layer from the reference design: the app background plus
 * a soft accent glow bleeding down from the top centre.
 */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <div className="absolute left-1/2 top-0 h-[420px] w-[min(100%,720px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-accent)_12%,transparent),transparent_70%)]" />
    </div>
  )
}

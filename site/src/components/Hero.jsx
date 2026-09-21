import { SITE } from '../config.js'
import { useI18n } from '../i18n/index.jsx'
import { IconDownload, IconGithub } from './icons.jsx'
import { LinkButton } from './ui.jsx'

export function Hero() {
  const { t } = useI18n()

  return (
    <section id="top" className="relative overflow-hidden">
      {/* Same radial accent glow the app draws behind its header. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-48 h-[36rem] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(59,130,246,0.16),transparent_70%)]"
      />

      <div className="relative mx-auto grid max-w-5xl gap-12 px-5 pb-4 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pt-20">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">GitTasks</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t('hero.tagline')}</p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-subtle">{t('hero.lead')}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href={SITE.download}>
              <IconDownload />
              {t('hero.ctaDownload')}
            </LinkButton>
            <LinkButton href={SITE.repo} variant="ghost">
              <IconGithub className="h-4 w-4" />
              {t('hero.ctaGithub')}
            </LinkButton>
          </div>
        </div>

        <div className="relative lg:justify-self-end">
          <img
            src="/screenshots/all.png"
            alt={t('hero.shotAlt')}
            width={1440}
            height={1640}
            className="w-full rounded-2xl border border-border-strong/70 shadow-2xl shadow-black/50"
          />
        </div>
      </div>
    </section>
  )
}

import { useI18n } from '../i18n/index.jsx'
import { FEATURE_ICONS } from './icons.jsx'
import { Section, SectionHead } from './ui.jsx'

export function Features() {
  const { t } = useI18n()

  return (
    <Section id="features">
      <SectionHead title={t('features.title')} subtitle={t('features.subtitle')} />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {t('features.items').map((item, index) => {
          const Icon = FEATURE_ICONS[index] ?? FEATURE_ICONS[0]
          return (
            <article key={item.title} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-elevated text-accent">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          )
        })}
      </div>
    </Section>
  )
}

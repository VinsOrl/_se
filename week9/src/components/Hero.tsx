import { motion } from 'motion/react'
import { useLang } from '../i18n'

export default function Hero() {
  const { t } = useLang()

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      className="pt-16 pb-8 px-6"
    >
      <div className="page-container text-center">
        <h1 className="heading-xl mb-4 text-ink dark:text-ink-light">
          {t.heroTitle1}
          <em className="italic font-normal">{t.heroTitleEm}</em>.
        </h1>
        <p className="text-muted dark:text-muted-dark text-lg max-w-md mx-auto">
          {t.heroSubtitle}
        </p>
      </div>
    </motion.section>
  )
}

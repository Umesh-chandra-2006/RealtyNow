import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, Target, Award, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useLanguageContext } from '../../lib/i18n/language-context';

export function AboutUsPage() {
  const { t } = useLanguageContext();

  const stats = [
    { label: t('about.propertiesSold', 'Verified Properties'), value: '36+' },
    { label: t('about.happyCustomers', 'Client Satisfaction'), value: '100%' },
    { label: t('about.citiesCovered', 'Title Scrutiny'), value: '100%' },
    { label: t('about.expertAgents', 'Zero Brokerage'), value: 'Direct' },
  ];

  const values = [
    {
      icon: ShieldCheck,
      title: t('about.val1Title', 'Trust & Transparency'),
      desc: t(
        'about.val1Desc',
        'Every listing is verified. No hidden charges, no fake properties. We build trust through absolute transparency.',
      ),
    },
    {
      icon: Target,
      title: t('about.val2Title', 'AI-Powered Precision'),
      desc: t(
        'about.val2Desc',
        'Our proprietary AI algorithms help you find the exact property match based on your preferences, budget, and lifestyle.',
      ),
    },
    {
      icon: Globe,
      title: t('about.val3Title', 'Pan-India Network'),
      desc: t(
        'about.val3Desc',
        'From bustling metros to emerging smart cities, our network spans across India offering you the best real estate choices.',
      ),
    },
    {
      icon: Award,
      title: t('about.val4Title', 'Award-Winning Service'),
      desc: t(
        'about.val4Desc',
        'Recognized as the fastest-growing prop-tech platform in India, delivering exceptional service from search to possession.',
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-hero-gradient pt-20 pb-32">
        <div className="absolute inset-0 bg-hero-radial opacity-80" />
        <div className="absolute inset-0 hero-dot-pattern opacity-60" />

        <div className="container-wide relative z-10 text-center text-white">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="font-display text-4xl font-extrabold sm:text-5xl lg:text-6xl">
              {t('about.heroTitle1', 'Revolutionizing')}{' '}
              <span className="text-gold-400">{t('about.heroTitle2', 'Real Estate')}</span>{' '}
              <br className="hidden sm:block" /> {t('about.heroTitle3', 'in India')}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
              {t(
                'about.heroDesc',
                "RealtyNow is India's most advanced AI-powered real estate marketplace. We simplify buying, selling, and renting properties by combining cutting-edge technology with human expertise.",
              )}
            </p>
          </motion.div>
        </div>

        {/* Wave bottom */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full text-navy-50"
          viewBox="0 0 1440 120"
          fill="none"
          preserveAspectRatio="none"
        >
          <path d="M0,60 C240,100 480,20 720,50 C960,80 1200,40 1440,70 L1440,120 L0,120 Z" fill="currentColor" />
        </svg>
      </section>

      {/* Stats Section */}
      <section className="relative z-20 -mt-20 pb-16">
        <div className="container-wide">
          <div className="grid grid-cols-2 gap-4 rounded-3xl bg-white p-8 shadow-xl md:grid-cols-4 lg:p-12">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="font-display text-3xl font-extrabold text-navy-900 lg:text-4xl">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-navy-500 uppercase tracking-wide">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="py-16 lg:py-24">
        <div className="container-wide">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">
                {t('about.missionTitle', 'Our Mission')}
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-navy-600">
                {t(
                  'about.missionDesc1',
                  "Finding a home shouldn't be a stressful process filled with endless calls and fake listings. Our mission is to make real estate transactions transparent, efficient, and reliable.",
                )}
              </p>
              <p className="mt-4 text-lg leading-relaxed text-navy-600">
                {t(
                  'about.missionDesc2',
                  'By integrating AI-driven insights, we empower buyers and renters to make data-backed decisions while providing sellers and agents with a platform that guarantees maximum visibility and fast closures.',
                )}
              </p>
              <div className="mt-8">
                <Link to="/search">
                  <Button
                    variant="primary"
                    size="lg"
                    className="rounded-xl px-8"
                    icon={<ArrowRight className="h-5 w-5" />}
                  >
                    {t('common.search', 'Explore Properties')}
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden shadow-2xl"
            >
              <img
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80"
                alt="Modern Real Estate Building"
                className="w-full object-cover aspect-[4/3]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-900/60 to-transparent" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-white py-16 lg:py-24">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">
              {t('about.whyTitle', 'Why Choose RealtyNow?')}
            </h2>
            <p className="mt-4 text-navy-600 text-lg">
              {t(
                'about.whyDesc',
                'We are building the future of real estate with a foundation of trust, technology, and customer-first approach.',
              )}
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-navy-100 bg-navy-50/50 p-8 transition-all hover:bg-white hover:shadow-xl"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold text-navy-900">{v.title}</h3>
                <p className="mt-3 text-navy-600 leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24">
        <div className="container-wide">
          <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-800 p-10 text-center shadow-2xl lg:p-16">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              {t('about.ctaTitle', 'Ready to find your dream property?')}
            </h2>
            <p className="mt-4 text-lg text-navy-100 max-w-2xl mx-auto">
              {t(
                'about.ctaSub',
                "Join thousands of happy customers who found their perfect home with RealtyNow's intelligent matchmaking.",
              )}
            </p>
            <div className="mt-8 flex justify-center gap-4 flex-wrap">
              <Link to="/signup">
                <Button
                  variant="primary"
                  size="lg"
                  className="rounded-xl px-8 bg-gold-500 text-navy-900 hover:bg-gold-400"
                >
                  {t('common.register', 'Create Account')}
                </Button>
              </Link>
              <Link to="/contact">
                <Button
                  variant="secondary"
                  size="lg"
                  className="rounded-xl px-8 bg-white/10 text-white hover:bg-white/20 border-0"
                >
                  {t('common.contactUs', 'Contact Sales')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

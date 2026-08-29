import React from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Search,
  TrendingUp,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  Lock,
  Star,
  Award,
  Calendar,
} from 'lucide-react';
import { useLanguageContext } from '../lib/i18n/language-context';

export const AppShowcase: React.FC = () => {
  const { t } = useLanguageContext();

  return (
    <section className="relative overflow-hidden py-8 sm:py-10 bg-slate-50">
      {/* Main Outer Container */}
      <div className="container-wide relative z-10">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-200/80 shadow-2xl min-h-[480px] lg:min-h-[520px] flex flex-col justify-between">
          {/* ============================================================
             BACKGROUND: Pure High-Res Cinematic Sunset Podium Image
          ============================================================ */}
          <div className="absolute inset-0 z-0">
            <img
              src="/app-showcase-bg.jpg"
              alt="RealtyNow App Showcase Background"
              className="h-full w-full object-cover object-center pointer-events-none"
            />
            {/* Subtle left gradient overlay strictly for text contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/40 to-transparent w-full lg:w-1/2 pointer-events-none" />
          </div>

          {/* ============================================================
             CONTENT OVERLAY GRID
          ============================================================ */}
          <div className="relative z-10 p-5 sm:p-8 lg:p-9">
            <div className="grid gap-8 lg:grid-cols-12 items-center">
              {/* LEFT COLUMN: Text Content & App Store Badges */}
              <div className="lg:col-span-6 space-y-4 text-left">
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white/95 px-4 py-1.5 shadow-sm backdrop-blur-md"
                >
                  <Sparkles className="h-4 w-4 text-red-600 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-600">
                    ✨ {t('home.appBadge', "India's AI-Powered Real Estate App")}
                  </span>
                </motion.div>

                {/* Main Heading */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                    Real Estate,{' '}
                    <span className="bg-gradient-to-r from-red-600 via-rose-600 to-red-500 bg-clip-text text-transparent">
                      Reimagined
                    </span>
                  </h2>
                  <p className="mt-2 text-sm sm:text-base text-slate-700 leading-relaxed max-w-lg font-medium">
                    Search smarter, decide faster, and move forward with AI insights that find the perfect property for
                    you.
                  </p>
                </motion.div>

                {/* 4 Feature Pills Grid */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-2 gap-2 max-w-md"
                >
                  {[
                    { icon: Search, label: 'AI Property Search' },
                    { icon: Sparkles, label: 'Smart Recommendations' },
                    { icon: TrendingUp, label: 'Market Insights' },
                    { icon: ShieldCheck, label: 'Secure & Trusted' },
                  ].map((feat) => (
                    <div
                      key={feat.label}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-sm backdrop-blur-md"
                    >
                      <feat.icon className="h-4 w-4 text-red-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-800">{feat.label}</span>
                    </div>
                  ))}
                </motion.div>

                {/* Download CTA Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="space-y-3 pt-2 border-t border-slate-300/60"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Download the RealtyNow App
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Apple Store Button */}
                    <a
                      href="#"
                      className="flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-2.5 text-white shadow-xl hover:bg-slate-900 hover:scale-105 transition-all group"
                    >
                      <svg className="h-6 w-6 fill-current" viewBox="0 0 384 512">
                        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-92.1-61.7-92.1zM263.7 103.9c22.4-27.1 37.4-64.8 33.3-103.9-32.5 1.7-71.9 22.3-95.2 49.3-20.7 23.8-38.7 62.4-33.8 100 36.4 2.8 73.3-18.3 95.7-45.4z" />
                      </svg>
                      <div className="text-left">
                        <p className="text-[10px] uppercase font-semibold text-slate-400 leading-tight">
                          Download on the
                        </p>
                        <p className="text-sm font-black text-white leading-tight">App Store</p>
                      </div>
                    </a>

                    {/* Google Play Button */}
                    <a
                      href="#"
                      className="flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-2.5 text-white shadow-xl hover:bg-slate-900 hover:scale-105 transition-all group"
                    >
                      <svg className="h-6 w-6 fill-current" viewBox="0 0 512 512">
                        <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 65.7 65.7 65.7 59.2-34.1c18-10.3 29.5-29.4 29.5-51.6s-11.5-41.3-29.8-51.6zM104.6 499l220.7-221.3 60.1 60.1L104.6 499z" />
                      </svg>
                      <div className="text-left">
                        <p className="text-[10px] uppercase font-semibold text-slate-400 leading-tight">GET IT ON</p>
                        <p className="text-sm font-black text-white leading-tight">Google Play</p>
                      </div>
                    </a>
                  </div>

                  {/* QR Code Box */}
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white border border-slate-200 p-2 shadow-md shrink-0">
                      <QrCode className="h-full w-full text-slate-900" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 leading-snug">
                      Scan to download
                      <br />
                      on your device
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* RIGHT COLUMN: Floating Glassmorphism Cards positioned around phone image */}
              <div className="lg:col-span-6 relative min-h-[380px] hidden lg:block">
                {/* Central Phone Mockup */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                >
                  <img
                    src="/app-mockup.png"
                    alt="RealtyNow App Interface"
                    className="h-[420px] w-auto object-contain drop-shadow-2xl mix-blend-screen"
                  />
                </motion.div>

                {/* Floating Card 1: AI Match Score */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-6 top-4 z-20 w-40 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-xl text-left"
                >
                  <p className="text-[10px] font-semibold text-slate-500">AI Match Score</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full border-2 border-red-600 flex items-center justify-center font-black text-xs text-red-600">
                      94%
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
                      <Sparkles className="h-3 w-3" /> Perfect Match
                    </span>
                  </div>
                </motion.div>

                {/* Floating Card 2: Price Trend */}
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 5, repeat: Infinity, delay: 0.5 }}
                  className="absolute left-2 top-36 z-20 w-40 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-xl text-left"
                >
                  <p className="text-[10px] font-semibold text-slate-500">Price Trend</p>
                  <p className="text-xs font-bold text-slate-900">Hyderabad</p>
                  <div className="mt-1 flex items-center gap-1 text-xs font-extrabold text-emerald-600">
                    <TrendingUp className="h-3.5 w-3.5" /> +8.5%
                    <span className="text-[9px] font-normal text-slate-400">vs last month</span>
                  </div>
                </motion.div>

                {/* Floating Card 3: Best Time to Buy */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, delay: 1 }}
                  className="absolute left-8 bottom-6 z-20 w-40 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-xl text-left"
                >
                  <p className="text-[10px] font-semibold text-slate-500">Best Time to Buy</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Next 30 Days</span>
                  </div>
                </motion.div>

                {/* Floating Card 4: Investment Potential */}
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 4.2, repeat: Infinity, delay: 0.2 }}
                  className="absolute right-4 top-4 z-20 w-40 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-xl text-left"
                >
                  <p className="text-[10px] font-semibold text-slate-500">Investment Potential</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-700">
                      📈 High
                    </span>
                    <span className="text-[10px] font-bold text-slate-600">Great ROI</span>
                  </div>
                </motion.div>

                {/* Floating Card 5: Rental Yield Average */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4.8, repeat: Infinity, delay: 0.7 }}
                  className="absolute right-0 top-32 z-20 w-40 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-xl text-left"
                >
                  <p className="text-[10px] font-semibold text-slate-500">Rental Yield Average</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full border-2 border-red-500 flex items-center justify-center font-extrabold text-[11px] text-red-600">
                      5.8%
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">High Demand</span>
                  </div>
                </motion.div>

                {/* Floating Card 6: AI Insights */}
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 5.2, repeat: Infinity, delay: 1.2 }}
                  className="absolute right-6 bottom-8 z-20 w-44 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-xl text-left"
                >
                  <div className="flex items-center gap-1 text-[10px] font-bold text-red-600">
                    <Sparkles className="h-3 w-3" /> AI Insights
                  </div>
                  <p className="mt-1 text-[10px] font-medium text-slate-600 leading-tight">
                    Good appreciation potential in this locality.
                  </p>
                </motion.div>
              </div>
            </div>
          </div>

          {/* BOTTOM TRUST BANNER PILL */}
          <div className="relative z-10 p-5 pt-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-md"
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center divide-x divide-slate-200/60">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-bold text-slate-800">Trusted Real Estate Platform</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-bold text-slate-800">100% Secure & Verified</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-bold text-slate-800">4.8/5 App Store Rating</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Award className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-bold text-slate-800">India's Most Trusted Real Estate App</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

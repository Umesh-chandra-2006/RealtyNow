import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Heart, Home, Gift, ShieldCheck, ChevronRight } from 'lucide-react';
import { RakhiMandala, RakhiThreadAccent, CitySilhouetteBackdrop, TinyRakhiIcon } from './RakshaBandhanIcons';

export function RakshaBandhanHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FFFDF9] via-[#FCF8F2] to-white border-b border-amber-100/70 select-none">
      {/* Background Architectural Skyline + Soft Festive Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle City Skyline Silhouette */}
        <div className="absolute bottom-0 inset-x-0 h-72 opacity-40">
          <CitySilhouetteBackdrop className="w-full h-full" />
        </div>

        {/* Ambient Warm Golden & RealtyNow Red Glow Orbs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-gradient-to-br from-amber-200/35 via-rose-200/25 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-red-100/40 via-amber-100/30 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-amber-100/30 blur-2xl" />

        {/* Delicate floating gold particles */}
        <motion.div
          animate={{ y: [-10, 10, -10], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-16 left-1/4 w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-300"
        />
        <motion.div
          animate={{ y: [10, -10, 10], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-28 right-1/3 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-sm"
        />
        <motion.div
          animate={{ y: [-8, 8, -8], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-20 left-1/6 w-2 h-2 rounded-full bg-rose-400/50"
        />
      </div>

      <div className="container-wide relative z-10 pt-6 pb-10 sm:pt-10 sm:pb-14 lg:pt-12 lg:pb-16">
        {/* Main Hero 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: Festive Headline, Copy & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Top Festive Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-50 via-amber-50/80 to-rose-50 border border-amber-200/80 shadow-2xs mb-4"
            >
              <TinyRakhiIcon className="w-4 h-4 text-red-600 animate-spin-slow" />
              <span className="text-xs font-black uppercase tracking-wider bg-gradient-to-r from-red-700 via-red-600 to-amber-700 bg-clip-text text-transparent">
                Raksha Bandhan Special
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-[11px] font-bold text-amber-800">
                August 28, 2026
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-display text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-widest text-[#D8232A] mb-1.5 flex items-center gap-2"
            >
              <span className="inline-block w-6 h-[2px] bg-[#D8232A]" />
              This Raksha Bandhan,
              <span className="inline-block w-6 h-[2px] bg-[#D8232A] lg:hidden" />
            </motion.p>

            {/* Highlight Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.15] tracking-tight mb-4"
            >
              Celebrate Every Bond{' '}
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#D8232A] via-red-600 to-amber-600">
                That Feels Like Home
              </span>
            </motion.h1>

            {/* Supporting Copy */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mb-7 font-medium"
            >
              Because every home is more than four walls — it&apos;s where relationships,
              memories and togetherness grow.
            </motion.p>

            {/* Festive Thread Accent Ribbon */}
            <div className="w-full max-w-md mb-6 opacity-80">
              <RakhiThreadAccent className="w-full h-3" />
            </div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto"
            >
              <Link
                to="/search"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D8232A] via-[#e5262d] to-[#c01e24] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 hover:shadow-red-600/40 hover:scale-[1.02] active:scale-98 transition-all group"
              >
                <span>Explore Properties</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                to="/search?purpose=Sale"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white/90 hover:bg-amber-50/60 hover:border-amber-300 px-6 py-3.5 text-sm font-bold text-slate-800 shadow-2xs hover:shadow-sm transition-all group"
              >
                <Home className="w-4 h-4 text-[#D8232A]" />
                <span>Find Your Dream Home</span>
              </Link>
            </motion.div>

            {/* Trust Micro-Row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-6 flex items-center gap-4 text-xs font-semibold text-slate-500"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> 100% Verified Homes
              </span>
              <span className="h-3 w-px bg-slate-200" />
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> Zero Brokerage Options
              </span>
            </motion.div>
          </div>

          {/* RIGHT COLUMN: Cinematic Festive Visual (Brother-Sister Celebration) */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            {/* Background Circular Rakhi Mandala */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-10 -right-10 sm:-top-16 sm:-right-16 w-80 h-80 sm:w-[460px] sm:h-[460px] opacity-40 pointer-events-none"
            >
              <RakhiMandala className="w-full h-full" />
            </motion.div>

            {/* Cinematic Visual Card Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border-2 border-white/80 bg-white/60 backdrop-blur-sm group"
            >
              {/* Image Frame with Warm Festive Overlay */}
              <div className="relative aspect-[4/3] sm:aspect-[16/11] w-full overflow-hidden bg-gradient-to-br from-amber-100 via-rose-100 to-amber-50">
                {/* Visual Artwork / Scene Layer */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10 z-10" />

                {/* Illustrated / Photographic Festive Visual Artwork */}
                <img
                  src="/hero-villa-luxury.jpg"
                  alt="Raksha Bandhan Modern Family Home"
                  className="w-full h-full object-cover object-center scale-105 group-hover:scale-110 transition-transform duration-1000 ease-out"
                />

                {/* Overlay Brother-Sister Festive Illustration & Sacred Elements */}
                <div className="absolute inset-0 z-10 flex flex-col justify-between p-5 sm:p-7 text-white">
                  {/* Top Ribbon */}
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/25 px-3 py-1 text-[11px] font-bold text-amber-200 shadow-sm">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Bond of Protection & Love
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full bg-[#D8232A]/90 backdrop-blur-md px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                      ❤️ Rakhi 2026
                    </span>
                  </div>

                  {/* Center Celebration Focus Badge */}
                  <div className="my-auto self-center text-center max-w-xs bg-black/35 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-tr from-amber-400 to-red-600 p-0.5 shadow-md flex items-center justify-center">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-red-600 text-xl font-bold">
                        🪢
                      </div>
                    </div>
                    <h3 className="font-display text-base sm:text-lg font-black text-white leading-tight">
                      Where Families Celebrate Together
                    </h3>
                    <p className="text-xs text-amber-100/90 font-medium mt-1">
                      Sister tying rakhi • Brother&apos;s lifelong promise • Growing in the warmth of home
                    </p>
                  </div>

                  {/* Bottom Elements: Traditional Thali & Gift Box Card */}
                  <div className="flex items-center justify-between gap-3 bg-white/95 text-slate-900 rounded-2xl p-3 sm:p-3.5 shadow-lg backdrop-blur-md border border-amber-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-100 to-red-50 text-red-600 border border-amber-200 shrink-0">
                        <Gift className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          Gift a Home This Rakhi
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Special festive offers & pre-approved loans
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/search?family=true"
                      className="px-3 py-1.5 rounded-xl bg-[#D8232A] hover:bg-red-700 text-white text-xs font-bold shrink-0 transition-colors"
                    >
                      View Deals
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* SMART PROPERTY CONNECTION: Emotional Card Underneath Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 sm:mt-12"
        >
          <div className="rounded-2xl sm:rounded-3xl border border-amber-200/90 bg-gradient-to-r from-white via-amber-50/40 to-rose-50/40 p-5 sm:p-7 shadow-lg shadow-amber-900/5 backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
              
              {/* Emotional Message */}
              <div className="flex items-start sm:items-center gap-3.5 text-left">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-md shadow-red-600/25">
                  <Heart className="h-6 w-6 fill-white" />
                </div>
                <div>
                  <h3 className="font-display text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>A Home for Every Bond</span>
                    <span className="text-base">❤️</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5 leading-relaxed">
                    From the home where you grew up together to the home you&apos;re building today —
                    find a place that brings your family closer.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="w-full md:w-auto shrink-0">
                <Link
                  to="/search?category=apartment&bedrooms=3"
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-[#D8232A] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition-all group cursor-pointer"
                >
                  <span>Explore Family Homes</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

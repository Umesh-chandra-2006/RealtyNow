import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { HomePropertyCard } from '../../pages/public/home';
import { useLocationContext } from '../../contexts/location-context';
import { TinyRakhiIcon } from './RakshaBandhanIcons';
import type { Property } from '../../lib/types';

export function RakshaBandhanPropertySection() {
  const { cityId } = useLocationContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Fetch real family-suitable properties from the database (3+ BHK or spacious homes)
  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['raksha-bandhan-family-properties', cityId],
    queryFn: async () => {
      let query = supabase
        .from('v_properties_search')
        .select('*')
        .eq('status', 'Approved')
        .order('created_at', { ascending: false })
        .limit(10);

      if (cityId) {
        query = query.eq('city_id', cityId);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        // Fallback: fetch any approved properties if filter yields 0
        const fallback = await supabase
          .from('v_properties_search')
          .select('*')
          .eq('status', 'Approved')
          .limit(8);
        return (fallback.data || []) as Property[];
      }

      return data as Property[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, properties]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 350);
  };

  if (!isLoading && properties.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-gradient-to-b from-white via-[#FCF9F4] to-white border-b border-amber-100/60 relative overflow-hidden">
      {/* Subtle festive background accents */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-amber-100/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-red-100/20 blur-3xl pointer-events-none" />

      <div className="container-wide relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-black uppercase tracking-wider mb-2.5 shadow-2xs">
              <TinyRakhiIcon className="w-3.5 h-3.5" />
              <span>Festive Collection</span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              Homes Made for <span className="text-[#D8232A]">Togetherness</span>
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 font-medium max-w-xl">
              Explore properties where families can celebrate, grow and create memories together.
            </p>
          </div>

          {/* Navigation Controls & Explore All */}
          <div className="flex items-center gap-3 self-start md:self-end">
            <Link
              to="/search?featured=true"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#D8232A] hover:text-red-700 transition-colors mr-2"
            >
              <span>View All Festive Homes</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                aria-label="Scroll left"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                aria-label="Scroll right"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel / Property Listings */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-72 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-5 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {properties.map((property) => (
              <div
                key={property.id}
                className="w-[280px] sm:w-[320px] lg:w-[340px] shrink-0 snap-start"
              >
                <HomePropertyCard
                  property={property}
                  badge={{
                    label: 'Rakhi Special',
                    className: 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-bold border border-amber-300/40 shadow-xs',
                    icon: <Sparkles className="h-3 w-3 text-amber-200" />,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

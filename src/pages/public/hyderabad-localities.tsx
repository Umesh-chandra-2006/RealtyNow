import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PageLoader } from '../../components/ui';

const LOCALITY_IMAGES = [
  'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg',
  'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg',
  'https://images.pexels.com/photos/2581922/pexels-photo-2581922.jpeg',
  'https://images.pexels.com/photos/380769/pexels-photo-380769.jpeg',
  'https://images.pexels.com/photos/259950/pexels-photo-259950.jpeg',
  'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg',
  'https://images.pexels.com/photos/2104152/pexels-photo-2104152.jpeg',
  'https://images.pexels.com/photos/208736/pexels-photo-208736.jpeg',
  'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg',
  'https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg',
];

export function HyderabadLocalitiesPage() {
  const { data: localities, isLoading } = useQuery({
    queryKey: ['hyderabad-localities-all'],
    queryFn: async () => {
      const { data: city } = await supabase.from('cities').select('id').ilike('name', 'Hyderabad').maybeSingle();
      if (!city) return [];
      const { data: localityRows } = await supabase
        .from('localities')
        .select('id, name')
        .eq('city_id', city.id)
        .order('name');
      if (!localityRows) return [];
      const enriched = await Promise.all(
        localityRows.map(async (l) => {
          const { count } = await supabase
            .from('v_properties_search')
            .select('id', { count: 'exact', head: true })
            .eq('locality_id', l.id);
          return { ...l, count: count ?? 0 };
        }),
      );
      return enriched.sort((a, b) => b.count - a.count);
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
      <div className="container-wide">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Explore <span className="text-red-600">Hyderabad</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            All localities in Hyderabad and their available properties.
          </p>
        </div>

        {localities && localities.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {localities.map((locality, i) => (
              <motion.div
                key={locality.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i, 10) * 0.05 }}
                whileHover={{ y: -5 }}
              >
                <Link
                  to={`/search?city=Hyderabad&locality=${encodeURIComponent(locality.name)}`}
                  className="group relative block overflow-hidden rounded-2xl"
                >
                  <div className="aspect-[4/5] w-full overflow-hidden">
                    <img
                      src={LOCALITY_IMAGES[i % LOCALITY_IMAGES.length]}
                      alt={locality.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-4">
                    <p className="font-display text-lg font-bold text-white">{locality.name}</p>
                    <p className="text-xs text-white/70">{locality.count} properties</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-slate-400">No localities found for Hyderabad yet.</p>
        )}
      </div>
    </div>
  );
}

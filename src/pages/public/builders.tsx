import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { PageLoader, EmptyState } from '../../components/ui';
import { Building2, BadgeCheck, Award, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export function BuildersPage() {
  const { data: builders, isLoading } = useQuery({
    queryKey: ['all-verified-builders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builders')
        .select('*')
        .eq('status', 'approved')
        .eq('public_visible', true)
        .order('is_featured', { ascending: false })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;

      const builderRows = data ?? [];
      const ids = builderRows.map((b) => b.id);
      const projectCounts = new Map<string, number>();
      if (ids.length > 0) {
        const { data: projectRows } = await supabase.from('projects').select('builder_id').in('builder_id', ids);
        (projectRows ?? []).forEach((p: { builder_id: string }) => {
          projectCounts.set(p.builder_id, (projectCounts.get(p.builder_id) ?? 0) + 1);
        });
      }
      return builderRows.map((b) => ({ ...b, _projectCount: projectCounts.get(b.id) ?? 0 }));
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50 pt-6 sm:pt-8 pb-12">
      <div className="container-wide">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Verified <span className="text-red-600">Builders</span>
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-600 border border-red-100">
              <BadgeCheck className="h-3 w-3" /> RealtyNow Verified
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Meet the trusted developers shaping India's next generation of premium living spaces.
          </p>
        </div>

        {!builders || builders.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8 text-slate-400" />}
            title="No verified builders yet"
            description="Verified builders will appear here soon."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {builders.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/builders/${b.id}`}
                  className="group block h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative h-40 overflow-hidden bg-slate-100">
                    {b.cover_image ? (
                      <img
                        src={b.cover_image}
                        alt={b.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="h-full w-full grid place-items-center bg-gradient-to-br from-navy-800 to-navy-950">
                        <Building2 className="h-10 w-10 text-white/40" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-sm">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </span>
                    <div className="absolute -bottom-6 left-4 h-14 w-14 rounded-xl bg-white border border-slate-200 shadow-md grid place-items-center overflow-hidden">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-6 w-6 text-navy-400" />
                      )}
                    </div>
                  </div>
                  <div className="pt-8 pb-5 px-4">
                    <p className="font-display font-bold text-navy-900 truncate">{b.name}</p>
                    {b.description && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{b.description}</p>}
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
                      {b._projectCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" /> {b._projectCount} Projects
                        </span>
                      )}
                      {b.established_year && (
                        <span className="flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-slate-400" />
                          {new Date().getFullYear() - b.established_year}+ Yrs
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs font-bold text-red-600 group-hover:text-red-700 inline-flex items-center gap-1">
                        View Builder <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

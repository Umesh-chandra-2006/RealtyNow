import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { Card, Skeleton, Badge } from '../../components/ui';
import {
  Building2,
  MessageSquare,
  Briefcase,
  TrendingUp,
  Layers,
  Boxes,
  ChevronRight,
} from 'lucide-react';
import { getBuilderSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n';
import { formatDate } from '../../lib/utils';

export function BuilderDashboard() {
  const { profile, user } = useAuth();
  const { t } = useLanguageContext();
  const builderSections = getBuilderSections(t);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['builder-dashboard-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [projectsRes, leadsRes, wonLeadsRes] = await Promise.all([
        supabase.from('builder_projects').select('id', { count: 'exact' }).eq('builder_id', user.id),
        supabase.from('builder_leads').select('id', { count: 'exact' }).eq('builder_id', user.id).eq('status', 'new'),
        supabase.from('builder_leads').select('id', { count: 'exact' }).eq('builder_id', user.id).eq('status', 'won'),
      ]);

      const projectIds = (projectsRes.data || []).map((p) => p.id);
      let blocksCount = 0;
      let unitsCount = 0;
      let bookingsCount = 0;

      if (projectIds.length > 0) {
        const { data: towerRows, count: towersCount } = await supabase
          .from('builder_towers')
          .select('id', { count: 'exact' })
          .in('project_id', projectIds);
        blocksCount = towersCount || 0;

        const towerIds = (towerRows || []).map((t) => t.id);
        if (towerIds.length > 0) {
          const { data: unitRows, count: totalUnits } = await supabase
            .from('builder_units')
            .select('id', { count: 'exact' })
            .in('tower_id', towerIds);
          unitsCount = totalUnits || 0;

          const unitIds = (unitRows || []).map((u) => u.id);
          if (unitIds.length > 0) {
            const { count: totalBookings } = await supabase
              .from('builder_bookings')
              .select('id', { count: 'exact' })
              .in('unit_id', unitIds);
            bookingsCount = totalBookings || 0;
          }
        }
      }

      return {
        projects: projectsRes.count || 0,
        newLeads: leadsRes.count || 0,
        wonLeads: wonLeadsRes.count || 0,
        blocks: blocksCount,
        units: unitsCount,
        bookings: bookingsCount,
      };
    },
    enabled: !!user,
  });

  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ['builder-dashboard-recent', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [projectsRes, leadsRes] = await Promise.all([
        supabase
          .from('builder_projects')
          .select('id, name, status, created_at')
          .eq('builder_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('builder_leads')
          .select('id, name, status, created_at, builder_projects(name)')
          .eq('builder_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      return {
        projects: projectsRes.data || [],
        leads: leadsRes.data || [],
      };
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout sections={builderSections} title="Dashboard" badge="Builder">
      <PageHeader
        title={`Welcome, ${profile?.first_name || 'Builder'}`}
        subtitle="Manage your projects, track leads, and analyze your portfolio."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              label="Total Projects"
              value={stats.projects}
              icon={<Building2 className="h-5 w-5" />}
              accent="navy"
              to="/builder/projects"
            />
            <StatCard
              label="New Leads"
              value={stats.newLeads}
              icon={<MessageSquare className="h-5 w-5" />}
              accent="gold"
              to="/builder/leads"
            />
            <StatCard
              label="Closed Deals"
              value={stats.wonLeads}
              icon={<Briefcase className="h-5 w-5" />}
              accent="success"
              to="/builder/bookings"
            />
            <StatCard
              label="Conversion"
              value={`${
                stats.newLeads && stats.newLeads > 0
                  ? Math.round((stats.wonLeads / (stats.newLeads + stats.wonLeads)) * 100)
                  : 0
              }%`}
              icon={<TrendingUp className="h-5 w-5" />}
              accent="success"
              to="/builder/analytics"
            />
          </>
        )}
      </div>

      {/* Portfolio & Sales Setup Flow Guide */}
      <div className="mt-8 bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-navy-950 flex items-center gap-2">
              <span>🏗️</span> Portfolio & Sales Workflow
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Connected lifecycle from project design to customer booking
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">
            Connected ERP Stages
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Step 1: Projects */}
          <Link
            to="/builder/projects"
            className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-red-50/50 hover:border-red-200 transition group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-navy-900">1. Projects</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 transition" />
            </div>
            <p className="text-xs text-slate-500">
              {stats?.projects ? `${stats.projects} projects active` : 'Create your first project'}
            </p>
          </Link>

          {/* Step 2: Blocks & Floors */}
          <Link
            to="/builder/blocks"
            className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/50 hover:border-blue-200 transition group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-navy-900">2. Blocks & Towers</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
            </div>
            <p className="text-xs text-slate-500">
              {stats?.blocks ? `${stats.blocks} towers configured` : 'Add towers & floors'}
            </p>
          </Link>

          {/* Step 3: Units & Pricing */}
          <Link
            to="/builder/units"
            className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-amber-50/50 hover:border-amber-200 transition group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                  <Boxes className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-navy-900">3. Units & Pricing</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition" />
            </div>
            <p className="text-xs text-slate-500">
              {stats?.units ? `${stats.units} units in inventory` : 'Place units & prices'}
            </p>
          </Link>

          {/* Step 4: Leads & Bookings */}
          <Link
            to="/builder/bookings"
            className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-emerald-50/50 hover:border-emerald-200 transition group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <Briefcase className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-navy-900">4. Bookings & Sales</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
            </div>
            <p className="text-xs text-slate-500">
              {stats?.bookings ? `${stats.bookings} bookings logged` : 'Manage deal closures'}
            </p>
          </Link>
        </div>
      </div>
      
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
           <h3 className="text-lg font-bold text-navy-900 mb-4">Recent Projects</h3>
           {recentLoading ? (
             <div className="space-y-3">
               {Array.from({ length: 3 }).map((_, i) => (
                 <Skeleton key={i} className="h-10 w-full" />
               ))}
             </div>
           ) : !recent?.projects.length ? (
             <p className="text-sm text-gray-500">Your most recently updated projects will appear here.</p>
           ) : (
             <div className="divide-y divide-navy-100">
               {recent.projects.map((p) => (
                 <div key={p.id} className="flex items-center justify-between py-2.5">
                   <div>
                     <p className="text-sm font-medium text-navy-900">{p.name}</p>
                     <p className="text-xs text-navy-500">{formatDate(p.created_at)}</p>
                   </div>
                   <Badge variant={p.status === 'completed' ? 'success' : p.status === 'ongoing' ? 'info' : 'default'} className="capitalize">
                     {p.status}
                   </Badge>
                 </div>
               ))}
             </div>
           )}
        </Card>
        <Card className="p-6">
           <h3 className="text-lg font-bold text-navy-900 mb-4">Recent Leads</h3>
           {recentLoading ? (
             <div className="space-y-3">
               {Array.from({ length: 3 }).map((_, i) => (
                 <Skeleton key={i} className="h-10 w-full" />
               ))}
             </div>
           ) : !recent?.leads.length ? (
             <p className="text-sm text-gray-500">Your latest enquiries will appear here.</p>
           ) : (
             <div className="divide-y divide-navy-100">
               {recent.leads.map((l: any) => (
                 <div key={l.id} className="flex items-center justify-between py-2.5">
                   <div>
                     <p className="text-sm font-medium text-navy-900">{l.name}</p>
                     <p className="text-xs text-navy-500">{l.builder_projects?.name || 'General Inquiry'} • {formatDate(l.created_at)}</p>
                   </div>
                   <Badge variant="gold" className="capitalize">{String(l.status).replace('_', ' ')}</Badge>
                 </div>
               ))}
             </div>
           )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

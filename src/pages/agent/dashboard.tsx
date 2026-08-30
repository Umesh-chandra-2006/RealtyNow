import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AiLeadAssistant } from '../../components/agent/AiLeadAssistant';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  MessageSquare,
  Eye,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, StatCard } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { Card, Skeleton, Badge, EmptyState } from '../../components/ui';
import { formatNumber } from '../../lib/utils';
import { useRealtimeCount } from '../../lib/realtime';
import { RemindersWidget } from '../../components/reminders-widget';
import { AgentLeadDetailDrawer } from '../../components/agent/AgentLeadDetailDrawer';

const AGENT_PROPERTIES_EXPORT_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Property' },
  { key: 'locality_name', label: 'Locality' },
  { key: 'city_name', label: 'City' },
  { key: 'price', label: 'Price' },
  { key: 'status', label: 'Status' },
  { key: 'view_count', label: 'Views' },
  { key: 'created_at', label: 'Created' },
];

interface AgentPropertiesFilterState {
  status: string;
  city: string;
  type: string;
  minPrice: string;
  maxPrice: string;
}

const LEAD_STATUSES = ['new', 'contacted', 'closed', 'spam'] as const;
const APPT_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'] as const;

export function AgentDashboard() {
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const { user, profile } = useAuth();
  const agentDisplayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'Agent';
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const realtimeTick = useRealtimeCount('enquiries', { column: 'agent_id', value: user?.id ?? '' });
  const realtimeTickAssigned = useRealtimeCount('enquiries', { column: 'assigned_to', value: user?.id ?? '' });
  const realtimeTasks = useRealtimeCount('agent_tasks', { column: 'agent_id', value: user?.id ?? '' });
  const realtimeAppts = useRealtimeCount('appointments', { column: 'agent_id', value: user?.id ?? '' });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['agent-stats', user?.id, dateRange, realtimeTick, realtimeTickAssigned, realtimeTasks, realtimeAppts],
    queryFn: async () => {
      if (!user) return null;

      let dateThreshold: string | null = null;
      const now = new Date();
      if (dateRange === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateThreshold = start.toISOString();
      } else if (dateRange === 'week') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateThreshold = start.toISOString();
      } else if (dateRange === 'month') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateThreshold = start.toISOString();
      }

      let leadsQuery = supabase
        .from('enquiries')
        .select('id, status, lead_status, created_at')
        .or(`agent_id.eq.${user.id},assigned_to.eq.${user.id}`);

      let apptsQuery = supabase
        .from('appointments')
        .select('id, status, created_at, scheduled_at')
        .eq('agent_id', user.id);

      if (dateThreshold) {
        leadsQuery = leadsQuery.gte('created_at', dateThreshold);
        apptsQuery = apptsQuery.gte('created_at', dateThreshold);
      }

      const [assigned, leadsRes, apptsRes, tasksRes] = await Promise.all([
        supabase.from('properties').select('id, view_count, status').or(`assigned_agent_id.eq.${user.id},owner_id.eq.${user.id}`),
        leadsQuery,
        apptsQuery,
        supabase.from('agent_tasks').select('id, status, due_date').eq('agent_id', user.id),
      ]);

      const props = assigned.data ?? [];
      const allLeads = leadsRes.data ?? [];
      const allAppts = apptsRes.data ?? [];
      const allTasks = tasksRes.data ?? [];

      return {
        assigned: props.length,
        views: props.reduce((a, p) => a + (p.view_count ?? 0), 0),
        totalLeads: allLeads.length,
        newLeads: allLeads.filter((l) => (l.lead_status || l.status) === 'new').length,
        contactedLeads: allLeads.filter((l) => (l.lead_status || l.status) === 'contacted' || (l.lead_status || l.status) === 'interested').length,
        siteVisits: allLeads.filter((l) => (l.lead_status || l.status) === 'site_visit').length,
        converted: allLeads.filter((l) => (l.lead_status || l.status) === 'won').length,
        appointments: allAppts.length,
        pendingAppts: allAppts.filter((a) => a.status === 'requested').length,
        pendingTasks: allTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length,
      };
    },
    enabled: !!user,
  });

  const { data: recentLeads } = useQuery({
    queryKey: ['agent-leads-recent', user?.id, realtimeTick, realtimeTickAssigned],
    queryFn: async () => {
      const { data } = await supabase
        .from('enquiries')
        .select('*, property:properties(id, title, price, purpose, images, locality_name, city_name)')
        .or(`agent_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
        .order('created_at', { ascending: false })
        .limit(5);
      return (data ?? []).map((e) => ({ ...e, property: Array.isArray(e.property) ? e.property[0] : e.property }));
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout sections={agentSections} title="Agent Dashboard" badge="Agent">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Welcome, {agentDisplayName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your real-time CRM performance & portfolio overview.</p>
        </div>

        {/* Date Range Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {(['all', 'today', 'week', 'month'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                dateRange === r ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r === 'all' ? 'All Time' : r === 'week' ? 'Last 7 Days' : r === 'month' ? 'Last 30 Days' : 'Today'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              label="Assigned Properties"
              value={stats.assigned}
              icon={<Building2 className="h-5 w-5" />}
              accent="navy"
              to="/agent/properties"
            />
            <StatCard
              label="Total Views"
              value={formatNumber(stats.views)}
              icon={<Eye className="h-5 w-5" />}
              accent="gold"
              to="/agent/properties"
            />
            <StatCard
              label="New Leads"
              value={stats.newLeads}
              icon={<MessageSquare className="h-5 w-5" />}
              accent="success"
              to="/agent/leads?status=new"
            />
            <StatCard
              label="Pending Visits & Appts"
              value={stats.pendingAppts}
              icon={<Calendar className="h-5 w-5" />}
              accent="navy"
              to="/agent/appointments?status=requested"
            />
          </>
        )}
      </div>

      <div className="mt-6">
        <AiLeadAssistant />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold text-navy-900">Recent leads</h3>
            <Link to="/agent/leads" className="text-xs font-bold text-red-600 hover:underline">
              View All Leads →
            </Link>
          </div>
          <Card className="divide-y divide-navy-50 overflow-hidden">
            {!recentLeads ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : recentLeads.length > 0 ? (
              recentLeads.map((e) => {
                const currentStatus = e.lead_status || e.status || 'new';
                return (
                  <div
                    key={e.id}
                    onClick={() => {
                      setSelectedLead(e);
                      setDrawerOpen(true);
                    }}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm font-semibold text-navy-900 truncate">{e.name || 'Anonymous'}</p>
                      <p className="text-xs text-slate-500 truncate">{e.property?.title ?? 'General Enquiry'}</p>
                    </div>
                    <Badge
                      variant={
                        currentStatus === 'won'
                          ? 'success'
                          : currentStatus === 'lost'
                            ? 'error'
                            : currentStatus === 'new'
                              ? 'info'
                              : 'default'
                      }
                      className="uppercase text-[10px] font-bold shrink-0"
                    >
                      {currentStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={<MessageSquare className="h-8 w-8 text-navy-300" />}
                  title="No leads yet"
                  description="Enquiries assigned to you will appear here."
                />
              </div>
            )}
          </Card>
        </div>

        <div>
          <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Quick actions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/agent/leads" className="card p-4 transition hover:shadow-cardHover">
              <MessageSquare className="h-6 w-6 text-navy-700" />
              <p className="mt-2 text-sm font-semibold text-navy-900">Manage Leads</p>
              <p className="text-xs text-navy-500">Update lead status and follow up</p>
            </Link>
            <Link to="/agent/appointments" className="card p-4 transition hover:shadow-cardHover">
              <Calendar className="h-6 w-6 text-navy-700" />
              <p className="mt-2 text-sm font-semibold text-navy-900">Appointments</p>
              <p className="text-xs text-navy-500">Confirm or cancel visits</p>
            </Link>
            <Link to="/agent/properties" className="card p-4 transition hover:shadow-cardHover">
              <Building2 className="h-6 w-6 text-navy-700" />
              <p className="mt-2 text-sm font-semibold text-navy-900">Properties</p>
              <p className="text-xs text-navy-500">View assigned listings</p>
            </Link>
            <Link to="/agent/analytics" className="card p-4 transition hover:shadow-cardHover">
              <TrendingUp className="h-6 w-6 text-navy-700" />
              <p className="mt-2 text-sm font-semibold text-navy-900">Analytics</p>
              <p className="text-xs text-navy-500">Track performance</p>
            </Link>
          </div>
          <div className="mt-6">
            <RemindersWidget />
          </div>
        </div>
      </div>

      <AgentLeadDetailDrawer
        lead={selectedLead}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLead(null);
        }}
      />
    </DashboardLayout>
  );
}


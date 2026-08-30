import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MessageCircle,
  Tag,
  LayoutGrid,
  LayoutList,
  Kanban,
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { Badge, Button } from '../../components/ui';
import { type Column } from '../../components/data-table';
import { formatDate, formatPrice, generatePropertyUrl, buildWhatsAppUrl, isUuid } from '../../lib/utils';
import { useRealtimeCount } from '../../lib/realtime';
import { AgentKanbanBoard } from '../../components/agent/AgentKanbanBoard';
import { UnifiedLeadDetailModal, AGENT_CRM_STAGES } from '../../components/crm/UnifiedLeadDetailModal';
import { ProfessionalCrmTable } from '../../components/crm/ProfessionalCrmTable';

export function AgentLeads() {
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated' | 'follow_up'>('newest');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'kanban'>('cards');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const leadIdParam = searchParams.get('leadId');

  // Realtime subscription ticks for leads
  const realtimeTick = useRealtimeCount('enquiries', { column: 'agent_id', value: user?.id ?? '' });
  const realtimeTickAssigned = useRealtimeCount('enquiries', { column: 'assigned_to', value: user?.id ?? '' });

  // Query Leads with joined property data
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['agent-leads', user?.id, realtimeTick, realtimeTickAssigned],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquiries')
        .select('*, property:properties(id, title, price, purpose, images, locality_name, city_name, bedrooms, built_up_area, property_types(name))')
        .or(`agent_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({
        ...e,
        property: Array.isArray(e.property) ? e.property[0] : e.property,
      }));
    },
    enabled: !!user,
  });

  // Auto-open lead if leadId query param is present (Deep Link from Notification)
  useEffect(() => {
    if (!leadIdParam) return;
    const found = leads.find((l) => l.id === leadIdParam);
    if (found) {
      setSelectedLead(found);
      setDrawerOpen(true);
    } else if (user && isUuid(leadIdParam)) {
      // Fetch specifically if not yet in list
      supabase
        .from('enquiries')
        .select('*, property:properties(id, title, price, purpose, images, locality_name, city_name, bedrooms, built_up_area, property_types(name))')
        .eq('id', leadIdParam)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSelectedLead({
              ...data,
              property: Array.isArray(data.property) ? data.property[0] : data.property,
            });
            setDrawerOpen(true);
          }
        });
    }
  }, [leadIdParam, leads, user]);

  // Mutation: Quick status update
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const oldLead = leads.find((l) => l.id === id);
      const oldStatus = oldLead?.lead_status || oldLead?.status;

      const isAppointment = id.startsWith('apt-');
      const cleanId = isAppointment ? id.replace(/^apt-/, '') : id;

      if (isUuid(cleanId)) {
        if (isAppointment) {
          const aptStatus =
            status === 'won' ? 'completed' :
            status === 'site_visit' ? 'confirmed' :
            status === 'lost' ? 'cancelled' : 'requested';
          await supabase.from('appointments').update({ status: aptStatus, updated_at: new Date().toISOString() }).eq('id', cleanId);
        } else {
          await supabase
            .from('enquiries')
            .update({
              lead_status: status,
              status: status === 'won' || status === 'lost' ? 'closed' : status === 'new' ? 'new' : 'contacted',
              updated_at: new Date().toISOString(),
            })
            .eq('id', cleanId);

          // Log activity
          try {
            await supabase.from('lead_activities').insert({
              lead_id: cleanId,
              actor_id: user?.id ?? null,
              activity_type: status === 'won' ? 'won' : status === 'lost' ? 'lost' : 'status_changed',
              title: `Status changed to ${status.replace('_', ' ').toUpperCase()}`,
              old_value: oldStatus,
              new_value: status,
              is_system: false,
              created_at: new Date().toISOString(),
            });
          } catch {
            // Non-blocking
          }
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-leads'] }),
  });

  // Derived filter rows with sorting
  const filteredLeads = useMemo(() => {
    const result = leads.filter((l) => {
      const st = l.lead_status || l.status || 'new';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (sourceFilter !== 'all' && (l.source || 'property_contact_agent') !== sourceFilter) return false;
      if (priorityFilter !== 'all' && (l.priority || 'medium') !== priorityFilter) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'updated') {
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      }
      if (sortBy === 'follow_up') {
        if (!a.follow_up_at) return 1;
        if (!b.follow_up_at) return -1;
        return new Date(a.follow_up_at).getTime() - new Date(b.follow_up_at).getTime();
      }
      return 0;
    });

    return result;
  }, [leads, statusFilter, sourceFilter, priorityFilter, sortBy]);

  // Derived Pipeline Metrics
  const metrics = useMemo(() => {
    const total = leads.length;
    const newCount = leads.filter((l) => (l.lead_status || l.status) === 'new').length;
    const contactedCount = leads.filter((l) => (l.lead_status || l.status) === 'contacted' || (l.lead_status || l.status) === 'interested').length;
    const followUpCount = leads.filter((l) => (l.lead_status || l.status) === 'follow_up' || l.follow_up_at).length;
    const siteVisitsCount = leads.filter((l) => (l.lead_status || l.status) === 'site_visit').length;
    const wonCount = leads.filter((l) => (l.lead_status || l.status) === 'won').length;
    const lostCount = leads.filter((l) => (l.lead_status || l.status) === 'lost' || (l.lead_status || l.status) === 'closed').length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = leads.filter((l) => new Date(l.created_at) >= todayStart).length;

    return {
      total,
      newCount,
      contactedCount,
      followUpCount,
      siteVisitsCount,
      wonCount,
      lostCount,
      todayCount,
    };
  }, [leads]);

  // Handle open lead
  const handleOpenLead = (lead: any) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  // Table Columns Definition
  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortable: true,
      render: (l) => {
        const isNew = (l.lead_status || l.status) === 'new';
        return (
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full border grid place-items-center shrink-0 relative ${isNew ? 'bg-red-50 border-red-200' : 'bg-slate-100 border-slate-200'}`}>
              <span className={`text-xs font-bold ${isNew ? 'text-red-700' : 'text-slate-700'}`}>
                {l.name ? l.name.charAt(0).toUpperCase() : 'C'}
              </span>
              {isNew && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-navy-900 leading-snug">{l.name || 'Anonymous Customer'}</p>
                {isNew && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700">
                    New
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{l.phone || l.email || 'No contact details'}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'property',
      header: 'Interested Property',
      render: (l) =>
        l.property?.title ? (
          <div className="max-w-xs min-w-[180px]">
            <Link
              to={generatePropertyUrl(l.property)}
              target="_blank"
              className="text-xs font-semibold text-navy-900 hover:text-red-600 truncate block hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {l.property.title}
            </Link>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {formatPrice(l.property.price, l.property.purpose)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">General Enquiry</span>
        ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (l) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
          <Tag className="w-3 h-3 text-slate-400" />
          {l.source ? l.source.replace(/_/g, ' ') : 'Property Contact'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Stage',
      sortable: true,
      render: (l) => {
        const st = l.lead_status || l.status || 'new';
        return (
          <Badge
            variant={
              st === 'won'
                ? 'success'
                : st === 'lost'
                  ? 'error'
                  : st === 'new'
                    ? 'info'
                    : 'default'
            }
            className="uppercase text-[10px] font-bold"
          >
            {st.replace('_', ' ')}
          </Badge>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Received',
      sortable: true,
      render: (l) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {formatDate(l.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (l) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenLead(l)}
            className="text-xs py-1 px-2.5 h-8"
          >
            View Lead
          </Button>
          {l.phone && (
            <a
              href={buildWhatsAppUrl(l.phone, `Hello ${l.name || ''}, regarding your enquiry on RealtyNow:`)}
              target="_blank"
              rel="noreferrer"
              className="h-8 w-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 grid place-items-center transition-colors shadow-2xs"
              title="Chat on WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout sections={agentSections} title="Leads & CRM" badge="Agent">
      <PageHeader
        title="Agent Leads & CRM"
        subtitle="Real-time customer enquiry, site visit, and appointment pipeline assigned to you."
      />

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          {
            id: 'all',
            label: 'All Leads',
            count: metrics.total,
            activeBg: 'bg-navy-900 border-navy-900 shadow-md text-white',
            dotActive: 'bg-white',
            dotInactive: 'bg-navy-600',
            inactiveLabelColor: 'text-slate-600',
          },
          {
            id: 'new',
            label: 'New',
            count: metrics.newCount,
            activeBg: 'bg-blue-600 border-blue-600 shadow-md shadow-blue-500/25 text-white',
            dotActive: 'bg-white',
            dotInactive: 'bg-blue-500',
            inactiveLabelColor: 'text-blue-600',
          },
          {
            id: 'contacted',
            label: 'Contacted',
            count: metrics.contactedCount,
            activeBg: 'bg-amber-600 border-amber-600 shadow-md shadow-amber-500/25 text-white',
            dotActive: 'bg-white',
            dotInactive: 'bg-amber-500',
            inactiveLabelColor: 'text-amber-600',
          },
          {
            id: 'follow_up',
            label: 'Follow-Up',
            count: metrics.followUpCount,
            activeBg: 'bg-orange-600 border-orange-600 shadow-md shadow-orange-500/25 text-white',
            dotActive: 'bg-white',
            dotInactive: 'bg-orange-500',
            inactiveLabelColor: 'text-orange-600',
          },
          {
            id: 'site_visit',
            label: 'Site Visits',
            count: metrics.siteVisitsCount,
            activeBg: 'bg-purple-600 border-purple-600 shadow-md shadow-purple-500/25 text-white',
            dotActive: 'bg-white',
            dotInactive: 'bg-purple-500',
            inactiveLabelColor: 'text-purple-600',
          },
          {
            id: 'won',
            label: 'Converted',
            count: metrics.wonCount,
            activeBg: 'bg-emerald-600 border-emerald-600 shadow-md shadow-emerald-500/25 text-white',
            dotActive: 'bg-white',
            dotInactive: 'bg-emerald-500',
            inactiveLabelColor: 'text-emerald-600',
          },
          {
            id: 'lost',
            label: 'Lost/Closed',
            count: metrics.lostCount,
            activeBg: 'bg-rose-600 border-rose-600 shadow-md shadow-rose-500/25 text-white',
            dotActive: 'bg-white',
            dotInactive: 'bg-rose-500',
            inactiveLabelColor: 'text-rose-600',
          },
        ].map((card) => {
          const isActive = statusFilter === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                setStatusFilter(card.id);
                if (card.id === 'all') {
                  setSearchParams({});
                } else {
                  setSearchParams({ status: card.id });
                }
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer select-none ${
                isActive
                  ? card.activeBg
                  : 'bg-white hover:bg-slate-50/80 border-slate-200/90 text-slate-800 shadow-2xs hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <span
                className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isActive ? 'text-white' : card.inactiveLabelColor
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? card.dotActive : card.dotInactive
                  }`}
                />
                {card.label}
              </span>
              <span
                className={`text-2xl font-extrabold font-display mt-1 block tracking-tight ${
                  isActive ? 'text-white' : 'text-navy-950'
                }`}
              >
                {card.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar: Filters, Sort, and View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Status Stage Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => {
              setStatusFilter('all');
              setSearchParams({});
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {leads.length}
            </span>
          </button>
          {AGENT_CRM_STAGES.map((s) => {
            const count = leads.filter((l) => (l.lead_status || l.status) === s.id).length;
            const isActive = statusFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setStatusFilter(s.id);
                  setSearchParams({ status: s.id });
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {s.label}
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort and View Switcher */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="updated">Recently Updated</option>
              <option value="follow_up">Next Follow-Up</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View Render */}
      {viewMode === 'kanban' ? (
        <AgentKanbanBoard
          leads={filteredLeads}
          onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
          onOpenLead={handleOpenLead}
        />
      ) : (
        <ProfessionalCrmTable
          leads={filteredLeads}
          isLoading={isLoading}
          sourceType="agent"
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
          }}
        />
      )}

      {/* Unified Lead Detail & Stage Stepper Modal */}
      <UnifiedLeadDetailModal
        lead={selectedLead}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLead(null);
        }}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
        }}
        sourceType="agent"
      />
    </DashboardLayout>
  );
}

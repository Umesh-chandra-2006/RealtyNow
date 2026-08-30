import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  PhoneCall,
  Target,
  Flame,
  RefreshCw,
  Eye,
  Edit2,
  UserCheck,
  Users,
  Clock,
  MapPin,
  Building2,
  Inbox,
  Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/dashboard-layout';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { formatDate, formatPrice, cn } from '../../lib/utils';
import { useRealtimeCount } from '../../lib/realtime';
import { getAdminSections } from '../portal/sections';
import { Modal, Select, Button } from '../../components/ui';
import { useToast } from '../../components/toast';
import { UnifiedLeadDetailModal } from '../../components/crm/UnifiedLeadDetailModal';
import { ProfessionalCrmTable } from '../../components/crm/ProfessionalCrmTable';

type LeadStatus = 'new' | 'assigned' | 'contacted' | 'site_visit' | 'negotiation' | 'won' | 'lost' | 'closed' | 'spam';

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  lead_status: LeadStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  source: string | null;
  budget_min: number | null;
  budget_max: number | null;
  assigned_to: string | null;
  follow_up_at: string | null;
  contact_count: number;
  conversion_value: number | null;
  created_at: string;
  updated_at: string;
  property?: { id: string; title: string };
  assignee?: { id: string; first_name: string; last_name: string; phone: string; email: string };
}

interface PipelineStats {
  total: number;
  new: number;
  assigned: number;
  contacted: number;
  site_visit: number;
  negotiation: number;
  won: number;
  lost: number;
  closed: number;
  overdue: number;
  total_revenue: number;
  conversion_rate: number;
}

const STAGE_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; bg: string; border: string; badge: string; icon: React.ReactNode }
> = {
  new: {
    label: 'New Leads',
    color: 'text-blue-700',
    bg: 'bg-blue-50/80',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    icon: <Flame className="w-4 h-4 text-blue-600" />,
  },
  assigned: {
    label: 'Assigned',
    color: 'text-purple-700',
    bg: 'bg-purple-50/80',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800',
    icon: <UserCheck className="w-4 h-4 text-purple-600" />,
  },
  contacted: {
    label: 'Contacted',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50/80',
    border: 'border-cyan-200',
    badge: 'bg-cyan-100 text-cyan-800',
    icon: <Phone className="w-4 h-4 text-cyan-600" />,
  },
  site_visit: {
    label: 'Site Visit',
    color: 'text-amber-700',
    bg: 'bg-amber-50/80',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    icon: <Eye className="w-4 h-4 text-amber-600" />,
  },
  negotiation: {
    label: 'Negotiation',
    color: 'text-orange-700',
    bg: 'bg-orange-50/80',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-800',
    icon: <SlidersHorizontal className="w-4 h-4 text-orange-600" />,
  },
  won: {
    label: 'Won / Converted',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  },
  lost: {
    label: 'Lost',
    color: 'text-rose-700',
    bg: 'bg-rose-50/80',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-800',
    icon: <XCircle className="w-4 h-4 text-rose-600" />,
  },
  closed: {
    label: 'Closed',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    badge: 'bg-slate-200 text-slate-800',
    icon: <CheckCircle2 className="w-4 h-4 text-slate-600" />,
  },
  spam: {
    label: 'Spam',
    color: 'text-slate-500',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    badge: 'bg-slate-200 text-slate-600',
    icon: <XCircle className="w-4 h-4 text-slate-500" />,
  },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-600' },
  high: { label: 'High', color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-600' },
  medium: { label: 'Medium', color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-600' },
  low: { label: 'Low', color: 'text-slate-700 bg-slate-100 border-slate-200', dot: 'bg-slate-400' },
};

const PIPELINE_STAGES: LeadStatus[] = ['new', 'assigned', 'contacted', 'site_visit', 'negotiation', 'won'];

// ─── Lead Card Component ──────────────────────────────────────────────────────
function LeadCard({
  lead,
  onStatusChange,
  onAssign,
  onOpenLead,
}: {
  lead: Lead;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onAssign: (lead: Lead) => void;
  onOpenLead: (lead: Lead) => void;
}) {
  const prio = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.medium;
  const isOverdue =
    lead.follow_up_at &&
    new Date(lead.follow_up_at) < new Date() &&
    !['won', 'lost', 'closed'].includes(lead.lead_status);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('leadId', lead.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onOpenLead(lead)}
      className={cn(
        'group relative rounded-2xl border bg-white p-4 shadow-xs transition-all duration-200 cursor-pointer active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5',
        isOverdue ? 'border-red-400 ring-1 ring-red-400/20' : 'border-slate-200 hover:border-red-300'
      )}
    >
      {/* Header: Name & Priority */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-sm text-slate-900 group-hover:text-red-600 transition-colors truncate">
            {lead.name || 'Anonymous Inquirer'}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                prio.color
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', prio.dot)} />
              {prio.label}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                <AlertTriangle className="w-3 h-3" /> Overdue
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onAssign(lead);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600"
          title="Assign Lead to Agent"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Contact Details */}
      <div className="space-y-1 text-xs text-slate-600 mb-3">
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 font-medium text-slate-700 hover:text-red-600 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{lead.phone}</span>
          </a>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 text-slate-500 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {(lead.budget_min || lead.budget_max) && (
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Budget: {lead.budget_max ? formatPrice(lead.budget_max) : 'N/A'}</span>
          </div>
        )}
      </div>

      {/* Property Badge */}
      {lead.property && (
        <div className="mb-3 rounded-xl bg-slate-50 border border-slate-200/80 p-2 text-xs">
          <p className="font-semibold text-slate-800 truncate flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="truncate">{lead.property.title}</span>
          </p>
        </div>
      )}

      {/* Footer Meta */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        <span className="capitalize font-medium text-slate-500">{lead.source || 'Website'}</span>
        <span>{formatDate(lead.created_at)}</span>
      </div>

      {/* Quick Action Button for New Leads */}
      {lead.lead_status === 'new' && (
        <div className="mt-2.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onStatusChange(lead.id, 'contacted')}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" /> Mark Contacted
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pipeline Column ──────────────────────────────────────────────────────────
function PipelineColumn({
  stage,
  leads,
  onStatusChange,
  onAssign,
  onOpenLead,
}: {
  stage: LeadStatus;
  leads: Lead[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onAssign: (lead: Lead) => void;
  onOpenLead: (lead: Lead) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const cfg = STAGE_CONFIG[stage];

  return (
    <div
      className={cn(
        'flex-shrink-0 w-80 rounded-2xl bg-slate-50/70 border border-slate-200/90 p-3 transition-all flex flex-col',
        isDragOver && 'bg-red-50/40 ring-2 ring-red-400 border-dashed border-red-400'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const leadId = e.dataTransfer.getData('leadId');
        if (leadId) {
          onStatusChange(leadId, stage);
        }
      }}
    >
      {/* Column Header */}
      <div
        className={cn(
          'flex items-center justify-between mb-3 px-3.5 py-2.5 rounded-xl border bg-white shadow-2xs',
          cfg.border
        )}
      >
        <div className="flex items-center gap-2">
          {cfg.icon}
          <span className={cn('text-xs sm:text-sm font-extrabold', cfg.color)}>{cfg.label}</span>
        </div>
        <span className={cn('text-xs font-extrabold px-2 py-0.5 rounded-full', cfg.badge)}>
          {leads.length}
        </span>
      </div>

      {/* Cards Container */}
      <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-slate-200 bg-white/60 p-4">
            <Inbox className="w-8 h-8 text-slate-300 mb-1" />
            <p className="text-xs font-bold text-slate-500">No leads in this stage</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Drag and drop leads here</p>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStatusChange={onStatusChange}
              onAssign={onAssign}
              onOpenLead={onOpenLead}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main CRM Dashboard ───────────────────────────────────────────────────────
export function AdminCRMDashboard() {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: agents = [] } = useQuery({
    queryKey: ['crm-assignable-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', 'agent')
        .eq('status', 'active')
        .order('first_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignLead = useMutation({
    mutationFn: async ({ leadId, agentId }: { leadId: string; agentId: string }) => {
      const { error } = await supabase.rpc('fn_assign_lead', { p_lead_id: leadId, p_agent_id: agentId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
      addToast('success', 'Lead successfully assigned.');
      setSelectedLead(null);
      setAssigneeId('');
    },
    onError: (err: any) => addToast('error', err.message ?? 'Could not assign lead'),
  });

  // Realtime subscription
  const realtimeCount = useRealtimeCount('enquiries');

  // Fetch pipeline stats
  const { data: stats } = useQuery<PipelineStats>({
    queryKey: ['crm-stats', realtimeCount],
    queryFn: async () => {
      const { data } = await supabase.rpc('fn_get_crm_dashboard_stats');
      return data as PipelineStats;
    },
    refetchInterval: 30000,
  });

  // Fetch leads
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['crm-leads', filterStatus, filterPriority, searchQuery, realtimeCount],
    queryFn: async () => {
      let q = supabase
        .from('enquiries')
        .select(`
          id, name, email, phone, message, lead_status, priority, source,
          budget_min, budget_max, assigned_to, follow_up_at, contact_count,
          conversion_value, created_at, updated_at,
          property:property_id(id, title, price, locality_name, city_name, property_types(name)),
          assignee:assigned_to(id, first_name, last_name, phone, email)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterStatus !== 'all') q = q.eq('lead_status', filterStatus);
      if (filterPriority !== 'all') q = q.eq('priority', filterPriority);
      if (searchQuery) {
        q = q.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Lead[]) ?? [];
    },
  });

  // Update lead status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.rpc('fn_update_lead_status', {
        p_lead_id: id,
        p_new_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
      addToast('success', 'Lead status updated.');
    },
  });

  const leadsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = leads.filter((l) => l.lead_status === stage);
    return acc;
  }, {} as Record<LeadStatus, Lead[]>);

  const handleStatusChange = (id: string, status: LeadStatus) => updateStatus.mutate({ id, status });
  const handleAssign = (lead: Lead) => setSelectedLead(lead);

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  const statCards = [
    {
      label: 'Total Leads',
      value: stats?.total ?? leads.length,
      icon: Users,
      color: 'text-slate-900',
      bg: 'bg-slate-100 text-slate-700',
      border: 'border-slate-200',
    },
    {
      label: 'New Inquiries',
      value: stats?.new ?? (leadsByStage.new?.length || 0),
      icon: Flame,
      color: 'text-blue-600',
      bg: 'bg-blue-50 text-blue-600',
      border: 'border-blue-200/80',
    },
    {
      label: 'In Progress',
      value:
        (stats?.contacted ?? 0) +
        (stats?.site_visit ?? 0) +
        (stats?.negotiation ?? 0) ||
        ((leadsByStage.contacted?.length || 0) + (leadsByStage.site_visit?.length || 0) + (leadsByStage.negotiation?.length || 0)),
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 text-amber-600',
      border: 'border-amber-200/80',
    },
    {
      label: 'Site Visits',
      value: stats?.site_visit ?? (leadsByStage.site_visit?.length || 0),
      icon: MapPin,
      color: 'text-purple-600',
      bg: 'bg-purple-50 text-purple-600',
      border: 'border-purple-200/80',
    },
    {
      label: 'Won / Converted',
      value: stats?.won ?? (leadsByStage.won?.length || 0),
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 text-emerald-600',
      border: 'border-emerald-200/80',
    },
    {
      label: 'Overdue Follow-ups',
      value: stats?.overdue ?? 0,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50 text-rose-600',
      border: 'border-rose-200/80',
    },
    {
      label: 'Conversion Rate',
      value: `${stats?.conversion_rate ?? 0}%`,
      icon: Target,
      color: 'text-red-600',
      bg: 'bg-red-50 text-red-600',
      border: 'border-red-200/80',
    },
  ];

  return (
    <DashboardLayout sections={adminSections} title="CRM Pipeline">
      {/* Header Bar */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">CRM Pipeline</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Manage leads, automated follow-ups, agent assignments, and conversions across your sales pipeline
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['crm-leads'] });
              qc.invalidateQueries({ queryKey: ['crm-stats'] });
              addToast('info', 'Refreshing CRM leads…');
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-red-300 hover:text-red-600 transition-all cursor-pointer"
            title="Refresh pipeline data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* View Mode Toggle: Kanban vs Table List */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            {(['kanban', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer',
                  viewMode === mode
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                )}
              >
                {mode === 'kanban' ? 'Kanban Board' : 'Table View'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={cn(
                'rounded-2xl border bg-white p-3.5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between',
                s.border
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-500 leading-tight">{s.label}</span>
                <div className={cn('p-1.5 rounded-lg shrink-0', s.bg)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className={cn('font-display text-xl font-extrabold tracking-tight', s.color)}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-slate-900 transition-all cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-slate-900 transition-all cursor-pointer"
          >
            <option value="all">All Pipeline Stages</option>
            {Object.entries(STAGE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>

          {(filterPriority !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setFilterPriority('all');
                setFilterStatus('all');
                setSearchQuery('');
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {PIPELINE_STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              leads={leadsByStage[stage] ?? []}
              onStatusChange={handleStatusChange}
              onAssign={handleAssign}
              onOpenLead={(lead) => setDetailLead(lead)}
            />
          ))}
        </div>
      )}

      {/* Table List View */}
      {viewMode === 'list' && (
        <ProfessionalCrmTable
          leads={leads}
          isLoading={isLoading}
          sourceType="admin"
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: ['crm-leads'] });
            qc.invalidateQueries({ queryKey: ['crm-stats'] });
          }}
        />
      )}

      {/* Unified Lead Detail & Stage Stepper Modal */}
      <UnifiedLeadDetailModal
        lead={detailLead}
        isOpen={!!detailLead}
        onClose={() => setDetailLead(null)}
        sourceType="admin"
        onLeadUpdated={() => {
          qc.invalidateQueries({ queryKey: ['crm-leads'] });
          qc.invalidateQueries({ queryKey: ['crm-stats'] });
        }}
      />

      {/* Assign to Agent Modal */}
      <Modal
        open={!!selectedLead}
        onClose={() => {
          setSelectedLead(null);
          setAssigneeId('');
        }}
        title="Assign Lead to Agent"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedLead(null);
                setAssigneeId('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!assigneeId || assignLead.isPending}
              onClick={() => selectedLead && assignLead.mutate({ leadId: selectedLead.id, agentId: assigneeId })}
            >
              {assignLead.isPending ? 'Assigning…' : 'Assign Agent'}
            </Button>
          </>
        }
      >
        {selectedLead && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <p className="font-bold text-slate-900 text-sm">{selectedLead.name || 'Anonymous'}</p>
              <p className="text-slate-500 mt-0.5">{selectedLead.phone || selectedLead.email}</p>
            </div>
            {selectedLead.assignee && (
              <p className="text-xs text-slate-500">
                Currently assigned to:{' '}
                <strong className="text-slate-800">
                  {selectedLead.assignee.first_name} {selectedLead.assignee.last_name}
                </strong>
              </p>
            )}
            <Select label="Select active agent" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Choose an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

export default AdminCRMDashboard;

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Mail,
  MessageCircle,
  User,
  FileText,
  Flame,
  Activity,
  Layers,
  CalendarClock,
  UserCheck,
  PhoneCall,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useToast } from '../../toast';
import { Button, Input, Textarea, Select } from '../../ui';
import { formatDate, formatDateTime, formatPrice, buildWhatsAppUrl, cn } from '../../../lib/utils';

export interface ServiceLead {
  id: string;
  lead_number?: string | null;
  name?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  service_type?: string | null;
  service_request?: string | null;
  message?: string | null;
  source?: string | null;
  city?: string | null;
  location?: string | null;
  state?: string | null;
  property_id?: string | null;
  property?: { id: string; title: string; price?: number; locality_name?: string; city_name?: string } | null;
  lead_status?: string | null;
  status?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string | null;
  assigned_to?: string | null;
  assignee?: { id: string; first_name?: string; last_name?: string; email?: string; phone?: string } | null;
  follow_up_at?: string | null;
  last_contacted_at?: string | null;
  converted_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  service_data?: Record<string, any> | null;
  custom_fields?: Record<string, any> | null;
  tags?: string[] | null;
}

export const LEAD_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  new: { label: 'New', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  contacted: { label: 'Contacted', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  follow_up: { label: 'Follow Up', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  in_progress: { label: 'In Progress', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  qualified: { label: 'Qualified', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  converted: { label: 'Converted', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  closed: { label: 'Closed', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-300' },
  lost: { label: 'Lost', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

export const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  urgent: { label: 'Urgent', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  high: { label: 'High', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  medium: { label: 'Medium', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  low: { label: 'Low', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400' },
};

export const SERVICE_TYPE_BADGES: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  HOME_SERVICES: { label: 'Home Services', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: '🛠️' },
  INTERIOR_SERVICES: { label: 'Interior Services', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: '🎨' },
  BOREWELL_SERVICES: { label: 'Borewell Services', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', icon: '💧' },
  HOME_LOANS: { label: 'Home Loans', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '🏦' },
  LEGAL_SERVICES: { label: 'Legal Services', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: '⚖️' },
  PACKERS_MOVERS: { label: 'Packers & Movers', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: '📦' },
  PEST_CONTROL: { label: 'Pest Control', color: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-200', icon: '🐜' },
  PAINTING: { label: 'Painting', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', icon: '🖌️' },
  CLEANING: { label: 'Cleaning', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', icon: '✨' },
  GENERAL_ENQUIRY: { label: 'General Enquiry', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-300', icon: '📋' },
};

interface ServiceLeadDetailDrawerProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated?: () => void;
}

export function ServiceLeadDetailDrawer({
  leadId,
  isOpen,
  onClose,
  onLeadUpdated,
}: ServiceLeadDetailDrawerProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'timeline' | 'schedule'>('overview');
  const [noteContent, setNoteContent] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('10:00');

  // Fetch full lead details
  const { data: lead, isLoading } = useQuery<ServiceLead | null>({
    queryKey: ['admin-service-lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('enquiries')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) throw error;
      if (!data) return null;

      let property = null;
      if (data.property_id) {
        const { data: propData } = await supabase
          .from('properties')
          .select('id, title, price, locality_name, city_name')
          .eq('id', data.property_id)
          .maybeSingle();
        property = propData;
      }

      let assignee = null;
      if (data.assigned_to) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .eq('id', data.assigned_to)
          .maybeSingle();
        assignee = profData;
      }

      return {
        ...data,
        property,
        assignee,
      } as ServiceLead;
    },
    enabled: !!leadId && isOpen,
  });

  // Fetch staff/admin team members for assignment
  const { data: staffMembers } = useQuery({
    queryKey: ['staff-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .in('role', ['admin', 'staff', 'manager', 'executive', 'agent', 'support'])
        .order('first_name', { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  // Fetch activities timeline
  const { data: activities, refetch: refetchActivities } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_activities')
        .select(`
          id, activity_type, title, description, created_at,
          actor:profiles(id, first_name, last_name, email)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!leadId && isOpen,
  });

  // Fetch notes
  const { data: notes, refetch: refetchNotes } = useQuery({
    queryKey: ['lead-notes', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_notes')
        .select(`
          id, note, created_at, pinned,
          author:profiles(id, first_name, last_name, email)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!leadId && isOpen,
  });

// Helper to sanitize UI status to allowed DB check constraint values
const toDbLeadStatus = (status: string): string => {
  const map: Record<string, string> = {
    new: 'new',
    assigned: 'assigned',
    contacted: 'contacted',
    follow_up: 'contacted',
    in_progress: 'contacted',
    qualified: 'contacted',
    site_visit: 'site_visit',
    negotiation: 'negotiation',
    converted: 'won',
    won: 'won',
    closed: 'closed',
    lost: 'lost',
    spam: 'spam',
    duplicate: 'duplicate',
  };
  return map[status?.toLowerCase()] || 'new';
};

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!leadId) return;
      const dbStatus = toDbLeadStatus(newStatus);
      const updates: Record<string, any> = {
        status: dbStatus,
        lead_status: dbStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'converted' || newStatus === 'won') updates.converted_at = new Date().toISOString();
      if (newStatus === 'closed' || newStatus === 'lost') updates.closed_at = new Date().toISOString();

      const { error } = await supabase.from('enquiries').update(updates).eq('id', leadId);
      if (error) throw error;

      // Log activity
      try {
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'status_changed',
          title: `Status Changed to ${LEAD_STATUS_CONFIG[newStatus]?.label || newStatus}`,
          description: `Lead status was updated to ${newStatus}`,
          actor_id: user?.id ?? null,
        });
      } catch {
        // Soft fail on activity log
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-lead-counts'] });
      refetchActivities();
      onLeadUpdated?.();
      addToast('success', 'Lead status updated');
    },
    onError: (err: any) => {
      addToast('error', `Failed to update status: ${err.message}`);
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async (newPriority: string) => {
      if (!leadId) return;
      const { error } = await supabase
        .from('enquiries')
        .update({ priority: newPriority, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;

      try {
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'status_changed',
          title: `Priority Changed to ${newPriority.toUpperCase()}`,
          actor_id: user?.id ?? null,
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      refetchActivities();
      onLeadUpdated?.();
      addToast('success', 'Priority updated');
    },
    onError: (err: any) => {
      addToast('error', `Failed to update priority: ${err.message}`);
    },
  });

  const updateAssigneeMutation = useMutation({
    mutationFn: async (assigneeId: string) => {
      if (!leadId) return;
      const { error } = await supabase
        .from('enquiries')
        .update({ assigned_to: assigneeId || null, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;

      try {
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'assigned',
          title: assigneeId ? 'Lead Assigned' : 'Lead Unassigned',
          actor_id: user?.id ?? null,
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      refetchActivities();
      onLeadUpdated?.();
      addToast('success', 'Assignment updated');
    },
    onError: (err: any) => {
      addToast('error', `Failed to assign lead: ${err.message}`);
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!leadId || !user?.id || !content.trim()) return;
      const { error } = await supabase.from('lead_notes').insert({
        lead_id: leadId,
        author_id: user.id,
        note: content.trim(),
      });
      if (error) throw error;

      try {
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'note_added',
          title: 'Internal Note Added',
          description: content.trim().substring(0, 100) + (content.length > 100 ? '...' : ''),
          actor_id: user.id,
        });
      } catch {}
    },
    onSuccess: () => {
      setNoteContent('');
      refetchNotes();
      refetchActivities();
      addToast('success', 'Note added');
    },
    onError: (err: any) => {
      addToast('error', `Failed to add note: ${err.message}`);
    },
  });

  const scheduleFollowUpMutation = useMutation({
    mutationFn: async () => {
      if (!leadId || !followUpDate) return;
      const fullIso = new Date(`${followUpDate}T${followUpTime || '10:00'}:00`).toISOString();
      const { error } = await supabase
        .from('enquiries')
        .update({
          follow_up_at: fullIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      if (error) throw error;

      try {
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'follow_up_scheduled',
          title: `Follow-up Scheduled for ${formatDate(fullIso)} ${followUpTime}`,
          actor_id: user?.id ?? null,
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      refetchActivities();
      onLeadUpdated?.();
      addToast('success', 'Follow-up scheduled successfully');
    },
    onError: (err: any) => {
      addToast('error', `Failed to schedule follow-up: ${err.message}`);
    },
  });

  if (!isOpen) return null;

  const displayServiceKey = lead?.service_type || 'GENERAL_ENQUIRY';
  const serviceBadge = SERVICE_TYPE_BADGES[displayServiceKey] || SERVICE_TYPE_BADGES.GENERAL_ENQUIRY;
  const currentStatus = lead?.lead_status || lead?.status || 'new';
  const statusCfg = LEAD_STATUS_CONFIG[currentStatus] || LEAD_STATUS_CONFIG.new;
  const priorityCfg = PRIORITY_CONFIG[lead?.priority || 'medium'] || PRIORITY_CONFIG.medium;
  const displayLeadNumber = lead?.lead_number || `RN-LEAD-${lead?.id?.substring(0, 6).toUpperCase()}`;

  const cleanPhone = (lead?.phone || '').replace(/[^0-9]/g, '');
  const waUrl = buildWhatsAppUrl(
    cleanPhone,
    `Hello ${lead?.name || 'Customer'}, regarding your ${serviceBadge.label} request on RealtyNow (${displayLeadNumber}):`
  );

  const customFields = { ...(lead?.service_data || {}), ...(lead?.custom_fields || {}) };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Slide-out Panel */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200/90 bg-slate-50/80 flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                {displayLeadNumber}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
                  serviceBadge.bg,
                  serviceBadge.color,
                  serviceBadge.border
                )}
              >
                <span>{serviceBadge.icon}</span>
                <span>{serviceBadge.label}</span>
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
                  statusCfg.bg,
                  statusCfg.color,
                  statusCfg.border
                )}
              >
                {statusCfg.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                  priorityCfg.bg,
                  priorityCfg.color
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', priorityCfg.dot)} />
                {priorityCfg.label}
              </span>
            </div>

            <h2 className="font-display text-xl font-black text-slate-900 truncate">
              {lead?.name || 'Anonymous Customer'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Customer Action Strip */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            {lead?.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1.5 font-bold text-slate-800 hover:text-red-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl transition"
              >
                <PhoneCall className="h-3.5 w-3.5 text-blue-600" />
                <span>{lead.phone}</span>
              </a>
            )}
            {lead?.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-red-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl transition truncate max-w-[200px]"
              >
                <Mail className="h-3.5 w-3.5 text-purple-600" />
                <span className="truncate">{lead.email}</span>
              </a>
            )}
          </div>

          {lead?.phone && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-xl shadow-xs transition"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="px-5 border-b border-slate-200 flex gap-6 bg-white shrink-0">
          {[
            { id: 'overview', label: 'Lead Overview', icon: FileText },
            { id: 'timeline', label: `Timeline (${activities?.length || 0})`, icon: Activity },
            { id: 'notes', label: `Notes (${notes?.length || 0})`, icon: Layers },
            { id: 'schedule', label: 'Follow-up & Assign', icon: CalendarClock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer',
                  isActive
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Body Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
          {isLoading ? (
            <div className="space-y-4 py-8">
              <div className="h-20 bg-slate-200 animate-pulse rounded-2xl" />
              <div className="h-32 bg-slate-200 animate-pulse rounded-2xl" />
              <div className="h-28 bg-slate-200 animate-pulse rounded-2xl" />
            </div>
          ) : activeTab === 'overview' ? (
            <>
              {/* Quick Status Control Ribbon */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Lead Lifecycle Stage
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Received {formatDate(lead?.created_at || '')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(LEAD_STATUS_CONFIG).map(([stKey, stVal]) => {
                    const isCurrent = currentStatus === stKey;
                    return (
                      <button
                        key={stKey}
                        onClick={() => updateStatusMutation.mutate(stKey)}
                        disabled={updateStatusMutation.isPending}
                        className={cn(
                          'p-2 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer',
                          isCurrent
                            ? `${stVal.bg} ${stVal.color} ${stVal.border} shadow-2xs font-extrabold ring-2 ring-red-500/20`
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        {stVal.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service Details & Requirements */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-display text-sm font-black text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-red-500" />
                    Service Request Details
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Category: {serviceBadge.label}
                  </span>
                </div>

                {/* Primary Message / Service Request */}
                {(lead?.service_request || lead?.message) && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      Customer Request Note
                    </span>
                    <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {lead.service_request || lead.message}
                    </p>
                  </div>
                )}

                {/* Dynamic Category-Specific Metadata Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  {/* Common Location */}
                  {(lead?.location || lead?.city || customFields.location || customFields.city) && (
                    <div className="p-3 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Location / City</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">
                        {lead?.location || customFields.location || ''}
                        {lead?.city ? `, ${lead.city}` : customFields.city ? `, ${customFields.city}` : ''}
                      </span>
                    </div>
                  )}

                  {/* Loan Amount (Home Loans) */}
                  {customFields.loanAmount && (
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-[10px] font-bold uppercase text-emerald-600 block">Required Loan Amount</span>
                      <span className="font-extrabold text-emerald-800 text-sm mt-0.5 block">
                        ₹ {customFields.loanAmount}
                      </span>
                    </div>
                  )}

                  {/* Employment Type */}
                  {customFields.employmentType && (
                    <div className="p-3 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Employment Type</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{customFields.employmentType}</span>
                    </div>
                  )}

                  {/* Monthly Income */}
                  {customFields.monthlyIncome && (
                    <div className="p-3 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Monthly Income</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">₹ {customFields.monthlyIncome}</span>
                    </div>
                  )}

                  {/* Preferred Tenure */}
                  {customFields.preferredTenure && (
                    <div className="p-3 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Preferred Tenure</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{customFields.preferredTenure}</span>
                    </div>
                  )}

                  {/* Interior / Home Style or Area */}
                  {customFields.propertyType && (
                    <div className="p-3 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Property Type</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{customFields.propertyType}</span>
                    </div>
                  )}

                  {customFields.budget && (
                    <div className="p-3 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Estimated Budget</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{customFields.budget}</span>
                    </div>
                  )}

                  {customFields.preferredDate && (
                    <div className="p-3 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Preferred Service Date</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{customFields.preferredDate}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Related Property (if originated from a property listing) */}
              {lead?.property && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Associated Property
                  </span>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 truncate">{lead.property.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {lead.property.locality_name ? `${lead.property.locality_name}, ` : ''}
                        {lead.property.city_name || ''}
                      </p>
                    </div>
                    {lead.property.price && (
                      <span className="font-extrabold text-sm text-red-600 shrink-0">
                        {formatPrice(lead.property.price)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Assigned Staff & Follow-up Snapshot */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="font-bold text-slate-700">Team Assignment</span>
                  <span className="font-semibold text-slate-500">
                    {lead?.assignee ? `${lead.assignee.first_name || ''} ${lead.assignee.last_name || ''}` : 'Unassigned'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="font-bold text-slate-700">Next Follow-up</span>
                  <span className={cn('font-semibold', lead?.follow_up_at ? 'text-amber-700 font-bold' : 'text-slate-400')}>
                    {lead?.follow_up_at ? formatDateTime(lead.follow_up_at) : 'None scheduled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Lead Source</span>
                  <span className="font-semibold text-slate-600 uppercase text-[11px]">
                    {lead?.source || 'Website'}
                  </span>
                </div>
              </div>
            </>
          ) : activeTab === 'timeline' ? (
            /* Timeline Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-black text-slate-900">Lead Activity Trail</h3>
                <span className="text-xs font-semibold text-slate-400">{activities?.length || 0} events recorded</span>
              </div>

              {activities && activities.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-slate-200 space-y-6 my-2">
                  {activities.map((act: any) => (
                    <div key={act.id} className="relative group">
                      {/* Marker dot */}
                      <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-white border-2 border-red-500 group-hover:scale-125 transition-transform" />

                      <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-xs text-slate-900">{act.title}</p>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {formatDateTime(act.created_at)}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{act.description}</p>
                        )}
                        {act.actor && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 mt-2">
                            <User className="h-2.5 w-2.5" />
                            {act.actor.first_name || act.actor.email}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
                  No activity events recorded yet.
                </div>
              )}
            </div>
          ) : activeTab === 'notes' ? (
            /* Internal Notes Tab */
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
                <span className="font-display text-xs font-black text-slate-900 block">
                  Add Internal Staff Note
                </span>
                <Textarea
                  placeholder="Type note regarding customer preferences, site visit notes, loan pre-qualification..."
                  rows={3}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    loading={addNoteMutation.isPending}
                    disabled={!noteContent.trim()}
                    onClick={() => addNoteMutation.mutate(noteContent)}
                  >
                    Save Note
                  </Button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-3">
                {notes && notes.length > 0 ? (
                  notes.map((n: any) => (
                    <div key={n.id} className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2">
                      <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                        {n.note}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                        <span className="font-semibold">
                          By {n.author ? `${n.author.first_name || ''} ${n.author.last_name || n.author.email || ''}` : 'Staff'}
                        </span>
                        <span>{formatDateTime(n.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
                    No notes recorded yet. Add the first internal note above.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Schedule & Assignment Tab */
            <div className="space-y-5">
              {/* Assign Lead */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
                <h3 className="font-display text-sm font-black text-slate-900 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                  Assign Lead to Team Member
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Select a team member to take ownership of this service lead.
                </p>
                <div className="pt-1">
                  <Select
                    value={lead?.assigned_to || ''}
                    onChange={(e) => updateAssigneeMutation.mutate(e.target.value)}
                    disabled={updateAssigneeMutation.isPending}
                  >
                    <option value="">Unassigned (Open for all staff)</option>
                    {staffMembers?.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name ? `${m.first_name} ${m.last_name || ''}` : m.email} ({m.role})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Priority Selector */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
                <h3 className="font-display text-sm font-black text-slate-900 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-500" />
                  Set Lead Priority
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {Object.entries(PRIORITY_CONFIG).map(([pKey, pVal]) => {
                    const isSelected = (lead?.priority || 'medium') === pKey;
                    return (
                      <button
                        key={pKey}
                        onClick={() => updatePriorityMutation.mutate(pKey)}
                        disabled={updatePriorityMutation.isPending}
                        className={cn(
                          'p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer',
                          isSelected
                            ? `${pVal.bg} ${pVal.color} font-black shadow-xs ring-2 ring-red-500/20`
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        {pVal.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schedule Follow-up */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
                <h3 className="font-display text-sm font-black text-slate-900 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-purple-600" />
                  Schedule Next Follow-Up
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Follow-up Date"
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                  <Input
                    label="Follow-up Time"
                    type="time"
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    loading={scheduleFollowUpMutation.isPending}
                    disabled={!followUpDate}
                    onClick={() => scheduleFollowUpMutation.mutate()}
                  >
                    Schedule & Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

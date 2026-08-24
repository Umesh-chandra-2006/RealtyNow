import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  Building2,
  Calendar,
  Clock,
  Send,
  User,
  Plus,
  ArrowRight,
  ExternalLink,
  MapPin,
  Tag,
  AlertCircle,
  FileText,
  PhoneCall,
  Check,
  CheckCircle2,
  Edit3,
  Flame,
  Activity,
  DollarSign,
  Home,
  Save,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useToast } from '../toast';
import { Button, Input, Textarea, Badge, Modal, Select } from '../ui';
import { formatDate, formatDateTime, formatPrice, generatePropertyUrl, buildWhatsAppUrl } from '../../lib/utils';
import { useRealtimeCount } from '../../lib/realtime';
import { DEFAULT_PROPERTY_IMAGE, handleImageError } from '../../lib/property-images';

export const BUILDER_STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-blue-500 text-white' },
  { id: 'contacted', label: 'Contacted', color: 'bg-amber-500 text-white' },
  { id: 'site_visit', label: 'Site Visit', color: 'bg-purple-500 text-white' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500 text-white' },
  { id: 'won', label: 'Closed Won', color: 'bg-emerald-500 text-white' },
  { id: 'lost', label: 'Lost / Closed', color: 'bg-rose-500 text-white' },
] as const;

export const AGENT_CRM_STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-blue-500 text-white' },
  { id: 'contacted', label: 'Contacted', color: 'bg-amber-500 text-white' },
  { id: 'interested', label: 'Interested', color: 'bg-indigo-500 text-white' },
  { id: 'site_visit', label: 'Site Visit', color: 'bg-purple-500 text-white' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500 text-white' },
  { id: 'won', label: 'Won', color: 'bg-emerald-500 text-white' },
  { id: 'lost', label: 'Lost / Closed', color: 'bg-rose-500 text-white' },
] as const;

interface UnifiedLeadDetailModalProps {
  lead: any | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated?: () => void;
  onStatusChange?: () => void;
  sourceType?: 'builder' | 'agent' | 'admin';
}

export function UnifiedLeadDetailModal({
  lead: initialLead,
  isOpen,
  onClose,
  onLeadUpdated,
  onStatusChange,
  sourceType = 'agent',
}: UnifiedLeadDetailModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'activities' | 'edit'>('overview');
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Follow-up state
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [followUpType, setFollowUpType] = useState('call');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
    budget_min: '',
    budget_max: '',
    priority: 'medium',
    status: 'new',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const isMovingRef = useRef(false);
  const isSavingRef = useRef(false);

  const leadId = initialLead?.id;
  // A lead is only in builder_leads table if explicitly sourced from builder CRM or tagged with builder_leads table
  const isBuilder = sourceType === 'builder' || initialLead?._table === 'builder_leads' || initialLead?.table_name === 'builder_leads';
  const targetTable = isBuilder ? 'builder_leads' : 'enquiries';

  const realtimeActivityTick = useRealtimeCount(
    isBuilder ? 'builder_lead_activities' : 'lead_activities',
    { column: 'lead_id', value: leadId ?? '' }
  );

  // 1. Fetch live lead data
  const { data: leadData } = useQuery({
    queryKey: ['lead-detail-modal', targetTable, leadId],
    queryFn: async () => {
      if (!leadId) return null;
      if (isBuilder) {
        const { data, error } = await supabase
          .from('builder_leads')
          .select('*, builder_projects(id, name)')
          .eq('id', leadId)
          .maybeSingle();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('enquiries')
          .select('*, property:properties(id, title, price, purpose, images, locality_name, city_name, bedrooms, built_up_area, property_types(name))')
          .eq('id', leadId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return {
          ...data,
          property: Array.isArray(data.property) ? data.property[0] : data.property,
        };
      }
    },
    initialData: initialLead,
    enabled: !!leadId && isOpen,
  });

  const lead = leadData || initialLead;

  // Initialize edit form when lead data changes
  useEffect(() => {
    if (lead) {
      setEditForm({
        name: lead.name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        message: lead.message || lead.notes || '',
        budget_min: lead.budget_min ? String(lead.budget_min) : '',
        budget_max: lead.budget_max ? String(lead.budget_max) : '',
        priority: lead.priority || 'medium',
        status: lead.lead_status || lead.status || 'new',
      });
      if (lead.follow_up_at) {
        try {
          const d = new Date(lead.follow_up_at);
          setFollowUpDate(d.toISOString().slice(0, 10));
          setFollowUpTime(d.toTimeString().slice(0, 5));
        } catch {
          // ignore
        }
      }
    }
  }, [lead]);

  // 2. Fetch Activities History
  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities-modal', targetTable, leadId, realtimeActivityTick],
    queryFn: async () => {
      if (!leadId) return [];
      if (isBuilder) {
        const { data, error } = await supabase
          .from('builder_lead_activities')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });
        if (error) return [];
        return data ?? [];
      } else {
        const { data, error } = await supabase
          .from('lead_activities')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });
        if (error) return [];
        return data ?? [];
      }
    },
    enabled: !!leadId && isOpen,
  });

  // Current active status
  const currentStatus = (lead?.lead_status || lead?.status || 'new').toLowerCase();
  const stages = isBuilder ? BUILDER_STAGES : AGENT_CRM_STAGES;

  // Mutation: Stage Stepper Update
  const stageMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const oldStatus = currentStatus;
      if (oldStatus === newStatus) return;

      if (isBuilder) {
        const { error } = await supabase
          .from('builder_leads')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', leadId);
        if (error) throw error;

        // Log builder activity (non-blocking)
        try {
          await supabase.from('builder_lead_activities').insert({
            lead_id: leadId,
            builder_id: user?.id ?? lead?.builder_id,
            activity_type: 'status_change',
            notes: `Stage updated from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()}`,
          });
        } catch {
          // non-blocking
        }
      } else {
        const { error } = await supabase
          .from('enquiries')
          .update({
            lead_status: newStatus,
            status: newStatus === 'won' || newStatus === 'lost' ? 'closed' : newStatus === 'new' ? 'new' : 'contacted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
        if (error) throw error;

        // Log agent / admin activity (non-blocking with profile actor_id fallback)
        try {
          const actPayload: any = {
            lead_id: leadId,
            actor_id: user?.id ?? null,
            activity_type: newStatus === 'won' ? 'won' : newStatus === 'lost' ? 'lost' : 'status_changed',
            title: `Stage changed to ${newStatus.replace('_', ' ').toUpperCase()}`,
            old_value: oldStatus,
            new_value: newStatus,
            is_system: false,
          };
          const { error: actErr } = await supabase.from('lead_activities').insert(actPayload);
          if (actErr && actPayload.actor_id) {
            await supabase.from('lead_activities').insert({ ...actPayload, actor_id: null });
          }
        } catch {
          // non-blocking
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['builder-leads'] });
      queryClient.invalidateQueries({ queryKey: ['builder-crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['role-crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-detail-modal', targetTable, leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities-modal', targetTable, leadId] });
      addToast('success', 'Lead stage updated successfully');
      onLeadUpdated?.();
      onStatusChange?.();
    },
    onError: (err: any) => {
      console.error('Stage update error:', err);
      addToast('error', err?.message || 'Unable to update lead stage. Please try again.');
    },
    onSettled: () => {
      isMovingRef.current = false;
    },
  });

  const handleStageClick = (stageId: string) => {
    if (isMovingRef.current || stageMutation.isPending) return;
    isMovingRef.current = true;
    stageMutation.mutate(stageId);
  };

  // Add Note Mutation
  const handleAddNote = async () => {
    if (!noteText.trim() || !leadId) return;
    setAddingNote(true);
    try {
      if (isBuilder) {
        const { error } = await supabase.from('builder_lead_activities').insert({
          lead_id: leadId,
          builder_id: user?.id ?? lead?.builder_id,
          activity_type: 'note',
          notes: noteText.trim(),
        });
        if (error) throw error;
      } else {
        const notePayload: any = {
          lead_id: leadId,
          actor_id: user?.id ?? null,
          activity_type: 'note_added', // Satisfies lead_activities CHECK constraint
          title: 'Note Added',
          description: noteText.trim(),
        };
        const { error } = await supabase.from('lead_activities').insert(notePayload);
        if (error) {
          if (notePayload.actor_id) {
            // Retry with actor_id: null if foreign key on profile failed
            const { error: retryErr } = await supabase.from('lead_activities').insert({
              ...notePayload,
              actor_id: null,
            });
            if (retryErr) throw retryErr;
          } else {
            throw error;
          }
        }
      }

      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['lead-activities-modal', targetTable, leadId] });
      addToast('success', 'Note added to lead timeline');
    } catch (err) {
      console.error('Add note error:', err);
      addToast('error', err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  // Schedule Follow-Up Mutation
  const handleSaveFollowUp = async () => {
    if (!followUpDate || !leadId) {
      addToast('error', 'Please select a follow-up date');
      return;
    }
    setSavingFollowUp(true);
    try {
      const followUpTimestamp = new Date(`${followUpDate}T${followUpTime}:00`).toISOString();

      if (isBuilder) {
        await supabase.from('builder_lead_activities').insert({
          lead_id: leadId,
          builder_id: user?.id ?? lead?.builder_id,
          activity_type: followUpType === 'visit' ? 'site_visit' : 'call',
          notes: `Follow-up scheduled: ${followUpType.toUpperCase()} on ${formatDateTime(followUpTimestamp)}`,
        });
      } else {
        const { error: updErr } = await supabase
          .from('enquiries')
          .update({
            follow_up_at: followUpTimestamp,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
        if (updErr) throw updErr;

        try {
          const actPayload: any = {
            lead_id: leadId,
            actor_id: user?.id ?? null,
            activity_type: 'follow_up_scheduled',
            title: `Follow-up ${followUpType.toUpperCase()} scheduled`,
            description: `Scheduled for ${formatDateTime(followUpTimestamp)}`,
          };
          const { error: actErr } = await supabase.from('lead_activities').insert(actPayload);
          if (actErr && actPayload.actor_id) {
            await supabase.from('lead_activities').insert({ ...actPayload, actor_id: null });
          }
        } catch {
          // non-blocking
        }
      }

      queryClient.invalidateQueries({ queryKey: ['lead-detail-modal', targetTable, leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities-modal', targetTable, leadId] });
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['role-crm-leads'] });
      addToast('success', 'Follow-up scheduled successfully');
      onLeadUpdated?.();
      onStatusChange?.();
    } catch (err) {
      console.error('Schedule follow-up error:', err);
      addToast('error', err instanceof Error ? err.message : 'Failed to schedule follow-up');
    } finally {
      setSavingFollowUp(false);
    }
  };

  // Save Lead Edits
  const handleSaveEdit = async () => {
    if (!leadId || isSavingRef.current) return;
    if (!editForm.name.trim()) {
      addToast('error', 'Lead name is required');
      return;
    }
    isSavingRef.current = true;
    setSavingEdit(true);
    try {
      if (isBuilder) {
        const payload = {
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          message: editForm.message.trim() || null,
          status: editForm.status,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('builder_leads').update(payload).eq('id', leadId);
        if (error) throw error;
      } else {
        const payload = {
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          message: editForm.message.trim() || null,
          budget_min: editForm.budget_min ? Number(editForm.budget_min) : null,
          budget_max: editForm.budget_max ? Number(editForm.budget_max) : null,
          priority: editForm.priority,
          lead_status: editForm.status,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('enquiries').update(payload).eq('id', leadId);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['builder-leads'] });
      queryClient.invalidateQueries({ queryKey: ['builder-crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-detail-modal', targetTable, leadId] });

      addToast('success', 'Lead information updated successfully');
      setIsEditing(false);
      onLeadUpdated?.();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to update lead');
    } finally {
      isSavingRef.current = false;
      setSavingEdit(false);
    }
  };

  if (!isOpen || !lead) return null;

  const phone = lead.phone || '';
  const email = lead.email || '';
  const leadName = lead.name || 'Anonymous Lead';
  const propertyTitle = lead.property?.title || lead.builder_projects?.name || 'General Inquiry';
  const currentStageIndex = stages.findIndex((s) => s.id === currentStatus);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title=""
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-400">
            Received: {formatDate(lead.created_at)}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-red-500/20 shrink-0">
              {leadName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-navy-900">{leadName}</h3>
                <Badge variant="default" className="capitalize text-xs font-semibold">
                  {currentStatus.replace('_', ' ')}
                </Badge>
                {lead.priority && (
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    lead.priority === 'urgent' || lead.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {lead.priority} Priority
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span>{propertyTitle}</span>
              </p>
            </div>
          </div>

          {/* Quick Communication Actions */}
          <div className="flex items-center gap-2">
            {phone && (
              <>
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-xs shadow-2xs transition-all"
                  title="Call Lead"
                >
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
                <a
                  href={buildWhatsAppUrl(phone, `Hello ${leadName}, I am reaching out regarding your inquiry on RealtyNow.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-2xs transition-all"
                  title="WhatsApp Lead"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </>
            )}
            {email && (
              <a
                href={`mailto:${email}?subject=Regarding your property inquiry on RealtyNow`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold text-xs shadow-2xs transition-all"
                title="Email Lead"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            )}
          </div>
        </div>

        {/* Lead Stage Stepper Pipeline */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-red-600" /> Lead Pipeline Stepper
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Click any stage to move lead</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {stages.map((stage, idx) => {
              const isCurrent = stage.id === currentStatus;
              const isPast = currentStageIndex > -1 && idx < currentStageIndex && stage.id !== 'lost';
              const isLost = stage.id === 'lost';

              return (
                <button
                  type="button"
                  key={stage.id}
                  onClick={() => handleStageClick(stage.id)}
                  disabled={stageMutation.isPending}
                  className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-navy-900 border-navy-900 text-white shadow-md scale-[1.03] ring-2 ring-red-500/50'
                      : isPast
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : isLost && isCurrent
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {isCurrent ? (
                      <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
                    ) : isPast ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 font-black" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">{idx + 1}</span>
                    )}
                  </div>
                  <span className="text-xs font-bold leading-tight truncate w-full">{stage.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => { setActiveTab('overview'); setIsEditing(false); }}
            className={`px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview' && !isEditing
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Overview & Details
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('notes'); setIsEditing(false); }}
            className={`px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'notes'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Notes & Follow-Up
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('activities'); setIsEditing(false); }}
            className={`px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'activities'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Activity Timeline ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('edit'); setIsEditing(true); }}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isEditing
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>{isEditing ? 'Editing Mode' : 'Edit Lead'}</span>
          </button>
        </div>

        {/* Tab 1: Overview & Details */}
        {activeTab === 'overview' && !isEditing && (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Contact Details Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact Information</h4>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Full Name</span>
                  <span className="font-bold text-navy-900">{leadName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Phone</span>
                  <span className="font-bold text-navy-900">{phone || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Email</span>
                  <span className="font-bold text-navy-900 truncate max-w-[200px]">{email || '—'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Source</span>
                  <span className="font-bold text-navy-900 capitalize">{lead.source || 'Website Inquiry'}</span>
                </div>
              </div>
            </div>

            {/* Requirement / Property Details */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Requirement & Property</h4>
              {lead.property ? (
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  {lead.property.images?.[0] && (
                    <img
                      src={lead.property.images[0]}
                      alt=""
                      onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                      className="h-12 w-16 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <Link
                      to={generatePropertyUrl(lead.property)}
                      target="_blank"
                      className="text-xs font-bold text-navy-900 hover:text-red-600 truncate block"
                    >
                      {lead.property.title} <ExternalLink className="inline h-3 w-3" />
                    </Link>
                    <p className="text-xs font-semibold text-red-600 mt-0.5">
                      {formatPrice(lead.property.price, lead.property.purpose)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {lead.property.locality_name}, {lead.property.city_name}
                    </p>
                  </div>
                </div>
              ) : lead.builder_projects ? (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="font-bold text-navy-900 block">{lead.builder_projects.name}</span>
                  <span className="text-slate-500">Project Inquiry</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">General Inquiry / No specific property linked</p>
              )}

              {(lead.budget_min || lead.budget_max) && (
                <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                  <span className="text-slate-500">Budget Range</span>
                  <span className="font-bold text-navy-900">
                    {lead.budget_min ? formatPrice(lead.budget_min) : '—'} to {lead.budget_max ? formatPrice(lead.budget_max) : '—'}
                  </span>
                </div>
              )}
            </div>

            {/* Inquiry Message / Notes */}
            {(lead.message || lead.notes) && (
              <div className="sm:col-span-2 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Inquiry Message / Notes</h4>
                <p className="text-xs sm:text-sm text-navy-900 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {lead.message || lead.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Notes & Follow-Up */}
        {activeTab === 'notes' && !isEditing && (
          <div className="space-y-4">
            {/* Follow-Up Scheduler */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-red-600" /> Next Follow-Up Schedule
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Follow-Up Date"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
                <Input
                  label="Follow-Up Time"
                  type="time"
                  value={followUpTime}
                  onChange={(e) => setFollowUpTime(e.target.value)}
                />
                <Select
                  label="Type"
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value)}
                >
                  <option value="call">Phone Call</option>
                  <option value="visit">Site Visit</option>
                  <option value="meeting">In-Person Meeting</option>
                  <option value="email">Email</option>
                </Select>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSaveFollowUp} loading={savingFollowUp}>
                  Save Follow-Up
                </Button>
              </div>
            </div>

            {/* Quick Add Note */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-red-600" /> Add Activity Note
              </h4>
              <Textarea
                placeholder="Type your notes about client discussion, requirements, budget updates..."
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddNote} loading={addingNote} disabled={!noteText.trim()}>
                  Add Note to Timeline
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Activities Timeline */}
        {activeTab === 'activities' && !isEditing && (
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                No activity history recorded yet. Use the notes tab to log calls and site visits.
              </div>
            ) : (
              activities.map((act: any) => (
                <div key={act.id} className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-navy-900">{act.title || act.activity_type?.toUpperCase() || 'Activity'}</span>
                      <span className="text-[11px] text-slate-400">{formatDateTime(act.created_at || act.activity_date)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                      {act.description || act.notes || '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Edit Lead Mode */}
        {isEditing && (
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">Edit Lead Information</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Full Name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Phone Number"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="Email Address"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Select
                label="Priority"
                value={editForm.priority}
                onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
              {!isBuilder && (
                <>
                  <Input
                    label="Budget Min (₹)"
                    type="number"
                    value={editForm.budget_min}
                    onChange={(e) => setEditForm((f) => ({ ...f, budget_min: e.target.value }))}
                  />
                  <Input
                    label="Budget Max (₹)"
                    type="number"
                    value={editForm.budget_max}
                    onChange={(e) => setEditForm((f) => ({ ...f, budget_max: e.target.value }))}
                  />
                </>
              )}
              <div className="sm:col-span-2">
                <Textarea
                  label="Inquiry Message / Requirement Notes"
                  rows={3}
                  value={editForm.message}
                  onChange={(e) => setEditForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} loading={savingEdit} icon={<Save className="h-4 w-4" />}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

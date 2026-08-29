import { useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useToast } from '../toast';
import { Button, Input, Textarea, Badge } from '../ui';
import { formatDate, formatPrice, generatePropertyUrl, buildWhatsAppUrl, isUuid } from '../../lib/utils';
import { useRealtimeCount } from '../../lib/realtime';
import { DEFAULT_PROPERTY_IMAGE, handleImageError } from '../../lib/property-images';

export const CRM_LEAD_STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'contacted', label: 'Contacted', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'interested', label: 'Interested', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'follow_up', label: 'Follow Up', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'site_visit', label: 'Site Visit', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'won', label: 'Won / Converted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'lost', label: 'Lost / Closed', color: 'bg-rose-50 text-rose-700 border-rose-200' },
] as const;

interface LeadActivity {
  id: string;
  lead_id: string;
  actor_id?: string | null;
  activity_type: string;
  title: string;
  description?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

interface AgentLeadDetailDrawerProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated?: () => void;
}

export function AgentLeadDetailDrawer({
  lead: initialLead,
  isOpen,
  onClose,
  onLeadUpdated,
}: AgentLeadDetailDrawerProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [noteText, setNoteText] = useState('');
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [followUpType, setFollowUpType] = useState('call');
  const [followUpNote, setFollowUpNote] = useState('');

  const rawLeadId = String(initialLead?.id || '');
  const isAppointment = rawLeadId.startsWith('apt-') || initialLead?._table === 'appointments' || initialLead?.type === 'appointment';
  const cleanId = isAppointment ? rawLeadId.replace(/^apt-/, '') : rawLeadId;
  const isValidUuid = isUuid(cleanId);

  const realtimeTick = useRealtimeCount('lead_activities', { column: 'lead_id', value: isValidUuid ? cleanId : '' });

  // Query live lead data to stay synchronized safely
  const { data: leadData } = useQuery({
    queryKey: ['agent-lead-detail', cleanId],
    queryFn: async () => {
      if (!isValidUuid) return initialLead;
      if (isAppointment) {
        const { data, error } = await supabase
          .from('appointments')
          .select('*, property:properties(id, title, price, purpose, images, locality_name, city_name, bedrooms, built_up_area, property_types(name))')
          .eq('id', cleanId)
          .maybeSingle();
        if (error || !data) return initialLead;
        return {
          ...data,
          name: data.notes ? `Site Visit: ${data.notes.slice(0, 30)}` : 'Site Visit Request',
          property: Array.isArray(data.property) ? data.property[0] : data.property,
          lead_status:
            data.status === 'confirmed' ? 'site_visit' :
            data.status === 'completed' ? 'won' :
            data.status === 'cancelled' ? 'lost' : 'new',
        };
      } else {
        const { data, error } = await supabase
          .from('enquiries')
          .select('*, property:properties(id, title, price, purpose, images, locality_name, city_name, bedrooms, built_up_area, property_types(name))')
          .eq('id', cleanId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return initialLead;
        return {
          ...data,
          property: Array.isArray(data.property) ? data.property[0] : data.property,
        };
      }
    },
    initialData: initialLead,
    enabled: !!cleanId && isOpen,
  });

  const lead = leadData || initialLead;

  // Query chronological activities
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['agent-lead-activities', cleanId, realtimeTick],
    queryFn: async () => {
      if (!isValidUuid) return [];
      try {
        const { data, error } = await supabase
          .from('lead_activities')
          .select('*')
          .eq('lead_id', cleanId)
          .order('created_at', { ascending: false });
        if (error) {
          console.warn('Failed to fetch lead activities:', error);
          return [];
        }
        return (data ?? []) as LeadActivity[];
      } catch {
        return [];
      }
    },
    enabled: !!cleanId && isOpen && isValidUuid,
  });

  // Mutation: Update Lead Status
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const oldStatus = lead.lead_status || lead.status;
      if (!isValidUuid) return;

      if (isAppointment) {
        const aptStatus =
          newStatus === 'won' ? 'completed' :
          newStatus === 'site_visit' ? 'confirmed' :
          newStatus === 'lost' ? 'cancelled' : 'requested';
        const { error } = await supabase
          .from('appointments')
          .update({ status: aptStatus, updated_at: new Date().toISOString() })
          .eq('id', cleanId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('enquiries')
          .update({
            lead_status: newStatus,
            status: newStatus === 'won' || newStatus === 'lost' ? 'closed' : newStatus === 'new' ? 'new' : 'contacted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', cleanId);

        if (error) throw error;

        // Log activity
        try {
          await supabase.from('lead_activities').insert({
            lead_id: cleanId,
            actor_id: user?.id ?? null,
            activity_type: newStatus === 'won' ? 'won' : newStatus === 'lost' ? 'lost' : 'status_changed',
            title: `Status changed to ${newStatus.replace('_', ' ').toUpperCase()}`,
            old_value: oldStatus,
            new_value: newStatus,
            is_system: false,
            created_at: new Date().toISOString(),
          });
        } catch {
          // non-blocking
        }
      }
    },
    onSuccess: () => {
      addToast('success', 'Lead status updated');
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
      queryClient.invalidateQueries({ queryKey: ['agent-lead-detail', cleanId] });
      queryClient.invalidateQueries({ queryKey: ['agent-lead-activities', cleanId] });
      onLeadUpdated?.();
    },
    onError: (err: any) => {
      addToast('error', err?.message || 'Failed to update status');
    },
  });

  // Mutation: Add Note
  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      if (!note.trim() || !isValidUuid) return;
      if (isAppointment) {
        const currentNotes = lead.notes || lead.message || '';
        const updatedNotes = currentNotes ? `${currentNotes}\n[${new Date().toLocaleDateString()}] ${note.trim()}` : note.trim();
        await supabase.from('appointments').update({ notes: updatedNotes, updated_at: new Date().toISOString() }).eq('id', cleanId);
      } else {
        const { error } = await supabase.from('lead_activities').insert({
          lead_id: cleanId,
          actor_id: user?.id ?? null,
          activity_type: 'note_added',
          title: 'Note Added',
          description: note.trim(),
          is_system: false,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setNoteText('');
      addToast('success', 'Note saved');
      queryClient.invalidateQueries({ queryKey: ['agent-lead-activities', cleanId] });
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
    },
    onError: (err: any) => {
      addToast('error', err?.message || 'Failed to save note');
    },
  });

  // Mutation: Schedule Follow-Up
  const scheduleFollowUpMutation = useMutation({
    mutationFn: async () => {
      if (!followUpDate) throw new Error('Please select a date');
      if (!isValidUuid) return;
      const scheduledDateTime = new Date(`${followUpDate}T${followUpTime || '10:00'}:00`).toISOString();

      if (isAppointment) {
        await supabase
          .from('appointments')
          .update({ scheduled_at: scheduledDateTime, updated_at: new Date().toISOString() })
          .eq('id', cleanId);
      } else {
        // 1. Update enquiry follow_up_at
        await supabase
          .from('enquiries')
          .update({
            follow_up_at: scheduledDateTime,
            lead_status: lead.lead_status === 'new' ? 'follow_up' : lead.lead_status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cleanId);

        // 2. Insert into follow_up_scheduler if table exists
        try {
          await supabase.from('follow_up_scheduler').insert({
            lead_id: cleanId,
            scheduled_by: user?.id,
            assigned_to: user?.id,
            scheduled_at: scheduledDateTime,
            type: followUpType,
            title: `Follow up via ${followUpType}`,
            notes: followUpNote.trim() || null,
          });
        } catch {
          // Non-blocking
        }

        // 3. Insert activity
        try {
          await supabase.from('lead_activities').insert({
            lead_id: cleanId,
            actor_id: user?.id ?? null,
            activity_type: 'follow_up_scheduled',
            title: `Follow-up Scheduled (${followUpType.toUpperCase()})`,
            description: `${formatDate(scheduledDateTime)}${followUpNote ? ` — "${followUpNote.trim()}"` : ''}`,
            is_system: false,
            created_at: new Date().toISOString(),
          });
        } catch {
          // non-blocking
        }
      }
    },
    onSuccess: () => {
      addToast('success', 'Follow-up scheduled');
      setShowFollowUpForm(false);
      setFollowUpNote('');
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
      queryClient.invalidateQueries({ queryKey: ['agent-lead-detail', cleanId] });
      queryClient.invalidateQueries({ queryKey: ['agent-lead-activities', cleanId] });
      onLeadUpdated?.();
    },
    onError: (err: any) => {
      addToast('error', err?.message || 'Failed to schedule follow-up');
    },
  });

  // Action: Log Call
  const handleCallCustomer = async () => {
    if (!lead?.phone) return;
    window.location.href = `tel:${lead.phone}`;
    if (!isValidUuid) return;
    try {
      await supabase.from('lead_activities').insert({
        lead_id: cleanId,
        actor_id: user?.id ?? null,
        activity_type: 'call_made',
        title: 'Call Initiated',
        description: `Agent dialed ${lead.phone}`,
        is_system: false,
        created_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['agent-lead-activities', cleanId] });
    } catch {
      // Non-blocking
    }
  };

  // Action: Log WhatsApp
  const handleWhatsAppCustomer = async () => {
    if (!lead?.phone) return;
    const propertyTitle = lead.property?.title || 'Property on RealtyNow';
    const waUrl = buildWhatsAppUrl(
      lead.phone,
      `Hello ${lead.name || 'there'}, regarding your enquiry on "${propertyTitle}" listed on RealtyNow:`
    );
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    if (!isValidUuid) return;
    try {
      await supabase.from('lead_activities').insert({
        lead_id: cleanId,
        actor_id: user?.id ?? null,
        activity_type: 'whatsapp_sent',
        title: 'WhatsApp Initiated',
        description: `Agent contacted customer via WhatsApp (${lead.phone})`,
        is_system: false,
        created_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['agent-lead-activities', cleanId] });
    } catch {
      // Non-blocking
    }
  };

  if (!isOpen || !lead) return null;

  const currentStatus = lead.lead_status || lead.status || 'new';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between">
          
          {/* Top Bar Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-navy-900 truncate">
                  {lead.name || 'Property Enquiry'}
                </h2>
                <Badge variant={currentStatus === 'won' ? 'success' : currentStatus === 'lost' ? 'error' : 'default'} className="uppercase text-[10px] font-bold">
                  {currentStatus.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Submitted {formatDate(lead.created_at)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-navy-900 hover:bg-slate-200/60 transition-colors"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Quick Action Contact Bar */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCallCustomer}
                disabled={!lead.phone}
                icon={<Phone className="w-3.5 h-3.5" />}
                className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Call
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleWhatsAppCustomer}
                disabled={!lead.phone}
                icon={<MessageCircle className="w-3.5 h-3.5 text-emerald-600" />}
                className="w-full justify-center border-emerald-200 hover:bg-emerald-50"
              >
                WhatsApp
              </Button>
              <a
                href={lead.email ? `mailto:${lead.email}?subject=Regarding your enquiry on ${encodeURIComponent(lead.property?.title || 'RealtyNow')}` : '#'}
                className={!lead.email ? 'pointer-events-none opacity-50' : ''}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!lead.email}
                  icon={<Mail className="w-3.5 h-3.5 text-blue-600" />}
                  className="w-full justify-center"
                >
                  Email
                </Button>
              </a>
            </div>

            {/* Customer Details Card */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Customer Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Full Name</span>
                  <span className="font-semibold text-navy-900">{lead.name || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Phone Number</span>
                  <span className="font-semibold text-navy-900">{lead.phone || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Email Address</span>
                  <span className="font-semibold text-navy-900 truncate block">{lead.email || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Lead Source</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/60">
                    <Tag className="w-3 h-3" />
                    {lead.source ? lead.source.replace(/_/g, ' ') : 'Property Contact Agent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Property Card */}
            {lead.property && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Interested Property
                  </h3>
                  <Link
                    to={generatePropertyUrl(lead.property)}
                    target="_blank"
                    className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 hover:underline"
                  >
                    View Listing <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex items-start gap-3">
                  <img
                    src={lead.property.images?.[0] || DEFAULT_PROPERTY_IMAGE}
                    alt={lead.property.title}
                    onError={(e) => handleImageError(e)}
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-navy-900 text-sm leading-snug truncate">
                      {lead.property.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" /> {lead.property.locality_name || lead.property.city_name || 'Location details'}
                    </p>
                    <p className="font-bold text-navy-900 text-sm mt-2">
                      {formatPrice(lead.property.price, lead.property.purpose)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Message */}
            {lead.message && (
              <div className="bg-amber-50/50 rounded-2xl border border-amber-200/80 p-4 space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Customer Message
                </h3>
                <p className="text-xs text-slate-700 italic">
                  "{lead.message}"
                </p>
              </div>
            )}

            {/* Pipeline Stage Progression */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" /> Pipeline Status
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CRM_LEAD_STAGES.map((stage) => {
                  const isActive = currentStatus === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => statusMutation.mutate(stage.id)}
                      disabled={statusMutation.isPending}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isActive
                          ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{stage.label}</span>
                      {isActive && <span className="text-[10px] opacity-80">● Current</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Follow-up Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Follow-Up Scheduler
                  </h3>
                  {lead.follow_up_at && (
                    <p className="text-xs font-semibold text-orange-600 mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Next follow-up: {formatDate(lead.follow_up_at)}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowFollowUpForm(!showFollowUpForm)}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  {showFollowUpForm ? 'Cancel' : 'Schedule'}
                </Button>
              </div>

              {showFollowUpForm && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Date</label>
                      <Input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Time</label>
                      <Input
                        type="time"
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Type</label>
                      <select
                        value={followUpType}
                        onChange={(e) => setFollowUpType(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium text-slate-800"
                      >
                        <option value="call">Phone Call</option>
                        <option value="site_visit">Site Visit</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="meeting">In-Person Meeting</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Input
                      placeholder="Follow-up notes (e.g. Call regarding price negotiation)..."
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => scheduleFollowUpMutation.mutate()}
                    disabled={scheduleFollowUpMutation.isPending || !followUpDate}
                  >
                    {scheduleFollowUpMutation.isPending ? 'Scheduling...' : 'Save Follow-Up'}
                  </Button>
                </div>
              )}
            </div>

            {/* Add Note Card */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Add Note / Update
              </h3>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a private note about customer requirements, budget, or discussion..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  className="text-xs flex-1"
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => addNoteMutation.mutate(noteText)}
                  disabled={addNoteMutation.isPending || !noteText.trim()}
                  className="self-end"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Activity Timeline & Audit History
              </h3>

              {activitiesLoading ? (
                <p className="text-xs text-slate-400">Loading timeline...</p>
              ) : activities.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                  <AlertCircle className="w-4 h-4 mx-auto mb-1 text-slate-300" />
                  No additional activities logged yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 text-xs"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 grid place-items-center shrink-0 shadow-2xs">
                        {act.activity_type.includes('call') ? (
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                        ) : act.activity_type.includes('whatsapp') ? (
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        ) : act.activity_type.includes('follow_up') ? (
                          <Calendar className="w-3.5 h-3.5 text-orange-600" />
                        ) : act.activity_type.includes('won') ? (
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-navy-900">{act.title}</p>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {formatDate(act.created_at)}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-slate-600 mt-1">{act.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Lead ID: {lead.id}</span>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}

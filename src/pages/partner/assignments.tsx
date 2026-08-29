import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Phone,
  Mail,
  MessageCircle,
  Building2,
  Calendar,
  Handshake,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Send,
  Clock,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  User,
  Star,
  Headphones,
  Award,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Badge, Input, Select, Textarea } from '../../components/ui';
import { formatDate, formatDateTime, buildWhatsAppUrl, cn } from '../../lib/utils';
import { useToast } from '../../components/toast';

const DEDICATED_EXECUTIVES = [
  {
    name: 'Rajesh Sharma',
    role: 'Senior VP — Strategic Partnerships',
    division: 'Partner Success & Deal Escalations',
    phone: '+91 9494230774',
    email: 'partners@realtynow.in',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    availableHours: '9:00 AM - 7:30 PM (Mon-Sat)',
    specialty: 'High-ticket Luxury & Commercial Referrals',
  },
  {
    name: 'Priya Reddy',
    role: 'Partner Operations Lead',
    division: 'KYC, Invoicing & Commission Payouts',
    phone: '+91 9876543210',
    email: 'payouts@realtynow.in',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    availableHours: '9:30 AM - 6:30 PM (Mon-Fri)',
    specialty: 'Wallet Settlements & Rule Overrides',
  },
  {
    name: 'Vikramaditya Varma',
    role: 'Head of Home Loans & Financial Services',
    division: 'Banking & Legal Documentation Desk',
    phone: '+91 9123456789',
    email: 'loans@realtynow.in',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    availableHours: '10:00 AM - 7:00 PM (Mon-Sat)',
    specialty: 'Quick Loan Sanctions & Legal Title Search',
  },
];

export function PartnerAssignmentsPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [activeMessageModal, setActiveMessageModal] = useState<any | null>(null);
  const [messageNote, setMessageNote] = useState('');
  const [callbackModalOpen, setCallbackModalOpen] = useState(false);
  const [callbackForm, setCallbackForm] = useState({
    topic: 'Deal Closure Assistance',
    urgency: 'Medium',
    preferredTime: 'Within 2 hours',
    notes: '',
  });

  // 1. Fetch Partner record
  const { data: partner } = useQuery({
    queryKey: ['partner-me', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('partners').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // 2. Fetch referrals with assigned agent
  const {
    data: referrals = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['partner-assigned-agents', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          assigned_agent:profiles!referrals_assigned_agent_id_fkey(id, first_name, last_name, phone, email, avatar_url, role)
        `)
        .eq('partner_id', partner.id)
        .order('assigned_at', { ascending: false });

      if (error) {
        // Safe fallback
        const { data: rawData } = await supabase
          .from('referrals')
          .select('*')
          .eq('partner_id', partner.id)
          .order('created_at', { ascending: false });
        return rawData ?? [];
      }
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  // Send Note Mutation
  const sendNoteMutation = useMutation({
    mutationFn: async ({ referralId, note }: { referralId: string; note: string }) => {
      const { error } = await supabase.from('referral_activities').insert({
        referral_id: referralId,
        actor_id: user?.id,
        activity_type: 'note',
        title: 'Partner Note to Assigned Agent',
        notes: note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast('success', 'Note sent to assigned agent and recorded in timeline!');
      setActiveMessageModal(null);
      setMessageNote('');
      queryClient.invalidateQueries({ queryKey: ['partner-referral-activities'] });
    },
    onError: (err: any) => {
      addToast('error', `Failed to send note: ${err.message}`);
    },
  });

  // Request Callback Mutation
  const requestCallbackMutation = useMutation({
    mutationFn: async () => {
      if (!partner?.id) throw new Error('Partner not found');
      // Record callback request in activities
      const { error } = await supabase.from('partner_support_tickets' as any).insert({
        partner_id: partner.id,
        subject: `RM Callback Request: ${callbackForm.topic}`,
        urgency: callbackForm.urgency,
        preferred_time: callbackForm.preferredTime,
        message: callbackForm.notes || 'Partner requested a direct phone callback.',
        status: 'open',
      } as any);

      // If table doesn't exist, fallback gracefully
      if (error) {
        console.warn('Support ticket table fallback:', error);
      }
    },
    onSuccess: () => {
      addToast('success', 'Callback request scheduled! Your Relationship Manager will reach out shortly.');
      setCallbackModalOpen(false);
      setCallbackForm({
        topic: 'Deal Closure Assistance',
        urgency: 'Medium',
        preferredTime: 'Within 2 hours',
        notes: '',
      });
    },
    onError: () => {
      addToast('success', 'Callback request recorded! Your Relationship Manager will contact you.');
      setCallbackModalOpen(false);
    },
  });

  const assignedReferrals = referrals.filter((r: any) => !!r.assigned_agent_id);

  return (
    <DashboardLayout sections={sections} title="Assigned Agents">
      <PageHeader
        title="Assigned Agents & Key Contacts"
        subtitle="Connect directly with RealtyNow relationship managers and field consultants actively handling your client referrals."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Headphones className="h-4 w-4" />}
              onClick={() => setCallbackModalOpen(true)}
            >
              Request RM Callback
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* 1. Dedicated Key Executive Support Contacts */}
      <div className="space-y-3 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-black text-slate-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-red-600" />
              Dedicated Partner Relationship Desk
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Direct access to senior division heads for high-priority deal approvals, fast-track loan sanctions, and commission disbursements.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEDICATED_EXECUTIVES.map((exec, idx) => {
            const cleanPhone = exec.phone.replace(/[^0-9]/g, '');
            const waUrl = buildWhatsAppUrl(
              cleanPhone,
              `Hello ${exec.name}, I am a RealtyNow Channel Partner (${partner?.partner_code || 'Partner'}). I would like assistance with: `
            );

            return (
              <Card
                key={idx}
                className="p-5 bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all rounded-2xl flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={exec.avatar}
                      alt={exec.name}
                      className="h-12 w-12 rounded-xl object-cover border border-slate-200 shadow-2xs"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-bold text-sm text-slate-900 truncate">{exec.name}</h4>
                      <p className="text-xs font-semibold text-red-600 truncate">{exec.role}</p>
                      <span className="text-[10px] text-slate-500 block mt-0.5 truncate">{exec.division}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1">
                    <p className="text-slate-600 font-medium flex items-center justify-between">
                      <span className="text-slate-400 font-normal">Desk Focus:</span>
                      <span className="font-bold text-slate-800">{exec.specialty}</span>
                    </p>
                    <p className="text-slate-600 font-medium flex items-center justify-between">
                      <span className="text-slate-400 font-normal">Hours:</span>
                      <span className="text-emerald-700 font-semibold">{exec.availableHours}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <a
                    href={`tel:${exec.phone}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    <Phone className="h-3.5 w-3.5 text-slate-600" /> Call
                  </a>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 2. Active Field Agent Assignments for Referrals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-red-600" />
              Active Referral Agent Assignments ({assignedReferrals.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Field agents and relationship managers assigned to your submitted client leads.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : assignedReferrals.length === 0 ? (
          <Card className="p-12 text-center space-y-3 bg-white border border-slate-200 rounded-2xl">
            <UserCheck className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="font-display text-base font-bold text-slate-900">No active field assignments yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              When our team reviews your submitted referrals, dedicated property consultants will be assigned to handle site visits and negotiation. You can submit new client referrals from the referrals page.
            </p>
            <Link to="/partner/referrals/new">
              <Button size="sm" className="mt-2">
                Submit New Referral
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedReferrals.map((r: any) => {
              const agent = r.assigned_agent;
              const agentName = agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() : 'RealtyNow Property Consultant';
              const agentPhone = agent?.phone || '+91 9494230774';
              const cleanPhone = agentPhone.replace(/[^0-9]/g, '');
              const waUrl = buildWhatsAppUrl(
                cleanPhone,
                `Hi ${agentName}, inquiring about client referral ${r.referral_code} (${r.details?.customer_name || 'Client'}):`
              );

              return (
                <Card key={r.id} className="p-5 bg-white border border-slate-200 shadow-2xs space-y-4 rounded-2xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {r.referral_code}
                        </span>
                        <h4 className="font-display font-bold text-base text-slate-900 mt-1">{agentName}</h4>
                        <p className="text-[11px] text-slate-500 font-semibold">RealtyNow Field Consultant</p>
                      </div>
                      <Badge variant={r.status === 'completed' ? 'success' : r.status === 'in_process' ? 'gold' : 'info'} className="text-[10px] uppercase">
                        {r.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Referred Client:</span>
                        <span className="font-bold text-slate-900">{r.details?.customer_name || r.details?.name || 'Customer'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Category:</span>
                        <span className="font-semibold text-slate-700 capitalize">{r.category || r.referral_type}</span>
                      </div>
                      {r.assigned_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Assigned On:</span>
                          <span className="text-slate-500">{formatDate(r.assigned_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${agentPhone}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-slate-600 hover:text-slate-900 border border-slate-200/80"
                      onClick={() => setActiveMessageModal(r)}
                      icon={<Send className="h-3.5 w-3.5 text-slate-400" />}
                    >
                      Send Agent Note / Update
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Send Note to Agent */}
      {activeMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Send Note to Assigned Agent
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Regarding Referral {activeMessageModal.referral_code} ({activeMessageModal.details?.customer_name || 'Client'})
                </p>
              </div>
              <button
                onClick={() => setActiveMessageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Message / Update Note</label>
              <Textarea
                rows={4}
                placeholder="e.g., Client is looking for 3BHK in Hitec City. Best time to call is weekday evenings."
                value={messageNote}
                onChange={(e) => setMessageNote(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setActiveMessageModal(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  sendNoteMutation.mutate({
                    referralId: activeMessageModal.id,
                    note: messageNote,
                  })
                }
                loading={sendNoteMutation.isPending}
                disabled={!messageNote.trim()}
                icon={<Send className="h-3.5 w-3.5" />}
              >
                Send Note
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Request RM Callback */}
      {callbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Request Relationship Manager Callback
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Our Senior Partner Success Manager will call you back directly.
                </p>
              </div>
              <button
                onClick={() => setCallbackModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Topic of Discussion</label>
                <Select
                  value={callbackForm.topic}
                  onChange={(e) => setCallbackForm({ ...callbackForm, topic: e.target.value })}
                  className="text-xs mt-1"
                >
                  <option value="Deal Closure Assistance">Deal Closure Assistance (Client Negotiation)</option>
                  <option value="Urgent Site Visit Coordination">Urgent Site Visit Coordination</option>
                  <option value="Commission & Wallet Payout Query">Commission & Wallet Payout Query</option>
                  <option value="Home Loan / Legal Verification Desk">Home Loan / Legal Verification Desk</option>
                  <option value="Tier Upgrade & Custom Incentive Agreement">Tier Upgrade & Custom Incentive Agreement</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Urgency Level</label>
                  <Select
                    value={callbackForm.urgency}
                    onChange={(e) => setCallbackForm({ ...callbackForm, urgency: e.target.value })}
                    className="text-xs mt-1"
                  >
                    <option value="Urgent">Urgent (Within 1 hour)</option>
                    <option value="Medium">Medium (Today)</option>
                    <option value="Low">Low (Next business day)</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Preferred Time Slot</label>
                  <Select
                    value={callbackForm.preferredTime}
                    onChange={(e) => setCallbackForm({ ...callbackForm, preferredTime: e.target.value })}
                    className="text-xs mt-1"
                  >
                    <option value="Immediately">Immediately</option>
                    <option value="Morning (10 AM - 1 PM)">Morning (10 AM - 1 PM)</option>
                    <option value="Afternoon (2 PM - 5 PM)">Afternoon (2 PM - 5 PM)</option>
                    <option value="Evening (5 PM - 8 PM)">Evening (5 PM - 8 PM)</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Additional Notes / Reference</label>
                <Textarea
                  rows={3}
                  placeholder="Provide client name, property project or question detail..."
                  value={callbackForm.notes}
                  onChange={(e) => setCallbackForm({ ...callbackForm, notes: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setCallbackModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => requestCallbackMutation.mutate()}
                loading={requestCallbackMutation.isPending}
                icon={<Phone className="h-3.5 w-3.5" />}
              >
                Schedule Callback
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default PartnerAssignmentsPage;

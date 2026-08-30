import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Star,
  Phone,
  MessageCircle,
  User,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { Card, Skeleton, Badge, Button, EmptyState, Modal, Textarea } from '../../components/ui';
import { useRealtimeCount } from '../../lib/realtime';
import { buildWhatsAppUrl } from '../../lib/utils';
import { AgentLeadDetailDrawer } from '../../components/agent/AgentLeadDetailDrawer';

const APPT_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'] as const;

export function AgentAppointments() {
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');
  const visitsOnly = searchParams.get('tab') === 'site_visits';
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [visitModal, setVisitModal] = useState<null | {
    appointmentId: string;
    customerId: string;
    propertyId: string;
    propertyTitle: string;
  }>(null);
  const [visitForm, setVisitForm] = useState({ feedback: '', rating: 5 });
  const realtimeTick = useRealtimeCount('appointments', { column: 'agent_id', value: user?.id ?? '' });

  const { data, isLoading } = useQuery({
    queryKey: ['agent-appointments', user?.id, statusFilter, visitsOnly, realtimeTick],
    queryFn: async () => {
      let q = supabase
        .from('appointments')
        .select(
          '*, property:properties(id, title, price, purpose, images, locality_name, city_name), customer:profiles!appointments_customer_id_profiles_fkey(first_name, last_name, email, phone)',
        )
        .eq('agent_id', user!.id)
        .order('scheduled_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      // "Site Visits" nav link — only appointments that are an actual
      // property visit (visit_type set), not other appointment kinds.
      if (visitsOnly) q = q.not('visit_type', 'is', null);
      const { data } = await q;
      return (data ?? []).map((a) => ({
        ...a,
        property: Array.isArray(a.property) ? a.property[0] : a.property,
        customer: Array.isArray(a.customer) ? a.customer[0] : a.customer,
      }));
    },
    enabled: !!user,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('appointments').update({ status }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-appointments'] }),
  });

  const logVisit = useMutation({
    mutationFn: async () => {
      if (!visitModal || !user) return;
      await supabase.from('visits').insert({
        property_id: visitModal.propertyId,
        customer_id: visitModal.customerId,
        agent_id: user.id,
        visited_at: new Date().toISOString(),
        feedback: visitForm.feedback,
        rating: visitForm.rating,
      });
      await supabase.from('appointments').update({ status: 'completed' }).eq('id', visitModal.appointmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-appointments'] });
      setVisitModal(null);
      setVisitForm({ feedback: '', rating: 5 });
    },
  });

  const tabs = ['all', ...APPT_STATUSES];

  const handleOpenLead = (a: any) => {
    if (a.lead_id) {
      supabase
        .from('enquiries')
        .select('*, property:properties(id, title, price, purpose, images, locality_name, city_name, bedrooms, built_up_area, property_types(name))')
        .eq('id', a.lead_id)
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
    } else {
      setSelectedLead({
        id: a.id,
        name: customerName(a),
        phone: customerPhone(a),
        email: customerEmail(a),
        message: a.notes,
        lead_status: 'site_visit',
        status: a.status,
        property: a.property,
        created_at: a.created_at || a.scheduled_at,
        source: a.source || 'site_visit',
      });
      setDrawerOpen(true);
    }
  };

  const customerName = (a: any) => {
    if (a.customer?.first_name) {
      return `${a.customer.first_name} ${a.customer.last_name ?? ''}`.trim();
    }
    return a.name || 'Anonymous Customer';
  };

  const customerPhone = (a: any) => a.customer?.phone || a.phone || '';
  const customerEmail = (a: any) => a.customer?.email || a.email || '';

  return (
    <DashboardLayout sections={agentSections} title="Appointments & Visits" badge="Agent">
      <PageHeader
        title={visitsOnly ? 'Site Visits' : 'Appointments & Visits'}
        subtitle={
          visitsOnly
            ? 'Scheduled and completed property site visits.'
            : 'Manage scheduled property visits and customer appointments.'
        }
      />

      <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => {
              setStatusFilter(t);
              setSearchParams({
                ...(t === 'all' ? {} : { status: t }),
                ...(visitsOnly ? { tab: 'site_visits' } : {}),
              });
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
              statusFilter === t
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-slate-100 border border-slate-200/80 shadow-xs">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          data.map((a) => {
            const name = customerName(a);
            const phone = customerPhone(a);
            const email = customerEmail(a);

            return (
              <div key={a.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  
                  {/* Left Column: Property & Customer Information */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-navy-900 text-base">
                        {a.property?.title ?? 'Property Appointment'}
                      </h4>
                      <Badge
                        variant={
                          a.status === 'confirmed'
                            ? 'success'
                            : a.status === 'cancelled'
                              ? 'error'
                              : a.status === 'completed'
                                ? 'default'
                                : 'warning'
                        }
                        className="uppercase text-[10px] font-bold"
                      >
                        {a.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-red-600" />
                        {new Date(a.scheduled_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      {a.visit_type && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 font-medium text-[11px] text-slate-700">
                          {a.visit_type}
                        </span>
                      )}
                    </div>

                    {/* Customer Information Card Block */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0">
                          <User className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-bold text-navy-900">{name}</p>
                          <p className="text-[11px] text-slate-500">{phone || email || 'No contact details'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {phone && (
                          <>
                            <a
                              href={`tel:${phone}`}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 text-emerald-600" /> Call
                            </a>
                            <a
                              href={buildWhatsAppUrl(phone, `Hello ${name}, regarding your scheduled visit for ${a.property?.title || 'the property'}:`)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold flex items-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3" /> WhatsApp
                            </a>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenLead(a)}
                          className="text-xs h-7 px-2.5"
                        >
                          View Lead
                        </Button>
                      </div>
                    </div>

                    {a.notes && (
                      <p className="text-xs text-slate-600 italic bg-amber-50/40 p-2.5 rounded-lg border border-amber-100">
                        "{a.notes}"
                      </p>
                    )}
                  </div>

                  {/* Right Column: Workflow Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {a.status === 'requested' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          icon={<CheckCircle2 className="h-4 w-4" />}
                          onClick={() => updateStatus.mutate({ id: a.id, status: 'confirmed' })}
                        >
                          Confirm Visit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<XCircle className="h-4 w-4" />}
                          onClick={() => updateStatus.mutate({ id: a.id, status: 'cancelled' })}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                    {a.status === 'confirmed' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ClipboardList className="h-4 w-4" />}
                          onClick={() =>
                            setVisitModal({
                              appointmentId: a.id,
                              customerId: a.customer_id,
                              propertyId: a.property_id,
                              propertyTitle: a.property?.title ?? '',
                            })
                          }
                        >
                          Log Visit Result
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => updateStatus.mutate({ id: a.id, status: 'cancelled' })}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        ) : (
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-slate-300" />}
            title="No appointments found"
            description="Scheduled property visits and appointments assigned to you will appear here."
          />
        )}
      </Card>

      <AgentLeadDetailDrawer
        lead={selectedLead}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLead(null);
        }}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['agent-appointments'] });
        }}
      />

      <Modal
        open={!!visitModal}
        onClose={() => setVisitModal(null)}
        title={`Log visit — ${visitModal?.propertyTitle ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVisitModal(null)}>
              Cancel
            </Button>
            <Button loading={logVisit.isPending} onClick={() => logVisit.mutate()}>
              Save visit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setVisitForm((f) => ({ ...f, rating: i }))}
                  className={i <= visitForm.rating ? 'text-gold-400' : 'text-navy-200'}
                >
                  <Star className="h-6 w-6 fill-current" />
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Feedback"
            placeholder="Visit notes and customer feedback..."
            value={visitForm.feedback}
            onChange={(e) => setVisitForm((f) => ({ ...f, feedback: e.target.value }))}
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}


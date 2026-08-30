import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit3,
  Trash2,
  Tag,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  User,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DataTable, type Column } from '../../components/data-table';
import { Badge, Button, Modal, Input, Textarea, EmptyState, Spinner } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useRealtimeCount } from '../../lib/realtime';
import { formatPrice, formatDate } from '../../lib/utils';

type NegotiationStatus = 'open' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';

interface LeadOption {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  lead_status: string | null;
  property_id: string | null;
  property?: {
    id: string;
    title: string;
    price: number;
    locality_name?: string;
    city_name?: string;
  } | null;
}

interface Negotiation {
  id: string;
  lead_id: string;
  property_id: string | null;
  round_number: number;
  offer_amount: number;
  counter_amount: number | null;
  status: NegotiationStatus;
  notes: string | null;
  created_at: string;
  updated_at?: string;
  enquiries: { id?: string; name: string | null; phone?: string | null } | null;
  properties: { id?: string; title: string; locality_name?: string; city_name?: string } | null;
}

const STATUSES: { id: NegotiationStatus; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'countered', label: 'Countered' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'withdrawn', label: 'Withdrawn' },
];

function makeEmptyForm() {
  return {
    id: '',
    lead_id: '',
    property_id: '',
    round_number: '1',
    offer_amount: '',
    counter_amount: '',
    status: 'open' as NegotiationStatus,
    notes: '',
  };
}

function statusVariant(s: NegotiationStatus): 'default' | 'info' | 'success' | 'error' | 'warning' {
  if (s === 'accepted') return 'success';
  if (s === 'rejected' || s === 'withdrawn') return 'error';
  if (s === 'countered') return 'warning';
  return 'info';
}

export function AgentNegotiations() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(makeEmptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Negotiation | null>(null);

  // Search filter inside the lead selector dropdown
  const [leadSearch, setLeadSearch] = useState('');
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);

  const realtimeTick = useRealtimeCount('agent_negotiations', { column: 'agent_id', value: user?.id ?? '' });
  const realtimeLeadsTick = useRealtimeCount('enquiries', { column: 'agent_id', value: user?.id ?? '' });

  // 1. Fetch real CRM leads belonging to or assigned to the authenticated agent
  const {
    data: leads = [],
    isLoading: leadsLoading,
    error: leadsError,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ['agent-negotiations-leads', user?.id, realtimeLeadsTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquiries')
        .select('id, name, phone, email, status, lead_status, property_id, property:properties(id, title, price, locality_name, city_name)')
        .or(`agent_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({
        ...e,
        property: Array.isArray(e.property) ? e.property[0] : e.property,
      })) as LeadOption[];
    },
    enabled: !!user,
  });

  // 2. Fetch agent's negotiations
  const { data: negotiations = [], isLoading, error } = useQuery({
    queryKey: ['agent-negotiations', user?.id, realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_negotiations')
        .select('*, enquiries:lead_id(id, name, phone), properties:property_id(id, title, locality_name, city_name)')
        .eq('agent_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Negotiation[];
    },
    enabled: !!user,
  });

  // KPI Stats
  const stats = useMemo(() => {
    return {
      total: negotiations.length,
      open: negotiations.filter((r) => r.status === 'open' || r.status === 'countered').length,
      accepted: negotiations.filter((r) => r.status === 'accepted').length,
      rejected: negotiations.filter((r) => r.status === 'rejected' || r.status === 'withdrawn').length,
    };
  }, [negotiations]);

  // Selected lead object for preview & auto-population
  const selectedLead = useMemo(() => {
    return leads.find((l) => l.id === form.lead_id) || null;
  }, [leads, form.lead_id]);

  // Filtered leads for the searchable dropdown
  const filteredLeadOptions = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    if (!query) return leads;
    return leads.filter((l) => {
      const name = (l.name || '').toLowerCase();
      const phone = (l.phone || '').toLowerCase();
      const email = (l.email || '').toLowerCase();
      const propTitle = (l.property?.title || '').toLowerCase();
      const location = `${l.property?.locality_name || ''} ${l.property?.city_name || ''}`.toLowerCase();
      return name.includes(query) || phone.includes(query) || email.includes(query) || propTitle.includes(query) || location.includes(query);
    });
  }, [leads, leadSearch]);

  // Auto-calculate next round number when a lead is selected in create mode
  const handleSelectLead = (lead: LeadOption) => {
    const existingForLead = negotiations.filter((n) => n.lead_id === lead.id);
    const highestRound = existingForLead.reduce((max, n) => Math.max(max, n.round_number || 1), 0);
    const nextRound = highestRound > 0 ? highestRound + 1 : 1;

    setForm((prev) => ({
      ...prev,
      lead_id: lead.id,
      property_id: lead.property_id || lead.property?.id || '',
      round_number: String(nextRound),
    }));
    setFormErrors((prev) => ({ ...prev, lead_id: '' }));
    setLeadDropdownOpen(false);
    setLeadSearch('');
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agent_negotiations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      addToast('success', 'Negotiation deleted');
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['agent-negotiations'] });
    },
    onError: (err: Error) => addToast('error', err.message || 'Failed to delete'),
  });

  const openCreate = () => {
    setForm(makeEmptyForm());
    setFormErrors({});
    setLeadSearch('');
    setLeadDropdownOpen(false);
    setModalOpen(true);
  };

  const openEdit = (n: Negotiation) => {
    setForm({
      id: n.id,
      lead_id: n.lead_id,
      property_id: n.property_id ?? '',
      round_number: String(n.round_number),
      offer_amount: String(n.offer_amount),
      counter_amount: n.counter_amount != null ? String(n.counter_amount) : '',
      status: n.status,
      notes: n.notes ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.lead_id) errs.lead_id = 'Please select a lead to log an offer';
    if (!form.offer_amount || Number(form.offer_amount) <= 0) errs.offer_amount = 'Enter a valid offer amount';
    if (!form.round_number || Number(form.round_number) <= 0) errs.round_number = 'Enter a valid round number';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        agent_id: user!.id,
        lead_id: form.lead_id,
        property_id: form.property_id || selectedLead?.property_id || null,
        round_number: Number(form.round_number) || 1,
        offer_amount: Number(form.offer_amount),
        counter_amount: form.counter_amount ? Number(form.counter_amount) : null,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (form.id) {
        const { error } = await supabase.from('agent_negotiations').update(payload).eq('id', form.id);
        if (error) throw error;
        addToast('success', 'Negotiation updated successfully');
      } else {
        const { error } = await supabase.from('agent_negotiations').insert(payload);
        if (error) throw error;

        // Synchronize Lead status to 'negotiation' if it's currently an earlier stage
        if (selectedLead && (!selectedLead.lead_status || selectedLead.lead_status === 'new' || selectedLead.lead_status === 'contacted' || selectedLead.lead_status === 'site_visit' || selectedLead.lead_status === 'interested' || selectedLead.lead_status === 'follow_up')) {
          await supabase
            .from('enquiries')
            .update({ lead_status: 'negotiation', status: 'contacted', updated_at: new Date().toISOString() })
            .eq('id', form.lead_id);
        }

        // Log to lead_activities
        try {
          await supabase.from('lead_activities').insert({
            lead_id: form.lead_id,
            actor_id: user!.id,
            activity_type: 'negotiation_started',
            title: `Negotiation Round #${payload.round_number} Logged`,
            description: `Offer: ${formatPrice(payload.offer_amount)}${payload.counter_amount ? ' | Counter: ' + formatPrice(payload.counter_amount) : ''} (${payload.status.toUpperCase()})`,
            is_system: false,
            created_at: new Date().toISOString(),
          });
        } catch {
          // non-blocking
        }

        addToast('success', `Offer Round #${payload.round_number} logged successfully`);
      }

      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agent-negotiations'] });
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
      queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save negotiation');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Negotiation>[] = useMemo(
    () => [
      {
        key: 'lead',
        header: 'Customer & Lead',
        sortable: true,
        render: (n) => (
          <div>
            <p className="font-bold text-navy-900">{n.enquiries?.name ?? 'Customer Lead'}</p>
            {n.enquiries?.phone && <p className="text-xs text-slate-500 mt-0.5">{n.enquiries.phone}</p>}
          </div>
        ),
      },
      {
        key: 'property',
        header: 'Property',
        render: (n) => (
          <div>
            <p className="font-semibold text-navy-900 line-clamp-1">{n.properties?.title || 'General Property'}</p>
            {(n.properties?.locality_name || n.properties?.city_name) && (
              <p className="text-xs text-slate-500 mt-0.5">
                {[n.properties.locality_name, n.properties.city_name].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'round',
        header: 'Round',
        render: (n) => (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            Round #{n.round_number}
          </span>
        ),
      },
      {
        key: 'offer',
        header: 'Offer Amount',
        sortable: true,
        render: (n) => <span className="font-bold text-navy-900">{formatPrice(n.offer_amount)}</span>,
      },
      {
        key: 'counter',
        header: 'Counter Offer',
        render: (n) => (
          <span className={n.counter_amount ? 'font-semibold text-amber-700' : 'text-slate-400'}>
            {n.counter_amount != null ? formatPrice(n.counter_amount) : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (n) => (
          <Badge variant={statusVariant(n.status)} className="capitalize font-bold text-[10px]">
            {n.status}
          </Badge>
        ),
      },
      {
        key: 'created_at',
        header: 'Date',
        sortable: true,
        render: (n) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(n.created_at)}</span>,
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (n) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(n)} />
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setToDelete(n)}
            />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout sections={agentSections} title="Negotiations" badge="Agent">
      <PageHeader
        title="Price Negotiations & Offers"
        subtitle="Track customer offers, counter-offers, and deal closures with multiple rounds."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Log Offer
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Negotiations" value={stats.total} icon={<Tag className="h-5 w-5" />} accent="navy" />
        <StatCard label="In Progress" value={stats.open} icon={<TrendingUp className="h-5 w-5" />} accent="gold" />
        <StatCard label="Accepted Deals" value={stats.accepted} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Rejected / Withdrawn" value={stats.rejected} icon={<XCircle className="h-5 w-5" />} accent="error" />
      </div>

      <DataTable
        columns={columns}
        rows={negotiations}
        loading={isLoading}
        error={error instanceof Error ? error.message : null}
        getRowId={(n) => n.id}
        searchKeys={['notes']}
        emptyState={
          <EmptyState
            icon={<Tag className="h-8 w-8 text-slate-300" />}
            title="No negotiations logged yet"
            description="Log an offer from a lead to start tracking negotiation rounds and counter-offers."
          />
        }
      />

      {/* Log / Edit Offer Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Edit Offer Round' : 'Log New Offer'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save Offer
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Searchable / Rich Lead Selector */}
          <div className="sm:col-span-2">
            <label className="label text-xs font-bold text-slate-700 mb-1 block">
              Lead <span className="text-red-500">*</span>
            </label>

            {form.id ? (
              // In edit mode, display lead name as read-only
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-navy-900">
                {selectedLead?.name || negotiations.find((n) => n.id === form.id)?.enquiries?.name || 'Selected Lead'}
              </div>
            ) : (
              <div className="relative">
                {/* Trigger Button */}
                <button
                  type="button"
                  onClick={() => setLeadDropdownOpen((v) => !v)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between text-sm transition-colors cursor-pointer ${
                    formErrors.lead_id
                      ? 'border-red-400 bg-red-50/20'
                      : leadDropdownOpen
                        ? 'border-red-500 ring-2 ring-red-100 bg-white'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {leadsLoading ? (
                    <span className="flex items-center gap-2 text-slate-400">
                      <Spinner className="h-3.5 w-3.5" /> Loading leads from CRM...
                    </span>
                  ) : leadsError ? (
                    <span className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Failed to load leads. Click to retry.
                    </span>
                  ) : selectedLead ? (
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-navy-900 truncate">{selectedLead.name || 'Customer'}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {selectedLead.property?.title ? selectedLead.property.title : 'General Lead'}{' '}
                        {selectedLead.phone ? `• ${selectedLead.phone}` : ''}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select a lead from your CRM...</span>
                  )}
                  <span className="text-xs text-slate-400 ml-2">▼</span>
                </button>

                {formErrors.lead_id && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{formErrors.lead_id}</p>
                )}

                {/* Dropdown Menu */}
                {leadDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    {/* Search bar inside dropdown */}
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
                      <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        placeholder="Search by name, phone, or property..."
                        className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                        autoFocus
                      />
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto divide-y divide-slate-100/70 p-1">
                      {leadsLoading ? (
                        <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                          <Spinner className="h-4 w-4" /> Loading CRM leads...
                        </div>
                      ) : leadsError ? (
                        <div className="p-4 text-center text-xs text-red-500">
                          <p>Unable to load leads.</p>
                          <Button size="sm" variant="ghost" onClick={() => refetchLeads()} className="mt-1 text-xs">
                            <RefreshCw className="w-3 h-3 mr-1" /> Retry
                          </Button>
                        </div>
                      ) : filteredLeadOptions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          {leadSearch ? 'No leads matched your search query.' : 'No eligible leads assigned to you.'}
                        </div>
                      ) : (
                        filteredLeadOptions.map((l) => {
                          const isSelected = form.lead_id === l.id;
                          const st = l.lead_status || l.status || 'new';
                          return (
                            <div
                              key={l.id}
                              onClick={() => handleSelectLead(l)}
                              className={`p-3 rounded-xl cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                                isSelected ? 'bg-red-50/70 text-red-950' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-navy-900 text-sm">{l.name || 'Customer'}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                                  {l.phone && <span>{l.phone}</span>}
                                  {l.property?.title && (
                                    <span className="font-medium text-slate-700 truncate max-w-[200px]">
                                      • {l.property.title}
                                    </span>
                                  )}
                                  {l.property?.price ? (
                                    <span className="font-semibold text-emerald-700">
                                      ({formatPrice(l.property.price)})
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase shrink-0">
                                {st.replace('_', ' ')}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Selected Lead Live Summary Card */}
            {selectedLead && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {selectedLead.name || 'Customer'}
                  </span>
                  <Badge variant="info" className="uppercase text-[10px] font-bold">
                    {(selectedLead.lead_status || selectedLead.status || 'new').replace('_', ' ')}
                  </Badge>
                </div>
                {selectedLead.property && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium truncate">{selectedLead.property.title}</span>
                    {selectedLead.property.price && (
                      <span className="font-bold text-emerald-700">({formatPrice(selectedLead.property.price)})</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Input
              type="number"
              label="Round Number"
              value={form.round_number}
              error={formErrors.round_number}
              onChange={(e) => setForm((f) => ({ ...f, round_number: e.target.value }))}
              placeholder="1, 2, 3..."
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 mb-1 block">Offer Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as NegotiationStatus }))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 capitalize focus:outline-hidden focus:ring-2 focus:ring-red-400"
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Input
              type="number"
              label="Offer Amount (₹)"
              value={form.offer_amount}
              error={formErrors.offer_amount}
              onChange={(e) => setForm((f) => ({ ...f, offer_amount: e.target.value }))}
              placeholder="e.g. 7500000"
            />
          </div>

          <div>
            <Input
              type="number"
              label="Counter Amount (₹, optional)"
              value={form.counter_amount}
              onChange={(e) => setForm((f) => ({ ...f, counter_amount: e.target.value }))}
              placeholder="e.g. 7800000"
            />
          </div>

          <div className="sm:col-span-2">
            <Textarea
              label="Negotiation Notes & Terms"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Key concessions, payment schedule terms, or customer condition notes..."
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {toDelete && (
        <Modal
          open={!!toDelete}
          onClose={() => setToDelete(null)}
          title="Delete Negotiation Record"
          footer={
            <>
              <Button variant="secondary" onClick={() => setToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this negotiation record? This action cannot be undone.
          </p>
        </Modal>
      )}
    </DashboardLayout>
  );
}

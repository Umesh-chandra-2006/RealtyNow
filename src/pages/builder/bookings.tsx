import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Edit3,
  IndianRupee,
  Trash2,
  Plus,
  UserPlus,
  User,
  Home,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getBuilderSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n';
import { DataTable } from '../../components/data-table';
import type { Column } from '../../components/data-table';
import { Badge, Button, EmptyState, Input, Modal, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useRealtimeMulti } from '../../lib/realtime';
import { logBuilderAudit } from '../../lib/builder-audit';
import { formatDate, formatPrice } from '../../lib/utils';

type BuilderBookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

interface BuilderUnit {
  id: string;
  tower_id: string;
  unit_number: string;
  type: string;
  size_sqft: number | null;
  price: number | null;
  status: 'available' | 'booked' | 'sold';
  builder_towers?: {
    id: string;
    name: string;
    project_id?: string;
    builder_projects?: { id: string; name: string } | null;
  } | null;
}

interface BuilderBooking {
  id: string;
  unit_id: string;
  customer_id: string | null;
  lead_id: string | null;
  booking_date: string;
  amount: number;
  status: BuilderBookingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BuilderBookingRow extends BuilderBooking {
  builder_units: {
    unit_number: string;
    type: string;
    builder_towers?: { name: string; builder_projects?: { name: string } | null } | null;
  } | null;
  builder_customers: { name: string; phone?: string | null; email?: string | null } | null;
  builder_leads: { name: string; phone?: string | null; email?: string | null } | null;
}

interface BookingForm {
  unit_id: string;
  customer_type: 'none' | 'customer' | 'lead';
  customer_id: string;
  lead_id: string;
  booking_date: string;
  amount: string;
  status: BuilderBookingStatus;
  notes: string;
}

const EMPTY_FORM: BookingForm = {
  unit_id: '',
  customer_type: 'none',
  customer_id: '',
  lead_id: '',
  booking_date: new Date().toISOString().slice(0, 10),
  amount: '',
  status: 'pending',
  notes: '',
};

const STATUS_VARIANT: Record<BuilderBookingStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'warning',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'error',
};

export function BuilderBookings() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const builderSections = getBuilderSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const realtimeTick = useRealtimeMulti(['builder_bookings', 'builder_units', 'builder_customers', 'builder_leads']);

  const [toDelete, setToDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<BuilderBookingRow | 'new' | null>(null);
  const [form, setForm] = useState<BookingForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Quick Customer Creation inline
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustEmail, setQuickCustEmail] = useState('');
  const [quickCustSaving, setQuickCustSaving] = useState(false);

  // Quick Unit Creation inline
  const [showQuickAddUnit, setShowQuickAddUnit] = useState(false);
  const [quickUnitTowerId, setQuickUnitTowerId] = useState('');
  const [quickUnitNumber, setQuickUnitNumber] = useState('');
  const [quickUnitType, setQuickUnitType] = useState('2BHK');
  const [quickUnitPrice, setQuickUnitPrice] = useState('');
  const [quickUnitSaving, setQuickUnitSaving] = useState(false);

  // 1. Fetch Builder's Projects & Towers
  const { data: towers } = useQuery({
    queryKey: ['builder-booking-towers', user?.id],
    queryFn: async () => {
      const { data: projs } = await supabase.from('builder_projects').select('id').eq('builder_id', user!.id);
      const projectIds = (projs ?? []).map((p) => p.id);
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('builder_towers')
        .select('id, name, project_id, builder_projects(id, name)')
        .in('project_id', projectIds)
        .order('name');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  // 2. Fetch All Units for the Builder
  const { data: scopeUnits, isLoading: unitsLoading } = useQuery({
    queryKey: ['builder-bookings-unit-scope', user?.id, realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_units')
        .select('id, tower_id, unit_number, type, size_sqft, price, status, builder_towers(id, name, project_id, builder_projects(id, name))')
        .order('unit_number');
      if (error) throw error;
      return (data ?? []) as unknown as BuilderUnit[];
    },
    enabled: !!user,
  });

  const unitIds = useMemo(() => (scopeUnits ?? []).map((u) => u.id), [scopeUnits]);

  // 3. Fetch Bookings
  const {
    data: bookings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['builder-bookings', user?.id, unitIds.join(','), realtimeTick],
    queryFn: async () => {
      if (!unitIds.length) return [];
      const { data, error } = await supabase
        .from('builder_bookings')
        .select('*, builder_units(unit_number, type, builder_towers(name, builder_projects(name))), builder_customers(name, phone, email), builder_leads(name, phone, email)')
        .in('unit_id', unitIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BuilderBookingRow[];
    },
    enabled: !!user && scopeUnits !== undefined,
  });

  // 4. Fetch Existing Builder Customers
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['builder-customers-lite', user?.id, realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_customers')
        .select('id, name, phone, email')
        .eq('builder_id', user!.id)
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; phone?: string | null; email?: string | null }[];
    },
    enabled: !!user,
  });

  // 5. Fetch Existing Builder CRM Leads
  const { data: leads } = useQuery({
    queryKey: ['builder-leads-lite', user?.id, realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_leads')
        .select('id, name, phone, email')
        .eq('builder_id', user!.id)
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; phone?: string | null; email?: string | null }[];
    },
    enabled: !!user,
  });

  const availableUnits = useMemo(() => {
    const list = (scopeUnits ?? []).filter((u) => u.status === 'available');
    if (editing && editing !== 'new') {
      const current = (scopeUnits ?? []).find((u) => u.id === editing.unit_id);
      if (current && !list.some((u) => u.id === current.id)) list.push(current);
    }
    return list;
  }, [scopeUnits, editing]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowQuickAddCustomer(false);
    setShowQuickAddUnit(false);
    setQuickUnitTowerId(towers?.[0]?.id ?? '');
    setEditing('new');
  };

  const openEdit = (b: BuilderBookingRow) => {
    let custType: 'none' | 'customer' | 'lead' = 'none';
    if (b.customer_id) custType = 'customer';
    else if (b.lead_id) custType = 'lead';

    setForm({
      unit_id: b.unit_id,
      customer_type: custType,
      customer_id: b.customer_id ?? '',
      lead_id: b.lead_id ?? '',
      booking_date: b.booking_date,
      amount: String(b.amount ?? ''),
      status: b.status,
      notes: b.notes ?? '',
    });
    setFormErrors({});
    setShowQuickAddCustomer(false);
    setShowQuickAddUnit(false);
    setEditing(b);
  };

  // Handle Unit Selection and auto-fill amount
  const handleUnitSelect = (unitId: string) => {
    const selectedUnit = scopeUnits?.find((u) => u.id === unitId);
    setForm((f) => ({
      ...f,
      unit_id: unitId,
      amount: f.amount || (selectedUnit?.price ? String(selectedUnit.price) : f.amount),
    }));
  };

  // Inline Quick Add Customer
  const handleQuickAddCustomer = async () => {
    if (!quickCustName.trim()) {
      addToast('error', 'Please enter customer name');
      return;
    }
    setQuickCustSaving(true);
    try {
      const payload = {
        builder_id: user!.id,
        name: quickCustName.trim(),
        phone: quickCustPhone.trim() || null,
        email: quickCustEmail.trim() || null,
      };
      const { data, error } = await supabase.from('builder_customers').insert(payload).select('id, name').single();
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['builder-customers-lite'] });
      setForm((f) => ({ ...f, customer_type: 'customer', customer_id: data.id, lead_id: '' }));
      setShowQuickAddCustomer(false);
      setQuickCustName('');
      setQuickCustPhone('');
      setQuickCustEmail('');
      addToast('success', `Customer "${data.name}" added and linked!`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to add customer');
    } finally {
      setQuickCustSaving(false);
    }
  };

  // Inline Quick Add Unit
  const handleQuickAddUnit = async () => {
    if (!quickUnitTowerId) {
      addToast('error', 'Please select a block/tower');
      return;
    }
    if (!quickUnitNumber.trim()) {
      addToast('error', 'Please enter unit number (e.g. 101)');
      return;
    }
    setQuickUnitSaving(true);
    try {
      const priceNum = Number(quickUnitPrice) || null;
      const payload = {
        tower_id: quickUnitTowerId,
        unit_number: quickUnitNumber.trim(),
        type: quickUnitType || '2BHK',
        price: priceNum,
        status: 'available',
      };
      const { data, error } = await supabase.from('builder_units').insert(payload).select('id, unit_number, price').single();
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['builder-bookings-unit-scope'] });
      setForm((f) => ({
        ...f,
        unit_id: data.id,
        amount: priceNum ? String(priceNum) : f.amount,
      }));
      setShowQuickAddUnit(false);
      setQuickUnitNumber('');
      setQuickUnitPrice('');
      addToast('success', `Unit "${data.unit_number}" created and selected!`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to add unit');
    } finally {
      setQuickUnitSaving(false);
    }
  };

  const save = async () => {
    const errors: Record<string, string> = {};
    if (!form.unit_id) errors.unit_id = 'Select a unit';
    const amountNum = Number(form.amount);
    if (!form.amount || Number.isNaN(amountNum) || amountNum <= 0) errors.amount = 'Enter a valid amount';
    if (!form.booking_date) errors.booking_date = 'Booking date is required';
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        unit_id: form.unit_id,
        customer_id: form.customer_id || null,
        lead_id: form.lead_id || null,
        booking_date: form.booking_date,
        amount: amountNum,
        status: form.status,
        notes: form.notes || null,
      };

      if (editing && editing !== 'new') {
        const { error } = await supabase.from('builder_bookings').update(payload).eq('id', editing.id);
        if (error) throw error;

        // If unit changed, release the old unit
        if (editing.unit_id && editing.unit_id !== form.unit_id) {
          await supabase.from('builder_units').update({ status: 'available' }).eq('id', editing.unit_id);
        }

        // Synchronize new unit status
        if (form.status === 'confirmed') {
          await supabase.from('builder_units').update({ status: 'booked' }).eq('id', form.unit_id);
        } else if (form.status === 'completed') {
          await supabase.from('builder_units').update({ status: 'sold' }).eq('id', form.unit_id);
        } else if (form.status === 'cancelled') {
          await supabase.from('builder_units').update({ status: 'available' }).eq('id', form.unit_id);
        }

        await logBuilderAudit('update', 'builder_bookings', editing.id, payload);
        addToast('success', 'Booking updated successfully');
      } else {
        const { data: inserted, error } = await supabase.from('builder_bookings').insert(payload).select('id').single();
        if (error) throw error;

        if (form.status === 'confirmed') {
          await supabase.from('builder_units').update({ status: 'booked' }).eq('id', form.unit_id);
        } else if (form.status === 'completed') {
          await supabase.from('builder_units').update({ status: 'sold' }).eq('id', form.unit_id);
        }

        await logBuilderAudit('create', 'builder_bookings', inserted?.id ?? null, payload);
        addToast('success', 'Booking created successfully');
      }

      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['builder-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['builder-bookings-unit-scope'] });
      queryClient.invalidateQueries({ queryKey: ['builder-units'] });
      queryClient.invalidateQueries({ queryKey: ['builder-inventory'] });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save booking');
    } finally {
      setSaving(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (rowId: string) => {
      // Find the booking before deleting to release the unit
      const bookingToDelete = bookings?.find((b) => b.id === rowId);
      const { error } = await supabase.from('builder_bookings').delete().eq('id', rowId);
      if (error) throw error;
      if (bookingToDelete?.unit_id) {
        await supabase.from('builder_units').update({ status: 'available' }).eq('id', bookingToDelete.unit_id);
      }
      return rowId;
    },
    onSuccess: async (id) => {
      await logBuilderAudit('delete', 'builder_bookings', id);
      queryClient.invalidateQueries({ queryKey: ['builder-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['builder-bookings-unit-scope'] });
      queryClient.invalidateQueries({ queryKey: ['builder-units'] });
      queryClient.invalidateQueries({ queryKey: ['builder-inventory'] });
      setToDelete(null);
      addToast('success', 'Booking deleted and unit released');
    },
    onError: (err) => addToast('error', err instanceof Error ? err.message : 'Failed to delete booking'),
  });

  const columns = useMemo<Column<BuilderBookingRow>[]>(
    () => [
      {
        key: 'unit',
        header: 'Unit',
        render: (b) => (
          <div>
            <p className="font-bold text-navy-900">{b.builder_units?.unit_number ?? '—'}</p>
            <p className="text-xs text-navy-500 font-medium">
              {b.builder_units?.type ?? ''}
              {b.builder_units?.builder_towers?.name ? ` · ${b.builder_units.builder_towers.name}` : ''}
              {b.builder_units?.builder_towers?.builder_projects?.name ? ` (${b.builder_units.builder_towers.builder_projects.name})` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'party',
        header: 'Customer / Lead',
        render: (b) => {
          const cust = b.builder_customers;
          const lead = b.builder_leads;
          if (cust) {
            return (
              <div>
                <span className="font-semibold text-slate-900 block">{cust.name}</span>
                <span className="text-xs text-emerald-700 font-medium">Customer {cust.phone ? `· ${cust.phone}` : ''}</span>
              </div>
            );
          }
          if (lead) {
            return (
              <div>
                <span className="font-semibold text-slate-900 block">{lead.name}</span>
                <span className="text-xs text-navy-500 font-medium">CRM Lead {lead.phone ? `· ${lead.phone}` : ''}</span>
              </div>
            );
          }
          return <span className="text-slate-400 text-xs italic">No customer linked</span>;
        },
      },
      {
        key: 'booking_date',
        header: 'Booking Date',
        sortable: true,
        render: (b) => formatDate(b.booking_date),
      },
      {
        key: 'amount',
        header: 'Amount',
        sortable: true,
        render: (b) => <span className="font-bold text-navy-900">{formatPrice(b.amount)}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        render: (b) => (
          <Badge variant={STATUS_VARIANT[b.status]} className="capitalize">
            {b.status}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (b) => (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(b)} />
            <Button
              size="sm"
              variant="ghost"
              className="text-error-600 hover:text-error-700"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setToDelete(b.id)}
            />
          </div>
        ),
      },
    ],
    [scopeUnits, editing],
  );

  const stats = useMemo(() => {
    const rows = bookings ?? [];
    const confirmed = rows.filter((b) => b.status === 'confirmed').length;
    const pending = rows.filter((b) => b.status === 'pending').length;
    const totalValue = rows.reduce((sum, b) => sum + (b.amount || 0), 0);
    return { total: rows.length, confirmed, pending, totalValue };
  }, [bookings]);

  return (
    <DashboardLayout sections={builderSections} title="Bookings" badge="Builder">
      <PageHeader
        title="Unit Bookings"
        subtitle="Track and manage bookings across your projects."
        action={
          <Button onClick={openCreate} icon={<CalendarCheck2 className="h-4 w-4" />}>
            New booking
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Bookings" value={stats.total} icon={<CalendarCheck2 className="h-5 w-5" />} accent="navy" />
        <StatCard label="Confirmed" value={stats.confirmed} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Pending" value={stats.pending} icon={<Clock className="h-5 w-5" />} accent="gold" />
        <StatCard label="Total Value" value={formatPrice(stats.totalValue)} icon={<IndianRupee className="h-5 w-5" />} accent="navy" />
      </div>

      <DataTable
        columns={columns}
        rows={bookings ?? []}
        loading={isLoading || unitsLoading}
        error={error instanceof Error ? error.message : null}
        getRowId={(b) => b.id}
        searchKeys={['booking_date', 'status']}
        emptyState={
          <EmptyState
            icon={<CalendarCheck2 className="h-6 w-6" />}
            title="No bookings yet"
            description="Create a booking once a unit is reserved for a customer."
            action={
              <Button onClick={openCreate} icon={<CalendarCheck2 className="h-4 w-4" />}>
                New booking
              </Button>
            }
          />
        }
      />

      {/* Delete Booking Modal */}
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete booking"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => toDelete && deleteMutation.mutate(toDelete)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">This will permanently delete this booking record.</p>
      </Modal>

      {/* Add / Edit Booking Modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New booking' : 'Edit booking'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing === 'new' ? 'Create booking' : 'Save changes'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Unit Dropdown & Inline Quick Add */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Unit</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddUnit((prev) => !prev)}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {showQuickAddUnit ? 'Cancel New Unit' : '+ Quick Add Unit'}
                  </button>
                </div>

                {!showQuickAddUnit ? (
                  <div>
                    <select
                      value={form.unit_id}
                      onChange={(e) => handleUnitSelect(e.target.value)}
                      className={`input pr-8 ${formErrors.unit_id ? 'border-error-400' : ''}`}
                    >
                      <option value="">Select a unit</option>
                      {availableUnits.map((u) => {
                        const towerName = u.builder_towers?.name;
                        const projName = u.builder_towers?.builder_projects?.name;
                        return (
                          <option key={u.id} value={u.id}>
                            Unit {u.unit_number} • {u.type} {towerName ? `· ${towerName}` : ''} {projName ? `(${projName})` : ''} {u.price ? `· ${formatPrice(u.price)}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {formErrors.unit_id && <p className="mt-1 text-xs text-error-600">{formErrors.unit_id}</p>}
                  </div>
                ) : (
                  /* Inline Quick Unit Form */
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <p className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                      <Home className="h-4 w-4 text-red-600" /> Create & Select New Unit
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <Select
                        label="Block / Tower"
                        value={quickUnitTowerId}
                        onChange={(e) => setQuickUnitTowerId(e.target.value)}
                      >
                        {(towers ?? []).map((tw) => (
                          <option key={tw.id} value={tw.id}>
                            {tw.name} {tw.builder_projects?.name ? `(${tw.builder_projects.name})` : ''}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Unit Number"
                        placeholder="e.g. 101, A-202"
                        value={quickUnitNumber}
                        onChange={(e) => setQuickUnitNumber(e.target.value)}
                      />
                      <Input
                        label="Unit Type"
                        placeholder="e.g. 2BHK, 3BHK"
                        value={quickUnitType}
                        onChange={(e) => setQuickUnitType(e.target.value)}
                      />
                      <Input
                        label="Price (₹)"
                        type="number"
                        placeholder="e.g. 7500000"
                        value={quickUnitPrice}
                        onChange={(e) => setQuickUnitPrice(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="secondary" onClick={() => setShowQuickAddUnit(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleQuickAddUnit} loading={quickUnitSaving}>
                        Save & Select Unit
                      </Button>
                    </div>
                  </div>
                )}

                {/* Empty Units Alert */}
                {!unitsLoading && availableUnits.length === 0 && !showQuickAddUnit && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-100/90 text-xs text-slate-600 flex items-center justify-between">
                    <span>No available units found.</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddUnit(true)}
                      className="font-bold text-red-600 hover:text-red-700 underline"
                    >
                      + Create a unit now
                    </button>
                  </div>
                )}
              </div>

              {/* Customer / Lead Dropdown & Inline Quick Add */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Customer (optional)</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCustomer((prev) => !prev)}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {showQuickAddCustomer ? 'Cancel New Customer' : '+ Quick Add Customer'}
                  </button>
                </div>

                {!showQuickAddCustomer ? (
                  <div>
                    <select
                      value={
                        form.customer_id ? `customer:${form.customer_id}` : form.lead_id ? `lead:${form.lead_id}` : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setForm((f) => ({ ...f, customer_type: 'none', customer_id: '', lead_id: '' }));
                        } else if (val.startsWith('customer:')) {
                          setForm((f) => ({
                            ...f,
                            customer_type: 'customer',
                            customer_id: val.replace('customer:', ''),
                            lead_id: '',
                          }));
                        } else if (val.startsWith('lead:')) {
                          setForm((f) => ({
                            ...f,
                            customer_type: 'lead',
                            lead_id: val.replace('lead:', ''),
                            customer_id: '',
                          }));
                        }
                      }}
                      className="input pr-8"
                    >
                      <option value="">No customer linked (Walk-in / Direct)</option>
                      {customers && customers.length > 0 && (
                        <optgroup label="── Existing Customers ──">
                          {customers.map((c) => (
                            <option key={`c-${c.id}`} value={`customer:${c.id}`}>
                              {c.name} {c.phone ? `· ${c.phone}` : ''} {c.email ? `(${c.email})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {leads && leads.length > 0 && (
                        <optgroup label="── CRM Leads ──">
                          {leads.map((l) => (
                            <option key={`l-${l.id}`} value={`lead:${l.id}`}>
                              {l.name} {l.phone ? `· ${l.phone}` : ''} {l.email ? `(${l.email})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                ) : (
                  /* Inline Quick Customer Form */
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <p className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-red-600" /> Create & Link New Customer
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <Input
                        label="Customer Name"
                        placeholder="e.g. Rahul Sharma"
                        value={quickCustName}
                        onChange={(e) => setQuickCustName(e.target.value)}
                      />
                      <Input
                        label="Phone Number"
                        placeholder="e.g. 9876543210"
                        value={quickCustPhone}
                        onChange={(e) => setQuickCustPhone(e.target.value)}
                      />
                      <Input
                        label="Email Address"
                        type="email"
                        placeholder="e.g. rahul@gmail.com"
                        value={quickCustEmail}
                        onChange={(e) => setQuickCustEmail(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="secondary" onClick={() => setShowQuickAddCustomer(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleQuickAddCustomer} loading={quickCustSaving}>
                        Save & Select Customer
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Booking Date */}
              <Input
                label="Booking Date"
                type="date"
                value={form.booking_date}
                error={formErrors.booking_date}
                onChange={(e) => setForm((f) => ({ ...f, booking_date: e.target.value }))}
              />

              {/* Amount */}
              <Input
                label="Amount (₹)"
                type="number"
                min="0"
                placeholder="e.g. 500000"
                value={form.amount}
                error={formErrors.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />

              {/* Status */}
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BuilderBookingStatus }))}
                containerClassName="sm:col-span-2"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>

              {/* Notes */}
              <Textarea
                label="Notes"
                placeholder="Optional booking notes, terms, token details..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                containerClassName="sm:col-span-2"
              />
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

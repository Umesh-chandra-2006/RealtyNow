import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, FileCheck2, Trash2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getBuilderSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n';
import { DataTable } from '../../components/data-table';
import type { Column } from '../../components/data-table';
import { Button, EmptyState, Input, Modal, Select, Badge } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useRealtimeCount } from '../../lib/realtime';
import { logBuilderAudit } from '../../lib/builder-audit';
import { uploadFile } from '../../lib/storage';
import { formatDate } from '../../lib/utils';

interface BuilderCustomer {
  id: string;
  builder_id: string;
  lead_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  kyc_doc_url: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface BuilderCustomerRow extends BuilderCustomer {
  builder_leads: { name: string } | null;
}

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  lead_id: string;
  kyc_doc_url: string;
}

const EMPTY_FORM: CustomerForm = { name: '', email: '', phone: '', address: '', lead_id: '', kyc_doc_url: '' };

export function BuilderCustomers() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const builderSections = getBuilderSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const realtimeTick = useRealtimeCount('builder_customers', user ? { column: 'builder_id', value: user.id } : undefined);

  const [toDelete, setToDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<BuilderCustomerRow | 'new' | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['builder-customers-full', user?.id, realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_customers')
        .select('*, builder_leads(name)')
        .eq('builder_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BuilderCustomerRow[];
    },
    enabled: !!user,
  });

  const { data: leads } = useQuery({
    queryKey: ['builder-leads-lite', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('builder_leads').select('id, name').eq('builder_id', user!.id).order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!user,
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditing('new');
  };

  const openEdit = (c: BuilderCustomerRow) => {
    setForm({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      lead_id: c.lead_id ?? '',
      kyc_doc_url: c.kyc_doc_url ?? '',
    });
    setFormErrors({});
    setEditing(c);
  };

  const handleKycUpload = async (file: File) => {
    setUploading(true);
    const { url, error } = await uploadFile('builder-documents', file);
    if (error || !url) {
      addToast('error', error || 'Failed to upload KYC document');
    } else {
      setForm((f) => ({ ...f, kyc_doc_url: url }));
      addToast('success', 'KYC document uploaded');
    }
    setUploading(false);
  };

  const save = async () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email';
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        lead_id: form.lead_id || null,
        kyc_doc_url: form.kyc_doc_url || null,
      };

      if (editing && editing !== 'new') {
        const { error } = await supabase.from('builder_customers').update(payload).eq('id', editing.id);
        if (error) throw error;
        await logBuilderAudit('update', 'builder_customers', editing.id, payload);
        addToast('success', 'Customer updated');
      } else {
        const { data: inserted, error } = await supabase
          .from('builder_customers')
          .insert({ ...payload, builder_id: user!.id })
          .select('id')
          .single();
        if (error) throw error;
        await logBuilderAudit('create', 'builder_customers', inserted?.id ?? null, payload);
        addToast('success', 'Customer added');
      }

      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['builder-customers-full'] });
      queryClient.invalidateQueries({ queryKey: ['builder-customers-lite'] });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('builder_customers').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      await logBuilderAudit('delete', 'builder_customers', id);
      queryClient.invalidateQueries({ queryKey: ['builder-customers-full'] });
      setToDelete(null);
      addToast('success', 'Customer deleted');
    },
    onError: (err) => addToast('error', err instanceof Error ? err.message : 'Failed to delete customer'),
  });

  const columns = useMemo<Column<BuilderCustomerRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        render: (c) => <p className="font-medium text-navy-900">{c.name}</p>,
      },
      { key: 'email', header: 'Email', render: (c) => c.email ?? '—' },
      { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—' },
      {
        key: 'lead',
        header: 'Linked Lead',
        render: (c) => <span className="text-sm">{c.builder_leads?.name ?? '—'}</span>,
      },
      { key: 'created_at', header: 'Joined', sortable: true, render: (c) => formatDate(c.created_at) },
      {
        key: 'actions',
        header: 'Actions',
        render: (c) => (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(c)} />
            <Button
              size="sm"
              variant="ghost"
              className="text-error-600"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setToDelete(c.id)}
            />
          </div>
        ),
      },
    ],
    [],
  );

  const stats = useMemo(() => {
    const rows = customers ?? [];
    const withKyc = rows.filter((c) => !!c.kyc_doc_url).length;
    const linked = rows.filter((c) => !!c.lead_id).length;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = rows.filter((c) => new Date(c.created_at).getTime() >= thirtyDaysAgo).length;
    return { total: rows.length, withKyc, linked, recent };
  }, [customers]);

  return (
    <DashboardLayout sections={builderSections} title="Customers" badge="Builder">
      <PageHeader
        title="Customers"
        subtitle="Manage your buyers and their KYC records."
        action={
          <Button onClick={openCreate} icon={<UserPlus className="h-4 w-4" />}>
            Add customer
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Customers" value={stats.total} icon={<Users className="h-5 w-5" />} accent="navy" />
        <StatCard label="KYC Uploaded" value={stats.withKyc} icon={<FileCheck2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Linked to Lead" value={stats.linked} icon={<Users className="h-5 w-5" />} accent="gold" />
        <StatCard label="New (30 days)" value={stats.recent} icon={<UserPlus className="h-5 w-5" />} accent="navy" />
      </div>

      <DataTable
        columns={columns}
        rows={customers ?? []}
        loading={isLoading}
        error={error instanceof Error ? error.message : null}
        getRowId={(c) => c.id}
        searchKeys={['name', 'email', 'phone']}
        cardRender={(c) => (
          <div
            key={c.id}
            className="card p-5 hover:shadow-cardHover transition-all flex flex-col justify-between h-full group bg-white border border-slate-200/80 rounded-2xl"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-bold text-navy-900 text-base shadow-2xs shrink-0">
                    {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-navy-900 text-base leading-tight truncate">{c.name}</h4>
                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{c.email || 'No email'}</p>
                    {c.phone && <p className="text-xs text-slate-500 truncate mt-0.5">{c.phone}</p>}
                  </div>
                </div>
                {c.kyc_doc_url ? (
                  <Badge variant="success" className="shrink-0">KYC Verified</Badge>
                ) : (
                  <Badge variant="default" className="shrink-0">Pending KYC</Badge>
                )}
              </div>

              {c.notes && (
                <p className="text-xs text-slate-600 line-clamp-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-3">
                  {c.notes}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
              <span className="text-[11px] text-slate-400">Added {new Date(c.created_at).toLocaleDateString()}</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(c)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setToDelete(c.id)}
                />
              </div>
            </div>
          </div>
        )}
        emptyState={
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No customers yet"
            description="Add a customer once a lead converts into a buyer."
            action={
              <Button onClick={openCreate} icon={<UserPlus className="h-4 w-4" />}>
                Add customer
              </Button>
            }
          />
        }
      />

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete customer"
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
        <p className="text-sm text-navy-700">This will permanently delete this customer record.</p>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add customer' : 'Edit customer'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save customer
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Name"
                value={form.name}
                error={formErrors.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                error={formErrors.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Select
                label="Linked lead (optional)"
                value={form.lead_id}
                onChange={(e) => setForm((f) => ({ ...f, lead_id: e.target.value }))}
              >
                <option value="">No linked lead</option>
                {(leads ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Input
                  label="Address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
            </div>

            <div className="bg-navy-50/70 p-4 rounded-2xl border border-navy-100">
              <label className="label font-bold text-navy-900 text-sm">KYC Document</label>
              <p className="text-xs text-navy-500 mb-2">Upload ID proof or KYC document (PDF/image).</p>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="customer-kyc-upload"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleKycUpload(file);
                  }}
                />
                <label
                  htmlFor="customer-kyc-upload"
                  className={`cursor-pointer rounded-xl bg-navy-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-navy-800 transition-all inline-flex items-center gap-1.5 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>{uploading ? 'Uploading...' : form.kyc_doc_url ? 'Replace document' : 'Upload document'}</span>
                </label>
                {form.kyc_doc_url && (
                  <a
                    href={form.kyc_doc_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-success-600 hover:underline"
                  >
                    ✓ View uploaded
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

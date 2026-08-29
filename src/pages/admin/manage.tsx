import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Ban, CheckCircle2, Edit3, Plus, FileText, Upload, ExternalLink, XCircle, Clock, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { Card, Button, Modal, Input, Select, Badge, Avatar, EmptyState, Skeleton, Textarea } from '../../components/ui';
import { DataTable, type Column, BulkActionsBar } from '../../components/data-table';
import { formatDate, cn } from '../../lib/utils';
import { useRealtimeCount } from '../../lib/realtime';
import { uploadFile } from '../../lib/storage';
import { useToast } from '../../components/toast';
import type { Profile } from '../../lib/types';
import { Users, UserCheck, UserX, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

// Customer data/mutations go through the `admin-customers` edge function rather than
// direct `supabase.from('profiles')` calls. The admin portal's session (admin-auth-context.tsx)
// is a custom opaque token, never a real Supabase Auth session, so `auth.uid()` is always
// null for these requests — profiles' RLS silently filtered out every customer row (that's
// why this page showed "No records found" despite real customer data existing). The edge
// function validates the admin's session token itself, then reads/writes with the service role.
async function callAdminCustomers<T = any>(action: string, token: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-customers', {
    headers: { 'x-action': action, Authorization: `Bearer ${token}` },
    body: payload,
  });
  if (error) throw new Error(error.message || 'Request failed');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

interface AdminCustomersStats {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
}

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
] as const;

function dateRangeToFrom(range: string): string | undefined {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return undefined;
}

export function AdminCustomers() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const toast = useToast();
  const token = session?.access_token ?? '';

  const [toDelete, setToDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', status: 'active' });
  const [saving, setSaving] = useState(false);

  // Advanced Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-customers', token, statusFilter, dateFilter],
    queryFn: async () => {
      const result = await callAdminCustomers<{ customers: Profile[]; stats: AdminCustomersStats }>('list', token, {
        status: statusFilter,
        dateFrom: dateRangeToFrom(dateFilter),
      });
      return result;
    },
    enabled: !!token,
  });

  const customers = data?.customers ?? [];
  const stats = data?.stats;

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => callAdminCustomers('delete', token, { customerIds: ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setToDelete(null);
      setSelected(new Set());
      toast.addToast('success', 'Customer deleted.');
    },
    onError: (e: any) => toast.addToast('error', e.message || 'Failed to delete customer.'),
  });

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await callAdminCustomers('update-profile', token, { customerId: editing.id, ...editForm });
      if (editForm.status !== editing.status) {
        await callAdminCustomers('update-status', token, { customerId: editing.id, status: editForm.status });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setEditing(null);
      toast.addToast('success', 'Profile updated successfully.');
    } catch (e: any) {
      toast.addToast('error', e.message || 'Profile update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (p: Profile) => {
    const nextStatus = p.status === 'active' ? 'suspended' : 'active';
    try {
      await callAdminCustomers('update-status', token, { customerId: p.id, status: nextStatus });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    } catch (e: any) {
      toast.addToast('error', e.message || 'Failed to update status.');
    }
  };

  const columns: Column<Profile>[] = [
    {
      key: 'first_name',
      header: 'Customer',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email} src={p.avatar_url} size={36} />
          <div>
            <p className="font-medium text-navy-900">
              {p.first_name} {p.last_name}
            </p>
            <p className="text-xs text-navy-500">{p.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (p) => p.phone ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge variant={p.status === 'active' ? 'success' : p.status === 'suspended' || p.status === 'blocked' ? 'error' : 'warning'}>
          {p.status}
        </Badge>
      ),
    },
    { key: 'created_at', header: 'Joined', sortable: true, render: (p) => formatDate(p.created_at) },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(p);
              setEditForm({
                first_name: p.first_name ?? '',
                last_name: p.last_name ?? '',
                email: p.email,
                phone: p.phone ?? '',
                status: p.status,
              });
            }}
            icon={<Edit3 className="h-4 w-4" />}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={p.status === 'active' ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            onClick={() => toggleStatus(p)}
          >
            {p.status === 'active' ? 'Suspend' : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-error-600"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setToDelete(p.id)}
          />
        </div>
      ),
    },
  ];

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  const statCards = stats
    ? [
        { label: 'Total Customers', value: stats.total, icon: Users },
        { label: 'Active Customers', value: stats.active, icon: UserCheck },
        { label: 'Inactive Customers', value: stats.inactive, icon: UserX },
        { label: 'New This Month', value: stats.newThisMonth, icon: TrendingUp },
      ]
    : [];

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:customers', 'Customers')}>
      <PageHeader title="Customers" subtitle="Manage all customer accounts." />

      {statCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {statCards.map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-navy-500">{s.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-navy-900">{s.value}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-navy-50 grid place-items-center">
                  <s.icon className="h-5 w-5 text-navy-600" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-4">
        <Card className="p-4 bg-navy-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wider mb-1.5">
                Account Status
              </label>
              <Select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="max-w-xs"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="blocked">Blocked</option>
                <option value="pending">Pending</option>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wider mb-1.5">
                Date
              </label>
              <Select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="max-w-xs"
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
      </div>

      {isError ? (
        <Card className="p-8 text-center">
          <AlertCircle className="h-8 w-8 text-error-500 mx-auto mb-2" />
          <p className="text-sm text-navy-700 mb-3">Unable to load customers.</p>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : (
        <>
          <BulkActionsBar count={selected.size} onDelete={() => deleteMutation.mutate([...selected])} />
          <DataTable
            columns={columns}
            rows={customers}
            loading={isLoading}
            getRowId={(p) => p.id}
            searchKeys={['first_name', 'last_name', 'email', 'phone']}
            selectedIds={selected}
            onToggleSelect={(id) =>
              setSelected((s) => {
                const n = new Set(s);
                n.has(id) ? n.delete(id) : n.add(id);
                return n;
              })
            }
            onSelectAll={(ids) =>
              setSelected((s) => {
                const n = new Set(s);
                ids.forEach((id) => (n.has(id) ? n.delete(id) : n.add(id)));
                return n;
              })
            }
          />
        </>
      )}
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete customer"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => toDelete && deleteMutation.mutate([toDelete])}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">This will permanently delete the customer and all their properties.</p>
      </Modal>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit customer"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="First name"
              value={editForm.first_name}
              onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
            />
            <Input
              label="Last name"
              value={editForm.last_name}
              onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
            />
            <Input
              label="Email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Select
              label="Status"
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
            </Select>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

async function callAdminAgentVerification<T = any>(action: string, token: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-agent-verification', {
    headers: { 'x-action': action, Authorization: `Bearer ${token}` },
    body: payload,
  });
  if (error) throw new Error(error.message || 'Request failed');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

const RERA_STATUS_LABEL: Record<string, string> = {
  not_submitted: 'Not Submitted',
  pending: 'Pending',
  under_review: 'Under Review',
  verified: 'Verified',
  rejected: 'Rejected',
};

function RERAVerificationPanel({ agent }: { agent: Profile }) {
  const { session } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const token = session?.access_token ?? '';
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const status = agent.rera_verification_status ?? 'not_submitted';
  if (status === 'not_submitted') return null;

  const run = async (action: 'verify' | 'reject' | 'under-review', payload: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await callAdminAgentVerification(action, token, { agentId: agent.id, ...payload });
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      toast.addToast('success', `RERA ${action === 'verify' ? 'verified' : action === 'reject' ? 'rejected' : 'marked under review'}.`);
      setShowReject(false);
      setReason('');
    } catch (e: any) {
      toast.addToast('error', e.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const viewDocument = async () => {
    setBusy(true);
    try {
      const { url } = await callAdminAgentVerification<{ url: string }>('get-document', token, { agentId: agent.id });
      setDocUrl(url);
    } catch (e: any) {
      toast.addToast('error', e.message || 'Could not load document.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-navy-100 bg-navy-50/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-navy-500">RERA Verification</p>
        <Badge variant={status === 'verified' ? 'success' : status === 'rejected' ? 'error' : 'warning'}>
          {RERA_STATUS_LABEL[status]}
        </Badge>
      </div>
      {status === 'rejected' && agent.rera_rejection_reason && (
        <p className="text-xs text-error-600 mb-3">Reason: {agent.rera_rejection_reason}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {agent.rera_document_url && (
          <Button size="sm" variant="ghost" onClick={viewDocument} loading={busy}>
            View Document
          </Button>
        )}
        {status !== 'verified' && (
          <Button size="sm" variant="secondary" onClick={() => run('verify')} loading={busy}>
            Verify RERA
          </Button>
        )}
        {status !== 'rejected' && !showReject && (
          <Button size="sm" variant="ghost" className="text-error-600" onClick={() => setShowReject(true)}>
            Reject RERA
          </Button>
        )}
      </div>
      {showReject && (
        <div className="mt-3 space-y-2">
          <Textarea
            label="Rejection reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="E.g. RERA number does not match the submitted document."
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" disabled={!reason.trim()} onClick={() => run('reject', { reason })} loading={busy}>
              Confirm Rejection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {docUrl && (
        <Modal open onClose={() => setDocUrl(null)} title="RERA Document" size="lg">
          {docUrl.toLowerCase().split('?')[0].endsWith('.pdf') ? (
            <iframe src={docUrl} className="w-full h-[70vh]" title="RERA Document" />
          ) : (
            <img src={docUrl} alt="RERA Document" className="max-w-full max-h-[70vh] object-contain mx-auto" />
          )}
        </Modal>
      )}
    </div>
  );
}

export function AdminAgents() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'agent' as 'agent' | 'builder',
    license_number: '',
    company: '',
    specialization: '',
    avatar_url: '',
  });
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    status: 'active',
    license_number: '',
    company: '',
    specialization: '',
    avatar_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const realtimeTick = useRealtimeCount('profiles');
  const requestsRealtimeTick = useRealtimeCount('agent_requests');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-agents', realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['agent', 'builder'])
        .order('created_at', { ascending: false });
      if (error) console.error('Error fetching agents:', error);
      return (data ?? []) as Profile[];
    },
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ['agent-requests-pending', requestsRealtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) console.error('Error fetching agent requests:', error);
      return (data ?? []) as {
        id: string;
        mobile: string;
        full_name: string | null;
        requested_role: 'agent' | 'builder';
        created_at: string;
      }[];
    },
  });

  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const approveRequest = (req: { id: string; mobile: string; full_name: string | null; requested_role: 'agent' | 'builder' }) => {
    const [first, ...rest] = (req.full_name ?? '').trim().split(/\s+/).filter(Boolean);
    setForm((f) => ({
      ...f,
      phone: req.mobile,
      first_name: first ?? '',
      last_name: rest.join(' '),
      role: req.requested_role,
    }));
    setShowCreate(true);
  };

  const rejectRequest = async (requestId: string) => {
    setReviewingId(requestId);
    try {
      const { error: reviewError } = await supabase.functions.invoke('otp-auth', {
        body: { requestId, decision: 'rejected' },
        headers: { 'x-action': 'review-agent-request' },
      });
      if (reviewError) throw reviewError;
      queryClient.invalidateQueries({ queryKey: ['agent-requests-pending'] });
      toast.addToast('success', 'Request rejected');
    } catch (err) {
      toast.addToast('error', err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setReviewingId(null);
    }
  };

  const handleAvatarUpload = async (file: File, isEdit: boolean) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.addToast('error', 'Only JPG, PNG, and WEBP image formats are supported');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.addToast('error', 'Profile image must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);
    const { url, error } = await uploadFile('profile-images', file);
    if (error || !url) {
      toast.addToast('error', error || 'Failed to upload profile image');
    } else {
      if (isEdit) {
        setEditForm((f) => ({ ...f, avatar_url: url }));
      } else {
        setForm((f) => ({ ...f, avatar_url: url }));
      }
      toast.addToast('success', 'Profile image uploaded successfully');
    }
    setUploadingAvatar(false);
  };

  const createAgent = async () => {
    if (!form.phone) {
      toast.addToast('error', 'Mobile number is required');
      return;
    }
    setCreating(true);
    try {
      const { data: provisionData, error: provisionError } = await supabase.functions.invoke('otp-auth', {
        body: { phone: form.phone, role: form.role, first_name: form.first_name, last_name: form.last_name },
        headers: { 'x-action': 'admin-provision' },
      });
      if (provisionError) throw provisionError;
      const agentId = provisionData?.user_id as string | undefined;
      if (!agentId) throw new Error(provisionData?.error ?? 'Could not provision account');

      // Fill in the remaining profile details the admin-provision action
      // doesn't set (it only creates the auth user + role/name).
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          email: form.email || null,
          license_number: form.license_number,
          company: form.company,
          specialization: form.specialization,
          avatar_url: form.avatar_url || null,
          profile_image_url: form.avatar_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      if (profileError) {
        console.error('Error saving agent profile:', profileError);
        throw profileError;
      }

      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent-requests-pending'] });
      setShowCreate(false);
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: 'agent',
        license_number: '',
        company: '',
        specialization: '',
        avatar_url: '',
      });
      toast.addToast(
        'success',
        `${form.role === 'builder' ? 'Builder' : 'Agent'} account created — they can now sign in with OTP using this mobile number.`,
      );
    } catch (err) {
      console.error('Failed to create agent:', err);
      toast.addToast('error', err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from('profiles').delete().in('id', ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      setToDelete(null);
      setSelected(new Set());
    },
  });

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        avatar_url: editForm.avatar_url || null,
        profile_image_url: editForm.avatar_url || null,
      };
      const { error } = await supabase.from('profiles').update(payload).eq('id', editing.id);
      if (error) throw error;
      toast.addToast('success', 'Agent profile updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
    } catch (err) {
      toast.addToast('error', err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (p: Profile) => {
    await supabase
      .from('profiles')
      .update({ status: p.status === 'active' ? 'suspended' : 'active' })
      .eq('id', p.id);
    queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
  };

  const columns: Column<Profile>[] = [
    {
      key: 'first_name',
      header: 'Agent',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email}
            src={p.avatar_url || (p as unknown as { profile_image_url?: string }).profile_image_url}
            size={40}
          />
          <div>
            <p className="font-bold text-navy-900">
              {p.first_name} {p.last_name}
            </p>
            <p className="text-xs text-navy-500">{p.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (p) => p.phone ?? '—' },
    {
      key: 'role',
      header: 'Type',
      render: (p) => <Badge variant={p.role === 'builder' ? 'info' : 'default'}>{p.role}</Badge>,
    },
    { key: 'license_number', header: 'License', render: (p) => p.license_number ?? '—' },
    { key: 'company', header: 'Company', render: (p) => p.company ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <Badge variant={p.status === 'active' ? 'success' : 'warning'}>{p.status}</Badge>,
    },
    { key: 'created_at', header: 'Joined', sortable: true, render: (p) => formatDate(p.created_at) },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(p);
              setEditForm({
                first_name: p.first_name ?? '',
                last_name: p.last_name ?? '',
                email: p.email,
                phone: p.phone ?? '',
                status: p.status,
                license_number: p.license_number ?? '',
                company: p.company ?? '',
                specialization: p.specialization ?? '',
                avatar_url: p.avatar_url || (p as unknown as { profile_image_url?: string }).profile_image_url || '',
              });
            }}
            icon={<Edit3 className="h-4 w-4" />}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={p.status === 'active' ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            onClick={() => toggleStatus(p)}
          >
            {p.status === 'active' ? 'Suspend' : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-error-600"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setToDelete(p.id)}
          />
        </div>
      ),
    },
  ];

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:agents', 'Agents')}>
      <PageHeader
        title="Agents & Builders"
        subtitle="Create and manage agent/builder accounts."
        action={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            Create account
          </Button>
        }
      />

      {!!pendingRequests?.length && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning-600" />
            <h3 className="font-bold text-navy-900">Pending access requests</h3>
            <Badge variant="warning">{pendingRequests.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col gap-2 rounded-xl border border-navy-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold text-navy-900">{req.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-navy-500">
                    {req.mobile} · requested as {req.requested_role} · {formatDate(req.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => approveRequest(req)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-error-600"
                    icon={<XCircle className="h-4 w-4" />}
                    loading={reviewingId === req.id}
                    onClick={() => rejectRequest(req.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <BulkActionsBar count={selected.size} onDelete={() => deleteMutation.mutate([...selected])} />
      <DataTable
        columns={columns}
        rows={data ?? []}
        loading={isLoading}
        getRowId={(p) => p.id}
        searchKeys={['first_name', 'last_name', 'email', 'company', 'license_number']}
        selectedIds={selected}
        onToggleSelect={(id) =>
          setSelected((s) => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
          })
        }
        onSelectAll={(ids) =>
          setSelected((s) => {
            const n = new Set(s);
            ids.forEach((id) => (n.has(id) ? n.delete(id) : n.add(id)));
            return n;
          })
        }
      />

      {/* CREATE AGENT MODAL WITH PROFILE IMAGE UPLOAD */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create agent account"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={createAgent} loading={creating}>
              Create agent
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Profile Picture Upload Section */}
          <div className="bg-navy-50/70 p-4 rounded-2xl border border-navy-100 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative shrink-0">
              <Avatar name={`${form.first_name} ${form.last_name}`} src={form.avatar_url} size={72} />
              {form.avatar_url && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, avatar_url: '' }))}
                  className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-error-600 text-white text-xs hover:bg-error-700 shadow"
                  title="Remove image"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="space-y-1 text-center sm:text-left flex-1">
              <label className="label font-bold text-navy-900 text-sm">Agent Profile Picture</label>
              <p className="text-xs text-navy-500">Upload headshot (JPG, PNG, WEBP, max 5MB)</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="file"
                  id="create-agent-avatar"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file, false);
                  }}
                />
                <label
                  htmlFor="create-agent-avatar"
                  className={cn(
                    'cursor-pointer rounded-xl bg-navy-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-navy-800 transition-all inline-flex items-center gap-1.5',
                    uploadingAvatar && 'opacity-50 pointer-events-none',
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{uploadingAvatar ? 'Uploading...' : form.avatar_url ? 'Change Photo' : 'Upload Photo'}</span>
                </label>
                {form.avatar_url && <span className="text-xs text-success-600 font-bold">✓ Uploaded</span>}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Account type"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'agent' | 'builder' }))}
            >
              <option value="agent">Agent</option>
              <option value="builder">Builder</option>
            </Select>
            <Input
              label="First name"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            />
            <Input
              label="Last name"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
            <Input
              label="Email (optional)"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Mobile number"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              hint="They'll sign in via OTP using this number."
            />
            <Input
              label="License number"
              value={form.license_number}
              onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
            />
            <Input
              label="Company"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
            <Input
              label="Specialization"
              value={form.specialization}
              onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
            />
          </div>
          <p className="mt-3 text-xs text-navy-400">The agent will receive credentials to log into the agent portal.</p>
        </div>
      </Modal>

      {/* EDIT AGENT MODAL WITH PROFILE IMAGE UPLOAD */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit agent profile"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            {/* Profile Picture Upload Section */}
            <div className="bg-navy-50/70 p-4 rounded-2xl border border-navy-100 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative shrink-0">
                <Avatar name={`${editForm.first_name} ${editForm.last_name}`} src={editForm.avatar_url} size={72} />
                {editForm.avatar_url && (
                  <button
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, avatar_url: '' }))}
                    className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-error-600 text-white text-xs hover:bg-error-700 shadow"
                    title="Remove image"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="space-y-1 text-center sm:text-left flex-1">
                <label className="label font-bold text-navy-900 text-sm">Agent Profile Picture</label>
                <p className="text-xs text-navy-500">Update agent headshot (JPG, PNG, WEBP, max 5MB)</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="file"
                    id="edit-agent-avatar"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file, true);
                    }}
                  />
                  <label
                    htmlFor="edit-agent-avatar"
                    className={cn(
                      'cursor-pointer rounded-xl bg-navy-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-navy-800 transition-all inline-flex items-center gap-1.5',
                      uploadingAvatar && 'opacity-50 pointer-events-none',
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>
                      {uploadingAvatar ? 'Uploading...' : editForm.avatar_url ? 'Replace Photo' : 'Upload Photo'}
                    </span>
                  </label>
                  {editForm.avatar_url && <span className="text-xs text-success-600 font-bold">✓ Photo Uploaded</span>}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                value={editForm.first_name}
                onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
              />
              <Input
                label="Last name"
                value={editForm.last_name}
                onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
              />
              <Input
                label="Email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="License number"
                value={editForm.license_number}
                onChange={(e) => setEditForm((f) => ({ ...f, license_number: e.target.value }))}
              />
              <Input
                label="Company"
                value={editForm.company}
                onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
              />
              <Input
                label="Specialization"
                value={editForm.specialization}
                onChange={(e) => setEditForm((f) => ({ ...f, specialization: e.target.value }))}
              />
              <Select
                label="Status"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
            </div>

            {editing.role === 'agent' && <RERAVerificationPanel agent={editing} />}
          </div>
        )}
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete agent"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => toDelete && deleteMutation.mutate([toDelete])}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">This will permanently delete the agent account.</p>
      </Modal>
    </DashboardLayout>
  );
}

export function AdminBlogs() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<{
    id?: string;
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    cover_image: string;
    tags: string;
    published: boolean;
    category: string;
    author_id: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const realtimeTick = useRealtimeCount('blogs');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blogs', realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching admin blogs:', error);
      }
      return data ?? [];
    },
  });

  useQuery({
    queryKey: ['admin-profiles-for-blogs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('role', ['admin', 'agent'])
        .order('first_name');
      setProfiles((data ?? []) as unknown as Profile[]);
      return data;
    },
  });

  const openNew = () => {
    setEditing({
      title: '',
      slug: '',
      excerpt: '',
      body: '',
      cover_image: '',
      tags: '',
      published: true,
      category: 'General',
      author_id: user?.id ?? '',
    });
    setShowEdit(true);
    setPreview(false);
  };

  const openEdit = (b: Record<string, unknown>) => {
    setEditing({
      id: b.id as string,
      title: b.title as string,
      slug: b.slug as string,
      excerpt: (b.excerpt as string) ?? '',
      body: b.body as string,
      cover_image: (b.cover_image as string) ?? '',
      tags: ((b.tags as string[]) ?? []).join(', '),
      published: Boolean(b.published),
      category: (b.category as string) ?? 'General',
      author_id: (b.author_id as string) ?? user?.id ?? '',
    });
    setShowEdit(true);
    setPreview(false);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const { url, error } = await uploadFile('blog-images', file);
    if (!error && url) setEditing((ed) => (ed ? { ...ed, cover_image: url } : null));
    setUploading(false);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.addToast('error', 'Blog Title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: editing.title,
        slug:
          editing.slug ||
          editing.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        excerpt: editing.excerpt,
        body: editing.body,
        cover_image: editing.cover_image || null,
        tags: editing.tags
          ? editing.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        published: editing.published,
        published_at: editing.published ? new Date().toISOString() : null,
        category: editing.category,
        author_id: editing.author_id || user?.id || null,
      };

      if (editing.id) {
        const { error } = await supabase.from('blogs').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blogs').insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      queryClient.invalidateQueries({ queryKey: ['home-blogs'] });

      setShowEdit(false);
      setPreview(false);
      toast.addToast('success', 'Blog saved & updated live!');
    } catch (err) {
      console.error('Blog save error:', err);
      toast.addToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (b: Record<string, unknown>) => {
    const isNowPublished = !b.published;
    try {
      const { error } = await supabase
        .from('blogs')
        .update({
          published: isNowPublished,
          published_at: isNowPublished ? new Date().toISOString() : b.published_at,
        })
        .eq('id', b.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      queryClient.invalidateQueries({ queryKey: ['home-blogs'] });
      toast.addToast('success', isNowPublished ? 'Blog is now Live on site!' : 'Blog changed to Draft');
    } catch (err) {
      toast.addToast('error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this blog post?')) return;
    const { error } = await supabase.from('blogs').delete().eq('id', id);
    if (error) {
      toast.addToast('error', error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
    queryClient.invalidateQueries({ queryKey: ['blogs'] });
    queryClient.invalidateQueries({ queryKey: ['home-blogs'] });
    toast.addToast('success', 'Blog deleted');
  };

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:blogs', 'Blogs')}>
      <PageHeader
        title="Blog posts"
        subtitle="Manage your content marketing & live posts."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
            New post
          </Button>
        }
      />
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <Card className="divide-y divide-navy-50">
          {data.map((b) => (
            <div key={b.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3">
              <div className="flex items-center gap-3">
                {b.cover_image ? (
                  <img
                    src={b.cover_image}
                    alt=""
                    className="h-12 w-16 rounded-lg object-cover border border-navy-100"
                  />
                ) : (
                  <div className="h-12 w-16 rounded-lg bg-navy-100 flex items-center justify-center text-navy-400 text-xs font-bold">
                    No Image
                  </div>
                )}
                <div>
                  <p className="font-bold text-navy-900 text-base">{b.title}</p>
                  <p className="text-xs text-navy-500">
                    /{b.slug} · {b.category ?? 'General'} · {formatDate(b.published_at ?? b.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => togglePublish(b)}
                  className="cursor-pointer"
                  title="Click to toggle Live/Draft"
                >
                  <Badge variant={b.published ? 'success' : 'default'}>
                    {b.published ? 'Live (Published)' : 'Draft'}
                  </Badge>
                </button>
                <Link to={`/blog/${b.slug}`} target="_blank">
                  <Button size="sm" variant="ghost" icon={<ExternalLink className="h-4 w-4" />} title="View Live" />
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Edit3 className="h-4 w-4" />}
                  onClick={() => openEdit(b)}
                  title="Edit Post"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-error-600"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => del(b.id)}
                  title="Delete Post"
                />
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No blog posts"
            description="Create your first post."
            action={
              <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>
                New post
              </Button>
            }
          />
        </Card>
      )}

      <Modal
        open={showEdit}
        onClose={() => {
          setShowEdit(false);
          setPreview(false);
        }}
        title={editing?.id ? 'Edit post' : 'New post'}
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowEdit(false);
                setPreview(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Title"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <Input
                label="Slug"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="auto-generated"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Category"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              >
                {['General', 'Market Updates', 'Tips & Advice', 'News'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select
                label="Author"
                value={editing.author_id}
                onChange={(e) => setEditing({ ...editing, author_id: e.target.value })}
              >
                <option value="">Select author</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.email})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="label">Cover image</label>
              {editing.cover_image && (
                <img src={editing.cover_image} alt="" className="mb-2 h-24 w-full rounded object-cover" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
                className="text-sm text-navy-500 file:mr-2 file:rounded file:border-0 file:bg-navy-700 file:px-3 file:py-1.5 file:text-white"
              />
            </div>
            <Input
              label="Tags (comma separated)"
              value={editing.tags}
              onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
            />
            <Input
              label="Excerpt"
              value={editing.excerpt}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
            />
            <div>
              <label className="label">Body (supports markdown)</label>
              <div className="mb-2 flex gap-2">
                <Button size="sm" variant={preview ? 'primary' : 'ghost'} onClick={() => setPreview(false)}>
                  Edit
                </Button>
                <Button size="sm" variant={preview ? 'ghost' : 'primary'} onClick={() => setPreview(true)}>
                  Preview
                </Button>
              </div>
              {preview ? (
                <div className="rounded-lg border border-navy-200 p-4 min-h-[200px] prose max-w-none">
                  {editing.body.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) return <h1 key={i}>{line.slice(2)}</h1>;
                    if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
                    if (line.startsWith('- ')) return <li key={i}>{line.slice(2)}</li>;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              ) : (
                <textarea
                  className="input min-h-[200px] font-mono text-sm"
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.published}
                onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                className="rounded border-navy-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
              />{' '}
              Publish immediately
            </label>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

type MasterTab = 'cities' | 'localities' | 'types' | 'amenities' | 'statuses' | 'furnishing' | 'lead_sources' | 'builders';

const MASTER_TABS: { key: MasterTab; label: string; subtitle: string }[] = [
  { key: 'cities', label: 'Cities & States', subtitle: 'Manage operating cities and state locations' },
  { key: 'localities', label: 'Localities & Areas', subtitle: 'Manage neighborhoods, localities, and pin codes' },
  { key: 'types', label: 'Property Types', subtitle: 'Manage property categories (Residential, Commercial, PG, Land)' },
  { key: 'amenities', label: 'Amenities & Features', subtitle: 'Manage lifestyle amenities and property features' },
  { key: 'statuses', label: 'Construction Statuses', subtitle: 'Manage project stages (Ready to Move, Under Construction, etc.)' },
  { key: 'furnishing', label: 'Furnishing Types', subtitle: 'Manage furnishing status options' },
  { key: 'lead_sources', label: 'Lead Channels', subtitle: 'Manage lead acquisition channels & referral sources' },
  { key: 'builders', label: 'Builders & Developers', subtitle: 'Manage builder directory and developer branding' },
];

export function AdminMasterData() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MasterTab>('cities');
  const [newName, setNewName] = useState('');
  const [extra, setExtra] = useState('');
  const [extra2, setExtra2] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Custom static initial fallbacks for business flow tabs if DB table empty
  const [customStatuses, setCustomStatuses] = useState([
    { id: 'st-1', name: 'Ready to Move', category: 'Immediate Possession' },
    { id: 'st-2', name: 'Under Construction', category: 'Possession in 1-3 Years' },
    { id: 'st-3', name: 'New Launch', category: 'Upcoming Project' },
    { id: 'st-4', name: 'Resale', category: 'Secondary Market' },
    { id: 'st-5', name: 'Under Renovation', category: 'Refurbishing' },
  ]);

  const [customFurnishing, setCustomFurnishing] = useState([
    { id: 'fr-1', name: 'Fully Furnished', category: 'Includes Furniture & Appliances' },
    { id: 'fr-2', name: 'Semi-Furnished', category: 'Includes Wardrobes & Lights' },
    { id: 'fr-3', name: 'Unfurnished', category: 'Bare Shell Structure' },
  ]);

  const [customLeadSources, setCustomLeadSources] = useState([
    { id: 'ls-1', name: 'Website Direct Inquiry', category: 'Organic Web' },
    { id: 'ls-2', name: 'WhatsApp AI Assistant', category: 'Chatbot Automated' },
    { id: 'ls-3', name: 'Google Search PPC', category: 'Paid Performance' },
    { id: 'ls-4', name: 'Facebook & Instagram Campaign', category: 'Social Media' },
    { id: 'ls-5', name: 'Agent Network Referral', category: 'Partner Network' },
    { id: 'ls-6', name: 'Direct Telecalling Walk-in', category: 'Offline Sales' },
  ]);

  // DB Queries for dynamic master tables
  const { data: cities } = useQuery({
    queryKey: ['admin-cities', search],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('*').ilike('name', `%${search}%`).order('name');
      return data ?? [];
    },
    enabled: tab === 'cities',
  });

  const { data: localities } = useQuery({
    queryKey: ['admin-localities', search],
    queryFn: async () => {
      const { data } = await supabase.from('localities').select('*, cities(name)').ilike('name', `%${search}%`).order('name');
      return data ?? [];
    },
    enabled: tab === 'localities',
  });

  const { data: types } = useQuery({
    queryKey: ['admin-ptypes', search],
    queryFn: async () => {
      const { data } = await supabase.from('property_types').select('*').ilike('name', `%${search}%`).order('name');
      return data ?? [];
    },
    enabled: tab === 'types',
  });

  const { data: amenities } = useQuery({
    queryKey: ['admin-amenities', search],
    queryFn: async () => {
      const { data } = await supabase.from('amenities').select('*').ilike('name', `%${search}%`).order('name');
      return data ?? [];
    },
    enabled: tab === 'amenities',
  });

  const { data: builders } = useQuery({
    queryKey: ['admin-builders', search],
    queryFn: async () => {
      const { data } = await supabase.from('builders').select('*').ilike('name', `%${search}%`).order('name');
      return data ?? [];
    },
    enabled: tab === 'builders',
  });

  // Calculate items based on current tab
  const getItems = () => {
    let raw: Array<Record<string, unknown>> = [];
    if (tab === 'cities') raw = (cities || []) as Array<Record<string, unknown>>;
    else if (tab === 'localities') raw = (localities || []) as Array<Record<string, unknown>>;
    else if (tab === 'types') raw = (types || []) as Array<Record<string, unknown>>;
    else if (tab === 'amenities') raw = (amenities || []) as Array<Record<string, unknown>>;
    else if (tab === 'builders') raw = (builders || []) as Array<Record<string, unknown>>;
    else if (tab === 'statuses') raw = customStatuses as Array<Record<string, unknown>>;
    else if (tab === 'furnishing') raw = customFurnishing as Array<Record<string, unknown>>;
    else if (tab === 'lead_sources') raw = customLeadSources as Array<Record<string, unknown>>;

    if (search.trim()) {
      const s = search.toLowerCase();
      raw = raw.filter((i) => String(i.name || '').toLowerCase().includes(s) || String(i.category || i.state || '').toLowerCase().includes(s));
    }
    return raw;
  };

  const items = getItems();
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  const add = async () => {
    if (!newName.trim()) return;
    if (tab === 'cities') {
      await supabase.from('cities').insert({ name: newName, state: extra || null, country: 'India' });
      queryClient.invalidateQueries({ queryKey: ['admin-cities'] });
    } else if (tab === 'localities') {
      const selectedCityId = extra || (cities && cities[0]?.id);
      await supabase.from('localities').insert({ name: newName, city_id: selectedCityId, pincode: extra2 || null });
      queryClient.invalidateQueries({ queryKey: ['admin-localities'] });
    } else if (tab === 'types') {
      await supabase.from('property_types').insert({
        name: newName,
        category: (extra || 'Residential') as 'Residential' | 'Commercial' | 'Plot' | 'Luxury',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-ptypes'] });
    } else if (tab === 'amenities') {
      await supabase.from('amenities').insert({ name: newName });
      queryClient.invalidateQueries({ queryKey: ['admin-amenities'] });
    } else if (tab === 'builders') {
      await supabase.from('builders').insert({
        name: newName,
        established_year: extra ? Number(extra) : null,
        logo_url: extra2?.trim() || null,
        status: 'approved',
        public_visible: true,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-builders'] });
      queryClient.invalidateQueries({ queryKey: ['home-top-builders-dynamic'] });
    } else if (tab === 'statuses') {
      setCustomStatuses((prev) => [...prev, { id: `st-${Date.now()}`, name: newName, category: extra || 'General Stage' }]);
    } else if (tab === 'furnishing') {
      setCustomFurnishing((prev) => [...prev, { id: `fr-${Date.now()}`, name: newName, category: extra || 'General Option' }]);
    } else if (tab === 'lead_sources') {
      setCustomLeadSources((prev) => [...prev, { id: `ls-${Date.now()}`, name: newName, category: extra || 'Channel Source' }]);
    }

    setNewName('');
    setExtra('');
    setExtra2('');
  };

  const remove = async (id: string) => {
    if (tab === 'cities') {
      await supabase.from('cities').delete().eq('id', id);
      queryClient.invalidateQueries({ queryKey: ['admin-cities'] });
    } else if (tab === 'localities') {
      await supabase.from('localities').delete().eq('id', id);
      queryClient.invalidateQueries({ queryKey: ['admin-localities'] });
    } else if (tab === 'types') {
      await supabase.from('property_types').delete().eq('id', id);
      queryClient.invalidateQueries({ queryKey: ['admin-ptypes'] });
    } else if (tab === 'amenities') {
      await supabase.from('amenities').delete().eq('id', id);
      queryClient.invalidateQueries({ queryKey: ['admin-amenities'] });
    } else if (tab === 'builders') {
      await supabase.from('builders').delete().eq('id', id);
      queryClient.invalidateQueries({ queryKey: ['admin-builders'] });
    } else if (tab === 'statuses') {
      setCustomStatuses((prev) => prev.filter((i) => i.id !== id));
    } else if (tab === 'furnishing') {
      setCustomFurnishing((prev) => prev.filter((i) => i.id !== id));
    } else if (tab === 'lead_sources') {
      setCustomLeadSources((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);
  const currentTabObj = MASTER_TABS.find((t) => t.key === tab) || MASTER_TABS[0];

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:masterData', 'Master Data')}>
      <PageHeader
        title="Master Data Management"
        subtitle={currentTabObj.subtitle}
      />

      {/* Scrollable Master Data Tabs Row */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {MASTER_TABS.map((tItem) => (
          <button
            key={tItem.key}
            onClick={() => {
              setTab(tItem.key);
              setPage(1);
              setSearch('');
              setNewName('');
              setExtra('');
              setExtra2('');
            }}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border',
              tab === tItem.key
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300',
            )}
          >
            {tItem.label}
          </button>
        ))}
      </div>

      <Card className="p-5 rounded-2xl shadow-sm border border-slate-200">
        {/* Search Bar */}
        <div className="mb-4">
          <Input
            placeholder={`Search ${currentTabObj.label.toLowerCase()}...`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-sm rounded-xl text-xs"
          />
        </div>

        {/* Add Entry Input Form Bar */}
        <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-3">
          <Input
            placeholder={
              tab === 'cities'
                ? 'City name (e.g. Hyderabad)'
                : tab === 'localities'
                  ? 'Locality name (e.g. Gachibowli)'
                  : tab === 'types'
                    ? 'Property type name (e.g. PG / Co-Living)'
                    : tab === 'amenities'
                      ? 'Amenity name (e.g. EV Charging Station)'
                      : tab === 'statuses'
                        ? 'Status name (e.g. Under Renovation)'
                        : tab === 'furnishing'
                          ? 'Furnishing name (e.g. Semi-Furnished)'
                          : tab === 'lead_sources'
                            ? 'Channel name (e.g. Instagram Ads)'
                            : 'Developer name (e.g. Prestige Group)'
            }
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded-xl text-xs bg-white"
          />

          {tab === 'cities' && (
            <Input
              placeholder="State (e.g. Telangana)"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className="sm:max-w-[200px] rounded-xl text-xs bg-white"
            />
          )}

          {tab === 'localities' && (
            <>
              <Select
                value={extra || (cities?.[0]?.id || '')}
                onChange={(e) => setExtra(e.target.value)}
                className="sm:max-w-[180px] rounded-xl text-xs bg-white"
              >
                {cities?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Pincode (e.g. 500032)"
                value={extra2}
                onChange={(e) => setExtra2(e.target.value)}
                className="sm:max-w-[140px] rounded-xl text-xs bg-white"
              />
            </>
          )}

          {tab === 'types' && (
            <Select
              value={extra || 'Residential'}
              onChange={(e) => setExtra(e.target.value)}
              className="sm:max-w-[200px] rounded-xl text-xs bg-white"
            >
              {['Residential', 'Commercial', 'PG / Co-Living', 'Plot', 'Luxury', 'Industrial'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}

          {(tab === 'statuses' || tab === 'furnishing' || tab === 'lead_sources') && (
            <Input
              placeholder="Category / Description"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className="sm:max-w-[220px] rounded-xl text-xs bg-white"
            />
          )}

          {tab === 'builders' && (
            <>
              <Input
                placeholder="Est. Year (e.g. 1995)"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                className="sm:max-w-[140px] rounded-xl text-xs bg-white"
              />
              <Input
                placeholder="Logo URL (e.g. /builders/prestige.svg)"
                value={extra2}
                onChange={(e) => setExtra2(e.target.value)}
                className="sm:max-w-[240px] rounded-xl text-xs bg-white"
              />
            </>
          )}

          <Button
            onClick={add}
            icon={<Plus className="h-4 w-4" />}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-red-600/20"
          >
            Add Item
          </Button>
        </div>

        {/* Items List Table */}
        <div className="divide-y divide-slate-100">
          {pageItems.map((item) => {
            const cityName = tab === 'localities' && (item as any).cities?.name ? (item as any).cities.name : null;
            return (
              <div key={String(item.id)} className="flex items-center justify-between py-3 px-2 hover:bg-slate-50/80 rounded-xl transition-colors">
                <div>
                  {tab === 'builders' ? (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                        {item.logo_url ? (
                          <img src={String(item.logo_url)} alt="" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <Building2 className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{String(item.name)}</p>
                        <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-2">
                          {item.established_year ? `Est. ${item.established_year}` : 'Verified Developer'}
                          <span>•</span>
                          <a
                            href={`/builders/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-600 hover:underline font-bold"
                          >
                            View Landing Page ↗
                          </a>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-black">{String(item.name)}</p>
                      {tab === 'cities' && item.state ? (
                        <p className="text-[11px] font-semibold text-slate-400">{String(item.state)}, India</p>
                      ) : null}
                      {tab === 'localities' ? (
                        <p className="text-[11px] font-semibold text-slate-400">
                          {cityName ? `City: ${cityName}` : ''} {item.pincode ? `• PIN: ${item.pincode}` : ''}
                        </p>
                      ) : null}
                      {tab === 'types' && item.category ? (
                        <p className="text-[11px] font-semibold text-red-600">{String(item.category)}</p>
                      ) : null}
                      {(tab === 'statuses' || tab === 'furnishing' || tab === 'lead_sources') && item.category ? (
                        <p className="text-[11px] font-semibold text-slate-400">{String(item.category)}</p>
                      ) : null}
                    </>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg p-1.5"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => remove(String(item.id))}
                />
              </div>
            );
          })}
          {pageItems.length === 0 && (
            <p className="py-8 text-center text-xs font-semibold text-slate-400">No master data entries found for {currentTabObj.label}.</p>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="text-slate-500 font-medium">
              Page {page} of {totalPages} ({items.length} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs font-bold rounded-lg"
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs font-bold rounded-lg"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}


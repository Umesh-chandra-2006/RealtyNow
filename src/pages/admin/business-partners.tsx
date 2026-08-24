import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Handshake, Users, ShieldCheck, ShieldOff, Building2, Phone, Mail, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Button, Badge, EmptyState, Skeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { DataTable, type Column } from '../../components/data-table';
import { formatDate } from '../../lib/utils';
import { PartnerDetailDrawer } from '../../components/admin/PartnerDetailDrawer';
import { ApplicationReviewDrawer } from '../../components/admin/ApplicationReviewDrawer';
import type { Partner, PartnerApplication } from '../../lib/types';

const PENDING_APPLICATION_STATUSES = ['submitted', 'pending_review', 'document_verification', 'final_review'];

function PendingApplicationsPanel({
  applications,
  isLoading,
  onReview,
}: {
  applications: PartnerApplication[];
  isLoading: boolean;
  onReview: (a: PartnerApplication) => void;
}) {
  if (isLoading) return <Skeleton className="h-24 rounded-2xl mb-6" />;
  if (applications.length === 0) return null;

  return (
    <Card className="p-5 mb-6 border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-amber-600" />
        <h3 className="font-display text-sm font-bold text-navy-900">
          {applications.length} Pending Application{applications.length === 1 ? '' : 's'} Awaiting Review
        </h3>
      </div>
      <p className="text-xs text-navy-500 mb-4">
        These have been submitted but not yet approved, so they don't appear in the list below — a partner only appears here once approved.
      </p>
      <div className="space-y-2">
        {applications.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-navy-100/70 px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy-900 truncate">{a.full_name} <span className="text-navy-400 font-normal">— {a.company_name ?? a.partner_type}</span></p>
              <p className="text-[11px] font-mono text-navy-400">{a.application_number} • {a.mobile_number} • {formatDate(a.created_at)}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onReview(a)}>Review</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PartnerRow({ p, onView, onToggleStatus, busy }: {
  p: Partner;
  onView: (p: Partner) => void;
  onToggleStatus: (p: Partner) => void;
  busy: boolean;
}) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between min-h-[260px]">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-[11px] font-medium text-slate-400">
            {p.approved_at ? `Since ${formatDate(p.approved_at)}` : ''}
          </span>
          <Badge variant={p.status === 'active' ? 'success' : 'error'}>{p.status}</Badge>
        </div>
        <div className="flex items-start gap-3.5 mb-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-100 flex items-center justify-center shrink-0">
            <Handshake className="h-6 w-6 text-slate-600" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h4 className="font-bold text-slate-900 text-base leading-snug truncate">{p.full_name}</h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{p.partner_type ?? '—'}</p>
            <p className="text-[11px] font-mono text-slate-400 mt-1">{p.partner_code}</p>
          </div>
        </div>
        <div className="space-y-2 text-xs text-slate-600 mb-5">
          <div className="flex items-center gap-2.5"><Phone className="h-3.5 w-3.5 text-slate-500" /> {p.mobile_number}</div>
          {p.email && <div className="flex items-center gap-2.5"><Mail className="h-3.5 w-3.5 text-slate-500" /> {p.email}</div>}
          {p.company_name && <div className="flex items-center gap-2.5"><Building2 className="h-3.5 w-3.5 text-slate-500" /> {p.company_name}</div>}
        </div>
      </div>
      <div className="mt-auto pt-1 flex gap-2">
        <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => onView(p)}>View</Button>
        <Button
          size="sm"
          variant="ghost"
          icon={p.status === 'active' ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          disabled={busy}
          onClick={() => onToggleStatus(p)}
        >
          {p.status === 'active' ? 'Suspend' : 'Reactivate'}
        </Button>
      </div>
    </div>
  );
}

export function AdminBusinessPartners() {
  const [viewing, setViewing] = useState<Partner | null>(null);
  const [reviewing, setReviewing] = useState<PartnerApplication | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-business-partners'],
    queryFn: async () => {
      const { data } = await supabase.from('partners').select('*').order('created_at', { ascending: false });
      return (data ?? []) as Partner[];
    },
  });

  const { data: pendingApplicationsData, isLoading: pendingLoading } = useQuery({
    queryKey: ['admin-pending-partner-applications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('partner_applications')
        .select('*')
        .in('status', PENDING_APPLICATION_STATUSES)
        .order('created_at', { ascending: false });
      return (data ?? []) as PartnerApplication[];
    },
  });
  const pendingApplications = pendingApplicationsData ?? [];

  const partners = data ?? [];
  const activeCount = partners.filter((p) => p.status === 'active').length;
  const suspendedCount = partners.filter((p) => p.status === 'suspended').length;

  const toggleStatus = async (p: Partner) => {
    if (!p.application_id) {
      addToast('error', 'This partner has no linked application record.');
      return;
    }
    setTogglingId(p.id);
    try {
      const action = p.status === 'active' ? 'suspend' : 'reactivate';
      const { data, error } = await supabase.functions.invoke('process-application', {
        body: { application_id: p.application_id, type: 'partner', action },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      addToast('success', action === 'suspend' ? 'Partner suspended.' : 'Partner reactivated.');
      queryClient.invalidateQueries({ queryKey: ['admin-business-partners'] });
    } catch (e: any) {
      addToast('error', e?.message || 'Failed to update partner status.');
    } finally {
      setTogglingId(null);
    }
  };

  const columns: Column<Partner>[] = [
    {
      key: 'full_name',
      header: 'Partner',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-navy-100 grid place-items-center shrink-0">
            <Handshake className="h-4 w-4 text-navy-500" />
          </div>
          <div>
            <p className="font-medium text-navy-900">{p.full_name}</p>
            <p className="text-xs text-navy-500 font-mono">{p.partner_code}</p>
          </div>
        </div>
      ),
    },
    { key: 'company_name', header: 'Company', render: (p) => <span className="text-sm">{p.company_name ?? '—'}</span> },
    { key: 'partner_type', header: 'Type', render: (p) => <span className="text-sm">{p.partner_type ?? '—'}</span> },
    { key: 'mobile_number', header: 'Mobile', render: (p) => <span className="text-sm">{p.mobile_number}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (p) => <Badge variant={p.status === 'active' ? 'success' : 'error'}>{p.status}</Badge> },
    { key: 'created_at', header: 'Joined', sortable: true, render: (p) => <span className="text-sm text-navy-500">{formatDate(p.created_at)}</span> },
    {
      key: 'id',
      header: '',
      render: (p) => (
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewing(p)}>View</Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={togglingId === p.id}
            onClick={() => toggleStatus(p)}
          >
            {p.status === 'active' ? 'Suspend' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout sections={adminSections} title="Business Partners">
      <PageHeader
        title="Business Partners"
        subtitle="Manage approved RealtyNow business partners"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Business Partner', to: '/admin/business-partners' },
          { label: 'Applications & Partners' },
        ]}
      />

      <PendingApplicationsPanel
        applications={pendingApplications}
        isLoading={pendingLoading}
        onReview={(a) => setReviewing(a)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Partners</p>
          <p className="font-display text-3xl font-bold text-slate-900 mt-2">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Suspended</p>
          <p className="font-display text-3xl font-bold text-slate-900 mt-2">{suspendedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Partners</p>
          <p className="font-display text-3xl font-bold text-slate-900 mt-2">{partners.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : partners.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-navy-400" />}
          title="No business partners yet"
          description="Approved partner applications will appear here."
        />
      ) : (
        <Card>
          <DataTable
            rows={partners}
            columns={columns as any}
            getRowId={(r: any) => r.id}
            searchable
            searchPlaceholder="Search by name, mobile, company..."
            cardRender={(row) => (
              <PartnerRow p={row as Partner} onView={(p) => setViewing(p)} onToggleStatus={toggleStatus} busy={togglingId === (row as Partner).id} />
            )}
          />
        </Card>
      )}

      {viewing && (
        <PartnerDetailDrawer
          open={!!viewing}
          onClose={() => {
            setViewing(null);
            queryClient.invalidateQueries({ queryKey: ['admin-business-partners'] });
          }}
          partner={partners.find((p) => p.id === viewing.id) ?? viewing}
        />
      )}

      {reviewing && (
        <ApplicationReviewDrawer
          open={!!reviewing}
          onClose={() => {
            setReviewing(null);
            queryClient.invalidateQueries({ queryKey: ['admin-pending-partner-applications'] });
            queryClient.invalidateQueries({ queryKey: ['admin-business-partners'] });
          }}
          application={pendingApplications.find((a) => a.id === reviewing.id) ?? reviewing}
          type="partner"
        />
      )}
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Button, Badge, EmptyState, Skeleton } from '../../components/ui';
import { DataTable, type Column } from '../../components/data-table';
import { formatDate, cn } from '../../lib/utils';
import type { AgentApplication, BuilderApplication, PartnerApplication } from '../../lib/types';
import {
  CheckCircle2, Eye, Clock, FileText,
  Building2, User, Phone, Mail, MapPin, Award, BadgeCheck, Calendar, Handshake,
} from 'lucide-react';
import { ApplicationReviewDrawer } from '../../components/admin/ApplicationReviewDrawer';

// ─── Shared status formatter ─────────────────────────────────────────────────
const STATUS_LABEL_KEYS: Record<string, string> = {
  submitted: 'admin.statusSubmittedApp',
  pending_review: 'admin.statusPendingReviewApp',
  document_verification: 'admin.statusDocumentVerification',
  identity_verification: 'admin.statusIdentityVerification',
  rera_verification: 'admin.statusReraVerification',
  background_verification: 'admin.statusBackgroundVerification',
  final_review: 'admin.statusFinalReview',
  approved: 'admin.statusApprovedApp',
  rejected: 'admin.statusRejectedApp',
  pending: 'admin.statusPendingReviewApp',
};

export function formatApplicationStatus(status: string, t?: (key: string, fallback?: string) => string): string {
  const map: Record<string, string> = {
    submitted: 'Submitted',
    pending_review: 'Pending Review',
    document_verification: 'Document Verification',
    identity_verification: 'Identity Verification',
    rera_verification: 'RERA Verification',
    background_verification: 'Background Verification',
    final_review: 'Final Review',
    approved: 'Approved',
    rejected: 'Rejected',
    pending: 'Pending Review',
  };
  const fallback = map[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const key = STATUS_LABEL_KEYS[status];
  return t && key ? t(key, fallback) : fallback;
}

// ─── Shared status badge ──────────────────────────────────────────────────────
export function AppBadge({ status }: { status: string }) {
  const { t } = useLanguageContext();
  const label = formatApplicationStatus(status, t);

  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
        {label}
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
        {label}
      </span>
    );
  }

  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
        {label}
      </span>
    );
  }

  // Pending review & other verification stages
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
      {label}
    </span>
  );
}

// ─── Clickable analytics stat card — drives the ?status= URL filter ──────────
function ClickableStatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  active,
  variant = 'default',
  onClick,
}: {
  label: string;
  value: number;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  variant?: 'default' | 'warning' | 'success';
  onClick: () => void;
}) {
  const iconBg =
    variant === 'warning'
      ? 'bg-amber-50 text-amber-600 border-amber-100'
      : variant === 'success'
        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
        : 'bg-slate-50 text-slate-600 border-slate-100';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`Filter by ${label.toLowerCase()}`}
      className={cn(
        'w-full text-left rounded-2xl border bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer relative overflow-hidden flex flex-col justify-between',
        active
          ? 'border-red-400 ring-2 ring-red-100 bg-gradient-to-br from-white to-red-50/20 shadow-sm'
          : 'border-slate-200/80 hover:border-slate-300',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={cn('h-9 w-9 rounded-full border grid place-items-center shrink-0', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <p className="font-display text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        {sublabel && <p className="text-xs text-slate-500 font-medium mt-1">{sublabel}</p>}
      </div>
      {active && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
      )}
    </button>
  );
}

// ─── Agent Application Card ───────────────────────────────────────────────────
function AgentAppCard({
  app,
  onReview,
}: {
  app: AgentApplication;
  onReview: (a: AgentApplication) => void;
}) {
  const { t } = useLanguageContext();
  const name = `${app.first_name ?? ''} ${app.last_name ?? ''}`.trim() || app.email;
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const status = app.status || 'pending_review';

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5 min-h-[380px]">
      <div>
        {/* Top Bar: Date & Status Badge */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-[11px] font-medium text-slate-400">
            {app.created_at ? t('admin.appliedOn', 'Applied {{date}}').replace('{{date}}', formatDate(app.created_at)) : ''}
          </span>
          <AppBadge status={status} />
        </div>

        {/* Profile Section: Contained Avatar + Name & Designation */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="relative shrink-0">
            {app.profile_image ? (
              <img
                src={app.profile_image}
                alt={name}
                className="h-16 w-16 rounded-full object-cover border-2 border-slate-100 ring-2 ring-slate-100/60 shadow-xs"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-100 ring-2 ring-slate-100/60 shadow-xs flex items-center justify-center">
                <span className="text-slate-700 font-bold text-lg tracking-tight">{initials}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h4 className="font-bold text-slate-900 text-base leading-snug truncate group-hover:text-red-600 transition-colors">
              {name}
            </h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
              {app.specialization ? `${app.specialization} ${t('admin.specialistSuffix', 'Specialist')}` : t('admin.realEstateAgent', 'Real Estate Agent')}
            </p>
            {app.license_number && (
              <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                RERA: {app.license_number}
              </p>
            )}
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full mb-3.5" />

        {/* Contact & Meta rows */}
        <div className="space-y-2 text-xs text-slate-600 mb-5">
          {app.phone && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700">{app.phone}</span>
            </div>
          )}
          {app.email && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700 truncate" title={app.email}>{app.email}</span>
            </div>
          )}
          {app.experience_years != null && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <Award className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700">
                {t('admin.yrsExperience', '{{count}} yrs experience').replace('{{count}}', String(app.experience_years))}
              </span>
            </div>
          )}
          {app.assigned_areas && app.assigned_areas.length > 0 && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700 truncate" title={app.assigned_areas.join(', ')}>
                {app.assigned_areas.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Review Button */}
      <div className="mt-auto pt-1">
        <button
          type="button"
          onClick={() => onReview(app)}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs shadow-2xs hover:border-red-500 hover:text-red-600 hover:bg-red-50/40 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer group/btn"
        >
          <Eye className="h-3.5 w-3.5 text-slate-400 group-hover/btn:text-red-500 transition-colors" />
          <span>{t('admin.reviewApplication', 'Review Application')}</span>
          <span className="text-slate-300 group-hover/btn:text-red-500 group-hover/btn:translate-x-0.5 transition-all font-bold">→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Builder Application Card ─────────────────────────────────────────────────
function BuilderAppCard({
  app,
  onReview,
}: {
  app: BuilderApplication;
  onReview: (a: BuilderApplication) => void;
}) {
  const { t } = useLanguageContext();
  const name = app.company_name || app.contact_name || app.email;
  const status = app.status || 'pending_review';

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5 min-h-[380px]">
      <div>
        {/* Top Bar: Date & Status Badge */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-[11px] font-medium text-slate-400">
            {app.created_at ? t('admin.appliedOn', 'Applied {{date}}').replace('{{date}}', formatDate(app.created_at)) : ''}
          </span>
          <AppBadge status={status} />
        </div>

        {/* Profile Section: Logo + Company Name & Contact */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="relative shrink-0">
            {app.logo_url ? (
              <img
                src={app.logo_url}
                alt={name}
                className="h-16 w-16 rounded-2xl object-cover border-2 border-slate-100 ring-2 ring-slate-100/60 shadow-xs"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-100 ring-2 ring-slate-100/60 shadow-xs flex items-center justify-center">
                <Building2 className="h-7 w-7 text-slate-600" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h4 className="font-bold text-slate-900 text-base leading-snug truncate group-hover:text-red-600 transition-colors">
              {name}
            </h4>
            {app.contact_name && app.company_name && (
              <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                {t('admin.contactLabel', 'Contact:')} {app.contact_name}
              </p>
            )}
            {app.rera_number && (
              <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                RERA: {app.rera_number}
              </p>
            )}
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full mb-3.5" />

        {/* Meta rows */}
        <div className="space-y-2 text-xs text-slate-600 mb-5">
          {app.email && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700 truncate" title={app.email}>{app.email}</span>
            </div>
          )}
          {app.phone && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700">{app.phone}</span>
            </div>
          )}
          {app.city && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700">{app.city}</span>
            </div>
          )}
        </div>
      </div>

      {/* Review Button */}
      <div className="mt-auto pt-1">
        <button
          type="button"
          onClick={() => onReview(app)}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs shadow-2xs hover:border-red-500 hover:text-red-600 hover:bg-red-50/40 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer group/btn"
        >
          <Eye className="h-3.5 w-3.5 text-slate-400 group-hover/btn:text-red-500 transition-colors" />
          <span>{t('admin.reviewApplication', 'Review Application')}</span>
          <span className="text-slate-300 group-hover/btn:text-red-500 group-hover/btn:translate-x-0.5 transition-all font-bold">→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Partner Application Card ─────────────────────────────────────────────────
function PartnerAppCard({
  app,
  onReview,
}: {
  app: PartnerApplication;
  onReview: (a: PartnerApplication) => void;
}) {
  const { t } = useLanguageContext();
  const status = app.status || 'submitted';

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5 min-h-[380px]">
      <div>
        {/* Top Bar: Date & Status Badge */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-[11px] font-medium text-slate-400">
            {app.created_at ? t('admin.appliedOn', 'Applied {{date}}').replace('{{date}}', formatDate(app.created_at)) : ''}
          </span>
          <AppBadge status={status} />
        </div>

        {/* Profile Section: Icon + Partner Name & Type */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-100 ring-2 ring-slate-100/60 shadow-xs flex items-center justify-center">
              <Handshake className="h-7 w-7 text-slate-600" />
            </div>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h4 className="font-bold text-slate-900 text-base leading-snug truncate group-hover:text-red-600 transition-colors">
              {app.full_name}
            </h4>
            {app.partner_type && (
              <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                {app.partner_type}
              </p>
            )}
            {app.application_number && (
              <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                ID: {app.application_number}
              </p>
            )}
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full mb-3.5" />

        {/* Meta rows */}
        <div className="space-y-2 text-xs text-slate-600 mb-5">
          {app.mobile_number && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700">{app.mobile_number}</span>
            </div>
          )}
          {app.email && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700 truncate" title={app.email}>{app.email}</span>
            </div>
          )}
          {app.city && (
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="font-medium text-slate-700">{app.city}{app.state ? `, ${app.state}` : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Review Button */}
      <div className="mt-auto pt-1">
        <button
          type="button"
          onClick={() => onReview(app)}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs shadow-2xs hover:border-red-500 hover:text-red-600 hover:bg-red-50/40 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer group/btn"
        >
          <Eye className="h-3.5 w-3.5 text-slate-400 group-hover/btn:text-red-500 transition-colors" />
          <span>{t('admin.reviewApplication', 'Review Application')}</span>
          <span className="text-slate-300 group-hover/btn:text-red-500 group-hover/btn:translate-x-0.5 transition-all font-bold">→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Admin Agent Applications ─────────────────────────────────────────────────
export function AdminAgentApplications() {
  const [viewing, setViewing] = useState<AgentApplication | null>(null);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const setStatusFilter = (next: string | null) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set('status', next);
      else p.delete('status');
      return p;
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-agent-applications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_applications')
        .select('*')
        .order('created_at', { ascending: false });
      return (data ?? []) as AgentApplication[];
    },
  });

  const applications = data ?? [];

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  const columns: Column<AgentApplication>[] = [
    {
      key: 'first_name',
      header: t('admin.applicantHeader', 'Applicant'),
      sortable: true,
      render: (a) => (
        <div className="flex items-center gap-3">
          {a.profile_image ? (
            <img src={a.profile_image} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-navy-100 grid place-items-center shrink-0">
              <User className="h-4 w-4 text-navy-500" />
            </div>
          )}
          <div>
            <p className="font-medium text-navy-900">{a.first_name} {a.last_name}</p>
            <p className="text-xs text-navy-500">{a.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: t('admin.phoneHeader', 'Phone'), render: (a) => <span className="text-sm">{a.phone}</span> },
    { key: 'specialization', header: t('admin.specializationHeader', 'Specialization'), render: (a) => <span className="text-sm">{a.specialization ?? '—'}</span> },
    { key: 'license_number', header: t('admin.reraHeader', 'RERA'), render: (a) => <span className="text-xs font-mono">{a.license_number ?? '—'}</span> },
    { key: 'status', header: t('admin.stageHeader', 'Stage'), sortable: true, render: (a) => <AppBadge status={a.status || 'pending_review'} /> },
    {
      key: 'created_at',
      header: t('admin.appliedHeader', 'Applied'),
      sortable: true,
      render: (a) => <span className="text-sm text-navy-500">{formatDate(a.created_at)}</span>,
    },
    {
      key: 'id',
      header: '',
      render: (a) => (
        <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewing(a)}>
          {t('admin.review', 'Review')}
        </Button>
      ),
    },
  ];

  const isPending = (a: AgentApplication) => a.status !== 'approved' && a.status !== 'rejected';
  const pendingCount = applications.filter(isPending).length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;

  const filteredApplications =
    statusFilter === 'pending' ? applications.filter(isPending)
    : statusFilter === 'approved' ? applications.filter((a) => a.status === 'approved')
    : applications;

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:agentApps', 'Agent Applications')}>
      <PageHeader
        title={t('admin.agentApplicationsCrmTitle', 'Agent Applications CRM')}
        subtitle={t('admin.agentApplicationsCrmSubtitle', 'Manage and verify agent registration pipeline')}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Agent', to: '/admin/agent-applications' },
          { label: 'Agent Applications' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <ClickableStatCard
          label={t('admin.pendingVerification', 'Pending Verification')}
          value={pendingCount}
          sublabel={t('admin.awaitingReview', 'Awaiting review')}
          icon={Clock}
          variant="warning"
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? null : 'pending')}
        />
        <ClickableStatCard
          label={t('admin.approved', 'Approved')}
          value={approvedCount}
          sublabel={t('admin.successfullyVerified', 'Successfully verified')}
          icon={CheckCircle2}
          variant="success"
          active={statusFilter === 'approved'}
          onClick={() => setStatusFilter(statusFilter === 'approved' ? null : 'approved')}
        />
        <ClickableStatCard
          label={t('admin.totalApplicants', 'Total Applicants')}
          value={applications.length}
          sublabel={t('admin.allApplications', 'All applications')}
          icon={User}
          variant="default"
          active={!statusFilter}
          onClick={() => setStatusFilter(null)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : filteredApplications.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8 text-navy-400" />}
          title={t('admin.noApplicationsTitle', 'No applications')}
          description={
            statusFilter
              ? t('admin.noApplicationsMatchFilter', 'No applications match this filter.')
              : t('admin.agentApplicationsEmptyDesc', 'Agent registration requests will appear here.')
          }
        />
      ) : (
        <Card>
          <DataTable
            rows={filteredApplications}
            columns={columns as any}
            getRowId={(r: any) => r.id}
            searchable
            searchPlaceholder={t('admin.searchAgentApplications', 'Search by name, phone, email, specialization...')}
            cardRender={(row) => (
              <AgentAppCard
                app={row as AgentApplication}
                onReview={(a) => setViewing(a)}
              />
            )}
          />
        </Card>
      )}

      {viewing && (
        <ApplicationReviewDrawer
          open={!!viewing}
          onClose={() => {
            setViewing(null);
            queryClient.invalidateQueries({ queryKey: ['admin-agent-applications'] });
          }}
          application={applications.find((a) => a.id === viewing.id) ?? viewing}
          type="agent"
        />
      )}
    </DashboardLayout>
  );
}

// ─── Admin Builder Applications ───────────────────────────────────────────────
export function AdminBuilderApplications() {
  const [viewing, setViewing] = useState<BuilderApplication | null>(null);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const setStatusFilter = (next: string | null) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set('status', next);
      else p.delete('status');
      return p;
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-builder-applications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('builder_applications')
        .select('*')
        .order('created_at', { ascending: false });
      return (data ?? []) as BuilderApplication[];
    },
  });

  const applications = data ?? [];

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  const columns: Column<BuilderApplication>[] = [
    {
      key: 'company_name',
      header: t('admin.companyHeader', 'Company'),
      sortable: true,
      render: (b) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-navy-100 grid place-items-center shrink-0">
            <Building2 className="h-4 w-4 text-navy-500" />
          </div>
          <div>
            <p className="font-medium text-navy-900">{b.company_name}</p>
            <p className="text-xs text-navy-500">{b.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'contact_name', header: t('admin.contactHeader', 'Contact'), render: (b) => <span className="text-sm">{b.contact_name}</span> },
    { key: 'city', header: t('admin.cityHeader', 'City'), render: (b) => <span className="text-sm">{b.city ?? '—'}</span> },
    { key: 'rera_number', header: t('admin.reraHeader', 'RERA'), render: (b) => <span className="text-xs font-mono">{b.rera_number ?? '—'}</span> },
    { key: 'status', header: t('admin.stageHeader', 'Stage'), sortable: true, render: (b) => <AppBadge status={b.status || 'pending_review'} /> },
    {
      key: 'created_at',
      header: t('admin.appliedHeader', 'Applied'),
      sortable: true,
      render: (b) => <span className="text-sm text-navy-500">{formatDate(b.created_at)}</span>,
    },
    {
      key: 'id',
      header: '',
      render: (b) => (
        <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewing(b)}>
          {t('admin.review', 'Review')}
        </Button>
      ),
    },
  ];

  const isPending = (a: BuilderApplication) => a.status !== 'approved' && a.status !== 'rejected';
  const pendingCount = applications.filter(isPending).length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;

  const filteredApplications =
    statusFilter === 'pending' ? applications.filter(isPending)
    : statusFilter === 'approved' ? applications.filter((a) => a.status === 'approved')
    : applications;

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:builderApps', 'Builder Applications')}>
      <PageHeader
        title={t('admin.builderApplicationsCrmTitle', 'Builder Applications CRM')}
        subtitle={t('admin.builderApplicationsCrmSubtitle', 'Manage builder registration pipeline')}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Builder', to: '/admin/builder-applications' },
          { label: 'Builder Applications' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <ClickableStatCard
          label={t('admin.pendingVerification', 'Pending Verification')}
          value={pendingCount}
          sublabel={t('admin.awaitingReview', 'Awaiting review')}
          icon={Clock}
          variant="warning"
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? null : 'pending')}
        />
        <ClickableStatCard
          label={t('admin.approved', 'Approved')}
          value={approvedCount}
          sublabel={t('admin.successfullyVerified', 'Successfully verified')}
          icon={CheckCircle2}
          variant="success"
          active={statusFilter === 'approved'}
          onClick={() => setStatusFilter(statusFilter === 'approved' ? null : 'approved')}
        />
        <ClickableStatCard
          label={t('admin.totalBuilders', 'Total Builders')}
          value={applications.length}
          sublabel={t('admin.allApplications', 'All applications')}
          icon={Building2}
          variant="default"
          active={!statusFilter}
          onClick={() => setStatusFilter(null)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : filteredApplications.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8 text-navy-400" />}
          title={t('admin.noBuilderApplicationsTitle', 'No builder applications')}
          description={
            statusFilter
              ? t('admin.noApplicationsMatchFilter', 'No applications match this filter.')
              : t('admin.builderApplicationsEmptyDesc', 'Builder registration requests will appear here.')
          }
        />
      ) : (
        <Card>
          <DataTable
            rows={filteredApplications}
            columns={columns as any}
            getRowId={(r: any) => r.id}
            searchable
            searchPlaceholder={t('admin.searchBuilderApplications', 'Search by company, contact, city, RERA...')}
            cardRender={(row) => (
              <BuilderAppCard
                app={row as BuilderApplication}
                onReview={(b) => setViewing(b)}
              />
            )}
          />
        </Card>
      )}

      {viewing && (
        <ApplicationReviewDrawer
          open={!!viewing}
          onClose={() => {
            setViewing(null);
            queryClient.invalidateQueries({ queryKey: ['admin-builder-applications'] });
          }}
          application={applications.find((a) => a.id === viewing.id) ?? viewing}
          type="builder"
        />
      )}
    </DashboardLayout>
  );
}

// ─── Admin Partner Applications ───────────────────────────────────────────────
export function AdminPartnerApplications() {
  const [viewing, setViewing] = useState<PartnerApplication | null>(null);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const setStatusFilter = (next: string | null) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set('status', next);
      else p.delete('status');
      return p;
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-partner-applications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false });
      return (data ?? []) as PartnerApplication[];
    },
  });

  const applications = data ?? [];

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  const columns: Column<PartnerApplication>[] = [
    {
      key: 'full_name',
      header: t('admin.partnerHeader', 'Partner'),
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-navy-100 grid place-items-center shrink-0">
            <Handshake className="h-4 w-4 text-navy-500" />
          </div>
          <div>
            <p className="font-medium text-navy-900">{p.full_name}</p>
            <p className="text-xs text-navy-500">{p.email ?? p.mobile_number}</p>
          </div>
        </div>
      ),
    },
    { key: 'mobile_number', header: t('admin.mobileHeader', 'Mobile'), render: (p) => <span className="text-sm">{p.mobile_number}</span> },
    { key: 'partner_type', header: t('admin.partnerTypeHeader', 'Partner Type'), render: (p) => <span className="text-sm">{p.partner_type ?? '—'}</span> },
    { key: 'company_name', header: t('admin.companyHeader', 'Company'), render: (p) => <span className="text-sm">{p.company_name ?? '—'}</span> },
    { key: 'status', header: t('admin.stageHeader', 'Stage'), sortable: true, render: (p) => <AppBadge status={p.status || 'submitted'} /> },
    {
      key: 'created_at',
      header: t('admin.appliedHeader', 'Applied'),
      sortable: true,
      render: (p) => <span className="text-sm text-navy-500">{formatDate(p.created_at)}</span>,
    },
    {
      key: 'id',
      header: '',
      render: (p) => (
        <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewing(p)}>
          {t('admin.review', 'Review')}
        </Button>
      ),
    },
  ];

  const isPending = (a: PartnerApplication) => a.status !== 'approved' && a.status !== 'rejected';
  const pendingCount = applications.filter(isPending).length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;

  const filteredApplications =
    statusFilter === 'pending' ? applications.filter(isPending)
    : statusFilter === 'approved' ? applications.filter((a) => a.status === 'approved')
    : applications;

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:partnerApps', 'Partner Applications')}>
      <PageHeader
        title={t('admin.partnerApplicationsCrmTitle', 'Partner Applications CRM')}
        subtitle={t('admin.partnerApplicationsCrmSubtitle', 'Manage and verify partner registration pipeline')}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Partner', to: '/admin/partner-applications' },
          { label: 'Partner Applications' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <ClickableStatCard
          label={t('admin.pendingReview', 'Pending Review')}
          value={pendingCount}
          sublabel={t('admin.awaitingReview', 'Awaiting review')}
          icon={Clock}
          variant="warning"
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? null : 'pending')}
        />
        <ClickableStatCard
          label={t('admin.approved', 'Approved')}
          value={approvedCount}
          sublabel={t('admin.successfullyVerified', 'Successfully verified')}
          icon={CheckCircle2}
          variant="success"
          active={statusFilter === 'approved'}
          onClick={() => setStatusFilter(statusFilter === 'approved' ? null : 'approved')}
        />
        <ClickableStatCard
          label={t('admin.totalPartners', 'Total Partners')}
          value={applications.length}
          sublabel={t('admin.allApplications', 'All applications')}
          icon={Handshake}
          variant="default"
          active={!statusFilter}
          onClick={() => setStatusFilter(null)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : filteredApplications.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-8 w-8 text-navy-400" />}
          title={t('admin.noPartnerApplicationsTitle', 'No partner applications')}
          description={
            statusFilter
              ? t('admin.noApplicationsMatchFilter', 'No applications match this filter.')
              : t('admin.partnerApplicationsEmptyDesc', 'Partner registration requests will appear here.')
          }
        />
      ) : (
        <Card>
          <DataTable
            rows={filteredApplications}
            columns={columns as any}
            getRowId={(r: any) => r.id}
            searchable
            searchPlaceholder={t('admin.searchPartnerApplications', 'Search by name, phone, email, company...')}
            cardRender={(row) => (
              <PartnerAppCard
                app={row as PartnerApplication}
                onReview={(p) => setViewing(p)}
              />
            )}
          />
        </Card>
      )}

      {viewing && (
        <ApplicationReviewDrawer
          open={!!viewing}
          onClose={() => {
            setViewing(null);
            queryClient.invalidateQueries({ queryKey: ['admin-partner-applications'] });
          }}
          application={applications.find((a) => a.id === viewing.id) ?? viewing}
          type="partner"
        />
      )}
    </DashboardLayout>
  );
}

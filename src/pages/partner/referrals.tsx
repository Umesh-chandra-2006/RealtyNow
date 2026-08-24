import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Handshake, User, Home, Briefcase } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Badge, EmptyState, Skeleton } from '../../components/ui';
import { DataTable, type Column } from '../../components/data-table';
import { formatDate } from '../../lib/utils';

interface Referral {
  id: string;
  referral_code: string;
  referral_type: 'customer' | 'property' | 'service';
  category: string | null;
  details: Record<string, any>;
  status: string;
  assigned_agent_id: string | null;
  eligible_amount: number | null;
  created_at: string;
}

const TYPE_ICON = { customer: User, property: Home, service: Briefcase } as const;

export function ReferralStatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge variant="success">Completed</Badge>;
  if (status === 'cancelled' || status === 'rejected') return <Badge variant="error">{status === 'cancelled' ? 'Cancelled' : 'Rejected'}</Badge>;
  if (status === 'in_process') return <Badge variant="gold">In Process</Badge>;
  if (status === 'assigned') return <Badge variant="info">Assigned</Badge>;
  if (status === 'verified') return <Badge variant="info">Verified</Badge>;
  return <Badge variant="default">Pending</Badge>;
}

function referralTitle(r: Referral): string {
  if (r.referral_type === 'customer') return r.details?.name || 'Customer Referral';
  if (r.referral_type === 'property') return r.details?.owner_name ? `${r.details.owner_name}'s Property` : 'Property Referral';
  return r.details?.customer_name || `${r.category ?? 'Service'} Referral`;
}

export function PartnerReferrals() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['partner-referrals', user?.id],
    queryFn: async () => {
      // RLS (referrals_select_own) already scopes this to the caller's own partner_id.
      const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false });
      return (data ?? []) as Referral[];
    },
    enabled: !!user,
  });

  const referrals = data ?? [];
  const filtered = statusFilter ? referrals.filter((r) => r.status === statusFilter) : referrals;

  const columns: Column<Referral>[] = [
    {
      key: 'referral_code',
      header: 'Referral',
      sortable: true,
      render: (r) => {
        const Icon = TYPE_ICON[r.referral_type];
        return (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-navy-100 grid place-items-center shrink-0">
              <Icon className="h-4 w-4 text-navy-500" />
            </div>
            <div>
              <p className="font-medium text-navy-900">{referralTitle(r)}</p>
              <p className="text-xs text-navy-500 font-mono">{r.referral_code}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'referral_type', header: 'Type', render: (r) => <span className="text-sm capitalize">{r.referral_type}{r.category ? ` — ${r.category}` : ''}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <ReferralStatusBadge status={r.status} /> },
    { key: 'created_at', header: 'Submitted', sortable: true, render: (r) => <span className="text-sm text-navy-500">{formatDate(r.created_at)}</span> },
    {
      key: 'id',
      header: '',
      render: (r) => (
        <Link to={`/partner/referrals/${r.id}`}>
          <Button size="sm" variant="ghost">View</Button>
        </Link>
      ),
    },
  ];

  return (
    <DashboardLayout sections={sections} title={t('dashboard:referrals', 'Referrals')}>
      <PageHeader
        title="Referrals"
        subtitle="Track every customer, property, and service referral you've submitted"
        action={
          <Link to="/partner/referrals/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>New Referral</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {['pending', 'assigned', 'in_process', 'completed', 'cancelled', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s ? 'border-red-500 bg-red-50 text-red-700' : 'border-navy-200 bg-white text-navy-600 hover:border-navy-300'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-8 w-8 text-navy-400" />}
          title={referrals.length === 0 ? "You haven't submitted any referrals yet" : 'No referrals match this filter'}
          description={referrals.length === 0 ? 'Refer a customer, property, or service to start earning commissions.' : undefined}
          action={referrals.length === 0 ? (
            <Link to="/partner/referrals/new">
              <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Create Your First Referral</Button>
            </Link>
          ) : undefined}
        />
      ) : (
        <Card>
          <DataTable rows={filtered} columns={columns as any} getRowId={(r: any) => r.id} searchable searchPlaceholder="Search referrals..." />
        </Card>
      )}
    </DashboardLayout>
  );
}

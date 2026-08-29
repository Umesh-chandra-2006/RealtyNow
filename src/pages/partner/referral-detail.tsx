import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User, Home, Briefcase, Award, IndianRupee } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Badge, Skeleton } from '../../components/ui';
import { formatDate, isUuid } from '../../lib/utils';
import { ReferralStatusBadge } from './referrals';

const TYPE_ICON = { customer: User, property: Home, service: Briefcase } as const;

function DetailRow({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="p-3 bg-navy-50/50 rounded-lg border border-navy-100/50">
      <p className="text-xs text-navy-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-navy-900 break-words">{String(value)}</p>
    </div>
  );
}

export function PartnerReferralDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);

  const { data: referral, isLoading } = useQuery({
    queryKey: ['partner-referral', id],
    queryFn: async () => {
      if (!isUuid(id)) return null;
      const { data } = await supabase.from('referrals').select('*').eq('id', id).maybeSingle();
      return data;
    },
    enabled: !!id && isUuid(id),
  });

  const { data: activities } = useQuery({
    queryKey: ['partner-referral-activities', id],
    queryFn: async () => {
      if (!isUuid(id)) return [];
      const { data } = await supabase.from('referral_activities').select('*').eq('referral_id', id).order('created_at', { ascending: true });
      return data ?? [];
    },
    enabled: !!id && isUuid(id),
  });

  const { data: commission } = useQuery({
    queryKey: ['partner-referral-commission', id],
    queryFn: async () => {
      if (!isUuid(id)) return null;
      const { data } = await supabase.from('partner_commissions').select('*').eq('referral_id', id).maybeSingle();
      return data;
    },
    enabled: !!id && isUuid(id),
  });

  const { data: agent } = useQuery({
    queryKey: ['partner-referral-agent', referral?.assigned_agent_id],
    queryFn: async () => {
      if (!isUuid(referral?.assigned_agent_id)) return null;
      const { data } = await supabase.from('profiles').select('first_name,last_name').eq('id', referral!.assigned_agent_id).maybeSingle();
      return data;
    },
    enabled: !!referral?.assigned_agent_id && isUuid(referral?.assigned_agent_id),
  });

  if (isLoading) {
    return (
      <DashboardLayout sections={sections} title="Referral">
        <Skeleton className="h-64 rounded-2xl" />
      </DashboardLayout>
    );
  }

  if (!referral) {
    return (
      <DashboardLayout sections={sections} title="Referral">
        <Card className="p-6"><p className="text-sm text-navy-500">Referral not found.</p></Card>
      </DashboardLayout>
    );
  }

  const Icon = TYPE_ICON[referral.referral_type as keyof typeof TYPE_ICON];
  const details = referral.details ?? {};

  return (
    <DashboardLayout sections={sections} title="Referral">
      <Link to="/partner/referrals" className="inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Referrals
      </Link>

      <PageHeader
        title={referral.referral_code}
        subtitle={`${referral.referral_type}${referral.category ? ` — ${referral.category}` : ''} referral`}
        action={<ReferralStatusBadge status={referral.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <h3 className="font-display text-sm font-bold text-navy-900 mb-4 flex items-center gap-2">
              <Icon className="h-4 w-4 text-navy-400" /> Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(details).map(([key, value]) => (
                <DetailRow key={key} label={key.replace(/_/g, ' ')} value={value} />
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-display text-sm font-bold text-navy-900 mb-4">Activity Timeline</h3>
            <div className="space-y-4">
              {(activities ?? []).map((a, i) => (
                <div key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    {i < (activities?.length ?? 0) - 1 && <div className="w-px flex-1 bg-navy-100 mt-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-navy-900">{a.title}</p>
                    {a.notes && <p className="text-xs text-navy-500 mt-0.5">{a.notes}</p>}
                    <p className="text-[11px] text-navy-400 mt-1">{formatDate(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs text-navy-400 mb-1">Assigned Agent</p>
            <p className="text-sm font-medium text-navy-900">{agent ? `${agent.first_name} ${agent.last_name}` : 'Not yet assigned'}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-navy-400 mb-1">Submitted</p>
            <p className="text-sm font-medium text-navy-900">{formatDate(referral.created_at)}</p>
          </Card>
          {referral.completed_at && (
            <Card className="p-5">
              <p className="text-xs text-navy-400 mb-1">Completed</p>
              <p className="text-sm font-medium text-navy-900">{formatDate(referral.completed_at)}</p>
            </Card>
          )}
          {commission && (
            <Card className="p-5 border-gold-300 bg-gold-500/5">
              <p className="text-xs text-navy-400 mb-1 flex items-center gap-1"><Award className="h-3.5 w-3.5" /> Commission</p>
              <p className="text-lg font-bold text-navy-900 flex items-center"><IndianRupee className="h-4 w-4" />{commission.commission_amount}</p>
              <p className="text-xs text-navy-500 font-mono mt-1">{commission.commission_code}</p>
              <Badge variant={commission.status === 'paid' ? 'success' : 'warning'} className="mt-2">{commission.status}</Badge>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

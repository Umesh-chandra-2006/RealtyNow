import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  DollarSign,
  Percent,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button } from '../../components/ui';
import { formatPrice } from '../../lib/utils';

export function PartnerAnalyticsPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();

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

  // 2. Fetch all referrals
  const { data: referrals = [], isLoading: isRefLoading, refetch } = useQuery({
    queryKey: ['partner-analytics-referrals', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data } = await supabase
        .from('referrals')
        .select('*')
        .eq('partner_id', partner.id);
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  // 3. Fetch commissions
  const { data: commissions = [], isLoading: isCommLoading } = useQuery({
    queryKey: ['partner-analytics-commissions', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data } = await supabase
        .from('partner_commissions')
        .select('*')
        .eq('partner_id', partner.id);
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  const totalReferrals = referrals.length;
  const completedReferrals = referrals.filter((r: any) => r.status === 'completed').length;
  const activeReferrals = referrals.filter((r: any) =>
    ['verified', 'assigned', 'in_process'].includes(r.status)
  ).length;
  const conversionRate = totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0;

  const totalEarned = commissions.reduce((sum: number, c: any) => sum + (Number(c.commission_amount) || 0), 0);
  const totalPaid = commissions
    .filter((c: any) => c.status === 'paid')
    .reduce((sum: number, c: any) => sum + (Number(c.commission_amount) || 0), 0);

  // Category breakdown
  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; completed: number }> = {};
    referrals.forEach((r: any) => {
      const cat = r.category || r.referral_type || 'General';
      if (!map[cat]) map[cat] = { count: 0, completed: 0 };
      map[cat].count += 1;
      if (r.status === 'completed') map[cat].completed += 1;
    });
    return Object.entries(map).map(([category, data]) => ({
      category,
      count: data.count,
      completed: data.completed,
      rate: data.count > 0 ? Math.round((data.completed / data.count) * 100) : 0,
    }));
  }, [referrals]);

  return (
    <DashboardLayout sections={sections} title="Analytics">
      <PageHeader
        title="Partner Performance & Commission Analytics"
        subtitle="Detailed statistics on your referral pipeline volume, deal conversion ratios, and monthly earnings growth."
        action={
          <Button variant="ghost" size="sm" onClick={() => refetch()} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        }
      />

      {/* Main KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Lifetime Earned</span>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="font-display text-2xl font-black text-slate-900 mt-2">{formatPrice(totalEarned)}</p>
          <span className="text-[11px] font-semibold text-emerald-700 block mt-1">
            {formatPrice(totalPaid)} Disbursed
          </span>
        </Card>

        <Card className="p-5 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Conversion Ratio</span>
            <Percent className="h-5 w-5 text-blue-600" />
          </div>
          <p className="font-display text-2xl font-black text-slate-900 mt-2">{conversionRate}%</p>
          <span className="text-[11px] font-semibold text-blue-700 block mt-1">
            {completedReferrals} Won of {totalReferrals} leads
          </span>
        </Card>

        <Card className="p-5 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Pipeline</span>
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <p className="font-display text-2xl font-black text-slate-900 mt-2">{activeReferrals}</p>
          <span className="text-[11px] font-semibold text-amber-700 block mt-1">In progress & site visits</span>
        </Card>

        <Card className="p-5 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Partner Status</span>
            <Award className="h-5 w-5 text-purple-600" />
          </div>
          <p className="font-display text-2xl font-black text-slate-900 mt-2 capitalize">
            {partner?.partner_type || 'Individual'}
          </p>
          <span className="text-[11px] font-semibold text-purple-700 block mt-1">
            Code: {partner?.partner_code || 'RNP-000001'}
          </span>
        </Card>
      </div>

      {/* Category Performance Breakdown */}
      <Card className="p-6 bg-white border border-slate-200 space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900">Performance by Referral Category</h3>
        {categoryStats.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
            No referral data available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Service / Category</th>
                  <th className="py-2.5 px-3">Total Submitted</th>
                  <th className="py-2.5 px-3">Converted (Won)</th>
                  <th className="py-2.5 px-3">Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryStats.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 font-bold text-slate-900 capitalize">{item.category}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{item.count}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">{item.completed}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-red-600 h-2 rounded-full" style={{ width: `${item.rate}%` }} />
                        </div>
                        <span className="font-bold text-slate-700">{item.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}

export default PartnerAnalyticsPage;

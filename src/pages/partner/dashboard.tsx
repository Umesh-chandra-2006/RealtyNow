import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2,
  Mail,
  Phone,
  Wallet,
  Handshake,
  Plus,
  ArrowRight,
  DollarSign,
  Copy,
  Check,
  Sparkles,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Badge } from '../../components/ui';
import { formatDate, formatPrice } from '../../lib/utils';
import { useToast } from '../../components/toast';

interface PartnerRecord {
  id: string;
  partner_code: string | null;
  full_name: string;
  mobile_number: string;
  email: string | null;
  partner_type: string | null;
  company_name: string | null;
  status: string;
  verification_status: string | null;
  approved_at: string | null;
  created_at: string;
}

export function PartnerDashboard() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);

  // 1. Fetch Partner
  const { data: partner, isLoading: isPartnerLoading } = useQuery({
    queryKey: ['partner-me', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('partners').select('*').eq('user_id', user.id).maybeSingle();
      return data as PartnerRecord | null;
    },
    enabled: !!user,
  });

  // 2. Fetch Referrals
  const { data: referrals = [], isLoading: isReferralsLoading } = useQuery({
    queryKey: ['partner-dashboard-referrals', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data } = await supabase
        .from('referrals')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  // 3. Fetch Wallet
  const { data: wallet } = useQuery({
    queryKey: ['partner-wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // 4. Fetch Commissions
  const { data: commissions = [] } = useQuery({
    queryKey: ['partner-commissions', partner?.id],
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

  const totalEarned = commissions.reduce((sum: number, c: any) => sum + (Number(c.commission_amount) || 0), 0);
  const totalReferrals = referrals.length;
  const completedReferrals = referrals.filter((r: any) => r.status === 'completed').length;
  const activeReferrals = referrals.filter((r: any) =>
    ['verified', 'assigned', 'in_process'].includes(r.status)
  ).length;

  const partnerCode = partner?.partner_code || 'RNP-000001';
  const referralUrl = `https://realtynow.in?ref=${partnerCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    addToast('success', 'Referral link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <DashboardLayout sections={sections} title={t('dashboard:dashboard', 'Dashboard')}>
      <PageHeader
        title={`${t('dashboard.welcomeComma', 'Welcome,')} ${partner?.full_name ?? profile?.first_name ?? t('dashboard.partnerFallback', 'Partner')}`}
        subtitle={partner?.partner_code ? `${t('dashboard.partnerCodeLabel', 'Partner Code:')} ${partner.partner_code}` : t('dashboard.realtyNowPartner', 'RealtyNow Partner')}
        action={
          <div className="flex items-center gap-2">
            <Link to="/partner/referrals/new">
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                Submit Referral
              </Button>
            </Link>
            <Link to="/partner/payouts">
              <Button size="sm" variant="secondary" icon={<DollarSign className="h-4 w-4" />}>
                Request Payout
              </Button>
            </Link>
          </div>
        }
      />

      {/* Main KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Referrals"
          value={totalReferrals}
          icon={<Handshake className="h-5 w-5" />}
          accent="navy"
          to="/partner/referrals"
        />
        <StatCard
          label="Active In Pipeline"
          value={activeReferrals}
          icon={<Clock className="h-5 w-5" />}
          accent="gold"
          to="/partner/leads"
        />
        <StatCard
          label="Deals Won"
          value={completedReferrals}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="success"
          to="/partner/referrals"
        />
        <StatCard
          label="Total Commission Earned"
          value={formatPrice(totalEarned)}
          icon={<Wallet className="h-5 w-5" />}
          accent="gold"
          to="/partner/earnings"
        />
      </div>

      {/* Quick Referral Link Banner */}
      <Card className="mt-6 p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-2xl shadow-md space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> Quick Share
            </span>
            <h3 className="font-display text-lg font-black text-white">Share Your Partner Referral Link</h3>
            <p className="text-xs text-white/90 max-w-xl">
              Any client who visits RealtyNow through your link is tagged automatically to your partner ID for commissions.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl backdrop-blur-xs border border-white/20">
            <span className="font-mono text-xs text-white px-2 font-bold select-all truncate max-w-[200px] sm:max-w-[280px]">
              {referralUrl}
            </span>
            <button
              onClick={handleCopyLink}
              className="py-1.5 px-3 rounded-lg bg-white text-red-700 text-xs font-bold hover:bg-white/90 transition flex items-center gap-1 cursor-pointer"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLink ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </Card>

      {/* Two Column Layout: Recent Referrals & Profile Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Recent Referrals */}
        <div className="lg:col-span-8">
          <Card className="p-6 bg-white border border-slate-200 shadow-2xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">Recent Referrals</h3>
              <Link to="/partner/referrals" className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {referrals.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
                No referrals submitted yet. Click <strong>Submit Referral</strong> to earn commissions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {referrals.slice(0, 5).map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          <Link to={`/partner/referrals/${r.id}`} className="hover:text-red-600">
                            {r.referral_code || 'RN-REF'}
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{r.details?.customer_name || 'Customer'}</td>
                        <td className="py-3 px-3 capitalize text-slate-600">{r.category || r.referral_type}</td>
                        <td className="py-3 px-3">
                          <Badge variant={r.status === 'completed' ? 'success' : r.status === 'pending' ? 'warning' : 'default'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Profile Card */}
        <div className="lg:col-span-4">
          <Card className="p-6 bg-white border border-slate-200 shadow-2xs space-y-4 rounded-2xl">
            <h3 className="font-display text-base font-bold text-slate-900">{t('dashboard.myProfile', 'My Profile')}</h3>
            {partner ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5 mb-1">
                    <Phone className="h-3 w-3" /> {t('dashboard.mobileNumber', 'Mobile Number')}
                  </p>
                  <p className="text-xs font-bold text-slate-900">{partner.mobile_number}</p>
                </div>
                {partner.email && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5 mb-1">
                      <Mail className="h-3 w-3" /> {t('dashboard.email', 'Email')}
                    </p>
                    <p className="text-xs font-bold text-slate-900">{partner.email}</p>
                  </div>
                )}
                {partner.company_name && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5 mb-1">
                      <Building2 className="h-3 w-3" /> {t('dashboard.company', 'Company')}
                    </p>
                    <p className="text-xs font-bold text-slate-900">{partner.company_name}</p>
                  </div>
                )}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">{t('dashboard.status', 'Status')}</p>
                  <Badge variant={partner.status === 'active' ? 'success' : 'error'}>{partner.status}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">{t('dashboard.partnerProfileLoadFailed', 'Your partner profile could not be loaded.')}</p>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PartnerDashboard;

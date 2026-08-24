import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet as WalletIcon, IndianRupee, ArrowDownRight, ArrowUpRight, History } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Badge, Modal, Input, EmptyState, Skeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { formatDate } from '../../lib/utils';

export function PartnerEarnings() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['partner-wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: bankAccount } = useQuery({
    queryKey: ['partner-bank-account-earnings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('partner_bank_accounts')
        .select('account_holder_name,bank_name,account_number_last4,ifsc_code,branch,account_type')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: commissions, isLoading: commissionsLoading } = useQuery({
    queryKey: ['partner-commissions', user?.id],
    queryFn: async () => {
      // RLS (partner_commissions_select_own) scopes this to the caller's own commissions.
      const { data } = await supabase.from('partner_commissions').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: withdrawals } = useQuery({
    queryKey: ['partner-withdrawals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('withdrawal_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const totalEarned = (commissions ?? []).reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const paidTotal = (commissions ?? []).filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const pendingTotal = (commissions ?? []).filter((c) => ['created', 'pending'].includes(c.status)).reduce((sum, c) => sum + Number(c.commission_amount), 0);

  const requestWithdrawal = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      addToast('error', 'Enter a valid amount.');
      return;
    }
    if (!bankAccount) {
      addToast('error', 'Add your bank details in My Profile before requesting a withdrawal.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('fn_request_withdrawal', {
        p_amount: amt,
        p_bank_details: {
          account_holder_name: bankAccount.account_holder_name,
          bank_name: bankAccount.bank_name,
          account_number_last4: bankAccount.account_number_last4,
          ifsc_code: bankAccount.ifsc_code,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.message || 'Withdrawal request failed.');
      addToast('success', 'Withdrawal request submitted.');
      setWithdrawOpen(false);
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['partner-wallet', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['partner-withdrawals', user?.id] });
    } catch (e: any) {
      addToast('error', e?.message || 'Failed to request withdrawal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout sections={sections} title={t('dashboard:earnings', 'Earnings')}>
      <PageHeader title="Earnings" subtitle="Your commissions, wallet balance, and payout history" />

      {walletLoading ? (
        <Skeleton className="h-32 rounded-2xl mb-6" />
      ) : (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-navy-900 to-navy-800 p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 p-4"><WalletIcon className="w-40 h-40" /></div>
          <div className="relative z-10">
            <p className="text-navy-200 font-medium tracking-wide uppercase text-xs mb-2">Available Balance</p>
            <div className="flex items-center gap-1 mb-5">
              <IndianRupee className="w-7 h-7" />
              <span className="text-4xl font-bold">{Number(wallet?.balance ?? 0).toLocaleString('en-IN')}</span>
            </div>
            <Button variant="gold" disabled={!wallet || Number(wallet.balance) <= 0} onClick={() => setWithdrawOpen(true)}>
              Request Withdrawal
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Earned" value={`₹${totalEarned.toLocaleString('en-IN')}`} icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard label="Paid Out" value={`₹${paidTotal.toLocaleString('en-IN')}`} icon={<ArrowDownRight className="h-5 w-5" />} accent="success" />
        <StatCard label="Pending Approval" value={`₹${pendingTotal.toLocaleString('en-IN')}`} icon={<History className="h-5 w-5" />} accent="gold" />
      </div>

      <Card className="mb-6">
        <div className="border-b border-navy-100 p-4">
          <h3 className="font-display text-sm font-bold text-navy-900">Commission History</h3>
        </div>
        {commissionsLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
        ) : (commissions ?? []).length === 0 ? (
          <EmptyState icon={<IndianRupee className="h-8 w-8 text-navy-400" />} title="No commissions generated yet" description="Commissions appear here once a referral is completed and approved." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50">
                <tr>
                  <th className="p-3 font-medium">Commission</th>
                  <th className="p-3 font-medium">Rule</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {(commissions ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="p-3 font-mono text-xs">{c.commission_code}</td>
                    <td className="p-3">{c.rule_name}</td>
                    <td className="p-3"><Badge variant={c.status === 'paid' || c.status === 'payable' ? 'success' : c.status === 'rejected' ? 'error' : 'warning'}>{c.status}</Badge></td>
                    <td className="p-3 text-navy-500">{formatDate(c.created_at)}</td>
                    <td className="p-3 text-right font-semibold">₹{Number(c.commission_amount).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="border-b border-navy-100 p-4">
          <h3 className="font-display text-sm font-bold text-navy-900">Payout History</h3>
        </div>
        {(withdrawals ?? []).length === 0 ? (
          <EmptyState icon={<ArrowUpRight className="h-8 w-8 text-navy-400" />} title="No payouts available yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50">
                <tr>
                  <th className="p-3 font-medium">Requested</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Reference</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {(withdrawals ?? []).map((w) => (
                  <tr key={w.id}>
                    <td className="p-3 text-navy-500">{formatDate(w.created_at)}</td>
                    <td className="p-3"><Badge variant={w.status === 'completed' ? 'success' : w.status === 'rejected' ? 'error' : 'warning'}>{w.status}</Badge></td>
                    <td className="p-3 font-mono text-xs">{w.transaction_ref ?? '—'}</td>
                    <td className="p-3 text-right font-semibold">₹{Number(w.amount).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Request Withdrawal" footer={
        <>
          <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={requestWithdrawal}>Submit Request</Button>
        </>
      }>
        <Input label="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
          hint={`Available: ₹${Number(wallet?.balance ?? 0).toLocaleString('en-IN')}`} />
        {bankAccount ? (
          <div className="mt-3 p-3 bg-navy-50/50 rounded-lg border border-navy-100/50 text-sm">
            <p className="text-navy-900 font-medium">{bankAccount.bank_name} •••• {bankAccount.account_number_last4}</p>
            <p className="text-xs text-navy-500">{bankAccount.ifsc_code}</p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-red-600">No bank account on file — add one in My Profile first.</p>
        )}
      </Modal>
    </DashboardLayout>
  );
}

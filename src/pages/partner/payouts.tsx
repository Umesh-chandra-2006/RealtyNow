import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  DollarSign,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Input, Select, Badge, Modal, Skeleton } from '../../components/ui';
import { formatDate, formatPrice, cn } from '../../lib/utils';
import { useToast } from '../../components/toast';

export function PartnerPayoutsPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'upi'>('upi');
  const [payoutNotes, setPayoutNotes] = useState('');

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

  // 2. Fetch Wallet
  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ['partner-wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // 3. Fetch Withdrawal Requests
  const {
    data: withdrawalRequests = [],
    isLoading,
    refetch: refetchWithdrawals,
  } = useQuery({
    queryKey: ['partner-withdrawals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!user,
  });

  // 4. Fetch Commissions summary
  const { data: commissions = [] } = useQuery({
    queryKey: ['partner-commissions-summary', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data } = await supabase
        .from('partner_commissions')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  // Withdrawal request mutation
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const num = parseFloat(withdrawAmount);
      if (!num || num <= 0) throw new Error('Enter a valid amount');
      if (wallet && num > (wallet.balance || 0)) {
        throw new Error('Requested amount exceeds available wallet balance');
      }

      // Try dedicated RPC first
      try {
        const { data, error } = await supabase.rpc('fn_request_withdrawal', {
          p_amount: num,
          p_method: paymentMethod,
          p_notes: payoutNotes || null,
        });
        if (!error && (data as any)?.success !== false) return data;
      } catch (e) {
        console.warn('RPC failed, trying direct insert', e);
      }

      // Direct insert fallback
      const { error: insErr } = await supabase.from('withdrawal_requests').insert({
        user_id: user?.id,
        wallet_id: wallet?.id,
        amount: num,
        payment_method: paymentMethod,
        notes: payoutNotes,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setPayoutNotes('');
      refetchWallet();
      refetchWithdrawals();
      addToast('success', 'Withdrawal request submitted successfully');
    },
    onError: (err: any) => {
      addToast('error', err.message || 'Failed to submit withdrawal request');
    },
  });

  const availableBalance = wallet?.balance ?? 0;
  const totalWithdrawn = withdrawalRequests
    .filter((w: any) => w.status === 'approved' || w.status === 'completed' || w.status === 'paid')
    .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);
  const pendingWithdrawn = withdrawalRequests
    .filter((w: any) => w.status === 'pending')
    .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);

  return (
    <DashboardLayout sections={sections} title="Payout Requests">
      <PageHeader
        title="Earnings, Wallet & Payout Requests"
        subtitle="Manage commission disbursements, view wallet balances, and request instant bank transfers or UPI payouts."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchWallet();
                refetchWithdrawals();
              }}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setShowWithdrawModal(true)}
              icon={<ArrowUpRight className="h-4 w-4" />}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Request Payout
            </Button>
          </div>
        }
      />

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-emerald-50/60 border border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Available Balance</span>
            <Wallet className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="font-display text-3xl font-black text-emerald-950 mt-2">
            {formatPrice(availableBalance)}
          </p>
          <span className="text-[11px] font-semibold text-emerald-700 block mt-1">Ready for withdrawal</span>
        </Card>

        <Card className="p-5 bg-amber-50/60 border border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Payouts</span>
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <p className="font-display text-3xl font-black text-amber-950 mt-2">
            {formatPrice(pendingWithdrawn)}
          </p>
          <span className="text-[11px] font-semibold text-amber-700 block mt-1">Under verification by finance</span>
        </Card>

        <Card className="p-5 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Paid Out</span>
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
          </div>
          <p className="font-display text-3xl font-black text-slate-900 mt-2">
            {formatPrice(totalWithdrawn)}
          </p>
          <span className="text-[11px] font-semibold text-slate-500 block mt-1">Lifetime settlements</span>
        </Card>
      </div>

      {/* Payout Requests History */}
      <Card className="p-6 bg-white border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-slate-900">Withdrawal Request History</h3>
          <span className="text-xs text-slate-400 font-semibold">{withdrawalRequests.length} total requests</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="h-6 w-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : withdrawalRequests.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
            No withdrawal requests made yet. When your referrals close, commissions credited to your wallet can be withdrawn here.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] relative">
            <table className="w-full text-left text-xs relative">
              <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
                <tr className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px]">
                  <th className="sticky top-0 z-20 bg-slate-50 py-3 px-3">Date</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3 px-3">Amount</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3 px-3">Payment Method</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3 px-3">Status</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3 px-3">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {withdrawalRequests.map((req: any) => {
                  const isApproved = req.status === 'approved' || req.status === 'completed' || req.status === 'paid';
                  const isPending = req.status === 'pending';
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 text-slate-600 font-medium">{formatDate(req.created_at)}</td>
                      <td className="py-3 px-3 font-extrabold text-slate-900">{formatPrice(req.amount)}</td>
                      <td className="py-3 px-3 uppercase text-slate-600 font-bold">{req.payment_method || 'UPI'}</td>
                      <td className="py-3 px-3">
                        <Badge variant={isApproved ? 'success' : isPending ? 'warning' : 'error'}>
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{req.notes || req.transaction_reference || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Withdrawal Request Modal */}
      <Modal
        open={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        title="Request Commission Payout"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowWithdrawModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={withdrawMutation.isPending}
              disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
              onClick={() => withdrawMutation.mutate()}
            >
              Submit Request
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Available to Withdraw</span>
            <span className="font-extrabold text-base text-emerald-700">{formatPrice(availableBalance)}</span>
          </div>

          <div>
            <label className="label">Withdrawal Amount (₹) *</label>
            <Input
              type="number"
              placeholder="e.g. 50000"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Payout Method *</label>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
            >
              <option value="upi">UPI ID (Instant Transfer)</option>
              <option value="bank_transfer">Direct Bank Transfer (NEFT/IMPS)</option>
            </Select>
          </div>

          <div>
            <label className="label">UPI ID / Bank Details / Note</label>
            <Input
              placeholder="e.g. name@okhdfcbank or Account: 1234567890, IFSC: HDFC0001234"
              value={payoutNotes}
              onChange={(e) => setPayoutNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

export default PartnerPayoutsPage;

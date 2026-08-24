import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Input, Badge, Skeleton } from '../../components/ui';
import { formatDate, formatPrice, exportToCsv, cn } from '../../lib/utils';
import { useToast } from '../../components/toast';

export function PartnerInvoicesPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');

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

  // 2. Fetch Partner Commissions
  const {
    data: commissions = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['partner-commissions-invoices', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data, error } = await supabase
        .from('partner_commissions')
        .select(`
          *,
          referral:referrals(referral_code, details, category)
        `)
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  const filtered = commissions.filter((c: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (c.commission_code || '').toLowerCase();
    const ref = (c.referral?.referral_code || '').toLowerCase();
    const rule = (c.rule_name || '').toLowerCase();
    return code.includes(q) || ref.includes(q) || rule.includes(q);
  });

  const handleExport = () => {
    const data = filtered.map((c: any) => ({
      'Invoice / Comm Code': c.commission_code || `RN-COM-${c.id.substring(0, 6)}`,
      'Referral Code': c.referral?.referral_code || '—',
      'Commission Rule': c.rule_name,
      'Eligible Amount': c.eligible_amount,
      'Commission Amount': c.commission_amount,
      Status: c.status,
      'Date Generated': formatDate(c.created_at),
      'Paid Date': c.paid_at ? formatDate(c.paid_at) : '—',
    }));
    exportToCsv(data, `RealtyNow_Partner_Invoices_${new Date().toISOString().split('T')[0]}`);
    addToast('success', 'Exported invoices list');
  };

  return (
    <DashboardLayout sections={sections} title="Commission Invoices">
      <PageHeader
        title="Commission Invoices & Tax Receipts"
        subtitle="Official commission statements and tax records (TDS compliant) for your verified partner earnings."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExport} icon={<Download className="h-4 w-4" />}>
              Export List
            </Button>
          </div>
        }
      />

      <Card className="p-4 bg-white border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Invoice Code, Referral Code, or Commission Rule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-xs w-full"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="h-8 w-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 mt-3">Loading invoices...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-display text-base font-bold text-slate-900">No commission invoices generated yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            When your referred clients complete bookings and payments, official commission statements will appear here with downloadable receipts.
          </p>
        </Card>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] relative">
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-2xs">
                <tr className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Invoice / Comm Code</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Referral Reference</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Commission Rule</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Deal Value</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Commission (₹)</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Status</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Date</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c: any) => {
                  const isPaid = c.status === 'paid';
                  const isApproved = c.status === 'approved' || c.status === 'payable';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {c.commission_code || `RN-COM-${c.id.substring(0, 6)}`}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 font-medium">
                        {c.referral?.referral_code || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{c.rule_name}</td>
                      <td className="py-3 px-4 text-slate-600">{formatPrice(c.eligible_amount || 0)}</td>
                      <td className="py-3 px-4 font-black text-emerald-800 text-sm">
                        {formatPrice(c.commission_amount)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={isPaid ? 'success' : isApproved ? 'gold' : 'warning'}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(c.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            window.print();
                          }}
                          title="Print or Save PDF"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default PartnerInvoicesPage;

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Handshake,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  ArrowRight,
  Filter,
  RefreshCw,
  ExternalLink,
  Building2,
  Tag,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  SlidersHorizontal,
  Eye,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Input, Select, Badge, Skeleton, EmptyState } from '../../components/ui';
import { formatDate, formatPrice, buildWhatsAppUrl, cn } from '../../lib/utils';
import { useToast } from '../../components/toast';

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'gold' | 'info' }> = {
  pending: { label: 'Pending Verification', variant: 'warning' },
  verified: { label: 'Verified', variant: 'info' },
  assigned: { label: 'Assigned to Agent', variant: 'gold' },
  in_process: { label: 'In Process', variant: 'default' },
  completed: { label: 'Completed (Won)', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  rejected: { label: 'Rejected', variant: 'error' },
};

export function PartnerLeadsPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // 1. Fetch Partner record for logged-in user
  const { data: partner } = useQuery({
    queryKey: ['partner-me', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('partners').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // 2. Fetch referrals/leads submitted by this partner
  const {
    data: referrals = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['partner-my-referrals-leads', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          assigned_agent:profiles!referrals_assigned_agent_id_fkey(id, first_name, last_name, phone, email)
        `)
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to plain query
        const { data: plainData } = await supabase
          .from('referrals')
          .select('*')
          .eq('partner_id', partner.id)
          .order('created_at', { ascending: false });
        return plainData ?? [];
      }
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  // Filtered referrals
  const filtered = useMemo(() => {
    return referrals.filter((r: any) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.referral_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const code = (r.referral_code || '').toLowerCase();
        const name = (r.details?.customer_name || r.details?.name || '').toLowerCase();
        const phone = (r.details?.customer_phone || r.details?.phone || '').toLowerCase();
        const category = (r.category || '').toLowerCase();
        return code.includes(q) || name.includes(q) || phone.includes(q) || category.includes(q);
      }
      return true;
    });
  }, [referrals, statusFilter, typeFilter, search]);

  return (
    <DashboardLayout sections={sections} title="Leads Pipeline">
      <PageHeader
        title="Partner Leads & Referrals Pipeline"
        subtitle="Track all client referrals submitted by you, their progression stages, assigned agents, and commission eligibility."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              loading={isRefetching}
              icon={<RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />}
            >
              Refresh
            </Button>
            <Link to="/partner/referrals/new">
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                Submit Referral
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Submitted</span>
          <p className="font-display text-2xl font-black text-slate-900 mt-1">{referrals.length}</p>
        </Card>
        <Card className="p-4 bg-blue-50/60 border border-blue-100">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">In Process</span>
          <p className="font-display text-2xl font-black text-blue-900 mt-1">
            {referrals.filter((r: any) => ['verified', 'assigned', 'in_process'].includes(r.status)).length}
          </p>
        </Card>
        <Card className="p-4 bg-emerald-50/60 border border-emerald-100">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Converted (Won)</span>
          <p className="font-display text-2xl font-black text-emerald-900 mt-1">
            {referrals.filter((r: any) => r.status === 'completed').length}
          </p>
        </Card>
        <Card className="p-4 bg-amber-50/60 border border-amber-100">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending Review</span>
          <p className="font-display text-2xl font-black text-amber-900 mt-1">
            {referrals.filter((r: any) => r.status === 'pending').length}
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 space-y-3 bg-white border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Referral Code, Client Name, Phone, Category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs w-full"
            />
          </div>

          <div className="md:col-span-3">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs">
              <option value="all">All Statuses</option>
              <option value="pending">Pending Verification</option>
              <option value="verified">Verified</option>
              <option value="assigned">Assigned</option>
              <option value="in_process">In Process</option>
              <option value="completed">Completed (Won)</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-xs">
              <option value="all">All Referral Types</option>
              <option value="customer">Customer Buyer / Tenant</option>
              <option value="property">Property Listing</option>
              <option value="service">Service Request (Loans, Interiors, Borewell)</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Referrals List Table */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="h-8 w-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 mt-3">Loading your referrals pipeline...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Handshake className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-display text-base font-bold text-slate-900">No referrals found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'No referrals matched your search filters.'
              : 'You have not submitted any client referrals yet. Submit your first referral to earn commissions.'}
          </p>
          <Link to="/partner/referrals/new">
            <Button size="sm" icon={<Plus className="h-4 w-4" />}>
              Submit New Referral
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] relative">
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-2xs">
                <tr className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Referral Code</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Client Name</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Type / Category</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Estimated Value</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Status</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Assigned Agent</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4">Submitted Date</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r: any) => {
                  const st = STATUS_BADGES[r.status] || { label: r.status, variant: 'default' };
                  const clientName = r.details?.customer_name || r.details?.name || 'Customer';
                  const clientPhone = r.details?.customer_phone || r.details?.phone || '';
                  const cleanPhone = clientPhone.replace(/[^0-9]/g, '');
                  const waUrl = buildWhatsAppUrl(cleanPhone, `Hi ${clientName}, follow up regarding your RealtyNow referral ${r.referral_code}`);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          to={`/partner/referrals/${r.id}`}
                          className="font-mono font-bold text-slate-900 hover:text-red-600 transition"
                        >
                          {r.referral_code || 'RN-REF-XXXX'}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-900">{clientName}</p>
                          {clientPhone && <p className="text-[11px] text-slate-500">{clientPhone}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-medium text-slate-700">
                          {r.category || r.referral_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">
                          {r.eligible_amount ? formatPrice(r.eligible_amount) : r.details?.budget ? r.details.budget : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {r.assigned_agent ? (
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>
                              {r.assigned_agent.first_name} {r.assigned_agent.last_name || ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {clientPhone && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Link to={`/partner/referrals/${r.id}`}>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
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

export default PartnerLeadsPage;

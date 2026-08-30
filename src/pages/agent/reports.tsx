import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  DollarSign,
  TrendingUp,
  Users,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Button, Badge, EmptyState } from '../../components/ui';
import { DataTable, type Column } from '../../components/data-table';
import { formatPrice, formatDate } from '../../lib/utils';
import { useToast } from '../../components/toast';

export function AgentReports() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const { addToast } = useToast();

  const [dateFilter, setDateFilter] = useState<'30days' | 'quarter' | 'year' | 'all'>('30days');

  // Fetch agent commissions & payouts
  const { data: commissions, isLoading: commsLoading } = useQuery({
    queryKey: ['agent-reports-commissions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_commissions')
        .select('*')
        .eq('agent_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('agent_commissions query warning:', error.message);
        return [];
      }
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch agent lead pipeline data
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['agent-reports-leads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquiries')
        .select('*, property:properties(title, price, locality_name, city_name)')
        .or(`agent_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({
        ...e,
        property: Array.isArray(e.property) ? e.property[0] : e.property,
      }));
    },
    enabled: !!user,
  });

  // Fetch agent property views & engagement
  const { data: properties, isLoading: propsLoading } = useQuery({
    queryKey: ['agent-reports-properties', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, price, purpose, status, view_count, created_at, locality_name, city_name')
        .or(`assigned_agent_id.eq.${user!.id},owner_id.eq.${user!.id}`)
        .order('view_count', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Calculate metrics
  const stats = useMemo(() => {
    const allLeads = leads ?? [];
    const allComms = commissions ?? [];
    const allProps = properties ?? [];

    const totalLeads = allLeads.length;
    const closedWon = allLeads.filter((l) => l.status === 'closed' || l.lead_status === 'won').length;
    const siteVisits = allLeads.filter((l) => l.status === 'site_visit' || l.lead_status === 'site_visit').length;
    const conversionRate = totalLeads > 0 ? Math.round((closedWon / totalLeads) * 100) : 0;

    const totalCommissionEarned = allComms.reduce((acc, c) => acc + (c.amount || 0), 0);
    const paidCommission = allComms.filter((c) => c.status === 'paid').reduce((acc, c) => acc + (c.amount || 0), 0);
    const totalViews = allProps.reduce((acc, p) => acc + (p.view_count || 0), 0);

    return {
      totalLeads,
      closedWon,
      siteVisits,
      conversionRate,
      totalCommissionEarned,
      paidCommission,
      totalViews,
      totalProperties: allProps.length,
    };
  }, [leads, commissions, properties]);

  // Export functions
  const downloadCSV = (filename: string, rows: Record<string, any>[]) => {
    if (rows.length === 0) {
      addToast('info', 'No records to export.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', `${filename}.csv exported successfully!`);
  };

  const exportLeadsReport = () => {
    const dataToExport = (leads ?? []).map((l) => ({
      'Lead ID': l.id,
      'Client Name': l.name || '',
      'Phone': l.phone || '',
      'Email': l.email || '',
      'Property': l.property?.title || 'General',
      'Location': l.property?.locality_name || '',
      'Status': l.status || l.lead_status || 'new',
      'Created Date': formatDate(l.created_at),
    }));
    downloadCSV('agent_leads_pipeline_report', dataToExport);
  };

  const exportCommissionsReport = () => {
    const dataToExport = (commissions ?? []).map((c) => ({
      'Commission ID': c.id,
      'Deal / Property ID': c.property_id || '',
      'Amount (₹)': c.amount || 0,
      'Status': c.status || 'pending',
      'Payout Date': c.paid_at ? formatDate(c.paid_at) : 'Pending',
      'Created Date': formatDate(c.created_at),
    }));
    downloadCSV('agent_commissions_statement', dataToExport);
  };

  const exportPropertiesReport = () => {
    const dataToExport = (properties ?? []).map((p) => ({
      'Property ID': p.id,
      'Title': p.title,
      'Price': p.price,
      'Purpose': p.purpose,
      'Location': `${p.locality_name || ''}, ${p.city_name || ''}`,
      'Status': p.status,
      'View Count': p.view_count || 0,
      'Listed Date': formatDate(p.created_at),
    }));
    downloadCSV('agent_inventory_performance_report', dataToExport);
  };

  const commissionColumns: Column<any>[] = [
    {
      key: 'id',
      header: 'Commission ID',
      render: (c) => <span className="font-mono text-xs">{c.id.slice(0, 8)}...</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (c) => <span className="font-bold text-navy-900">₹{formatPrice(c.amount || 0)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge variant={c.status === 'paid' ? 'success' : 'warning'} className="capitalize">
          {c.status || 'Pending'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (c) => formatDate(c.created_at),
    },
  ];

  return (
    <DashboardLayout sections={agentSections} title="Performance Reports" badge="Agent">
      <PageHeader
        title="Agent Performance & Business Reports"
        subtitle="Track sales conversion funnels, earned commission statements, and export tax-ready statements."
      />

      {/* KPI Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
        <StatCard
          label="Total Leads Managed"
          value={stats.totalLeads}
          icon={<Users className="h-5 w-5" />}
          accent="navy"
          trend={`${stats.siteVisits} Site Visits`}
        />
        <StatCard
          label="Deals Won"
          value={stats.closedWon}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="success"
          trend={`${stats.conversionRate}% Conversion Rate`}
        />
        <StatCard
          label="Commissions Earned"
          value={`₹${formatPrice(stats.totalCommissionEarned)}`}
          icon={<DollarSign className="h-5 w-5" />}
          accent="gold"
          trend={`₹${formatPrice(stats.paidCommission)} Paid`}
        />
        <StatCard
          label="Portfolio Views"
          value={stats.totalViews}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="navy"
          trend={`${stats.totalProperties} Listed Properties`}
        />
      </div>

      {/* Exportable Reports Section */}
      <div className="mt-8">
        <h3 className="font-display font-bold text-navy-900 text-lg mb-4">Exportable Reports & Statements</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5 border-navy-100 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl w-fit mb-3">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-navy-900 text-base">Lead Pipeline & Conversion</h4>
              <p className="text-xs text-navy-500 mt-1">
                Full breakdown of customer contacts, status stages, scheduled visits, and enquiries.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
              icon={<Download className="h-4 w-4" />}
              onClick={exportLeadsReport}
            >
              Export Leads (.CSV)
            </Button>
          </Card>

          <Card className="p-5 border-navy-100 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-3">
                <DollarSign className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-navy-900 text-base">Commission & Payout Statement</h4>
              <p className="text-xs text-navy-500 mt-1">
                Financial audit report of deal payouts, pending balances, and transaction timestamps.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
              icon={<Download className="h-4 w-4" />}
              onClick={exportCommissionsReport}
            >
              Export Commissions (.CSV)
            </Button>
          </Card>

          <Card className="p-5 border-navy-100 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="p-2 bg-gold-50 text-gold-600 rounded-xl w-fit mb-3">
                <Building2 className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-navy-900 text-base">Listing Performance Analytics</h4>
              <p className="text-xs text-navy-500 mt-1">
                Total page impressions, buyer shortlist ratios, and active availability status.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
              icon={<Download className="h-4 w-4" />}
              onClick={exportPropertiesReport}
            >
              Export Listings (.CSV)
            </Button>
          </Card>
        </div>
      </div>

      {/* Recent Commission & Payout History Table */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-navy-900 text-lg">Recent Commission Transactions</h3>
          <span className="text-xs text-navy-500">Live ledger</span>
        </div>

        <Card className="p-0 overflow-hidden border-navy-100">
          <DataTable
            columns={commissionColumns}
            rows={commissions ?? []}
            loading={commsLoading}
            getRowId={(row) => row.id}
            searchKeys={['id', 'status']}
            emptyState={
              <EmptyState
                icon={<DollarSign className="h-6 w-6" />}
                title="No commission records found"
                description="When deals close and commissions are approved, your statements will appear here."
              />
            }
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}

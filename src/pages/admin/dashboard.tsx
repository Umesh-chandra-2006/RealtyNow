import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  LayoutDashboard,
  Kanban,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  Shield,
  Clock,
  Laptop,
  Globe,
  LogOut,
  PowerOff,
  UserCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { Badge } from '../../components/ui';
import { StatusBadge } from '../../components/property-card';
import { formatPrice, formatDate } from '../../lib/utils';
import { useRealtimeMulti } from '../../lib/realtime';
import { useAuth } from '../../lib/auth';
import { getAdminMe, listAdminLoginLogs, ROLE_PERMISSIONS, AdminRole, hasPermission as checkHasPermission } from '../../lib/admin-security';

// Import Syncfusion Hybrid Architecture Enterprise Components
import { EnterpriseDataGrid, type ColumnDef } from '../../components/enterprise/enterprise-datagrid';
import { EnterpriseKanban, type KanbanLeadCard } from '../../components/enterprise/enterprise-kanban';
import { EnterpriseCharts } from '../../components/enterprise/enterprise-charts';
import { EnterpriseAIReportDashboard } from '../../components/enterprise/enterprise-aireport';
import { EnterpriseScheduler } from '../../components/enterprise/enterprise-scheduler';
import { RemindersWidget } from '../../components/reminders-widget';

type DateRange = '7d' | '30d' | '6m' | '1y';



export function AdminDashboard() {
  const { t } = useLanguageContext();
  const sections = getAdminSections(t);
  const { signOut } = useAuth();
  const { data: me } = useQuery({ queryKey: ['admin-me'], queryFn: () => getAdminMe() });
  const { data: loginLogs } = useQuery({
    queryKey: ['admin-login-logs-self', me?.admin.id],
    queryFn: () => listAdminLoginLogs(me!.admin.id),
    enabled: !!me?.admin.id,
  });
  const lastSuccessfulLogin = loginLogs?.logs.find((l) => l.status === 'success' && l.action !== 'logout');
  const admin = me
    ? {
        id: me.admin.id,
        name: `${me.profile.first_name ?? ''} ${me.profile.last_name ?? ''}`.trim() || me.admin.mobile,
        email: me.profile.email,
        mobile: me.admin.mobile,
        role: me.admin.role,
      }
    : null;
  const hasPermission = (perm: string) => (admin ? checkHasPermission(admin.role as AdminRole, perm) : false);
  const logout = () => signOut();
  const logoutAllDevices = async () => {
    const { supabase: sb } = await import('../../lib/supabase');
    await sb.auth.signOut({ scope: 'global' });
  };
  const realtimeTick = useRealtimeMulti(['properties', 'enquiries', 'profiles']);
  const [dateRange] = useState<DateRange>('6m');
  const [activeTab, setActiveTab] = useState<'analytics' | 'kanban' | 'datagrid' | 'scheduler' | 'ai_report'>(
    'analytics'
  );

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', realtimeTick, dateRange],
    queryFn: async () => {
      const [propsRpc, customers, payments, views, enquiries, closedEnquiries] = await Promise.all([
        supabase.rpc('admin_get_properties'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('payments').select('amount').eq('status', 'paid'),
        supabase.from('property_views').select('id', { count: 'exact', head: true }),
        supabase.from('enquiries').select('id', { count: 'exact', head: true }),
        supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
      ]);
      const propsData = (propsRpc.data ?? []) as Array<{
        id: string;
        status: string;
        title: string;
        price: number;
        purpose: string;
        created_at: string;
        city_name?: string;
      }>;
      const pendingStatuses = ['pending_verification', 'submitted', 'changes_requested'];
      const pendingCount = propsData.filter((p) => pendingStatuses.includes(p.status)).length;
      const revenue = (payments.data ?? []).reduce((a, p) => a + Number(p.amount), 0);

      return {
        propsData,
        totalProps: propsData.length,
        customers: customers.count ?? 0,
        pending: pendingCount,
        published: propsData.filter((p) => p.status === 'published').length,
        views: views.count ?? 0,
        enquiries: enquiries.count ?? 0,
        closedEnquiries: closedEnquiries.count ?? 0,
        revenue,
        conversionRate: enquiries.count ? (((closedEnquiries.count ?? 0) / enquiries.count) * 100).toFixed(1) : '0.0',
      };
    },
  });

  const { data: realLeads = [] } = useQuery({
    queryKey: ['admin-kanban-leads', realtimeTick],
    queryFn: async () => {
      const { data } = await supabase
        .from('enquiries')
        .select('id, name, phone, email, message, status, created_at, properties(title, price)')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []).map((e: any) => ({
        id: e.id,
        title: e.properties?.title || 'Property Inquiry',
        customerName: e.name || 'Inquirer',
        phone: e.phone || 'N/A',
        email: e.email || 'N/A',
        budget: e.properties?.price ? formatPrice(e.properties.price) : 'N/A',
        stage: (e.status === 'closed' ? 'closed' : e.status === 'in_progress' ? 'contacted' : 'new') as KanbanLeadCard['stage'],
        priority: 'High' as const,
        createdAt: formatDate(e.created_at),
      }));
    },
  });

  const propertyGridColumns: ColumnDef<any>[] = [
    { field: 'title', headerName: t('compare.propertyCol', 'Property Title'), sortable: true },
    {
      field: 'purpose',
      headerName: t('search.purposeLabel', 'Purpose'),
      render: (r) => <Badge variant={r.purpose === 'Rent' ? 'info' : 'gold'}>{r.purpose}</Badge>,
    },
    {
      field: 'price',
      headerName: t('property.price', 'Price (INR)'),
      sortable: true,
      render: (r) => <span className="font-bold text-red-600">{formatPrice(r.price, r.purpose)}</span>,
    },
    {
      field: 'status',
      headerName: t('portal.workflowProgress', 'Status'),
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      field: 'created_at',
      headerName: t('portal.created', 'Created Date'),
      sortable: true,
      render: (r) => formatDate(r.created_at),
    },
  ];

  const currentRole = admin?.role || 'admin';
  const permissions = ROLE_PERMISSIONS[currentRole as AdminRole] || [];

  return (
    <DashboardLayout
      sections={sections}
      title={t('nav.dashboard', 'Admin Dashboard')}
      badge="Independent Portal"
    >
      {/* ADMIN SESSION HEADER CARD */}
      <div className="mb-6 rounded-2xl border border-slate-800 bg-navy-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 text-white font-bold text-xl shadow-lg shadow-red-900/40">
              {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold text-white">{admin?.name || 'Administrator'}</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-red-300">
                  <Shield className="h-3 w-3" /> {currentRole.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-navy-300">{admin?.email} • {admin?.mobile}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
            <button
              onClick={() => logoutAllDevices()}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20"
            >
              <PowerOff className="h-3.5 w-3.5" /> Logout All Devices
            </button>
          </div>
        </div>

        {/* ADMIN SECURITY DETAILS STRIP */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs text-navy-300">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-400" />
            <span>Last Login: <strong className="text-white">{lastSuccessfulLogin ? formatDate(lastSuccessfulLogin.created_at) : 'Just now'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-red-400" />
            <span>Device: <strong className="text-white">{lastSuccessfulLogin?.device || 'Active Session'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-red-400" />
            <span>Login IP: <strong className="text-white">{lastSuccessfulLogin?.ip || '127.0.0.1'}</strong></span>
          </div>
        </div>
      </div>

      {/* RBAC CAPABILITIES BANNER */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Active Role: <strong className="capitalize text-slate-900">{currentRole.replace('_', ' ')}</strong>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {permissions.map((perm) => (
            <span key={perm} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">
              {perm}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <RemindersWidget />
      </div>

      {/* Enterprise Tab Bar */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'analytics', label: 'Syncfusion Analytics & Charts', icon: LayoutDashboard, perm: 'reports' },
          { key: 'kanban', label: 'CRM Lead Pipeline (Kanban)', icon: Kanban, perm: 'leads' },
          { key: 'datagrid', label: 'Enterprise DataGrid', icon: FileSpreadsheet, perm: 'approve_properties' },
          { key: 'scheduler', label: 'Visit Scheduler', icon: CalendarIcon, perm: 'verify_properties' },
          { key: 'ai_report', label: 'AI Intelligence Report', icon: Sparkles, perm: 'reports' },
        ].map((tItem) => {
          const Icon = tItem.icon;
          const isActive = activeTab === tItem.key;
          const canView = hasPermission(tItem.perm);

          if (!canView && currentRole !== 'super_admin') return null;

          return (
            <button
              key={tItem.key}
              onClick={() => setActiveTab(tItem.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                isActive
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tItem.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Syncfusion Analytics Charts */}
      {activeTab === 'analytics' && <EnterpriseCharts />}

      {/* Tab 2: CRM Kanban Lead Pipeline */}
      {activeTab === 'kanban' && <EnterpriseKanban initialLeads={realLeads} />}

      {/* Tab 3: Enterprise DataGrid */}
      {activeTab === 'datagrid' && (
        <EnterpriseDataGrid
          title="Master Properties Enterprise DataGrid"
          subtitle="Real-time listing records with column reordering, global search, filtering and export"
          columns={propertyGridColumns}
          data={stats?.propsData ?? []}
          loading={isLoading}
        />
      )}

      {/* Tab 4: Appointment & Visit Scheduler */}
      {activeTab === 'scheduler' && (
        <EnterpriseScheduler
          events={[
            {
              id: '1',
              title: 'Site Visit: Luxury Villa',
              date: new Date().toISOString().slice(0, 10),
              time: '10:30 AM',
              customerName: 'Rajesh Sharma',
              locality: 'Gachibowli',
              type: 'visit',
              status: 'confirmed',
            },
          ]}
        />
      )}

      {/* Tab 5: AI Intelligence Report */}
      {activeTab === 'ai_report' && <EnterpriseAIReportDashboard />}
    </DashboardLayout>
  );
}

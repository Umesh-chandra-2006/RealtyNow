import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Mail, Phone, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DataTable, type Column } from '../../components/data-table';
import { Badge, Card, EmptyState } from '../../components/ui';
import { useRealtimeCount } from '../../lib/realtime';
import { formatDate, generatePropertyUrl } from '../../lib/utils';

interface EnquiryRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  customer_id: string | null;
  property: { id: string; title: string } | null;
}

interface ClientRow {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  enquiryCount: number;
  lastContactAt: string;
  latestStatus: string;
  properties: { id: string; title: string }[];
}

function groupIntoClients(rows: EnquiryRow[]): ClientRow[] {
  const map = new Map<string, ClientRow>();
  for (const r of rows) {
    const key = r.customer_id ?? r.phone ?? r.email ?? r.id;
    const existing = map.get(key);
    const props = existing?.properties ?? [];
    if (r.property && !props.some((p) => p.id === r.property!.id)) props.push(r.property);
    if (!existing) {
      map.set(key, {
        key,
        name: r.name ?? 'Unknown',
        email: r.email,
        phone: r.phone,
        enquiryCount: 1,
        lastContactAt: r.created_at,
        latestStatus: r.status,
        properties: props,
      });
    } else {
      existing.enquiryCount += 1;
      existing.properties = props;
      if (new Date(r.created_at) > new Date(existing.lastContactAt)) {
        existing.lastContactAt = r.created_at;
        existing.latestStatus = r.status;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.lastContactAt).getTime() - new Date(a.lastContactAt).getTime());
}

export function AgentClients() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const realtimeTick = useRealtimeCount('enquiries', { column: 'agent_id', value: user?.id ?? '' });
  const realtimeTickAssigned = useRealtimeCount('enquiries', { column: 'assigned_to', value: user?.id ?? '' });

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-clients', user?.id, realtimeTick, realtimeTickAssigned],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquiries')
        .select('id, name, email, phone, status, created_at, customer_id, property:properties(id, title)')
        .or(`agent_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((e) => ({
        ...e,
        property: Array.isArray(e.property) ? e.property[0] : e.property,
      })) as EnquiryRow[];
    },
    enabled: !!user,
  });

  const clients = useMemo(() => groupIntoClients(data ?? []), [data]);

  const stats = useMemo(() => {
    const recent = clients.filter((c) => Date.now() - new Date(c.lastContactAt).getTime() < 30 * 24 * 60 * 60 * 1000);
    return {
      total: clients.length,
      active: clients.filter((c) => c.latestStatus === 'new' || c.latestStatus === 'contacted').length,
      recentlyActive: recent.length,
    };
  }, [clients]);

  const columns: Column<ClientRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Client',
        sortable: true,
        render: (c) => (
          <div>
            <p className="font-semibold text-navy-900">{c.name}</p>
            <p className="text-xs text-navy-400">{c.enquiryCount} enquir{c.enquiryCount === 1 ? 'y' : 'ies'}</p>
          </div>
        ),
      },
      {
        key: 'contact',
        header: 'Contact',
        render: (c) => (
          <div className="text-xs space-y-1">
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-navy-700 hover:text-navy-900">
                <Mail className="h-3 w-3 text-navy-400" /> {c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="flex items-center gap-1 font-semibold text-navy-700 hover:text-navy-900">
                <Phone className="h-3 w-3 text-navy-400" /> {c.phone}
              </a>
            )}
          </div>
        ),
      },
      {
        key: 'properties',
        header: 'Interested In',
        render: (c) => (
          <div className="flex flex-col gap-1">
            {c.properties.slice(0, 2).map((p) => (
              <Link key={p.id} to={generatePropertyUrl(p)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
                <Building2 className="h-3 w-3" /> <span className="line-clamp-1">{p.title}</span>
              </Link>
            ))}
            {c.properties.length > 2 && <span className="text-xs text-navy-400">+{c.properties.length - 2} more</span>}
          </div>
        ),
      },
      {
        key: 'lastContactAt',
        header: 'Last Contact',
        sortable: true,
        render: (c) => <span className="text-xs text-navy-500">{formatDate(c.lastContactAt)}</span>,
      },
      {
        key: 'status',
        header: 'Latest Status',
        render: (c) => (
          <Badge
            variant={
              c.latestStatus === 'new' ? 'info' : c.latestStatus === 'contacted' ? 'success' : c.latestStatus === 'closed' ? 'default' : 'error'
            }
            className="capitalize"
          >
            {c.latestStatus}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (c) => (
          <Link to={`/agent/leads?status=all`} className="text-xs font-semibold text-primary-600 hover:underline">
            View leads
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout sections={agentSections} title="Clients" badge="Agent">
      <PageHeader title="Client Management" subtitle="Everyone who's enquired with you, grouped by contact." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Clients" value={stats.total} icon={<Users className="h-5 w-5" />} accent="navy" />
        <StatCard label="Active (New/Contacted)" value={stats.active} icon={<Users className="h-5 w-5" />} accent="gold" />
        <StatCard label="Active in Last 30 Days" value={stats.recentlyActive} icon={<Users className="h-5 w-5" />} accent="success" />
      </div>

      {isLoading ? (
        <Card className="p-8">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 skeleton rounded-xl" />
            ))}
          </div>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={clients}
          error={error instanceof Error ? error.message : null}
          getRowId={(c) => c.key}
          searchKeys={['name', 'email', 'phone']}
          cardRender={(c) => (
            <div
              key={c.key}
              className="card p-5 hover:shadow-cardHover transition-all flex flex-col justify-between h-full group bg-white border border-slate-200/80 rounded-2xl"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-bold text-navy-900 text-base shadow-2xs shrink-0">
                      {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-navy-900 text-base truncate">{c.name}</h4>
                      <p className="text-xs text-slate-500">{c.enquiryCount} enquir{c.enquiryCount === 1 ? 'y' : 'ies'}</p>
                    </div>
                  </div>
                  <Badge variant={c.latestStatus === 'converted' ? 'success' : c.latestStatus === 'new' ? 'info' : 'default'} className="capitalize shrink-0">
                    {c.latestStatus}
                  </Badge>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  {c.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a href={`mailto:${c.email}`} className="truncate hover:text-red-600 hover:underline">
                        {c.email}
                      </a>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a href={`tel:${c.phone}`} className="hover:text-red-600 hover:underline">
                        {c.phone}
                      </a>
                    </div>
                  )}
                </div>

                {c.properties.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Enquired Properties</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.properties.slice(0, 3).map((p) => (
                        <Link
                          key={p.id}
                          to={generatePropertyUrl(p)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-navy-800 text-xs font-medium truncate max-w-full"
                        >
                          <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{p.title}</span>
                        </Link>
                      ))}
                      {c.properties.length > 3 && (
                        <span className="text-xs text-slate-400 self-center">+{c.properties.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Last contact: {formatDate(c.lastContactAt)}</span>
              </div>
            </div>
          )}
          emptyState={
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No clients found"
              description="Clients are built automatically from your incoming enquiries."
            />
          }
        />
      )}
    </DashboardLayout>
  );
}

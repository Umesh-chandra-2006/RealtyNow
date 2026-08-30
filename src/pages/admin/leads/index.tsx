import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Download,
  Eye,
  Phone,
  LayoutList,
  LayoutGrid,
  MessageCircle,
  Trash2,
  CheckSquare,
  Inbox,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useToast } from '../../../components/toast';
import { Button, Input, Select, Badge, Modal, Textarea } from '../../../components/ui';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { getAdminSections } from '../../portal/sections';
import { useLanguageContext } from '../../../lib/i18n/language-context';
import {
  formatDate,
  buildWhatsAppUrl,
  exportToCsv,
  exportToExcel,
  cn,
} from '../../../lib/utils';
import {
  ServiceLead,
  ServiceLeadDetailDrawer,
  LEAD_STATUS_CONFIG,
  PRIORITY_CONFIG,
  SERVICE_TYPE_BADGES,
} from '../../../components/admin/leads/ServiceLeadDetailDrawer';

export const SERVICE_TABS = [
  { key: 'ALL', label: 'All Leads', serviceType: null },
  { key: 'HOME_SERVICES', label: 'Home Services', serviceType: 'HOME_SERVICES' },
  { key: 'INTERIOR_SERVICES', label: 'Interior Services', serviceType: 'INTERIOR_SERVICES' },
  { key: 'BOREWELL_SERVICES', label: 'Borewell Services', serviceType: 'BOREWELL_SERVICES' },
  { key: 'HOME_LOANS', label: 'Home Loans', serviceType: 'HOME_LOANS' },
  { key: 'LEGAL_SERVICES', label: 'Legal Services', serviceType: 'LEGAL_SERVICES' },
  { key: 'PACKERS_MOVERS', label: 'Packers & Movers', serviceType: 'PACKERS_MOVERS' },
  { key: 'PEST_CONTROL', label: 'Pest Control', serviceType: 'PEST_CONTROL' },
  { key: 'PAINTING', label: 'Painting', serviceType: 'PAINTING' },
  { key: 'CLEANING', label: 'Cleaning', serviceType: 'CLEANING' },
] as const;

export const toDbLeadStatus = (status: string): string => {
  const map: Record<string, string> = {
    new: 'new',
    assigned: 'assigned',
    contacted: 'contacted',
    follow_up: 'contacted',
    in_progress: 'contacted',
    qualified: 'contacted',
    site_visit: 'site_visit',
    negotiation: 'negotiation',
    converted: 'won',
    won: 'won',
    closed: 'closed',
    lost: 'lost',
    spam: 'spam',
    duplicate: 'duplicate',
  };
  return map[status?.toLowerCase()] || 'new';
};

export function AdminAllLeadsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { t } = useLanguageContext();
  const queryClient = useQueryClient();

  const adminSections = useMemo(() => getAdminSections(t), [t]);

  // Active service tab
  const [activeTab, setActiveTab] = useState<string>('ALL');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Sorting
  const [sortField, setSortField] = useState<'created_at' | 'priority' | 'lead_status' | 'name'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Multi-selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Drawer state
  const [selectedLeadIdForDrawer, setSelectedLeadIdForDrawer] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Manual Lead Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    email: '',
    service_type: 'HOME_LOANS',
    location: '',
    city: 'Hyderabad',
    priority: 'medium',
    message: '',
    budget: '',
  });

  // 1. Fetch live staff members for assignee filter & assignments
  const { data: staffMembers = [] } = useQuery({
    queryKey: ['staff-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .in('role', ['admin', 'staff', 'manager', 'executive', 'agent', 'support'])
        .order('first_name', { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  // 2. Fetch all leads from database with resilient fallback
  const {
    data: rawLeads = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ServiceLead[]>({
    queryKey: ['admin-all-service-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching enquiries:', error);
        throw error;
      }
      return (data as ServiceLead[]) ?? [];
    },
  });

  // Realtime synchronization for new leads
  useEffect(() => {
    const channel = supabase
      .channel('admin-service-leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'enquiries' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Enrich leads with assignee profile info
  const allLeads = useMemo(() => {
    const staffMap = new Map((staffMembers || []).map((m: any) => [m.id, m]));
    return rawLeads.map((lead) => ({
      ...lead,
      assignee: lead.assigned_to ? staffMap.get(lead.assigned_to) || null : null,
    }));
  }, [rawLeads, staffMembers]);

  // Helper to determine service type if missing
  const normalizeServiceType = (lead: ServiceLead): string => {
    if (lead.service_type && lead.service_type !== 'GENERAL_ENQUIRY') {
      return lead.service_type;
    }
    const tags = (lead.tags || []).map((t) => t.toLowerCase());
    const src = (lead.source || '').toLowerCase();

    if (src.includes('home_loans') || tags.includes('home-loans') || tags.includes('home-loan')) return 'HOME_LOANS';
    if (src.includes('borewell') || tags.includes('borewell-services') || tags.includes('borewell')) return 'BOREWELL_SERVICES';
    if (src.includes('legal') || tags.includes('legal-services') || tags.includes('legal services')) return 'LEGAL_SERVICES';
    if (src.includes('packers') || tags.includes('packers-movers') || tags.includes('packers and movers')) return 'PACKERS_MOVERS';
    if (src.includes('pest') || tags.includes('pest-control') || tags.includes('pest control')) return 'PEST_CONTROL';
    if (src.includes('painting') || tags.includes('painting')) return 'PAINTING';
    if (src.includes('cleaning') || tags.includes('cleaning')) return 'CLEANING';
    if (src.includes('interior') || tags.includes('interior-services') || tags.includes('interior services')) return 'INTERIOR_SERVICES';
    if (src.includes('home_services') || tags.includes('home-services') || tags.includes('home services')) return 'HOME_SERVICES';

    return 'GENERAL_ENQUIRY';
  };

  // Dynamic counts for tabs
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allLeads.length };
    SERVICE_TABS.forEach((tab) => {
      if (tab.key !== 'ALL') counts[tab.key] = 0;
    });

    allLeads.forEach((lead) => {
      const sType = normalizeServiceType(lead);
      if (counts[sType] !== undefined) {
        counts[sType] += 1;
      }
    });

    return counts;
  }, [allLeads]);

  // Dynamic KPIs (Total, New, In Progress, Contacted, Converted, Closed, Today, This Week, This Month)
  const kpis = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const total = allLeads.length;
    let newCount = 0;
    let inProgressCount = 0;
    let contactedCount = 0;
    let convertedCount = 0;
    let closedCount = 0;
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    allLeads.forEach((lead) => {
      const st = (lead.lead_status || lead.status || 'new').toLowerCase();
      const leadTime = new Date(lead.created_at).getTime();

      if (st === 'new') newCount++;
      else if (st === 'in_progress' || st === 'follow_up' || st === 'qualified') inProgressCount++;
      else if (st === 'contacted') contactedCount++;
      else if (st === 'converted') convertedCount++;
      else if (st === 'closed' || st === 'lost') closedCount++;

      if (leadTime >= startOfToday) todayCount++;
      if (leadTime >= startOfWeek) weekCount++;
      if (leadTime >= startOfMonth) monthCount++;
    });

    return {
      total,
      newCount,
      inProgressCount,
      contactedCount,
      convertedCount,
      closedCount,
      todayCount,
      weekCount,
      monthCount,
    };
  }, [allLeads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      // 1. Service Tab Filter
      if (activeTab !== 'ALL') {
        const sType = normalizeServiceType(lead);
        if (sType !== activeTab) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        const st = (lead.lead_status || lead.status || 'new').toLowerCase();
        if (st !== statusFilter.toLowerCase()) return false;
      }

      // 3. Priority Filter
      if (priorityFilter !== 'ALL') {
        const pr = (lead.priority || 'medium').toLowerCase();
        if (pr !== priorityFilter.toLowerCase()) return false;
      }

      // 4. Assignee Filter
      if (assigneeFilter !== 'ALL') {
        if (assigneeFilter === 'UNASSIGNED') {
          if (lead.assigned_to) return false;
        } else if (lead.assigned_to !== assigneeFilter) {
          return false;
        }
      }

      // 5. Date Range Filter
      if (dateRangeFilter !== 'ALL') {
        const now = new Date();
        const leadTime = new Date(lead.created_at).getTime();
        if (dateRangeFilter === 'TODAY') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (leadTime < startOfToday) return false;
        } else if (dateRangeFilter === 'YESTERDAY') {
          const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (leadTime < startOfYesterday || leadTime >= startOfToday) return false;
        } else if (dateRangeFilter === 'LAST_7_DAYS') {
          const start7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
          if (leadTime < start7) return false;
        } else if (dateRangeFilter === 'LAST_30_DAYS') {
          const start30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
          if (leadTime < start30) return false;
        } else if (dateRangeFilter === 'THIS_MONTH') {
          const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          if (leadTime < startMonth) return false;
        }
      }

      // 6. Global Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const leadNum = (lead.lead_number || `RN-LEAD-${lead.id.substring(0, 6)}`).toLowerCase();
        const name = (lead.name || '').toLowerCase();
        const phone = (lead.phone || '').toLowerCase();
        const email = (lead.email || '').toLowerCase();
        const msg = (lead.service_request || lead.message || '').toLowerCase();
        const loc = (lead.location || lead.city || '').toLowerCase();

        return (
          leadNum.includes(q) ||
          name.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          msg.includes(q) ||
          loc.includes(q)
        );
      }

      return true;
    });
  }, [allLeads, activeTab, statusFilter, priorityFilter, assigneeFilter, dateRangeFilter, searchQuery]);

  // Sorted Leads
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'created_at') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredLeads, sortField, sortAsc]);

  // Paginated Leads
  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, page, pageSize]);

  const totalPages = Math.ceil(sortedLeads.length / pageSize) || 1;

  // Multi-select handlers
  const isAllPageSelected =
    paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedLeadIds.includes(l.id));

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !paginatedLeads.some((l) => l.id === id)));
    } else {
      const pageIds = paginatedLeads.map((l) => l.id);
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk status update
  const bulkStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (selectedLeadIds.length === 0) return;
      const { error } = await supabase
        .from('enquiries')
        .update({
          status: newStatus,
          lead_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedLeadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      setSelectedLeadIds([]);
      addToast('success', 'Selected leads updated');
    },
    onError: (err: any) => {
      addToast('error', `Failed to update leads: ${err.message}`);
    },
  });

  // Bulk priority update
  const bulkPriorityMutation = useMutation({
    mutationFn: async (newPriority: string) => {
      if (selectedLeadIds.length === 0) return;
      const { error } = await supabase
        .from('enquiries')
        .update({
          priority: newPriority,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedLeadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      setSelectedLeadIds([]);
      addToast('success', 'Selected leads updated');
    },
    onError: (err: any) => {
      addToast('error', `Failed to update priority: ${err.message}`);
    },
  });

  // Bulk assignee update
  const bulkAssigneeMutation = useMutation({
    mutationFn: async (assigneeId: string) => {
      if (selectedLeadIds.length === 0) return;
      const { error } = await supabase
        .from('enquiries')
        .update({
          assigned_to: assigneeId || null,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedLeadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      setSelectedLeadIds([]);
      addToast('success', 'Selected leads assigned');
    },
    onError: (err: any) => {
      addToast('error', `Failed to assign leads: ${err.message}`);
    },
  });

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      if (selectedLeadIds.length === 0) return;
      if (!confirm(`Are you sure you want to permanently delete ${selectedLeadIds.length} lead(s)?`)) return;
      const { error } = await supabase.from('enquiries').delete().in('id', selectedLeadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      setSelectedLeadIds([]);
      addToast('success', 'Selected leads deleted');
    },
    onError: (err: any) => {
      addToast('error', `Failed to delete leads: ${err.message}`);
    },
  });

  // Inline status mutation
  const inlineStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const dbStatus = toDbLeadStatus(status);
      const updates: Record<string, any> = {
        status: dbStatus,
        lead_status: dbStatus,
        updated_at: new Date().toISOString(),
      };
      if (status === 'converted' || status === 'won') updates.converted_at = new Date().toISOString();
      if (status === 'closed' || status === 'lost') updates.closed_at = new Date().toISOString();

      const { error } = await supabase
        .from('enquiries')
        .update(updates)
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      addToast('success', 'Status updated');
    },
  });

  // Inline priority mutation
  const inlinePriorityMutation = useMutation({
    mutationFn: async ({ leadId, priority }: { leadId: string; priority: string }) => {
      const { error } = await supabase
        .from('enquiries')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      addToast('success', 'Priority updated');
    },
  });

  // Inline assignee mutation
  const inlineAssigneeMutation = useMutation({
    mutationFn: async ({ leadId, assigneeId }: { leadId: string; assigneeId: string }) => {
      const { error } = await supabase
        .from('enquiries')
        .update({
          assigned_to: assigneeId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      addToast('success', 'Assignee updated');
    },
  });

  // Manual Lead Creation Mutation
  const createLeadMutation = useMutation({
    mutationFn: async () => {
      const cleanName = createForm.name.trim();
      const cleanPhone = createForm.phone.trim();
      if (!cleanName || !cleanPhone) throw new Error('Name and Phone are required');

      const msg = createForm.message.trim() || `${SERVICE_TYPE_BADGES[createForm.service_type]?.label || createForm.service_type} enquiry`;

      // Try RPC first
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('submit_contact_enquiry', {
          p_name: cleanName,
          p_phone: cleanPhone,
          p_email: createForm.email.trim() || null,
          p_message: msg,
          p_source: 'portal',
          p_tags: [createForm.service_type, createForm.location.trim()].filter(Boolean),
          p_service_type: createForm.service_type,
          p_city: createForm.city.trim() || null,
          p_location: createForm.location.trim() || null,
          p_service_data: { budget: createForm.budget || null },
        });

        if (!rpcError && (rpcData as any)?.success !== false) {
          return rpcData;
        }
      } catch (e) {
        console.warn('RPC error, falling back to direct insert', e);
      }

      // Direct insert fallback
      const { error: insertErr } = await supabase.from('enquiries').insert({
        name: cleanName,
        phone: cleanPhone,
        email: createForm.email.trim() || null,
        message: msg,
        service_request: msg,
        source: 'portal',
        status: 'new',
        lead_status: 'new',
        priority: createForm.priority,
        tags: [createForm.service_type, createForm.location.trim()].filter(Boolean),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        phone: '',
        email: '',
        service_type: 'HOME_LOANS',
        location: '',
        city: 'Hyderabad',
        priority: 'medium',
        message: '',
        budget: '',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-all-service-leads'] });
      refetch();
      addToast('success', 'Lead created successfully!');
    },
    onError: (err: any) => {
      addToast('error', err.message || 'Failed to create lead');
    },
  });

  // Export handlers
  const handleExportCsv = () => {
    const exportData = sortedLeads.map((lead) => {
      const sKey = normalizeServiceType(lead);
      return {
        'Lead Number': lead.lead_number || `RN-LEAD-${lead.id.substring(0, 6)}`,
        'Customer Name': lead.name || '',
        'Phone Number': lead.phone || '',
        'Email Address': lead.email || '',
        'Service Category': SERVICE_TYPE_BADGES[sKey]?.label || sKey,
        Status: (lead.lead_status || lead.status || 'new').toUpperCase(),
        Priority: (lead.priority || 'medium').toUpperCase(),
        Location: lead.location || lead.city || '',
        Message: lead.service_request || lead.message || '',
        'Assigned To': lead.assignee ? `${lead.assignee.first_name || ''} ${lead.assignee.last_name || ''}` : 'Unassigned',
        'Follow Up Date': lead.follow_up_at ? formatDate(lead.follow_up_at) : '',
        'Created At': formatDate(lead.created_at),
      };
    });

    exportToCsv(exportData, `RealtyNow_All_Leads_${new Date().toISOString().split('T')[0]}`);
    addToast('success', `Exported ${exportData.length} leads to CSV`);
  };

  const handleExportExcel = () => {
    const exportData = sortedLeads.map((lead) => {
      const sKey = normalizeServiceType(lead);
      return {
        'Lead Number': lead.lead_number || `RN-LEAD-${lead.id.substring(0, 6)}`,
        'Customer Name': lead.name || '',
        'Phone Number': lead.phone || '',
        'Email Address': lead.email || '',
        'Service Category': SERVICE_TYPE_BADGES[sKey]?.label || sKey,
        Status: (lead.lead_status || lead.status || 'new').toUpperCase(),
        Priority: (lead.priority || 'medium').toUpperCase(),
        Location: lead.location || lead.city || '',
        Message: lead.service_request || lead.message || '',
        'Assigned To': lead.assignee ? `${lead.assignee.first_name || ''} ${lead.assignee.last_name || ''}` : 'Unassigned',
        'Follow Up Date': lead.follow_up_at ? formatDate(lead.follow_up_at) : '',
        'Created At': formatDate(lead.created_at),
      };
    });

    exportToExcel(exportData, `RealtyNow_All_Leads_${new Date().toISOString().split('T')[0]}`);
    addToast('success', `Exported ${exportData.length} leads to Excel`);
  };

  const openDrawer = (leadId: string) => {
    setSelectedLeadIdForDrawer(leadId);
    setIsDrawerOpen(true);
  };

  return (
    <DashboardLayout sections={adminSections} title="All Leads">
      <div className="space-y-6 pb-12">
      {/* 1. Header & Live Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-500/20">
                <Inbox className="h-5 w-5" />
              </span>
              All Leads
            </h1>
            <Badge variant="default" className="text-xs font-mono font-bold bg-slate-100 text-slate-700">
              {allLeads.length} Total
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage, track and process all customer enquiries and service requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            icon={<Plus className="h-4 w-4" />}
            className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
          >
            + Create Lead
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            loading={isRefetching}
            icon={<RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />}
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            icon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            icon={<Download className="h-4 w-4" />}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'TOTAL LEADS', value: kpis.total, color: 'text-slate-900', bg: 'bg-white border-slate-200/80', badge: `${kpis.todayCount} Today` },
          { label: 'NEW LEADS', value: kpis.newCount, color: 'text-blue-600', bg: 'bg-blue-50/50 border-blue-100', badge: 'Unassigned/Action' },
          { label: 'IN PROGRESS', value: kpis.inProgressCount, color: 'text-purple-600', bg: 'bg-purple-50/50 border-purple-100', badge: 'Active Pipeline' },
          { label: 'CONTACTED', value: kpis.contactedCount, color: 'text-amber-600', bg: 'bg-amber-50/50 border-amber-100', badge: 'Follow Up Set' },
          { label: 'CONVERTED', value: kpis.convertedCount, color: 'text-emerald-600', bg: 'bg-emerald-50/50 border-emerald-100', badge: 'Won Clients' },
          { label: 'CLOSED', value: kpis.closedCount, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200/60', badge: 'Archived/Lost' },
        ].map((card, i) => (
          <div key={i} className={cn('rounded-2xl border p-4 shadow-2xs space-y-1', card.bg)}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {card.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className={cn('font-display text-2xl font-black', card.color)}>
                {card.value}
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-white/80 border border-slate-200/50 px-1.5 py-0.5 rounded-md">
                {card.badge}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. 10 Service Tabs with Live Badges */}
      <div className="border-b border-slate-200 bg-white rounded-2xl p-2 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          {SERVICE_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                }}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0',
                  isActive
                    ? 'bg-red-600 text-white shadow-xs font-extrabold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono',
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Global Search & Advanced Multi-Filters */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Lead #, Customer, Phone, Email, Location..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="input pl-9.5 text-xs w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(LEAD_STATUS_CONFIG).map(([stKey, stVal]) => (
                <option key={stKey} value={stKey}>
                  {stVal.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="md:col-span-2">
            <Select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>

          {/* Assignee Filter */}
          <div className="md:col-span-2">
            <Select
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="ALL">All Assignees</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {staffMembers?.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.first_name ? `${m.first_name} ${m.last_name || ''}` : m.email}
                </option>
              ))}
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="md:col-span-2">
            <Select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="THIS_MONTH">This Month</option>
            </Select>
          </div>
        </div>

        {/* View Mode & Active Counts Strip */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-500 border-t border-slate-100">
          <div>
            Showing <span className="font-bold text-slate-900">{sortedLeads.length}</span> lead(s) matching criteria
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1.5 rounded-lg border transition cursor-pointer',
                viewMode === 'table'
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
              title="Table View"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                'p-1.5 rounded-lg border transition cursor-pointer',
                viewMode === 'cards'
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
              title="Cards View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Bulk Action Strip (When records are selected) */}
      {selectedLeadIds.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-red-900">
            <CheckSquare className="h-4 w-4 text-red-600" />
            <span>{selectedLeadIds.length} lead(s) selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Batch Status */}
            <Select
              onChange={(e) => {
                if (e.target.value) bulkStatusMutation.mutate(e.target.value);
              }}
              className="text-xs py-1"
            >
              <option value="">Set Status...</option>
              {Object.entries(LEAD_STATUS_CONFIG).map(([stKey, stVal]) => (
                <option key={stKey} value={stKey}>
                  {stVal.label}
                </option>
              ))}
            </Select>

            {/* Batch Priority */}
            <Select
              onChange={(e) => {
                if (e.target.value) bulkPriorityMutation.mutate(e.target.value);
              }}
              className="text-xs py-1"
            >
              <option value="">Set Priority...</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>

            {/* Batch Assign */}
            <Select
              onChange={(e) => {
                if (e.target.value !== '') bulkAssigneeMutation.mutate(e.target.value);
              }}
              className="text-xs py-1"
            >
              <option value="">Assign To...</option>
              <option value="">Unassigned</option>
              {staffMembers?.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.first_name ? `${m.first_name} ${m.last_name || ''}` : m.email}
                </option>
              ))}
            </Select>

            {/* Batch Delete */}
            <Button
              variant="danger"
              size="sm"
              onClick={() => bulkDeleteMutation.mutate()}
              loading={bulkDeleteMutation.isPending}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Delete
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLeadIds([])}
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* 6. Leads Display (Table or Cards) */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-4">
          <div className="h-8 w-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading service leads...</p>
        </div>
      ) : sortedLeads.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <Inbox className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-display text-base font-black text-slate-900">No leads found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No service leads matched your active search query or filter selection.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
              setAssigneeFilter('ALL');
              setDateRangeFilter('ALL');
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : viewMode === 'table' ? (
        /* Rich Table View */
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] relative">
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-2xs">
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 w-10 text-center border-b border-slate-200 shadow-xs">
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={toggleSelectAllPage}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[130px] border-b border-slate-200 shadow-xs">Lead Number</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[200px] border-b border-slate-200 shadow-xs">Customer</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[150px] border-b border-slate-200 shadow-xs">Service Category</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[220px] border-b border-slate-200 shadow-xs">Requirement / Notes</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[130px] border-b border-slate-200 shadow-xs">Status</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[120px] border-b border-slate-200 shadow-xs">Priority</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[150px] border-b border-slate-200 shadow-xs">Assigned Staff</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[120px] border-b border-slate-200 shadow-xs">Received Date</th>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3.5 px-4 min-w-[120px] text-right border-b border-slate-200 shadow-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLeads.map((lead) => {
                  const sKey = normalizeServiceType(lead);
                  const serviceBadge = SERVICE_TYPE_BADGES[sKey] || SERVICE_TYPE_BADGES.GENERAL_ENQUIRY;
                  const currentSt = (lead.lead_status || lead.status || 'new').toLowerCase();
                  const statusCfg = LEAD_STATUS_CONFIG[currentSt] || LEAD_STATUS_CONFIG.new;
                  const currentPr = (lead.priority || 'medium').toLowerCase();
                  const priorityCfg = PRIORITY_CONFIG[currentPr] || PRIORITY_CONFIG.medium;
                  const displayLeadNum = lead.lead_number || `RN-LEAD-${lead.id.substring(0, 6)}`;
                  const isSelected = selectedLeadIds.includes(lead.id);

                  const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
                  const waUrl = buildWhatsAppUrl(
                    cleanPhone,
                    `Hello ${lead.name || 'Customer'}, regarding your ${serviceBadge.label} request on RealtyNow (${displayLeadNum}):`
                  );

                  return (
                    <tr
                      key={lead.id}
                      className={cn(
                        'hover:bg-slate-50/80 transition-colors group',
                        isSelected && 'bg-red-50/40'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLead(lead.id)}
                          className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                      </td>

                      {/* Lead Number */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openDrawer(lead.id)}
                          className="font-mono font-black text-slate-900 hover:text-red-600 hover:underline transition cursor-pointer text-left"
                        >
                          {displayLeadNum}
                        </button>
                      </td>

                      {/* Customer Info & Contact Quick Actions */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <button
                            onClick={() => openDrawer(lead.id)}
                            className="font-bold text-slate-900 hover:text-red-600 transition text-left block truncate max-w-[180px]"
                          >
                            {lead.name || 'Anonymous'}
                          </button>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {lead.phone && (
                              <a
                                href={`tel:${lead.phone}`}
                                className="hover:text-blue-600 flex items-center gap-1 font-medium"
                                title="Call Customer"
                              >
                                <Phone className="h-3 w-3" />
                                <span>{lead.phone}</span>
                              </a>
                            )}
                            {lead.phone && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 font-bold"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Service Category Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
                            serviceBadge.bg,
                            serviceBadge.color,
                            serviceBadge.border
                          )}
                        >
                          <span>{serviceBadge.icon}</span>
                          <span>{serviceBadge.label}</span>
                        </span>
                      </td>

                      {/* Requirement / Message */}
                      <td className="py-3 px-4">
                        <div className="max-w-[240px]">
                          <p className="text-slate-700 truncate font-medium">
                            {lead.service_request || lead.message || 'No additional note'}
                          </p>
                          {(lead.location || lead.city) && (
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5 font-semibold">
                              📍 {lead.location || ''} {lead.city ? `(${lead.city})` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Inline Status Dropdown */}
                      <td className="py-3 px-4">
                        <select
                          value={currentSt}
                          onChange={(e) =>
                            inlineStatusMutation.mutate({ leadId: lead.id, status: e.target.value })
                          }
                          className={cn(
                            'text-xs font-bold rounded-lg border px-2 py-1 cursor-pointer outline-none transition',
                            statusCfg.bg,
                            statusCfg.color,
                            statusCfg.border
                          )}
                        >
                          {Object.entries(LEAD_STATUS_CONFIG).map(([stKey, stVal]) => (
                            <option key={stKey} value={stKey}>
                              {stVal.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Inline Priority Dropdown */}
                      <td className="py-3 px-4">
                        <select
                          value={currentPr}
                          onChange={(e) =>
                            inlinePriorityMutation.mutate({ leadId: lead.id, priority: e.target.value })
                          }
                          className={cn(
                            'text-xs font-bold rounded-lg border px-2 py-1 cursor-pointer outline-none transition',
                            priorityCfg.bg,
                            priorityCfg.color
                          )}
                        >
                          <option value="urgent">🔴 Urgent</option>
                          <option value="high">🟠 High</option>
                          <option value="medium">🔵 Medium</option>
                          <option value="low">⚪ Low</option>
                        </select>
                      </td>

                      {/* Assigned Staff */}
                      <td className="py-3 px-4">
                        <select
                          value={lead.assigned_to || ''}
                          onChange={(e) =>
                            inlineAssigneeMutation.mutate({ leadId: lead.id, assigneeId: e.target.value })
                          }
                          className="text-xs font-medium rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 cursor-pointer max-w-[140px] truncate"
                        >
                          <option value="">Unassigned</option>
                          {staffMembers?.map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.first_name ? `${m.first_name} ${m.last_name || ''}` : m.email}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Received Date */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        <span className="font-semibold">{formatDate(lead.created_at)}</span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDrawer(lead.id)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                            title="View Lead Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {lead.phone && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                              title="WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Responsive Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedLeads.map((lead) => {
            const sKey = normalizeServiceType(lead);
            const serviceBadge = SERVICE_TYPE_BADGES[sKey] || SERVICE_TYPE_BADGES.GENERAL_ENQUIRY;
            const currentSt = (lead.lead_status || lead.status || 'new').toLowerCase();
            const statusCfg = LEAD_STATUS_CONFIG[currentSt] || LEAD_STATUS_CONFIG.new;
            const currentPr = (lead.priority || 'medium').toLowerCase();
            const priorityCfg = PRIORITY_CONFIG[currentPr] || PRIORITY_CONFIG.medium;
            const displayLeadNum = lead.lead_number || `RN-LEAD-${lead.id.substring(0, 6)}`;
            const isSelected = selectedLeadIds.includes(lead.id);

            const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
            const waUrl = buildWhatsAppUrl(
              cleanPhone,
              `Hello ${lead.name || 'Customer'}, regarding your ${serviceBadge.label} request on RealtyNow (${displayLeadNum}):`
            );

            return (
              <div
                key={lead.id}
                className={cn(
                  'rounded-2xl border bg-white p-5 shadow-2xs space-y-4 transition-all hover:shadow-md',
                  isSelected ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20' : 'border-slate-200/90'
                )}
              >
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 border border-slate-200/70 px-2 py-0.5 rounded-md">
                      {displayLeadNum}
                    </span>
                    <h3 className="font-display text-base font-black text-slate-900 mt-1">
                      {lead.name || 'Anonymous Customer'}
                    </h3>
                  </div>

                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold',
                      serviceBadge.bg,
                      serviceBadge.color,
                      serviceBadge.border
                    )}
                  >
                    <span>{serviceBadge.icon}</span>
                    <span>{serviceBadge.label}</span>
                  </span>
                </div>

                {/* Message preview */}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {lead.service_request || lead.message || 'No additional note provided.'}
                </p>

                {/* Badges strip */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
                      statusCfg.bg,
                      statusCfg.color,
                      statusCfg.border
                    )}
                  >
                    {statusCfg.label}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase',
                      priorityCfg.bg,
                      priorityCfg.color
                    )}
                  >
                    {priorityCfg.label}
                  </span>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {formatDate(lead.created_at)}
                  </span>

                  <div className="flex items-center gap-2">
                    {lead.phone && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    <Button size="sm" onClick={() => openDrawer(lead.id)}>
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Pagination Controls */}
      {sortedLeads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Page <span className="font-bold text-slate-900">{page}</span> of{' '}
              <span className="font-bold text-slate-900">{totalPages}</span> ({sortedLeads.length} leads total)
            </span>
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="input py-1 px-2 text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* 8. Slide-out Lead Detail Drawer */}
      <ServiceLeadDetailDrawer
        leadId={selectedLeadIdForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLeadIdForDrawer(null);
        }}
        onLeadUpdated={() => refetch()}
      />

      {/* 9. Manual Create Lead Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Service Lead"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createLeadMutation.isPending}
              onClick={() => createLeadMutation.mutate()}
            >
              Create Lead
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Customer Name *"
              placeholder="e.g. Rajesh Sharma"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            />
            <Input
              label="Phone Number *"
              placeholder="e.g. +91 98765 43210"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. rajesh@example.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
            <div>
              <label className="label">Service Category *</label>
              <Select
                value={createForm.service_type}
                onChange={(e) => setCreateForm({ ...createForm, service_type: e.target.value })}
              >
                {SERVICE_TABS.filter((t) => t.key !== 'ALL').map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Location / Area"
              placeholder="e.g. Tellapur, Gachibowli"
              value={createForm.location}
              onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
            />
            <Input
              label="City"
              placeholder="e.g. Hyderabad"
              value={createForm.city}
              onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
            />
            <div>
              <label className="label">Priority</label>
              <Select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="label">Budget / Loan Requirement (Optional)</label>
            <Input
              placeholder="e.g. ₹75,00,000"
              value={createForm.budget}
              onChange={(e) => setCreateForm({ ...createForm, budget: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Requirements / Customer Message</label>
            <Textarea
              rows={3}
              placeholder="Enter customer specific requests, preferred style, date or time..."
              value={createForm.message}
              onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })}
            />
          </div>
        </div>
      </Modal>
      </div>
    </DashboardLayout>
  );
}

export default AdminAllLeadsPage;

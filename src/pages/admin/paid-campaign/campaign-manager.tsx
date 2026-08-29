import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  SlidersHorizontal,
  Building2,
  Award,
  LayoutGrid,
  Zap,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Copy,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  MapPin,
  IndianRupee,
  Building,
  Smartphone,
  Tablet,
  Monitor,
  Table as TableIcon,
  Filter,
} from 'lucide-react';
import { DashboardLayout, PageHeader } from '../../../components/dashboard-layout';
import { getAdminSections } from '../../portal/sections';
import { useLanguageContext } from '../../../lib/i18n/language-context';
import { Card, Button, Badge, Modal, Input, Select, Skeleton, EmptyState } from '../../../components/ui';
import { useToast } from '../../../components/toast';
import { formatDate, formatPrice, cn } from '../../../lib/utils';
import { PropertyImage } from '../../../components/property-image';
import { DEFAULT_PROPERTY_IMAGE } from '../../../lib/property-images';
import { FeaturedScheduleControl } from '../../../components/admin/featured-schedule-control';
import {
  type CampaignType,
  type CampaignStatus,
  type CampaignPriority,
  type PaidCampaign,
  CAMPAIGN_SECTIONS_CONFIG,
  fetchAdminCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  reorderCampaigns,
  bulkUpdateCampaignsActive,
  bulkDeleteCampaigns,
  fetchEligiblePropertiesForCampaign,
  fetchEligibleBuildersForCampaign,
} from '../../../lib/paid-campaigns-api';

export function CampaignManagerPage({ campaignType }: { campaignType: CampaignType }) {
  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const config = CAMPAIGN_SECTIONS_CONFIG[campaignType];

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CampaignStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<PaidCampaign | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<PaidCampaign | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBadge, setFormBadge] = useState('');
  const [formCtaLabel, setFormCtaLabel] = useState('');
  const [formCtaUrl, setFormCtaUrl] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formPriority, setFormPriority] = useState<CampaignPriority>('High');
  const [formStartAt, setFormStartAt] = useState<string | null>(null);
  const [formEndAt, setFormEndAt] = useState<string | null>(null);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPropertyId, setFormPropertyId] = useState<string | null>(null);
  const [formBuilderId, setFormBuilderId] = useState<string | null>(null);

  // Entity selector search inside modal
  const [entitySearch, setEntitySearch] = useState('');

  // Fetch campaigns
  const { data: campaignList = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-paid-campaigns', campaignType],
    queryFn: () => fetchAdminCampaigns(campaignType),
  });

  // Fetch eligible properties if needed
  const { data: eligibleProperties = [], isLoading: loadingProps } = useQuery({
    queryKey: ['eligible-properties-campaign', entitySearch],
    queryFn: () => fetchEligiblePropertiesForCampaign({ search: entitySearch, limit: 30 }),
    enabled: config.hasProperty && (createModalOpen || !!editingCampaign),
  });

  // Fetch eligible builders if needed
  const { data: eligibleBuilders = [] } = useQuery({
    queryKey: ['eligible-builders-campaign', entitySearch],
    queryFn: () => fetchEligibleBuildersForCampaign(entitySearch),
    enabled: config.hasBuilder && (createModalOpen || !!editingCampaign),
  });

  // Filtered campaigns
  const filtered = useMemo(() => {
    return campaignList.filter((c) => {
      if (statusFilter !== 'ALL' && c.derived_status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchSubtitle = c.subtitle?.toLowerCase().includes(q);
        const matchProp = c.primary_property?.title?.toLowerCase().includes(q);
        const matchBuilder = c.primary_builder?.name?.toLowerCase().includes(q);
        if (!matchTitle && !matchSubtitle && !matchProp && !matchBuilder) return false;
      }
      return true;
    });
  }, [campaignList, statusFilter, priorityFilter, searchQuery]);

  // Counts for status tabs
  const tabCounts = useMemo(() => {
    const counts = { ALL: campaignList.length, ACTIVE: 0, SCHEDULED: 0, EXPIRED: 0, INACTIVE: 0, DRAFT: 0 };
    for (const c of campaignList) {
      if (c.derived_status in counts) {
        counts[c.derived_status]++;
      }
    }
    return counts;
  }, [campaignList]);

  const openCreateModal = () => {
    setFormTitle('');
    setFormSubtitle('');
    setFormDescription('');
    setFormBadge(config.badgeDefault);
    setFormCtaLabel(config.ctaDefault);
    setFormCtaUrl(config.ctaUrlDefault);
    setFormImageUrl('');
    setFormPriority('High');
    setFormStartAt(null);
    setFormEndAt(null);
    setFormIsActive(true);
    setFormPropertyId(null);
    setFormBuilderId(null);
    setEntitySearch('');
    setCreateModalOpen(true);
  };

  const openEditModal = (c: PaidCampaign) => {
    setEditingCampaign(c);
    setFormTitle(c.title);
    setFormSubtitle(c.subtitle || '');
    setFormDescription(c.description || '');
    setFormBadge(c.badge_label || config.badgeDefault);
    setFormCtaLabel(c.cta_label || config.ctaDefault);
    setFormCtaUrl(c.cta_url || config.ctaUrlDefault);
    setFormImageUrl(c.image_url || '');
    setFormPriority(c.priority);
    setFormStartAt(c.start_at || null);
    setFormEndAt(c.end_at || null);
    setFormIsActive(c.is_active);
    setFormPropertyId(c.items?.[0]?.property_id || null);
    setFormBuilderId(c.items?.[0]?.builder_id || null);
    setEntitySearch('');
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formTitle.trim()) throw new Error('Please enter a campaign title.');
      return await createCampaign({
        campaign_type: campaignType,
        title: formTitle,
        subtitle: formSubtitle,
        description: formDescription,
        badge_label: formBadge,
        cta_label: formCtaLabel,
        cta_url: formCtaUrl,
        image_url: formImageUrl,
        priority: formPriority,
        start_at: formStartAt,
        end_at: formEndAt,
        is_active: formIsActive,
        property_id: formPropertyId,
        builder_id: formBuilderId,
        status: formIsActive ? 'ACTIVE' : 'DRAFT',
      });
    },
    onSuccess: () => {
      addToast('success', `${config.label} campaign created successfully.`);
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaign-stats'] });
      setCreateModalOpen(false);
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to create campaign'),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingCampaign) return;
      return await updateCampaign(editingCampaign.id, {
        title: formTitle,
        subtitle: formSubtitle,
        description: formDescription,
        badge_label: formBadge,
        cta_label: formCtaLabel,
        cta_url: formCtaUrl,
        image_url: formImageUrl,
        priority: formPriority,
        start_at: formStartAt,
        end_at: formEndAt,
        is_active: formIsActive,
        property_id: formPropertyId,
        builder_id: formBuilderId,
        status: formIsActive ? 'ACTIVE' : 'INACTIVE',
      });
    },
    onSuccess: () => {
      addToast('success', 'Campaign updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaign-stats'] });
      setEditingCampaign(null);
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to update campaign'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteCampaign(id);
    },
    onSuccess: () => {
      addToast('success', 'Campaign removed successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaign-stats'] });
      setDeleteConfirmId(null);
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to delete campaign'),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await duplicateCampaign(id);
    },
    onSuccess: () => {
      addToast('success', 'Campaign duplicated as Draft.');
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaign-stats'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to duplicate campaign'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await updateCampaign(id, { is_active: isActive, status: isActive ? 'ACTIVE' : 'INACTIVE' });
    },
    onSuccess: () => {
      addToast('success', 'Status updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaign-stats'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to update status'),
  });

  const moveOrderMutation = useMutation({
    mutationFn: async ({ index, direction }: { index: number; direction: 'up' | 'down' }) => {
      const newItems = [...filtered];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newItems.length) return;

      const [movedItem] = newItems.splice(index, 1);
      newItems.splice(targetIndex, 0, movedItem);

      // Re-index to strict 1..N order
      const payload = newItems.map((item, idx) => ({
        id: item.id,
        display_order: idx + 1,
      }));

      await reorderCampaigns(payload);
    },
    onSuccess: () => {
      addToast('success', 'Campaign display order updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaigns'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to reorder'),
  });

  const bulkActionMutation = useMutation({
    mutationFn: async (action: 'activate' | 'deactivate' | 'delete') => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      if (action === 'activate') await bulkUpdateCampaignsActive(ids, true);
      else if (action === 'deactivate') await bulkUpdateCampaignsActive(ids, false);
      else if (action === 'delete') await bulkDeleteCampaigns(ids);
    },
    onSuccess: (_, action) => {
      addToast('success', `Bulk ${action} completed successfully.`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaign-stats'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Bulk action failed'),
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <DashboardLayout sections={adminSections} title={config.label}>
      <PageHeader
        title={config.label}
        subtitle={config.description}
        action={
          <div className="flex items-center gap-2">
            <Link to="/admin/paid-campaign">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Layers className="h-4 w-4" /> All Campaigns
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              className="bg-[#C91F2B] hover:bg-[#b01b25] text-white gap-1.5 shadow-md shadow-red-600/20"
            >
              <Plus className="h-4 w-4" /> Add to {config.label}
            </Button>
          </div>
        }
      />

      {/* ── SEARCH, FILTER & STATUS TABS ── */}
      <Card className="p-4 space-y-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, locality, property, builder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:border-red-500 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Priority Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-slate-500">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="ALL">All</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50">
              <button
                onClick={() => setViewMode('table')}
                className={cn('p-1.5 rounded-lg text-xs font-bold transition', viewMode === 'table' ? 'bg-white shadow-xs text-red-600' : 'text-slate-500 hover:text-slate-800')}
                title="Table View"
              >
                <TableIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={cn('p-1.5 rounded-lg text-xs font-bold transition', viewMode === 'cards' ? 'bg-white shadow-xs text-red-600' : 'text-slate-500 hover:text-slate-800')}
                title="Cards View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'ACTIVE', label: 'Active' },
              { key: 'SCHEDULED', label: 'Scheduled' },
              { key: 'EXPIRED', label: 'Expired' },
              { key: 'INACTIVE', label: 'Inactive' },
              { key: 'DRAFT', label: 'Draft' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as any)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5',
                statusFilter === tab.key
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/70'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px]',
                  statusFilter === tab.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                )}
              >
                {tabCounts[tab.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* ── BULK ACTIONS BAR ── */}
      {selectedIds.size > 0 && (
        <div className="my-3 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between animate-fadeIn">
          <span className="text-xs font-bold text-red-900">
            {selectedIds.size} {selectedIds.size === 1 ? 'campaign' : 'campaigns'} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkActionMutation.mutate('activate')}
              className="text-xs font-bold text-emerald-700 bg-white"
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkActionMutation.mutate('deactivate')}
              className="text-xs font-bold text-slate-700 bg-white"
            >
              Deactivate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkActionMutation.mutate('delete')}
              className="text-xs font-bold text-red-600 bg-white hover:bg-red-600 hover:text-white"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* ── CAMPAIGNS CONTENT (TABLE OR CARDS) ── */}
      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="mt-4 p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <EmptyState
            title={`No ${config.label} campaigns found`}
            description="Create your first campaign in this section to promote it dynamically on the RealtyNow homepage."
            action={
              <Button variant="primary" onClick={openCreateModal}>
                + Add to {config.label}
              </Button>
            }
          />
        </Card>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                  </th>
                  <th className="py-3.5 px-3 w-20 text-center">Order</th>
                  <th className="py-3.5 px-3">Campaign / Entity Details</th>
                  <th className="py-3.5 px-3">Badge & CTA</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Priority</th>
                  <th className="py-3.5 px-3">Schedule</th>
                  <th className="py-3.5 pr-4 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item, idx) => {
                  const prop = item.primary_property;
                  const builder = item.primary_builder;
                  const thumb = item.image_url || prop?.images?.[0] || (builder as any)?.cover_image || (builder as any)?.logo_url || DEFAULT_PROPERTY_IMAGE;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectOne(item.id)}
                          className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                      </td>

                      {/* Display Order with up/down arrows */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{item.display_order}
                          </span>
                          <div className="flex flex-col">
                            <button
                              disabled={idx === 0}
                              onClick={() => moveOrderMutation.mutate({ index: idx, direction: 'up' })}
                              className="p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-20 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              disabled={idx === filtered.length - 1}
                              onClick={() => moveOrderMutation.mutate({ index: idx, direction: 'down' })}
                              className="p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-20 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 relative">
                            <PropertyImage src={thumb} alt={item.title} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-slate-900 truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {item.subtitle}
                              </p>
                            )}
                            {prop?.price && (
                              <p className="text-[11px] font-bold text-red-600">{formatPrice(prop.price)}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Badge & CTA */}
                      <td className="py-3 px-3">
                        <div>
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                            {item.badge_label || config.badgeDefault}
                          </span>
                          {item.cta_label && (
                            <p className="text-[11px] text-slate-500 mt-1 truncate">
                              CTA: <span className="font-semibold text-slate-700">{item.cta_label}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.is_active })}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition',
                            item.derived_status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : item.derived_status === 'SCHEDULED'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              : item.derived_status === 'EXPIRED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', item.is_active ? 'bg-emerald-500' : 'bg-slate-400')} />
                          {item.derived_status}
                        </button>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md',
                            item.priority === 'High'
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : item.priority === 'Medium'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {item.priority}
                        </span>
                      </td>

                      {/* Schedule */}
                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        {item.start_at || item.end_at ? (
                          <div className="space-y-0.5">
                            {item.start_at && <p>From: {formatDate(item.start_at)}</p>}
                            {item.end_at ? <p>To: {formatDate(item.end_at)}</p> : <p className="text-emerald-600 font-semibold">Continuous</p>}
                          </div>
                        ) : (
                          <span className="text-slate-400">Continuous</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 pr-4 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewCampaign(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Live Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => duplicateMutation.mutate(item.id)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Duplicate as Draft"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                            title="Edit Campaign"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                            title="Delete Campaign"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
        /* ── CARDS VIEW ── */
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item, idx) => {
            const prop = item.primary_property;
            const builder = item.primary_builder;
            const thumb = item.image_url || prop?.images?.[0] || (builder as any)?.cover_image || (builder as any)?.logo_url || DEFAULT_PROPERTY_IMAGE;

            return (
              <Card
                key={item.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white hover:shadow-xl transition-all duration-300"
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    <PropertyImage src={thumb} alt={item.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                      <span className="bg-black/75 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur">
                        #{item.display_order}
                      </span>
                      <span className="bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">
                        {item.badge_label || config.badgeDefault}
                      </span>
                    </div>

                    <span
                      className={cn(
                        'absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur',
                        item.derived_status === 'ACTIVE'
                          ? 'bg-emerald-600 text-white'
                          : item.derived_status === 'SCHEDULED'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-700 text-white'
                      )}
                    >
                      {item.derived_status}
                    </span>
                  </div>

                  <div className="p-4 space-y-1.5">
                    <h3 className="font-display font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-red-600 transition-colors">
                      {item.title}
                    </h3>
                    {item.subtitle && (
                      <p className="text-xs text-slate-500 line-clamp-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {item.subtitle}
                      </p>
                    )}
                    {prop?.price && (
                      <p className="font-display text-sm font-extrabold text-red-600 pt-1">{formatPrice(prop.price)}</p>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveOrderMutation.mutate({ index: idx, direction: 'up' })}
                      className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:text-red-600 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      disabled={idx === filtered.length - 1}
                      onClick={() => moveOrderMutation.mutate({ index: idx, direction: 'down' })}
                      className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:text-red-600 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewCampaign(item)} className="h-7 px-2 text-xs">
                      <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditModal(item)} className="h-7 px-2 text-xs">
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      <Modal
        isOpen={createModalOpen || !!editingCampaign}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingCampaign(null);
        }}
        title={editingCampaign ? `Edit ${config.label} Campaign` : `Add to ${config.label}`}
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* Linked Property Selector */}
          {config.hasProperty && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Link to Master Property Listing (Single Source of Truth)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by title, location, BHK..."
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-red-500 bg-white"
                />
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                {loadingProps ? (
                  <Skeleton className="h-10 w-full" />
                ) : eligibleProperties.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 text-center">No properties found</p>
                ) : (
                  eligibleProperties.map((p) => {
                    const isSelected = formPropertyId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setFormPropertyId(p.id);
                          if (!formTitle) setFormTitle(p.title);
                          if (!formSubtitle) setFormSubtitle([p.locality_name, p.city_name].filter(Boolean).join(', '));
                        }}
                        className={cn(
                          'p-2 rounded-xl flex items-center justify-between gap-2 border text-xs cursor-pointer transition',
                          isSelected ? 'bg-red-50 border-red-400 font-bold text-red-900' : 'bg-white border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('h-2 w-2 rounded-full', isSelected ? 'bg-red-600' : 'bg-slate-300')} />
                          <span className="truncate">{p.title}</span>
                        </div>
                        <span className="font-bold text-red-600 shrink-0">{p.price ? formatPrice(p.price) : ''}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Linked Builder Selector */}
          {config.hasBuilder && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Link to Master Builder Record
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search builder name..."
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-red-500 bg-white"
                />
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                {eligibleBuilders.map((b) => {
                  const isSelected = formBuilderId === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        setFormBuilderId(b.id);
                        if (!formTitle) setFormTitle(b.name);
                        if (!formSubtitle) setFormSubtitle(b.description || '');
                        if (!formCtaUrl) setFormCtaUrl(`/builders/${b.id}`);
                      }}
                      className={cn(
                        'p-2 rounded-xl flex items-center justify-between gap-2 border text-xs cursor-pointer transition',
                        isSelected ? 'bg-red-50 border-red-400 font-bold text-red-900' : 'bg-white border-slate-200 hover:bg-slate-100'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('h-2 w-2 rounded-full', isSelected ? 'bg-red-600' : 'bg-slate-300')} />
                        <span className="truncate">{b.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{b.city_name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Headline Title *</label>
            <Input placeholder="e.g. Sea-Facing Mansions in Goa" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Subtitle / Sub-headline</label>
            <Input placeholder="e.g. Private Beach Access | Zero Brokerage" value={formSubtitle} onChange={(e) => setFormSubtitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Badge Tag</label>
              <Input placeholder={config.badgeDefault} value={formBadge} onChange={(e) => setFormBadge(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
              <Select value={formPriority} onChange={(e) => setFormPriority(e.target.value as any)}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CTA Button Label</label>
              <Input placeholder={config.ctaDefault} value={formCtaLabel} onChange={(e) => setFormCtaLabel(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CTA Destination URL</label>
              <Input placeholder={config.ctaUrlDefault} value={formCtaUrl} onChange={(e) => setFormCtaUrl(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Custom Image URL (Override)</label>
            <Input placeholder="https://..." value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} />
          </div>

          {/* Schedule Controls */}
          <div className="pt-2">
            <FeaturedScheduleControl
              startAt={formStartAt}
              endAt={formEndAt}
              isActive={formIsActive}
              onStartAtChange={setFormStartAt}
              onEndAtChange={setFormEndAt}
              onIsActiveChange={setFormIsActive}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => {
                setCreateModalOpen(false);
                setEditingCampaign(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={createMutation.isPending || updateMutation.isPending || !formTitle.trim()}
              onClick={() => {
                if (editingCampaign) updateMutation.mutate();
                else createMutation.mutate();
              }}
              className="bg-[#C91F2B] hover:bg-[#b01b25] text-white"
            >
              {editingCampaign
                ? updateMutation.isPending
                  ? 'Saving...'
                  : 'Save Changes'
                : createMutation.isPending
                ? 'Creating...'
                : 'Publish Campaign'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── LIVE PREVIEW MODAL ── */}
      <Modal
        isOpen={!!previewCampaign}
        onClose={() => setPreviewCampaign(null)}
        title="Live Homepage Section Preview"
      >
        {previewCampaign && (
          <div className="space-y-4">
            {/* Device Switcher */}
            <div className="flex items-center justify-center gap-2 p-1 bg-slate-100 rounded-xl w-fit mx-auto">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={cn('flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition', previewDevice === 'desktop' ? 'bg-white shadow text-red-600' : 'text-slate-600')}
              >
                <Monitor className="h-3.5 w-3.5" /> Desktop
              </button>
              <button
                onClick={() => setPreviewDevice('tablet')}
                className={cn('flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition', previewDevice === 'tablet' ? 'bg-white shadow text-red-600' : 'text-slate-600')}
              >
                <Tablet className="h-3.5 w-3.5" /> Tablet
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={cn('flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition', previewDevice === 'mobile' ? 'bg-white shadow text-red-600' : 'text-slate-600')}
              >
                <Smartphone className="h-3.5 w-3.5" /> Mobile
              </button>
            </div>

            {/* Preview Frame */}
            <div className="p-6 bg-slate-100/70 rounded-2xl flex items-center justify-center">
              <div
                className={cn(
                  'bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 transition-all duration-300',
                  previewDevice === 'desktop' ? 'w-full max-w-md' : previewDevice === 'tablet' ? 'w-80' : 'w-72'
                )}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-200">
                  <PropertyImage
                    src={previewCampaign.image_url || previewCampaign.primary_property?.images?.[0] || (previewCampaign.primary_builder as any)?.cover_image || DEFAULT_PROPERTY_IMAGE}
                    alt={previewCampaign.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm">
                      {previewCampaign.badge_label || config.badgeDefault}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <h3 className="font-display text-lg font-bold text-slate-900 leading-tight">
                    {previewCampaign.title}
                  </h3>
                  {previewCampaign.subtitle && (
                    <p className="text-xs text-slate-500">{previewCampaign.subtitle}</p>
                  )}
                  {previewCampaign.primary_property?.price && (
                    <p className="font-display text-base font-extrabold text-red-600 pt-1">
                      {formatPrice(previewCampaign.primary_property.price)}
                    </p>
                  )}
                  <div className="pt-3">
                    <span className="inline-flex items-center justify-center w-full py-2 bg-red-600 text-white text-xs font-bold rounded-xl">
                      {previewCampaign.cta_label || config.ctaDefault}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setPreviewCampaign(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Paid Campaign"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this campaign? It will be removed from the public homepage section.
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  Trash2,
  Settings,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Calendar,
  Building2,
  MapPin,
  Tag,
  Copy,
  Check,
  Filter,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Layers,
  ChevronRight,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Button, Modal, Badge, Input, Select, EmptyState } from '../../components/ui';
import { useToast } from '../../components/toast';
import { supabase } from '../../lib/supabase';
import { formatPrice, formatDate, cn, generatePropertyUrl } from '../../lib/utils';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';
import { getPropertyPricingDisplay } from '../../lib/plot-pricing';
import * as api from '../../lib/featured-properties-api';
import type { FeaturedPropertyItem, FeaturedPriority, FeaturedStatus } from '../../lib/featured-properties-api';
import { FeaturedScheduleControl } from '../../components/admin/featured-schedule-control';

export function AdminFeaturedPropertiesPage() {
  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | FeaturedStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | FeaturedPriority>('ALL');
  const [sortBy, setSortBy] = useState<'order' | 'priority' | 'newest' | 'price'>('order');

  // Selection & Modal States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeaturedPropertyItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Modal Form State
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [addSearch, setAddSearch] = useState('');
  const [addTypeFilter, setAddTypeFilter] = useState('all');
  const [addCityFilter, setAddCityFilter] = useState('all');
  const [addPriority, setAddPriority] = useState<FeaturedPriority>('High');
  const [addDisplayOrder, setAddDisplayOrder] = useState<number>(1);
  const [addIsActive, setAddIsActive] = useState<boolean>(true);
  const [addStartDate, setAddStartDate] = useState('');
  const [addEndDate, setAddEndDate] = useState('');

  // 1. Fetch Main Featured Properties
  const {
    data: featuredList = [],
    isLoading,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ['admin-featured-properties'],
    queryFn: api.fetchFeaturedPropertiesAdmin,
  });

  // 2. Fetch Available Eligible Properties Count & List
  const { data: eligibleProperties = [], isLoading: isLoadingEligible, refetch: refetchEligible } = useQuery({
    queryKey: ['admin-eligible-properties', addSearch, addTypeFilter, addCityFilter],
    queryFn: () =>
      api.fetchEligibleProperties({
        search: addSearch,
        type: addTypeFilter,
        cityId: addCityFilter,
        limit: 50,
      }),
    enabled: isAddModalOpen,
  });

  // 3. Real-time WebSocket Listeners
  useEffect(() => {
    const channel = supabase
      .channel('realtime-featured-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'featured_properties' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
        queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Set default next display order when opening add modal
  useEffect(() => {
    if (isAddModalOpen) {
      const maxOrder = featuredList.reduce((max, item) => Math.max(max, item.display_order || 0), 0);
      setAddDisplayOrder(maxOrder + 1);
    }
  }, [isAddModalOpen, featuredList]);

  // Copy helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast('success', `Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // KPI Metrics calculation
  const stats = useMemo(() => {
    const total = featuredList.length;
    const active = featuredList.filter((item) => item.derived_status === 'ACTIVE').length;
    const scheduled = featuredList.filter((item) => item.derived_status === 'SCHEDULED').length;
    const expired = featuredList.filter((item) => item.derived_status === 'EXPIRED').length;
    const inactive = featuredList.filter((item) => item.derived_status === 'INACTIVE').length;
    return { total, active, scheduled, expired, inactive };
  }, [featuredList]);

  // Mutations
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.updateFeaturedProperty(id, { is_active: isActive });
    },
    onSuccess: (_, vars) => {
      addToast('success', `Featured property ${vars.isActive ? 'activated' : 'deactivated'}.`);
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to update status'),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      await api.removePropertyFromFeatured(id, propertyId);
    },
    onSuccess: () => {
      addToast('success', 'Property removed from Featured Properties.');
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to remove featured property'),
  });

  const addFeaturedMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      await api.addPropertyToFeatured(propertyId, {
        priority: addPriority,
        display_order: Number(addDisplayOrder) || 1,
        is_active: addIsActive,
        start_at: addStartDate || null,
        end_at: addEndDate || null,
      });
    },
    onSuccess: () => {
      addToast('success', 'Property added to Featured Properties successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['admin-eligible-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
      setIsAddModalOpen(false);
      setSelectedPropertyId('');
      setAddStartDate('');
      setAddEndDate('');
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to add featured property'),
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async () => {
      return await api.autoPopulateFeaturedProperties(6);
    },
    onSuccess: (count) => {
      addToast('success', `Populated ${count} properties into Featured Listings!`);
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['admin-eligible-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to auto-populate properties'),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (item: {
      id: string;
      priority: FeaturedPriority;
      display_order: number;
      is_active: boolean;
      start_at: string | null;
      end_at: string | null;
    }) => {
      await api.updateFeaturedProperty(item.id, {
        priority: item.priority,
        display_order: item.display_order,
        is_active: item.is_active,
        start_at: item.start_at,
        end_at: item.end_at,
      });
    },
    onSuccess: () => {
      addToast('success', 'Featured property settings updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
      setEditingItem(null);
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to update settings'),
  });

  const moveOrderMutation = useMutation({
    mutationFn: async ({ index, direction }: { index: number; direction: 'up' | 'down' }) => {
      const newItems = [...filtered];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newItems.length) return;

      // Move element in array
      const [movedItem] = newItems.splice(index, 1);
      newItems.splice(targetIndex, 0, movedItem);

      // Assign normalized 1..N order to eliminate duplicates and gaps
      const payload = newItems.map((item, idx) => ({
        id: item.id,
        display_order: idx + 1,
      }));

      await api.reorderFeaturedProperties(payload);
    },
    onSuccess: () => {
      addToast('success', 'Display order updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to reorder'),
  });

  const bulkActionMutation = useMutation({
    mutationFn: async (action: 'activate' | 'deactivate' | 'remove') => {
      const selectedItems = featuredList.filter((item) => selectedIds.has(item.id));
      if (selectedItems.length === 0) return;

      if (action === 'activate') {
        await api.bulkUpdateFeaturedActive(Array.from(selectedIds), true);
      } else if (action === 'deactivate') {
        await api.bulkUpdateFeaturedActive(Array.from(selectedIds), false);
      } else if (action === 'remove') {
        await api.bulkRemoveFeatured(selectedItems.map((i) => ({ id: i.id, property_id: i.property_id })));
      }
    },
    onSuccess: (_, action) => {
      addToast('success', `Bulk ${action} completed successfully.`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
    },
    onError: (err: any) => addToast('error', err?.message || 'Bulk operation failed'),
  });

  // Filtered & Sorted items
  const filtered = useMemo(() => {
    return featuredList
      .filter((item) => {
        const p = item.property || {};
        const matchSearch =
          !search ||
          (p.title && p.title.toLowerCase().includes(search.toLowerCase())) ||
          (p.city_name && p.city_name.toLowerCase().includes(search.toLowerCase())) ||
          (p.locality_name && p.locality_name.toLowerCase().includes(search.toLowerCase())) ||
          (p.builder_name && p.builder_name.toLowerCase().includes(search.toLowerCase())) ||
          (item.property_id && item.property_id.toLowerCase().includes(search.toLowerCase()));

        const matchStatus = statusFilter === 'ALL' || item.derived_status === statusFilter;
        const matchPriority = priorityFilter === 'ALL' || item.priority === priorityFilter;

        return matchSearch && matchStatus && matchPriority;
      })
      .sort((a, b) => {
        if (sortBy === 'order') {
          return a.display_order - b.display_order;
        }
        if (sortBy === 'priority') {
          const rank = { High: 1, Medium: 2, Low: 3 };
          return (rank[a.priority] || 4) - (rank[b.priority] || 4);
        }
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === 'price') {
          return (b.property?.price || 0) - (a.property?.price || 0);
        }
        return 0;
      });
  }, [featuredList, search, statusFilter, priorityFilter, sortBy]);

  // Helpers for Status Badges
  const getStatusBadge = (status: FeaturedStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Active
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5 text-amber-600" /> Scheduled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" /> Expired
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="h-3.5 w-3.5 text-slate-400" /> Inactive
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: FeaturedPriority) => {
    switch (priority) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            ⚡ High
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Medium
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Low
          </span>
        );
    }
  };

  const selectedProperty = useMemo(() => {
    return eligibleProperties.find((p) => p.id === selectedPropertyId) || null;
  }, [eligibleProperties, selectedPropertyId]);

  return (
    <DashboardLayout sections={adminSections} title="Featured Properties">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* 1. Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight">
                Featured Properties
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-navy-500 mt-1">
              Manage and control properties displayed in the public Featured Properties section.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {featuredList.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={<Zap className="h-4 w-4 text-amber-500" />}
                onClick={() => autoPopulateMutation.mutate()}
                loading={autoPopulateMutation.isPending}
                className="text-navy-700 border-navy-200 hover:bg-slate-50"
              >
                Auto-Populate
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />}
              onClick={() => refetchFeatured()}
              className="text-navy-700 border-navy-200"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              className="font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm cursor-pointer"
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Featured Property
            </Button>
          </div>
        </div>

        {/* 2. Live Dynamic KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5',
              statusFilter === 'ALL' ? 'ring-2 ring-navy-600 rounded-2xl shadow-sm' : ''
            )}
          >
            <Card className="p-4 bg-white border border-slate-200/80 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Total Featured</span>
                <div className="p-2 rounded-xl bg-navy-50 text-navy-600">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-navy-900 mt-2">{stats.total}</p>
              <p className="text-[11px] text-navy-400 mt-0.5">Configured listings</p>
            </Card>
          </div>

          <div
            onClick={() => setStatusFilter('ACTIVE')}
            className={cn(
              'cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5',
              statusFilter === 'ACTIVE' ? 'ring-2 ring-emerald-600 rounded-2xl shadow-sm' : ''
            )}
          >
            <Card className="p-4 bg-white border border-slate-200/80 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Featured</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-emerald-700 mt-2">{stats.active}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Live on public carousel</p>
            </Card>
          </div>

          <div
            onClick={() => setStatusFilter('SCHEDULED')}
            className={cn(
              'cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5',
              statusFilter === 'SCHEDULED' ? 'ring-2 ring-amber-500 rounded-2xl shadow-sm' : ''
            )}
          >
            <Card className="p-4 bg-white border border-slate-200/80 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Scheduled</span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-amber-700 mt-2">{stats.scheduled}</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Future start date set</p>
            </Card>
          </div>

          <div
            onClick={() => setIsAddModalOpen(true)}
            className="cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5"
          >
            <Card className="p-4 bg-white border border-slate-200/80 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-600 uppercase tracking-wider">Available Pools</span>
                <div className="p-2 rounded-xl bg-red-50 text-red-600">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-navy-900 mt-2">
                {featuredList.length > 0 ? `${stats.total} Featured` : 'Ready'}
              </p>
              <p className="text-[11px] text-navy-400 mt-0.5">+ Click to add more</p>
            </Card>
          </div>
        </div>

        {/* 3. Advanced Filter & Control Toolbar */}
        <Card className="p-5">
          <div className="space-y-3.5">
            {/* Search & Selectors Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
                <input
                  type="text"
                  placeholder="Search property title, ID, locality, builder..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-navy-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Priority Selector */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="text-xs px-3 py-2 rounded-xl border border-navy-200 bg-white font-semibold text-navy-700 focus:outline-none focus:border-red-500"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="High">⚡ High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>

                {/* Sort Selector */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs px-3 py-2 rounded-xl border border-navy-200 bg-white font-semibold text-navy-700 focus:outline-none focus:border-red-500"
                >
                  <option value="order">Display Order (Default)</option>
                  <option value="priority">Priority (High → Low)</option>
                  <option value="newest">Newest Added</option>
                  <option value="price">Price (High → Low)</option>
                </select>
              </div>
            </div>

            {/* Status Filter Tabs Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer',
                    statusFilter === 'ALL'
                      ? 'bg-navy-900 text-white'
                      : 'bg-slate-100 text-navy-600 hover:bg-slate-200'
                  )}
                >
                  All ({stats.total})
                </button>
                <button
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer',
                    statusFilter === 'ACTIVE'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  )}
                >
                  Active ({stats.active})
                </button>
                <button
                  onClick={() => setStatusFilter('SCHEDULED')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer',
                    statusFilter === 'SCHEDULED'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  )}
                >
                  Scheduled ({stats.scheduled})
                </button>
                <button
                  onClick={() => setStatusFilter('EXPIRED')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer',
                    statusFilter === 'EXPIRED'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  )}
                >
                  Expired ({stats.expired})
                </button>
                <button
                  onClick={() => setStatusFilter('INACTIVE')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer',
                    statusFilter === 'INACTIVE'
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  Inactive ({stats.inactive})
                </button>
              </div>

              <div className="text-xs text-navy-500 font-medium">
                Showing <span className="font-bold text-navy-900">{filtered.length}</span> of {featuredList.length} items
              </div>
            </div>

            {/* Bulk Action Bar (when rows are selected) */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-navy-900 text-white px-4 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-2">
                <span className="text-xs font-bold">
                  {selectedIds.size} {selectedIds.size === 1 ? 'property' : 'properties'} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-white hover:bg-navy-800"
                    onClick={() => bulkActionMutation.mutate('activate')}
                  >
                    Activate Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-white hover:bg-navy-800"
                    onClick={() => bulkActionMutation.mutate('deactivate')}
                  >
                    Deactivate Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-rose-400 hover:bg-rose-950 hover:text-rose-300"
                    onClick={() => {
                      if (window.confirm(`Remove ${selectedIds.size} properties from Featured?`)) {
                        bulkActionMutation.mutate('remove');
                      }
                    }}
                  >
                    Remove Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-slate-400 hover:text-white"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Tabular Data List */}
          <div className="mt-4 overflow-x-auto border border-slate-200/80 rounded-2xl shadow-2xs bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-navy-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(filtered.map((i) => i.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="rounded text-red-600 focus:ring-red-500"
                    />
                  </th>
                  <th className="py-3.5 px-3 w-16 text-center">Order</th>
                  <th className="py-3.5 px-4">Property Details</th>
                  <th className="py-3.5 px-3">Price</th>
                  <th className="py-3.5 px-3">Featured Status</th>
                  <th className="py-3.5 px-3">Priority</th>
                  <th className="py-3.5 px-4">Schedule Range</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="py-4 px-4">
                        <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="max-w-md mx-auto space-y-3.5">
                        <div className="h-14 w-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                          <Sparkles className="h-7 w-7" />
                        </div>
                        <h4 className="font-extrabold text-navy-900 text-base">No Featured Properties Configured</h4>
                        <p className="text-xs text-navy-500 max-w-sm mx-auto">
                          Add properties to highlight them in the public website's Featured carousel, or click below to auto-populate from your published listings.
                        </p>
                        <div className="flex items-center justify-center gap-2.5 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<Zap className="h-4 w-4 text-amber-500" />}
                            onClick={() => autoPopulateMutation.mutate()}
                            loading={autoPopulateMutation.isPending}
                          >
                            Auto-Populate Listings
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            className="font-bold bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => setIsAddModalOpen(true)}
                          >
                            + Add Featured Property
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, index) => {
                    const p = item.property || ({} as any);
                    const pricing = getPropertyPricingDisplay(p);
                    const isSelected = selectedIds.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'hover:bg-slate-50/80 transition-colors group',
                          isSelected && 'bg-red-50/30'
                        )}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSet = new Set(selectedIds);
                              if (e.target.checked) newSet.add(item.id);
                              else newSet.delete(item.id);
                              setSelectedIds(newSet);
                            }}
                            className="rounded text-red-600 focus:ring-red-500"
                          />
                        </td>

                        {/* Order & Reorder Controls */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-mono font-bold text-xs text-navy-900 bg-slate-100 px-2 py-0.5 rounded">
                              #{item.display_order}
                            </span>
                            <div className="flex flex-col -space-y-1">
                              <button
                                disabled={index === 0 || moveOrderMutation.isPending}
                                onClick={() => moveOrderMutation.mutate({ index, direction: 'up' })}
                                className="text-slate-400 hover:text-navy-900 disabled:opacity-20 p-0.5 cursor-pointer"
                                title="Move Up"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                disabled={index === filtered.length - 1 || moveOrderMutation.isPending}
                                onClick={() => moveOrderMutation.mutate({ index, direction: 'down' })}
                                className="text-slate-400 hover:text-navy-900 disabled:opacity-20 p-0.5 cursor-pointer"
                                title="Move Down"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Property Details */}
                        <td className="py-3 px-4">
                          <div className="flex items-start gap-3">
                            <img
                              src={getPropertyCoverImage(p)}
                              alt={p.title || 'Property'}
                              onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                              className="h-12 w-16 rounded-xl object-cover shrink-0 border border-slate-200 bg-slate-100"
                            />
                            <div className="min-w-0">
                              <Link
                                to={generatePropertyUrl(p)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold text-navy-900 hover:text-red-600 transition-colors text-xs leading-snug line-clamp-1 flex items-center gap-1"
                              >
                                <span>{p.title || 'Untitled Property'}</span>
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </Link>
                              <p className="text-[11px] text-navy-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {p.locality_name ? `${p.locality_name}, ` : ''}
                                  {p.city_name || 'Hyderabad'}
                                </span>
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  {item.property_id.slice(0, 8)}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(item.property_id, item.id)}
                                  className="text-slate-400 hover:text-navy-800 p-0.5 cursor-pointer"
                                  title="Copy Full Property ID"
                                >
                                  {copiedId === item.id ? (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                                {p.property_type_name && (
                                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 px-1.5 py-0.2 rounded">
                                    {p.property_type_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-3 font-extrabold text-navy-900 text-xs whitespace-nowrap">
                          {pricing.primaryPrice}
                        </td>

                        {/* Featured Status */}
                        <td className="py-3 px-3">{getStatusBadge(item.derived_status)}</td>

                        {/* Priority */}
                        <td className="py-3 px-3">{getPriorityBadge(item.priority)}</td>

                        {/* Schedule */}
                        <td className="py-3 px-4 text-xs text-navy-600">
                          {item.start_at || item.end_at ? (
                            <div className="space-y-0.5">
                              {item.start_at && (
                                <p className="text-[11px] font-semibold text-navy-800 flex items-center gap-1">
                                  <span className="text-[10px] font-extrabold uppercase text-navy-400">From:</span>
                                  {new Date(item.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(item.start_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                              {item.end_at ? (
                                <p className="text-[11px] font-semibold text-navy-800 flex items-center gap-1">
                                  <span className="text-[10px] font-extrabold uppercase text-navy-400">Until:</span>
                                  {new Date(item.end_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(item.end_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              ) : (
                                <p className="text-[10px] font-bold text-emerald-600">No End Date (Ongoing)</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 inline-flex items-center gap-1">
                              Continuous / Always Active
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Active switch */}
                            <button
                              onClick={() =>
                                toggleActiveMutation.mutate({ id: item.id, isActive: !item.is_active })
                              }
                              className={cn(
                                'text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors cursor-pointer',
                                item.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              )}
                              title={item.is_active ? 'Click to Deactivate' : 'Click to Activate'}
                            >
                              {item.is_active ? 'Active' : 'Paused'}
                            </button>

                            {/* Edit settings */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 px-2 text-navy-700 hover:bg-slate-100"
                              onClick={() => setEditingItem(item)}
                              title="Edit Priority & Schedule"
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>

                            {/* Public Preview */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 px-2 text-navy-700 hover:bg-slate-100"
                              onClick={() => window.open(generatePropertyUrl(p), '_blank')}
                              title="Preview Public Page"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {/* Remove from featured */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => {
                                if (window.confirm(`Remove "${p.title}" from Featured Properties?`)) {
                                  removeMutation.mutate({ id: item.id, propertyId: item.property_id });
                                }
                              }}
                              title="Remove from Featured"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 5. Add Property to Featured Modal */}
        <Modal
          open={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Property to Featured"
          size="lg"
        >
          <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
            {/* Step 1: Direct Property Selector */}
            <div>
              <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1.5">
                Select Property From Database
              </label>
              <div className="relative">
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-navy-200 bg-white font-medium text-navy-900 focus:outline-none focus:border-red-500"
                >
                  <option value="">-- Choose a property from available pool ({eligibleProperties.length}) --</option>
                  {eligibleProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.locality_name ? `(${p.locality_name}, ${p.city_name || ''})` : ''} - ₹{p.price}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Property Preview */}
            {selectedProperty && (
              <div className="flex items-center gap-3 p-3 bg-red-50/50 rounded-2xl border border-red-200">
                <img
                  src={getPropertyCoverImage(selectedProperty)}
                  alt={selectedProperty.title}
                  onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                  className="h-12 w-16 rounded-xl object-cover shrink-0 border border-red-200"
                />
                <div className="min-w-0 flex-1">
                  <h5 className="font-bold text-navy-900 text-xs line-clamp-1">{selectedProperty.title}</h5>
                  <p className="text-[11px] text-navy-500">
                    {selectedProperty.locality_name}, {selectedProperty.city_name}
                  </p>
                  <p className="text-xs font-extrabold text-red-600 mt-0.5">
                    {getPropertyPricingDisplay(selectedProperty).primaryPrice}
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Featured Configuration & Scheduling Form */}
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-navy-700 mb-1">Priority Level</label>
                  <select
                    value={addPriority}
                    onChange={(e) => setAddPriority(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-navy-200 bg-white font-medium focus:outline-none focus:border-red-500"
                  >
                    <option value="High">⚡ High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-navy-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={addDisplayOrder}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setAddDisplayOrder(isNaN(val) || val < 1 ? 1 : val);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-navy-200 bg-white font-mono font-bold focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Custom Date & Time Scheduler Control */}
              <FeaturedScheduleControl
                startAt={addStartDate}
                endAt={addEndDate}
                isActive={addIsActive}
                onStartChange={setAddStartDate}
                onEndChange={setAddEndDate}
                onActiveChange={setAddIsActive}
              />

              {selectedPropertyId && (
                <div className="pt-2 flex justify-end">
                  <Button
                    variant="primary"
                    className="font-bold bg-red-600 hover:bg-red-700 text-white"
                    loading={addFeaturedMutation.isPending}
                    onClick={() => addFeaturedMutation.mutate(selectedPropertyId)}
                  >
                    Feature Selected Property Now
                  </Button>
                </div>
              )}
            </div>

            {/* Step 3: Or Pick Directly from Filtered List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-navy-800 uppercase tracking-wider">
                  Or Browse & Pick from Pool ({eligibleProperties.length})
                </p>
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-navy-400" />
                  <input
                    type="text"
                    placeholder="Quick search..."
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-navy-200 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {isLoadingEligible ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />
                  ))
                ) : eligibleProperties.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                    <Building2 className="h-6 w-6 text-navy-300 mx-auto" />
                    <p className="text-xs font-bold text-navy-800 mt-1">No available properties found</p>
                  </div>
                ) : (
                  eligibleProperties.map((p) => {
                    const pricing = getPropertyPricingDisplay(p);
                    const isAlready = p.is_already_featured;

                    return (
                      <div
                        key={p.id}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-xl border transition-all',
                          selectedPropertyId === p.id
                            ? 'border-red-500 bg-red-50/20'
                            : 'border-slate-200 bg-white hover:border-red-200'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={getPropertyCoverImage(p)}
                            alt={p.title}
                            onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                            className="h-10 w-14 rounded-lg object-cover shrink-0 border border-slate-100"
                          />
                          <div className="min-w-0">
                            <h5 className="font-bold text-navy-900 text-xs line-clamp-1">{p.title}</h5>
                            <p className="text-[10px] text-navy-500 truncate">
                              {p.locality_name ? `${p.locality_name}, ` : ''}{p.city_name || 'Hyderabad'}
                            </p>
                            <span className="font-extrabold text-red-600 text-[11px]">{pricing.primaryPrice}</span>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2">
                          {isAlready ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                              <Check className="h-3 w-3" /> Featured
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                              disabled={addFeaturedMutation.isPending}
                              onClick={() => {
                                setSelectedPropertyId(p.id);
                                addFeaturedMutation.mutate(p.id);
                              }}
                            >
                              + Feature
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>

        {/* 6. Edit Featured Settings Modal */}
        <Modal
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Edit Featured Settings"
        >
          {editingItem && (
            <div className="space-y-4 pt-1">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <h5 className="font-bold text-navy-900 text-xs">{editingItem.property?.title}</h5>
                <p className="text-[11px] text-navy-500">
                  {editingItem.property?.locality_name}, {editingItem.property?.city_name}
                </p>
                <p className="font-mono text-[10px] text-slate-600">ID: {editingItem.property_id}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">Priority Level</label>
                  <select
                    value={editingItem.priority}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, priority: e.target.value as FeaturedPriority })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-navy-200 bg-white font-medium focus:outline-none focus:border-red-500"
                  >
                    <option value="High">⚡ High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editingItem.display_order}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setEditingItem({ ...editingItem, display_order: isNaN(val) || val < 1 ? 1 : val });
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-navy-200 bg-white font-mono font-bold focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Custom Date & Time Scheduler Control */}
              <FeaturedScheduleControl
                startAt={editingItem.start_at}
                endAt={editingItem.end_at}
                isActive={editingItem.is_active}
                onStartChange={(iso) => setEditingItem({ ...editingItem, start_at: iso })}
                onEndChange={(iso) => setEditingItem({ ...editingItem, end_at: iso })}
                onActiveChange={(act) => setEditingItem({ ...editingItem, is_active: act })}
              />

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="ghost"
                  className="text-xs text-navy-600"
                  onClick={() => window.open(generatePropertyUrl(editingItem.property), '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Public Preview
                </Button>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setEditingItem(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    disabled={updateSettingsMutation.isPending}
                    onClick={() => updateSettingsMutation.mutate(editingItem)}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}

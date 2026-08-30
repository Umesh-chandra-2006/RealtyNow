import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Edit3, Trash2, Send, Eye, Building2, Share2, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { SharePropertyModal } from '../../components/ui/share-property-modal';

import { getPortalSections, getAgentSections } from './sections';
import { Button, Card, EmptyState, Modal, Badge, Select, Input } from '../../components/ui';
import { StatusBadge } from '../../components/property-card';
import { DataTable, type Column, BulkActionsBar } from '../../components/data-table';
import { submitPropertyForReview } from '../../lib/properties';
import { mapJoined } from '../../lib/join-helpers';
import { formatPrice, formatDate , generatePropertyUrl, getPropertyPrice } from '../../lib/utils';
import { getPriceUnitLabel } from '../../lib/plot-pricing';
import { PropertyPriceCell } from '../../components/ui/property-price-cell';
import type { Property } from '../../lib/types';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';
import { ExportMenu } from '../../components/export-menu';
import { SavedFiltersMenu } from '../../components/saved-filters-menu';
import { useSavedFilters } from '../../lib/saved-filters';
import { PostPropertyLink } from '../../components/post-property-link';
import { EditPropertyModal } from '../../components/portal/edit-property-modal';
import { EnableNotificationsCard } from '../../components/enable-notifications-card';
import { fetchActiveCustomerSubscription } from '../../lib/subscriptions';

const MY_PROPERTIES_EXPORT_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Property' },
  { key: 'locality_name', label: 'Locality' },
  { key: 'city_name', label: 'City' },
  { key: 'price', label: 'Price' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
];

interface MyPropertiesFilterState {
  city: string;
  type: string;
  minPrice: string;
  maxPrice: string;
}

export function PortalMyProperties() {
  const { t } = useLanguageContext();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>('all');
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [shareProperty, setShareProperty] = useState<Property | null>(null);
  const [editPropertyId, setEditPropertyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleRows, setVisibleRows] = useState<Property[]>([]);
  const [rich, setRich] = useState<MyPropertiesFilterState>({ city: '', type: '', minPrice: '', maxPrice: '' });
  const savedFilters = useSavedFilters<MyPropertiesFilterState>('portal-my-properties');

  const sections = profile?.role === 'agent' ? getAgentSections(t) : getPortalSections(t);

  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-my-properties', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('*, cities(name), localities(name), property_types(name)')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false });
      return (data ?? []).map((p) => mapJoined(p as unknown as Record<string, unknown>)) as unknown as Property[];
    },
    enabled: !!user,
  });

  const { data: mySub } = useQuery({
    queryKey: ['my-active-subscription', user?.id],
    queryFn: () => (user ? fetchActiveCustomerSubscription(user.id) : null),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('portal-properties-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        queryClient.invalidateQueries({ queryKey: ['portal-my-properties'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const tabs = [
    { key: 'all', label: t('blog.allCategories', 'All') },
    { key: 'draft', label: t('portal.drafts', 'Drafts') },
    { key: 'pending', label: t('portal.pending', 'Pending') },
    { key: 'published', label: t('portal.published', 'Published') },
    { key: 'rejected', label: t('portal.rejected', 'Rejected') },
  ];

  const getTabCount = (key: string) => {
    return (data ?? []).filter((p) => {
      if (key === 'all') return true;
      if (key === 'draft') return p.status === 'draft';
      if (key === 'pending')
        return p.status !== 'draft' && (['submitted', 'pending_verification'].includes(p.status) || p.approval_status === 'Pending');
      if (key === 'published') return (p.status === 'published' || p.is_live) && p.status !== 'rejected';
      if (key === 'rejected')
        return p.status !== 'draft' && (['rejected', 'changes_requested'].includes(p.status) || p.approval_status === 'Rejected');
      return p.status === key;
    }).length;
  };

  const filtered = useMemo(() => {
    return (data ?? []).filter((p) => {
      if (tab === 'all') {
        /* no-op, status-tab passes everything through */
      } else if (tab === 'draft') {
        if (p.status !== 'draft') return false;
      } else if (tab === 'pending') {
        if (p.status === 'draft' || !(['submitted', 'pending_verification'].includes(p.status) || p.approval_status === 'Pending')) return false;
      } else if (tab === 'published') {
        if (!((p.status === 'published' || p.is_live) && p.status !== 'rejected')) return false;
      } else if (tab === 'rejected') {
        if (p.status === 'draft' || !(['rejected', 'changes_requested'].includes(p.status) || p.approval_status === 'Rejected')) return false;
      } else if (p.status !== tab) return false;

      if (rich.city && p.city_id !== rich.city) return false;
      if (rich.type && p.property_type_id !== rich.type) return false;
      if (rich.minPrice && p.price < Number(rich.minPrice)) return false;
      if (rich.maxPrice && p.price > Number(rich.maxPrice)) return false;
      return true;
    });
  }, [data, tab, rich]);

  const filterOptions = useMemo(() => {
    const cities = new Map<string, string>();
    const types = new Map<string, string>();
    (data ?? []).forEach((p) => {
      if (p.city_id && p.city_name) cities.set(p.city_id, p.city_name);
      if (p.property_type_id && p.property_type_name) types.set(p.property_type_id, p.property_type_name);
    });
    return { cities: [...cities.entries()], types: [...types.entries()] };
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitPropertyForReview(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-my-properties'] }),
  });

  const resubmitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { resubmitProperty } = await import('../../lib/properties');
      return resubmitProperty(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-my-properties'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('properties').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-my-properties'] });
      setToDelete(null);
    },
  });

  const bulkDelete = async () => {
    await Promise.all([...selected].map((id) => supabase.from('properties').delete().eq('id', id)));
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['portal-my-properties'] });
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const columns = useMemo<Column<Property>[]>(() => [
    {
      key: 'title',
      header: t('compare.propertyCol', 'Property'),
      sortable: true,
      className: 'min-w-[280px] max-w-[380px]',
      render: (p) => (
        <div className="flex items-center gap-3.5 py-1">
          <img
            src={getPropertyCoverImage(p)}
            alt=""
            onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
            className="h-12 w-16 rounded-xl object-cover shrink-0 shadow-2xs border border-slate-100"
          />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 line-clamp-1 text-sm">{p.title}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 whitespace-nowrap">
              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
              <span>{[p.locality_name, p.city_name].filter(Boolean).join(', ') || 'India'}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'purpose',
      header: t('search.purposeLabel', 'Purpose'),
      className: 'whitespace-nowrap min-w-[110px]',
      render: (p) => (
        <Badge variant={p.purpose === 'Rent' ? 'info' : 'gold'}>
          {p.purpose === 'Rent' ? t('property.forRent', 'For Rent') : t('property.forSale', 'For Sale')}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: 'Price / Rent',
      sortable: true,
      className: 'whitespace-nowrap min-w-[150px]',
      render: (p) => (
        <div className="whitespace-nowrap font-extrabold text-slate-900">
          <PropertyPriceCell property={p} showInvalidWarning={false} />
        </div>
      ),
    },
    {
      key: 'status',
      header: t('portal.workflowProgress', 'Workflow Progress'),
      className: 'min-w-[300px] whitespace-nowrap',
      render: (p) => (
        <div className="space-y-1.5 whitespace-nowrap">
          <StatusBadge status={p.status} />
          <div className="mt-1">
            {p.status === 'draft' ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                Draft (Not Submitted)
              </span>
            ) : p.status === 'rejected' ? (
              <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 whitespace-normal max-w-[280px]">
                <span className="font-bold">{t('portal.rejected', 'Rejected')}:</span>{' '}
                {p.rejection_reason || 'Needs corrections'}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold whitespace-nowrap">
                <span
                  className={`px-2 py-0.5 rounded-md ${['submitted', 'pending_verification', 'approved', 'published'].includes(p.status) ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-100 text-slate-500'}`}
                >
                  {t('portal.submitted', 'Submitted')}
                </span>
                <span className="text-slate-400 font-bold">→</span>
                <span
                  className={`px-2 py-0.5 rounded-md ${['pending_verification', 'changes_requested', 'approved', 'published'].includes(p.status) ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-100 text-slate-500'}`}
                >
                  {t('portal.underReview', 'Under Review')}
                </span>
                <span className="text-slate-400 font-bold">→</span>
                <span
                  className={`px-2 py-0.5 rounded-md ${['approved', 'published'].includes(p.status) || p.is_live ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-100 text-slate-500'}`}
                >
                  {p.is_live || p.status === 'published' ? t('portal.live', 'Live') : t('portal.approved', 'Approved')}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'view_count',
      header: t('property.views', 'Views'),
      sortable: true,
      className: 'whitespace-nowrap min-w-[130px]',
      render: (p) => (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-red-50/90 px-3 py-1 text-xs font-black text-red-600 border border-red-100/90 shadow-2xs whitespace-nowrap">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>{p.view_count || 0} {p.view_count === 1 ? 'View' : 'Views'}</span>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: t('portal.created', 'Created'),
      sortable: true,
      className: 'whitespace-nowrap min-w-[130px] text-slate-700 font-semibold text-xs',
      render: (p) => <span className="whitespace-nowrap">{formatDate(p.created_at)}</span>,
    },
    {
      key: 'actions',
      header: t('portal.actions', 'Actions'),
      className: 'whitespace-nowrap min-w-[180px] text-right',
      render: (p) => (
        <div className="flex items-center gap-1 justify-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {p.status === 'draft' && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Send className="h-4 w-4" />}
              onClick={() => submitMutation.mutate(p.id)}
              loading={submitMutation.isPending}
            >
              {t('portal.submit', 'Submit')}
            </Button>
          )}
          {(p.status === 'rejected' || p.status === 'changes_requested') && (
            <Button
              size="sm"
              variant="primary"
              icon={<Send className="h-4 w-4" />}
              onClick={() => resubmitMutation.mutate(p.id)}
              loading={resubmitMutation.isPending}
            >
              {t('portal.resubmit', 'Resubmit')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Edit3 className="h-4 w-4" />}
            title="Edit property"
            onClick={() => setEditPropertyId(p.id)}
          />
          <Link to={generatePropertyUrl(p)}>
            <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} />
          </Link>
          {p.status !== 'draft' && (
            <Button 
              size="sm" 
              variant="ghost" 
              icon={<Share2 className="h-4 w-4" />} 
              onClick={() => setShareProperty(p)} 
              title="Share Property"
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-error-600"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setToDelete(p.id)}
            disabled={
              !['draft', 'submitted', 'pending_verification', 'rejected', 'changes_requested'].includes(p.status)
            }
          />
        </div>
      ),
    },
  ], [t, submitMutation.isPending, resubmitMutation.isPending]);

  return (
    <DashboardLayout sections={sections} title={t('portal.myProperties', 'My Properties')}>
      <PageHeader
        title={t('portal.myProperties', 'My Properties')}
        subtitle={t('portal.manageListingsSub', 'Manage all your listings across every status.')}
        action={
          <div className="relative z-30 flex flex-wrap items-center gap-2">
            <SavedFiltersMenu
              presets={savedFilters.presets}
              onSave={(name) => savedFilters.save(name, rich)}
              onRemove={savedFilters.remove}
              onApply={setRich}
            />
            <ExportMenu
              filename="my-properties"
              rows={visibleRows as unknown as Record<string, unknown>[]}
              columns={MY_PROPERTIES_EXPORT_COLUMNS}
            />
            <Link
              to="/portal/bulk-upload"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-navy-200 text-navy-700 font-bold text-xs sm:text-sm shadow-sm hover:bg-navy-50 hover:text-navy-900 transition-all duration-200 cursor-pointer"
            >
              Bulk Upload
            </Link>
            <PostPropertyLink to="/portal/list-property"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-red-600/25 hover:shadow-red-600/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <span>{t('forms.postProperty', 'Post Property')}</span>
              <span className="bg-amber-300 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                FREE
              </span>
            </PostPropertyLink>
          </div>
        }
      />

      {/* Subscription Quota & Plan Status Banner */}
      {mySub && (
        <div className="mb-4 p-4 rounded-2xl bg-white border border-navy-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-navy-900">{mySub.plan_name}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  {mySub.status}
                </span>
                <span className="text-[11px] text-navy-400 font-semibold">• {mySub.visibility_level} Visibility</span>
              </div>
              <p className="text-xs text-navy-600 mt-0.5">
                Using <strong>{mySub.listings_used}</strong> of <strong>{mySub.listing_limit}</strong> listing quota ({mySub.remaining_days} days remaining)
              </p>
            </div>
          </div>
          <Link
            to="/portal/subscription"
            className="px-3.5 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs shadow-xs self-start sm:self-auto transition-all"
          >
            Upgrade Plan
          </Link>
        </div>
      )}

      <EnableNotificationsCard context="your listings" className="mb-4" />

      <div className="sticky top-16 z-20 -mx-1 mb-4 space-y-3 bg-navy-50/95 px-1 pb-3 pt-1 backdrop-blur-sm">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tItem) => {
            const count = getTabCount(tItem.key);
            return (
              <button
                key={tItem.key}
                onClick={() => setTab(tItem.key)}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${tab === tItem.key ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-600 hover:bg-navy-100'}`}
              >
                {tItem.label}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${tab === tItem.key ? 'bg-white/20 text-white' : 'bg-navy-100 text-navy-600'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={rich.city} onChange={(e) => setRich((f) => ({ ...f, city: e.target.value }))} className="text-sm">
              <option value="">All cities</option>
              {filterOptions.cities.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Select value={rich.type} onChange={(e) => setRich((f) => ({ ...f, type: e.target.value }))} className="text-sm">
              <option value="">All types</option>
              {filterOptions.types.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              placeholder="Min price"
              value={rich.minPrice}
              onChange={(e) => setRich((f) => ({ ...f, minPrice: e.target.value }))}
              className="text-sm"
            />
            <Input
              type="number"
              placeholder="Max price"
              value={rich.maxPrice}
              onChange={(e) => setRich((f) => ({ ...f, maxPrice: e.target.value }))}
              className="text-sm"
            />
          </div>
        </Card>
      </div>

      {selected.size > 0 && <BulkActionsBar count={selected.size} onDelete={bulkDelete} />}
      {filtered.length === 0 && !isLoading ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title={t('portal.noPropertiesTitle', 'No properties here')}
            description={t('portal.noPropertiesDesc', 'List your first property to see it here.')}
            action={
              <PostPropertyLink to="/portal/list-property">
                <Button variant="primary">{t('forms.postProperty', 'List Property')}</Button>
              </PostPropertyLink>
            }
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          error={error instanceof Error ? error.message : null}
          getRowId={(p) => p.id}
          selectedIds={selected}
          onToggleSelect={toggleSelect}
          onSelectAll={(ids) =>
            setSelected((s) => {
              const n = new Set(s);
              ids.forEach((id) => (n.has(id) ? n.delete(id) : n.add(id)));
              return n;
            })
          }
          onVisibleRowsChange={setVisibleRows}
          cardRender={(p) => (
            <Card className="p-4 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
              <div>
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-navy-100">
                  <img
                    src={getPropertyCoverImage(p)}
                    alt=""
                    onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <h4 className="font-bold text-navy-900 text-base line-clamp-1">{p.title}</h4>
                <p className="text-xs text-navy-500 mt-0.5">
                  {p.property_type_name ?? 'Property'} {p.locality_name ? `• ${p.locality_name}` : ''}
                </p>
                
                {p.status === 'draft' ? (
                  <div className="mt-3 bg-slate-50 border border-slate-100 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-navy-900">{p.completion_percentage ?? 0}% Complete</span>
                      <span className="text-[10px] text-navy-500 font-medium">Last Saved: {formatDate(p.updated_at || p.created_at)}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-red-500 to-rose-500 h-1.5 rounded-full" style={{ width: `${p.completion_percentage ?? 0}%` }}></div>
                    </div>
                    <p className="text-[11px] text-navy-600">
                      Current Step: <span className="font-bold">Step {((p.current_step ?? 0) + 1)}</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="font-bold text-navy-900 mt-2 text-lg">{formatPrice(getPropertyPrice(p), p.purpose)}</p>
                    {p.price_per_unit != null && (
                      <p className="text-xs font-semibold text-navy-500">{formatPrice(p.price_per_unit)} / {getPriceUnitLabel(p.area_unit)}</p>
                    )}
                    <p className="text-xs text-navy-400 mt-1">
                      {t('portal.submitted', 'Submitted')}: {formatDate(p.created_at)}
                    </p>
                    {p.rejection_reason && (
                      <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                        {t('portal.reason', 'Reason')}: {p.rejection_reason}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-navy-100 flex items-center justify-between gap-2">
                {(p.status === 'rejected' || p.status === 'changes_requested') && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Send className="h-4 w-4" />}
                    onClick={() => resubmitMutation.mutate(p.id)}
                    loading={resubmitMutation.isPending}
                  >
                    {t('portal.resubmit', 'Resubmit')}
                  </Button>
                )}
                {p.status === 'draft' ? (
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1"
                    onClick={() => setEditPropertyId(p.id)}
                  >
                    Continue Listing
                  </Button>
                ) : null}
                <div className="flex gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Edit3 className="h-4 w-4" />}
                    title="Edit property"
                    onClick={() => setEditPropertyId(p.id)}
                  />
                  <Link to={generatePropertyUrl(p)}>
                    <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} />
                  </Link>
                  {p.status !== 'draft' && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      icon={<Share2 className="h-4 w-4" />} 
                      onClick={() => setShareProperty(p)} 
                      title="Share Property"
                    />
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-error-600"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setToDelete(p.id)}
                    disabled={
                      !['draft', 'submitted', 'pending_verification', 'rejected', 'changes_requested'].includes(
                        p.status,
                      )
                    }
                  />
                </div>
              </div>
            </Card>
          )}
        />
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={t('portal.deletePropTitle', 'Delete property')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => toDelete && deleteMutation.mutate(toDelete)}
              loading={deleteMutation.isPending}
            >
              {t('portal.delete', 'Delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">
          {t('portal.deleteConfirm', 'Are you sure you want to delete this property? This action cannot be undone.')}
        </p>
      </Modal>

      {shareProperty && (
        <SharePropertyModal
          isOpen={!!shareProperty}
          onClose={() => setShareProperty(null)}
          property={{
            id: shareProperty.id,
            title: shareProperty.title,
            price: shareProperty.price,
            location: `${shareProperty.locality_name}, ${shareProperty.city_name}`,
            purpose: shareProperty.purpose,
            imageUrl: shareProperty.images?.[0],
            slug: (shareProperty as any).slug || shareProperty.id
          }}
        />
      )}

      <EditPropertyModal propertyId={editPropertyId} onClose={() => setEditPropertyId(null)} />
    </DashboardLayout>
  );
}

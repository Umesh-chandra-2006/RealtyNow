import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Eye,
  Edit3,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { Card, Button, Input, Select, Modal } from '../../components/ui';
import { StatusBadge } from '../../components/property-card';
import { DataTable, type Column } from '../../components/data-table';
import { mapJoined } from '../../lib/join-helpers';
import { formatPrice, formatDate, generatePropertyUrl } from '../../lib/utils';
import { getPriceUnitLabel } from '../../lib/plot-pricing';
import { PropertyPriceCell } from '../../components/ui/property-price-cell';
import { useRealtimeCount } from '../../lib/realtime';
import type { Property } from '../../lib/types';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';
import { ExportMenu } from '../../components/export-menu';
import { SavedFiltersMenu } from '../../components/saved-filters-menu';
import { useSavedFilters } from '../../lib/saved-filters';
import { useToast } from '../../components/toast';
import { EditPropertyModal } from '../../components/portal/edit-property-modal';

const AGENT_PROPERTIES_EXPORT_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Property' },
  { key: 'locality_name', label: 'Locality' },
  { key: 'city_name', label: 'City' },
  { key: 'price', label: 'Price' },
  { key: 'status', label: 'Status' },
  { key: 'view_count', label: 'Views' },
  { key: 'created_at', label: 'Created' },
];

interface AgentPropertiesFilterState {
  status: string;
  city: string;
  type: string;
  minPrice: string;
  maxPrice: string;
}

export function AgentProperties() {
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const realtimeTick = useRealtimeCount('properties', { column: 'assigned_agent_id', value: user?.id ?? '' });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editPropertyId, setEditPropertyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Property | null>(null);
  const deletingRef = useRef(false);

  const [filters, setFilters] = useState<AgentPropertiesFilterState>({
    status: '',
    city: '',
    type: '',
    minPrice: '',
    maxPrice: '',
  });
  const savedFilters = useSavedFilters<AgentPropertiesFilterState>('agent-properties');

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-properties', user?.id, realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*, cities(name), localities(name), property_types(name)')
        .or(`assigned_agent_id.eq.${user!.id},owner_id.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => mapJoined(p as unknown as Record<string, unknown>)) as unknown as Property[];
    },
    enabled: !!user,
  });

  // Delete mutation with double-click guard
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-properties'] });
      queryClient.invalidateQueries({ queryKey: ['portal-my-properties'] });
      addToast('success', 'Property deleted successfully.');
      setToDelete(null);
    },
    onError: (err) => {
      console.error('Property delete error:', err);
      addToast('error', 'Unable to delete this property. Please try again.');
    },
    onSettled: () => {
      deletingRef.current = false;
    },
  });

  const handleDeleteConfirm = () => {
    if (!toDelete || deletingRef.current || deleteMutation.isPending) return;
    deletingRef.current = true;
    deleteMutation.mutate(toDelete.id);
  };

  // Filter option lists derived from the already-loaded set
  const filterOptions = useMemo(() => {
    const cities = new Map<string, string>();
    const types = new Map<string, string>();
    const statuses = new Set<string>();
    (data ?? []).forEach((p) => {
      if (p.city_id && p.city_name) cities.set(p.city_id, p.city_name);
      if (p.property_type_id && p.property_type_name) types.set(p.property_type_id, p.property_type_name);
      if (p.status) statuses.add(p.status);
    });
    return { cities: [...cities.entries()], types: [...types.entries()], statuses: [...statuses] };
  }, [data]);

  const filteredRows = useMemo(() => {
    return (data ?? []).filter((p) => {
      if (filters.status && p.status !== filters.status) return false;
      if (filters.city && p.city_id !== filters.city) return false;
      if (filters.type && p.property_type_id !== filters.type) return false;
      if (filters.minPrice && p.price < Number(filters.minPrice)) return false;
      if (filters.maxPrice && p.price > Number(filters.maxPrice)) return false;
      return true;
    });
  }, [data, filters]);

  const [visibleRows, setVisibleRows] = useState<Property[]>([]);

  const columns = useMemo<Column<Property>[]>(() => [
    {
      key: 'title',
      header: 'Property',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <img
            src={getPropertyCoverImage(p)}
            alt=""
            onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
            className="h-10 w-14 rounded object-cover"
          />
          <div className="min-w-0">
            <Link to={generatePropertyUrl(p)} className="font-medium text-navy-900 hover:underline truncate block">
              {p.title}
            </Link>
            <p className="text-xs text-navy-500">
              {p.locality_name}, {p.city_name}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      render: (p) => <PropertyPriceCell property={p} showInvalidWarning={false} />,
    },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'view_count',
      header: 'Views',
      sortable: true,
      render: (p) => (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-red-50/90 px-2.5 py-1 text-xs font-black text-red-600 border border-red-100/90 shadow-2xs">
          <Eye className="h-3.5 w-3.5" />
          <span>{p.view_count || 0} {p.view_count === 1 ? 'View' : 'Views'}</span>
        </div>
      ),
    },
    { key: 'created_at', header: 'Created', sortable: true, render: (p) => formatDate(p.created_at) },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            to={generatePropertyUrl(p)}
            target="_blank"
            rel="noopener noreferrer"
            title="View property"
            aria-label="View property"
          >
            <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} />
          </Link>
          <Button
            size="sm"
            variant="ghost"
            icon={<Edit3 className="h-4 w-4" />}
            title="Edit property"
            aria-label="Edit property"
            onClick={() => setEditPropertyId(p.id)}
          />
          <Button
            size="sm"
            variant="ghost"
            className="text-error-600 hover:text-error-700"
            icon={<Trash2 className="h-4 w-4" />}
            title="Delete property"
            aria-label="Delete property"
            onClick={() => setToDelete(p)}
          />
        </div>
      ),
    },
  ], []);

  return (
    <DashboardLayout sections={agentSections} title="Assigned Properties" badge="Agent">
      <PageHeader
        title="Assigned properties"
        subtitle="Properties you're managing."
        action={
          <div className="flex flex-wrap gap-2">
            <SavedFiltersMenu
              presets={savedFilters.presets}
              onSave={(name) => savedFilters.save(name, filters)}
              onRemove={savedFilters.remove}
              onApply={setFilters}
            />
            <ExportMenu
              filename="agent-properties"
              rows={(selected.size > 0 ? visibleRows.filter((p) => selected.has(p.id)) : visibleRows) as unknown as Record<string, unknown>[]}
              columns={AGENT_PROPERTIES_EXPORT_COLUMNS}
            />
          </div>
        }
      />

      <div className="sticky top-0 z-20 -mx-1 mb-4 bg-navy-50/95 px-1 pb-1 pt-1 backdrop-blur-sm">
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="text-sm">
              <option value="">All statuses</option>
              {filterOptions.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} className="text-sm">
              <option value="">All cities</option>
              {filterOptions.cities.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className="text-sm">
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
              value={filters.minPrice}
              onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
              className="text-sm"
            />
            <Input
              type="number"
              placeholder="Max price"
              value={filters.maxPrice}
              onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
              className="text-sm"
            />
          </div>
          {selected.size > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2">
              <span className="text-xs font-bold text-navy-600">{selected.size} selected</span>
              <button onClick={() => setSelected(new Set())} className="text-xs font-semibold text-navy-400 hover:text-red-600">
                Clear selection
              </button>
            </div>
          )}
        </Card>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        loading={isLoading}
        error={error instanceof Error ? error.message : null}
        getRowId={(p) => p.id}
        searchPlaceholder={t('agent.searchAssignedProperties', 'Search assigned properties by title, locality, city...')}
        searchKeys={['title', 'locality_name', 'city_name', 'property_type_name']}
        dateKey="created_at"
        selectedIds={selected}
        onToggleSelect={(id) =>
          setSelected((s) => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
          })
        }
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
                {p.locality_name ?? '—'}, {p.city_name ?? '—'}
              </p>
              <p className="font-bold text-navy-900 mt-2 text-lg">{formatPrice(p.price, p.purpose)}</p>
              {p.price_per_unit != null && (
                <p className="text-xs font-semibold text-navy-500">{formatPrice(p.price_per_unit)} / {getPriceUnitLabel(p.area_unit)}</p>
              )}
              <p className="text-xs text-navy-400 mt-1">Assigned: {formatDate(p.created_at)}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-navy-100 flex flex-wrap items-center justify-between gap-2">
              <Link to={`/agent/leads?propertyId=${p.id}`}>
                <Button size="sm" variant="secondary" className="text-xs">
                  View Leads
                </Button>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  to={generatePropertyUrl(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View property"
                  aria-label="View property"
                >
                  <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />}>
                    View
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Edit3 className="h-4 w-4" />}
                  title="Edit property"
                  aria-label="Edit property"
                  onClick={() => setEditPropertyId(p.id)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-error-600 hover:text-error-700"
                  icon={<Trash2 className="h-4 w-4" />}
                  title="Delete property"
                  aria-label="Delete property"
                  onClick={() => setToDelete(p)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        )}
      />

      {/* Delete Property Confirmation Modal */}
      <Modal
        open={!!toDelete}
        onClose={() => !deleteMutation.isPending && setToDelete(null)}
        title="Delete Property?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={handleDeleteConfirm}
            >
              Delete Property
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-navy-800">
            Are you sure you want to delete <strong className="text-navy-950">"{toDelete?.title}"</strong>?
          </p>
          <p className="text-xs text-error-600 font-medium">
            This action cannot be undone and will permanently remove this property.
          </p>
        </div>
      </Modal>

      {/* Edit Property Modal */}
      <EditPropertyModal propertyId={editPropertyId} onClose={() => setEditPropertyId(null)} />
    </DashboardLayout>
  );
}

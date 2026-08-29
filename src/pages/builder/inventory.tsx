import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Package, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getBuilderSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n';
import { DataTable } from '../../components/data-table';
import type { Column } from '../../components/data-table';
import { Badge, Button, EmptyState, Input, Modal, Select } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useRealtimeCount } from '../../lib/realtime';
import { logBuilderAudit } from '../../lib/builder-audit';
import { formatPrice } from '../../lib/utils';
import { BuilderWorkflowBar } from '../../components/builder/BuilderWorkflowBar';
import type { BuilderUnit, BuilderUnitStatus } from '../../lib/types';

type InventoryRow = BuilderUnit & {
  builder_towers: { name: string; builder_projects: { name: string } | null } | null;
};

const STATUS_OPTIONS: BuilderUnitStatus[] = ['available', 'booked', 'sold'];

const statusBadgeVariant = (status: BuilderUnitStatus) =>
  status === 'available' ? 'success' : status === 'booked' ? 'warning' : 'default';

export function BuilderInventory() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const builderSections = getBuilderSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | BuilderUnitStatus>('all');
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [quickForm, setQuickForm] = useState({ status: 'available' as BuilderUnitStatus, price: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ['builder-my-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('builder_projects').select('id').eq('builder_id', user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const projectIds = useMemo(() => (projects ?? []).map((p) => p.id), [projects]);

  const { data: towers } = useQuery({
    queryKey: ['builder-my-towers', user?.id, projectIds.join(',')],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase.from('builder_towers').select('id').in('project_id', projectIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!projects,
  });

  const towerIds = useMemo(() => (towers ?? []).map((tw) => tw.id), [towers]);
  const unitsTick = useRealtimeCount('builder_units');

  const {
    data: units,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['builder-inventory', user?.id, towerIds.join(','), unitsTick],
    queryFn: async () => {
      if (towerIds.length === 0) return [] as InventoryRow[];
      const { data, error } = await supabase
        .from('builder_units')
        .select('*, builder_towers(name, builder_projects(name))')
        .in('tower_id', towerIds)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InventoryRow[];
    },
    enabled: !!user && !!towers,
  });

  const stats = useMemo(() => {
    const rows = units ?? [];
    return {
      total: rows.length,
      available: rows.filter((r) => r.status === 'available').length,
      booked: rows.filter((r) => r.status === 'booked').length,
      sold: rows.filter((r) => r.status === 'sold').length,
    };
  }, [units]);

  const filteredRows = useMemo(() => {
    const rows = units ?? [];
    return statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter);
  }, [units, statusFilter]);

  const openQuickEdit = (row: InventoryRow) => {
    setEditing(row);
    setQuickForm({ status: row.status, price: row.price != null ? String(row.price) : '' });
    setFormErrors({});
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (quickForm.price && (Number.isNaN(Number(quickForm.price)) || Number(quickForm.price) < 0)) {
      errs.price = 'Price must be a positive number';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveQuickEdit = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    try {
      const payload = {
        status: quickForm.status,
        price: quickForm.price ? Number(quickForm.price) : null,
      };
      const { error } = await supabase.from('builder_units').update(payload).eq('id', editing.id);
      if (error) throw error;
      logBuilderAudit('update', 'builder_units', editing.id, {
        unit_number: editing.unit_number,
        ...payload,
      }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['builder-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['builder-units'] });
      addToast('success', 'Unit updated');
      setEditing(null);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to update unit');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<Column<InventoryRow>[]>(
    () => [
      {
        key: 'unit_number',
        header: 'Unit #',
        sortable: true,
        render: (row) => <span className="font-medium text-navy-900">{row.unit_number}</span>,
      },
      { key: 'type', header: 'Type', render: (row) => row.type },
      {
        key: 'tower',
        header: 'Block / Tower',
        render: (row) => <span className="text-sm text-navy-600">{row.builder_towers?.name ?? '—'}</span>,
      },
      {
        key: 'project',
        header: 'Project',
        render: (row) => (
          <span className="text-sm text-navy-600">{row.builder_towers?.builder_projects?.name ?? '—'}</span>
        ),
      },
      { key: 'size_sqft', header: 'Size (sqft)', render: (row) => row.size_sqft ?? '—' },
      { key: 'price', header: 'Price', sortable: true, render: (row) => formatPrice(row.price) },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <Badge variant={statusBadgeVariant(row.status)} className="capitalize">
            {row.status}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openQuickEdit(row)} />
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout sections={builderSections} title="Inventory" badge="Builder">
      <PageHeader
        title="Inventory"
        subtitle="A portfolio-wide view of every unit across your projects."
        action={
          <Link
            to="/builder/units"
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold bg-navy-900 text-white hover:bg-navy-800 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Unit
          </Link>
        }
      />

      {/* Contextual Workflow Progression */}
      <BuilderWorkflowBar
        currentStage="inventory"
        counts={{
          projects: projects?.length,
          blocks: towers?.length,
          units: units?.length,
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Units" value={stats.total} icon={<Package className="h-5 w-5" />} accent="navy" />
        <StatCard label="Available" value={stats.available} icon={<Package className="h-5 w-5" />} accent="success" />
        <StatCard label="Booked" value={stats.booked} icon={<Package className="h-5 w-5" />} accent="gold" />
        <StatCard label="Sold" value={stats.sold} icon={<Package className="h-5 w-5" />} accent="error" />
      </div>

      <div className="mb-4 max-w-xs">
        <Select
          label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | BuilderUnitStatus)}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        loading={isLoading}
        error={error instanceof Error ? error.message : null}
        getRowId={(row) => row.id}
        searchKeys={['unit_number', 'type']}
        selectedIds={selected}
        onToggleSelect={(id) =>
          setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
          })
        }
        onSelectAll={(ids) =>
          setSelected((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
            return next;
          })
        }
        emptyState={
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="No inventory yet"
            description="Units you create in the Units page will show up here across all your projects."
            action={
              <Link to="/builder/units">
                <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                  Go to Units
                </Button>
              </Link>
            }
          />
        }
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Quick Edit Unit"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveQuickEdit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-sm text-navy-500">
              Unit <span className="font-semibold text-navy-900">{editing.unit_number}</span> ·{' '}
              {editing.builder_towers?.name ?? '—'}
            </div>
            <Select
              label="Status"
              value={quickForm.status}
              onChange={(e) => setQuickForm((f) => ({ ...f, status: e.target.value as BuilderUnitStatus }))}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </Select>
            <Input
              label="Price"
              type="number"
              min={0}
              value={quickForm.price}
              onChange={(e) => setQuickForm((f) => ({ ...f, price: e.target.value }))}
              error={formErrors.price}
            />
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

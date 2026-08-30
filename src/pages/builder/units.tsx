import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit3, Home, Plus, Trash2, Building2, Layers } from 'lucide-react';
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

type UnitRow = BuilderUnit & {
  builder_towers: { name: string } | null;
  builder_floors: { floor_number: number; name: string | null } | null;
};

const STATUS_OPTIONS: BuilderUnitStatus[] = ['available', 'booked', 'sold'];

const statusBadgeVariant = (status: BuilderUnitStatus) =>
  status === 'available' ? 'success' : status === 'booked' ? 'warning' : 'default';

const emptyForm = {
  tower_id: '',
  floor_id: '',
  unit_number: '',
  type: '',
  size_sqft: '',
  price: '',
  status: 'available' as BuilderUnitStatus,
};

export function BuilderUnits() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const builderSections = getBuilderSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UnitRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<UnitRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const { data, error } = await supabase
        .from('builder_towers')
        .select('id, name')
        .in('project_id', projectIds)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!projects,
  });

  const towerIds = useMemo(() => (towers ?? []).map((tw) => tw.id), [towers]);

  const { data: floors } = useQuery({
    queryKey: ['builder-my-floors', user?.id, towerIds.join(',')],
    queryFn: async () => {
      if (towerIds.length === 0) return [];
      const { data, error } = await supabase
        .from('builder_floors')
        .select('id, tower_id, floor_number, name')
        .in('tower_id', towerIds)
        .order('floor_number');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!towers,
  });

  const unitsTick = useRealtimeCount('builder_units');

  const {
    data: units,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['builder-units', user?.id, towerIds.join(','), unitsTick],
    queryFn: async () => {
      if (towerIds.length === 0) return [] as UnitRow[];
      const { data, error } = await supabase
        .from('builder_units')
        .select('*, builder_towers(name), builder_floors(floor_number, name)')
        .in('tower_id', towerIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UnitRow[];
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

  const floorsForTower = useMemo(
    () => (floors ?? []).filter((f) => f.tower_id === form.tower_id),
    [floors, form.tower_id],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, tower_id: towerIds[0] ?? '' });
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (row: UnitRow) => {
    setEditing(row);
    setForm({
      tower_id: row.tower_id,
      floor_id: row.floor_id ?? '',
      unit_number: row.unit_number,
      type: row.type,
      size_sqft: row.size_sqft != null ? String(row.size_sqft) : '',
      price: row.price != null ? String(row.price) : '',
      status: row.status,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.tower_id) errs.tower_id = 'Block/tower is required';
    if (!form.unit_number.trim()) errs.unit_number = 'Unit number is required';
    if (!form.type.trim()) errs.type = 'Type is required';
    if (form.size_sqft && (Number.isNaN(Number(form.size_sqft)) || Number(form.size_sqft) < 0)) {
      errs.size_sqft = 'Size must be a positive number';
    }
    if (form.price && (Number.isNaN(Number(form.price)) || Number(form.price) < 0)) {
      errs.price = 'Price must be a positive number';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveUnit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        tower_id: form.tower_id,
        floor_id: form.floor_id || null,
        unit_number: form.unit_number.trim(),
        type: form.type.trim(),
        size_sqft: form.size_sqft ? Number(form.size_sqft) : null,
        price: form.price ? Number(form.price) : null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from('builder_units').update(payload).eq('id', editing.id);
        if (error) throw error;
        logBuilderAudit('update', 'builder_units', editing.id, { unit_number: payload.unit_number }).catch(
          () => {},
        );
        addToast('success', 'Unit updated');
      } else {
        const { data, error } = await supabase.from('builder_units').insert(payload).select('id').single();
        if (error) throw error;
        logBuilderAudit('create', 'builder_units', data?.id ?? null, { unit_number: payload.unit_number }).catch(
          () => {},
        );
        addToast('success', 'Unit created');
      }
      queryClient.invalidateQueries({ queryKey: ['builder-units'] });
      setShowModal(false);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save unit');
    } finally {
      setSaving(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (row: UnitRow) => {
      const { error } = await supabase.from('builder_units').delete().eq('id', row.id);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      logBuilderAudit('delete', 'builder_units', row.id, { unit_number: row.unit_number }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['builder-units'] });
      addToast('success', 'Unit deleted');
      setToDelete(null);
    },
    onError: (err) => {
      addToast('error', err instanceof Error ? err.message : 'Failed to delete unit');
    },
    onSettled: () => setDeleting(false),
  });

  const columns = useMemo<Column<UnitRow>[]>(
    () => [
      {
        key: 'unit_number',
        header: 'Unit #',
        sortable: true,
        render: (row) => <span className="font-medium text-navy-900">{row.unit_number}</span>,
      },
      { key: 'type', header: 'Type', render: (row) => row.type },
      {
        key: 'floor',
        header: 'Floor',
        render: (row) =>
          row.builder_floors
            ? `${row.builder_floors.floor_number}${row.builder_floors.name ? ` · ${row.builder_floors.name}` : ''}`
            : '—',
      },
      {
        key: 'tower',
        header: 'Block / Tower',
        render: (row) => <span className="text-sm text-navy-600">{row.builder_towers?.name ?? '—'}</span>,
      },
      { key: 'size_sqft', header: 'Size (sqft)', render: (row) => row.size_sqft ?? '—' },
      { key: 'price', header: 'Price', render: (row) => formatPrice(row.price) },
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
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(row)} />
            <Button
              size="sm"
              variant="ghost"
              className="text-error-600"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setToDelete(row)}
            />
          </div>
        ),
      },
    ],
    [],
  );

  const [filterTowerId, setFilterTowerId] = useState<string>('all');
  const [filterFloorId, setFilterFloorId] = useState<string>('all');

  const filterFloorsList = useMemo(() => {
    if (!floors) return [];
    if (filterTowerId === 'all') return floors;
    return floors.filter((fl) => fl.tower_id === filterTowerId);
  }, [floors, filterTowerId]);

  const filteredUnits = useMemo(() => {
    let list = units ?? [];
    if (filterTowerId !== 'all') {
      list = list.filter((u) => u.tower_id === filterTowerId);
    }
    if (filterFloorId !== 'all') {
      list = list.filter((u) => u.floor_id === filterFloorId);
    }
    return list;
  }, [units, filterTowerId, filterFloorId]);

  return (
    <DashboardLayout sections={builderSections} title="Units" badge="Builder">
      <PageHeader
        title="Units"
        subtitle="Manage individual units across your blocks and floors."
        actions={[{ label: 'Add Unit', icon: <Plus className="h-4 w-4" />, primary: true, onClick: openCreate }]}
      />

      {/* Contextual Workflow Progression */}
      <BuilderWorkflowBar
        currentStage="units"
        counts={{
          projects: projects?.length,
          blocks: towers?.length,
          floors: floors?.length,
          units: units?.length,
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Units" value={stats.total} icon={<Home className="h-5 w-5" />} accent="navy" />
        <StatCard label="Available" value={stats.available} icon={<Home className="h-5 w-5" />} accent="success" />
        <StatCard label="Booked" value={stats.booked} icon={<Home className="h-5 w-5" />} accent="gold" />
        <StatCard label="Sold" value={stats.sold} icon={<Home className="h-5 w-5" />} accent="error" />
      </div>

      {/* Dependency Warning Banners */}
      {!projects || projects.length === 0 ? (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-amber-900 shadow-xs mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-8 h-8 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-base text-amber-950">1. Create a Project First</h3>
              <p className="text-xs text-amber-800 mt-1 max-w-xl">
                Units must belong to a Block/Tower and Floor inside a Project. You currently have no projects created.
              </p>
            </div>
          </div>
          <Link
            to="/builder/projects"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </Link>
        </div>
      ) : !towers || towers.length === 0 ? (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 text-blue-950 shadow-xs mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Layers className="w-8 h-8 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-base text-blue-950">2. Create a Block / Tower</h3>
              <p className="text-xs text-blue-800 mt-1 max-w-xl">
                Units are organized inside Blocks or Towers. Create your first Block/Tower to start placing units.
              </p>
            </div>
          </div>
          <Link
            to="/builder/blocks"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Block / Tower</span>
          </Link>
        </div>
      ) : null}

      {/* Block & Floor Filter Drilldown */}
      {towers && towers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <span>Filter Inventory:</span>
          </div>

          <div className="w-48">
            <Select
              value={filterTowerId}
              onChange={(e) => {
                setFilterTowerId(e.target.value);
                setFilterFloorId('all');
              }}
              className="py-1 text-xs"
            >
              <option value="all">All Blocks / Towers ({towers.length})</option>
              {towers.map((tw) => (
                <option key={tw.id} value={tw.id}>
                  {tw.name}
                </option>
              ))}
            </Select>
          </div>

          {floors && floors.length > 0 && (
            <div className="w-48">
              <Select
                value={filterFloorId}
                onChange={(e) => setFilterFloorId(e.target.value)}
                className="py-1 text-xs"
              >
                <option value="all">All Floors ({filterFloorsList.length})</option>
                {filterFloorsList.map((fl) => (
                  <option key={fl.id} value={fl.id}>
                    Floor {fl.floor_number} {fl.name ? `(${fl.name})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {(filterTowerId !== 'all' || filterFloorId !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setFilterTowerId('all');
                setFilterFloorId('all');
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={filteredUnits}
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
          !projects || projects.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No projects yet"
              description="Create a project first before adding blocks, floors, and units."
              action={
                <Link to="/builder/projects">
                  <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                    Create Project
                  </Button>
                </Link>
              }
            />
          ) : !towers || towers.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="No blocks / towers found"
              description="Create a block/tower first before adding units."
              action={
                <Link to="/builder/blocks">
                  <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                    Create Block / Tower
                  </Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Home className="h-6 w-6" />}
              title="No units yet"
              description="Add units to a block or floor to start tracking inventory."
              action={
                <Button size="sm" onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
                  Add Unit
                </Button>
              }
            />
          )
        }
      />

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Unit' : 'Add Unit'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveUnit} loading={saving}>
              {editing ? 'Save changes' : 'Create unit'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Block / Tower"
            value={form.tower_id}
            onChange={(e) => setForm((f) => ({ ...f, tower_id: e.target.value, floor_id: '' }))}
            error={formErrors.tower_id}
          >
            <option value="">Select a block/tower</option>
            {(towers ?? []).map((tw) => (
              <option key={tw.id} value={tw.id}>
                {tw.name}
              </option>
            ))}
          </Select>
          <Select
            label="Floor (optional)"
            value={form.floor_id}
            onChange={(e) => setForm((f) => ({ ...f, floor_id: e.target.value }))}
          >
            <option value="">No specific floor</option>
            {floorsForTower.map((fl) => (
              <option key={fl.id} value={fl.id}>
                {fl.floor_number}
                {fl.name ? ` · ${fl.name}` : ''}
              </option>
            ))}
          </Select>
          <Input
            label="Unit Number"
            value={form.unit_number}
            onChange={(e) => setForm((f) => ({ ...f, unit_number: e.target.value }))}
            error={formErrors.unit_number}
          />
          <Input
            label="Type"
            placeholder="e.g. 2BHK"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            error={formErrors.type}
          />
          <Input
            label="Size (sqft)"
            type="number"
            min={0}
            value={form.size_sqft}
            onChange={(e) => setForm((f) => ({ ...f, size_sqft: e.target.value }))}
            error={formErrors.size_sqft}
          />
          <Input
            label="Price"
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            error={formErrors.price}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BuilderUnitStatus }))}
            containerClassName="sm:col-span-2"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete unit"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() => {
                if (toDelete) {
                  setDeleting(true);
                  deleteMutation.mutate(toDelete);
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">This will permanently delete unit "{toDelete?.unit_number}".</p>
      </Modal>
    </DashboardLayout>
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit3, Layers, Plus, Trash2, Building2, AlertCircle, ArrowRight } from 'lucide-react';
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
import { BuilderWorkflowBar } from '../../components/builder/BuilderWorkflowBar';
import type { BuilderFloor, BuilderTowerStatus } from '../../lib/types';

type FloorRow = BuilderFloor & { builder_towers: { name: string; project_id?: string; builder_projects?: { name: string } | null } | null };

const STATUS_OPTIONS: BuilderTowerStatus[] = ['planned', 'under_construction', 'ready'];

const statusBadgeVariant = (status: BuilderTowerStatus) =>
  status === 'ready' ? 'success' : status === 'under_construction' ? 'warning' : 'default';

const emptyForm = {
  project_id: '',
  tower_id: '',
  floor_number: '',
  name: '',
  status: 'planned' as BuilderTowerStatus,
  is_batch: false,
  start_floor: '1',
  end_floor: '10',
};

export function BuilderFloors() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const builderSections = getBuilderSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FloorRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<FloorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Inline quick block creation state
  const [showQuickAddTower, setShowQuickAddTower] = useState(false);
  const [quickTowerName, setQuickTowerName] = useState('');
  const [quickTowerFloors, setQuickTowerFloors] = useState('10');
  const [quickTowerSaving, setQuickTowerSaving] = useState(false);

  // 1. Fetch Builder's Projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['builder-my-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_projects')
        .select('id, name')
        .eq('builder_id', user!.id)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const projectIds = useMemo(() => (projects ?? []).map((p) => p.id), [projects]);

  // 2. Fetch Builder's Towers/Blocks across all projects
  const { data: towers, isLoading: towersLoading } = useQuery({
    queryKey: ['builder-my-towers', user?.id, projectIds.join(',')],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('builder_towers')
        .select('id, name, project_id, total_floors, builder_projects(id, name)')
        .in('project_id', projectIds)
        .order('name');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user && projectIds.length > 0,
  });

  const towerIds = useMemo(() => (towers ?? []).map((tw) => tw.id), [towers]);
  const floorsTick = useRealtimeCount('builder_floors');

  // 3. Fetch Builder's Floors
  const {
    data: floors,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['builder-floors', user?.id, towerIds.join(','), floorsTick],
    queryFn: async () => {
      if (towerIds.length === 0) return [] as FloorRow[];
      const { data, error } = await supabase
        .from('builder_floors')
        .select('*, builder_towers(name, project_id, builder_projects(name))')
        .in('tower_id', towerIds)
        .order('floor_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FloorRow[];
    },
    enabled: !!user && towerIds.length > 0,
  });

  // Filter towers based on selected project in form
  const availableTowers = useMemo(() => {
    if (!towers || towers.length === 0) return [];
    if (!form.project_id) return towers;
    return towers.filter((tw) => tw.project_id === form.project_id);
  }, [towers, form.project_id]);

  const stats = useMemo(() => {
    const rows = floors ?? [];
    return {
      total: rows.length,
      ready: rows.filter((r) => r.status === 'ready').length,
      underConstruction: rows.filter((r) => r.status === 'under_construction').length,
      planned: rows.filter((r) => r.status === 'planned').length,
    };
  }, [floors]);

  const openCreate = () => {
    const defaultProject = projects?.[0]?.id ?? '';
    const initialTowers = defaultProject ? (towers ?? []).filter((t) => t.project_id === defaultProject) : (towers ?? []);
    const defaultTower = initialTowers[0]?.id ?? towers?.[0]?.id ?? '';

    setEditing(null);
    setForm({
      ...emptyForm,
      project_id: defaultProject,
      tower_id: defaultTower,
      floor_number: '',
    });
    setFormErrors({});
    setShowQuickAddTower(false);
    setQuickTowerName('');
    setShowModal(true);
  };

  const openEdit = (row: FloorRow) => {
    setEditing(row);
    const tower = towers?.find((t) => t.id === row.tower_id);
    setForm({
      ...emptyForm,
      project_id: tower?.project_id ?? '',
      tower_id: row.tower_id,
      floor_number: String(row.floor_number),
      name: row.name ?? '',
      status: row.status,
      is_batch: false,
    });
    setFormErrors({});
    setShowQuickAddTower(false);
    setShowModal(true);
  };

  // Inline Quick Add Block
  const handleQuickAddTower = async () => {
    const projectId = form.project_id || projects?.[0]?.id;
    if (!projectId) {
      addToast('error', 'Please select or create a project first');
      return;
    }
    if (!quickTowerName.trim()) {
      addToast('error', 'Please enter a block/tower name');
      return;
    }
    setQuickTowerSaving(true);
    try {
      const payload = {
        project_id: projectId,
        name: quickTowerName.trim(),
        total_floors: Math.max(1, Number(quickTowerFloors) || 1),
        status: 'planned' as BuilderTowerStatus,
      };
      const { data, error } = await supabase.from('builder_towers').insert(payload).select('id, name, project_id').single();
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['builder-my-towers'] });
      await queryClient.invalidateQueries({ queryKey: ['builder-towers'] });

      setForm((f) => ({ ...f, project_id: projectId, tower_id: data.id }));
      setShowQuickAddTower(false);
      setQuickTowerName('');
      addToast('success', `Block "${data.name}" created and selected!`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to create block');
    } finally {
      setQuickTowerSaving(false);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.tower_id) errs.tower_id = 'Block / Tower is required';
    if (!form.is_batch) {
      if (form.floor_number.trim() === '' || Number.isNaN(Number(form.floor_number))) {
        errs.floor_number = 'Floor number is required (e.g. 1, 2, 3)';
      }
    } else {
      const start = Number(form.start_floor);
      const end = Number(form.end_floor);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
        errs.start_floor = 'Start floor must be less than or equal to End floor';
      }
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveFloor = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        const payload = {
          tower_id: form.tower_id,
          floor_number: Number(form.floor_number),
          name: form.name.trim() || null,
          status: form.status,
        };
        const { error } = await supabase.from('builder_floors').update(payload).eq('id', editing.id);
        if (error) throw error;
        logBuilderAudit('update', 'builder_floors', editing.id, { floor_number: payload.floor_number }).catch(() => {});
        addToast('success', 'Floor updated successfully');
      } else if (form.is_batch) {
        const start = Number(form.start_floor);
        const end = Number(form.end_floor);
        const batchPayload = [];
        for (let fl = start; fl <= end; fl++) {
          batchPayload.push({
            tower_id: form.tower_id,
            floor_number: fl,
            name: fl === 0 ? 'Ground Floor' : `Floor ${fl}`,
            status: form.status,
          });
        }
        const { error } = await supabase.from('builder_floors').insert(batchPayload);
        if (error) throw error;
        addToast('success', `Created ${batchPayload.length} floors (Floors ${start} to ${end}) successfully!`);
      } else {
        const payload = {
          tower_id: form.tower_id,
          floor_number: Number(form.floor_number),
          name: form.name.trim() || null,
          status: form.status,
        };
        const { data, error } = await supabase.from('builder_floors').insert(payload).select('id').single();
        if (error) throw error;
        logBuilderAudit('create', 'builder_floors', data?.id ?? null, { floor_number: payload.floor_number }).catch(() => {});
        addToast('success', 'Floor created successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['builder-floors'] });
      setShowModal(false);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save floor');
    } finally {
      setSaving(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (row: FloorRow) => {
      const { error } = await supabase.from('builder_floors').delete().eq('id', row.id);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      logBuilderAudit('delete', 'builder_floors', row.id, { floor_number: row.floor_number }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['builder-floors'] });
      addToast('success', 'Floor deleted');
      setToDelete(null);
    },
    onError: (err) => {
      addToast('error', err instanceof Error ? err.message : 'Failed to delete floor');
    },
    onSettled: () => setDeleting(false),
  });

  const columns = useMemo<Column<FloorRow>[]>(
    () => [
      {
        key: 'floor_number',
        header: 'Floor #',
        sortable: true,
        render: (row) => (
          <span className="font-bold text-navy-900 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
            Floor {row.floor_number}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Floor Name / Label',
        render: (row) => <span className="font-medium text-slate-800">{row.name ?? '—'}</span>,
      },
      {
        key: 'tower',
        header: 'Block / Tower',
        render: (row) => (
          <div>
            <span className="font-semibold text-navy-900">{row.builder_towers?.name ?? '—'}</span>
            {row.builder_towers?.builder_projects?.name && (
              <span className="block text-xs text-slate-400 font-normal">
                {row.builder_towers.builder_projects.name}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <Badge variant={statusBadgeVariant(row.status)} className="capitalize">
            {row.status.replace('_', ' ')}
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
              className="text-error-600 hover:text-error-700"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setToDelete(row)}
            />
          </div>
        ),
      },
    ],
    [],
  );

  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [filterTowerId, setFilterTowerId] = useState<string>('all');

  // Filtered towers based on main project filter
  const filterTowersList = useMemo(() => {
    if (!towers) return [];
    if (filterProjectId === 'all') return towers;
    return towers.filter((tw) => tw.project_id === filterProjectId);
  }, [towers, filterProjectId]);

  // Filtered floors based on active filters
  const filteredFloors = useMemo(() => {
    let list = floors ?? [];
    if (filterProjectId !== 'all') {
      list = list.filter((f) => f.builder_towers?.project_id === filterProjectId);
    }
    if (filterTowerId !== 'all') {
      list = list.filter((f) => f.tower_id === filterTowerId);
    }
    return list;
  }, [floors, filterProjectId, filterTowerId]);

  return (
    <DashboardLayout sections={builderSections} title="Floors" badge="Builder">
      <PageHeader
        title="Floors"
        subtitle="Manage floors within your blocks and towers."
        actions={[{ label: 'Add Floor', icon: <Plus className="h-4 w-4" />, primary: true, onClick: openCreate }]}
      />

      {/* Contextual Workflow Progression */}
      <BuilderWorkflowBar
        currentStage="floors"
        counts={{
          projects: projects?.length,
          blocks: towers?.length,
          floors: floors?.length,
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Floors" value={stats.total} icon={<Layers className="h-5 w-5" />} accent="navy" />
        <StatCard label="Ready" value={stats.ready} icon={<Layers className="h-5 w-5" />} accent="success" />
        <StatCard
          label="Under Construction"
          value={stats.underConstruction}
          icon={<Layers className="h-5 w-5" />}
          accent="gold"
        />
        <StatCard label="Planned" value={stats.planned} icon={<Layers className="h-5 w-5" />} accent="navy" />
      </div>

      {/* Dependency Warning Banners */}
      {!projectsLoading && (!projects || projects.length === 0) ? (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-amber-900 shadow-xs mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-8 h-8 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-base text-amber-950">1. Create a Project First</h3>
              <p className="text-xs text-amber-800 mt-1 max-w-xl">
                Floors must belong to a Block/Tower inside a Project. You currently have no projects created.
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
      ) : !towersLoading && (!towers || towers.length === 0) ? (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 text-blue-950 shadow-xs mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Layers className="w-8 h-8 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-base text-blue-950">2. Create a Block / Tower</h3>
              <p className="text-xs text-blue-800 mt-1 max-w-xl">
                Floors are organized under Blocks or Towers (e.g. Tower A, Block 1). Create your first Block/Tower to start placing floors.
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

      {/* Project & Tower Filter Drilldown */}
      {towers && towers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <span>Filter Inventory:</span>
          </div>

          {projects && projects.length > 1 && (
            <div className="w-48">
              <Select
                value={filterProjectId}
                onChange={(e) => {
                  setFilterProjectId(e.target.value);
                  setFilterTowerId('all');
                }}
                className="py-1 text-xs"
              >
                <option value="all">All Projects ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="w-48">
            <Select
              value={filterTowerId}
              onChange={(e) => setFilterTowerId(e.target.value)}
              className="py-1 text-xs"
            >
              <option value="all">All Blocks / Towers ({filterTowersList.length})</option>
              {filterTowersList.map((tw) => (
                <option key={tw.id} value={tw.id}>
                  {tw.name} {tw.builder_projects?.name ? `(${tw.builder_projects.name})` : ''}
                </option>
              ))}
            </Select>
          </div>

          {(filterProjectId !== 'all' || filterTowerId !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setFilterProjectId('all');
                setFilterTowerId('all');
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
        rows={filteredFloors}
        loading={isLoading || towersLoading || projectsLoading}
        error={error instanceof Error ? error.message : null}
        getRowId={(row) => row.id}
        searchKeys={['name', 'floor_number']}
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
              description="Create a project to begin adding towers and floors."
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
              description="Create a block/tower first to start organizing floors on it."
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
              icon={<Layers className="h-6 w-6" />}
              title="No floors yet"
              description="Add floors to a block/tower to start placing units on them."
              action={
                <Button size="sm" onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
                  Add Floor
                </Button>
              }
            />
          )
        }
      />

      {/* Add / Edit Floor Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Floor' : 'Add Floor'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveFloor} loading={saving} icon={editing ? undefined : <Plus className="h-4 w-4" />}>
              {editing ? 'Save changes' : form.is_batch ? 'Generate floors' : 'Create floor'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* If No Projects Exist */}
          {!projectsLoading && (!projects || projects.length === 0) && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-amber-900 mb-1">No Projects Found</p>
                <p className="text-amber-700 mb-2">
                  You need to create a project in the Builder Portal before adding blocks and floors.
                </p>
                <Link
                  to="/builder/projects"
                  className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700 bg-white px-3 py-1.5 rounded-lg border border-amber-300 shadow-2xs"
                >
                  Create Project <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Project & Tower Selection Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Project Selection (shown when multiple projects or to switch project) */}
            {projects && projects.length > 1 && (
              <Select
                label="Project"
                value={form.project_id}
                onChange={(e) => {
                  const newProjectId = e.target.value;
                  const newTowers = (towers ?? []).filter((tw) => tw.project_id === newProjectId);
                  setForm((f) => ({
                    ...f,
                    project_id: newProjectId,
                    tower_id: newTowers[0]?.id ?? '',
                  }));
                }}
                containerClassName="sm:col-span-2"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}

            {/* Block / Tower Dropdown */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Block / Tower</label>
                <button
                  type="button"
                  onClick={() => setShowQuickAddTower((prev) => !prev)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showQuickAddTower ? 'Cancel New Block' : '+ Quick Add Block'}
                </button>
              </div>

              {!showQuickAddTower ? (
                <div>
                  <select
                    value={form.tower_id}
                    onChange={(e) => setForm((f) => ({ ...f, tower_id: e.target.value }))}
                    className={`input pr-8 ${formErrors.tower_id ? 'border-error-400' : ''}`}
                  >
                    <option value="">Select a block/tower</option>
                    {availableTowers.map((tw) => {
                      const projName = tw.builder_projects?.name;
                      return (
                        <option key={tw.id} value={tw.id}>
                          {tw.name} {projName ? `· (${projName})` : ''} {tw.total_floors ? `· [${tw.total_floors} Floors]` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {formErrors.tower_id && <p className="mt-1 text-xs text-error-600">{formErrors.tower_id}</p>}
                </div>
              ) : (
                /* Inline Quick Add Block Form */
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                  <p className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-red-600" /> Create New Block / Tower
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Input
                      label="Block Name"
                      placeholder="e.g. Tower A, Block 1"
                      value={quickTowerName}
                      onChange={(e) => setQuickTowerName(e.target.value)}
                    />
                    <Input
                      label="Total Floors"
                      type="number"
                      min={1}
                      value={quickTowerFloors}
                      onChange={(e) => setQuickTowerFloors(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => setShowQuickAddTower(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleQuickAddTower} loading={quickTowerSaving}>
                      Save & Select Block
                    </Button>
                  </div>
                </div>
              )}

              {/* No Towers Warning Banner */}
              {!towersLoading && availableTowers.length === 0 && !showQuickAddTower && (
                <div className="mt-2 p-3 rounded-xl bg-slate-100/90 text-xs text-slate-600 flex items-center justify-between">
                  <span>No blocks/towers found for this project.</span>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddTower(true)}
                    className="font-bold text-red-600 hover:text-red-700 underline"
                  >
                    + Create a block now
                  </button>
                </div>
              )}
            </div>

            {/* Mode Switcher (Single Floor vs Batch Floor Generator) - only on Create */}
            {!editing && (
              <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-navy-900 block">Batch Floor Generator</span>
                  <span className="text-[11px] text-slate-500">Generate multiple floors in 1 click (e.g. Floors 1 to 10)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_batch: !f.is_batch }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    form.is_batch ? 'bg-red-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      form.is_batch ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Single Floor Inputs */}
            {!form.is_batch ? (
              <>
                <Input
                  label="Floor Number"
                  type="number"
                  placeholder="e.g. 1, 2, 3"
                  value={form.floor_number}
                  onChange={(e) => setForm((f) => ({ ...f, floor_number: e.target.value }))}
                  error={formErrors.floor_number}
                />
                <Input
                  label="Floor Name / Label (Optional)"
                  placeholder="e.g. Ground Floor, Penthouse"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </>
            ) : (
              /* Batch Generation Inputs */
              <>
                <Input
                  label="From Floor #"
                  type="number"
                  placeholder="1"
                  value={form.start_floor}
                  onChange={(e) => setForm((f) => ({ ...f, start_floor: e.target.value }))}
                  error={formErrors.start_floor}
                />
                <Input
                  label="To Floor #"
                  type="number"
                  placeholder="10"
                  value={form.end_floor}
                  onChange={(e) => setForm((f) => ({ ...f, end_floor: e.target.value }))}
                />
              </>
            )}

            {/* Status Dropdown */}
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BuilderTowerStatus }))}
              containerClassName="sm:col-span-2"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      {/* Delete Floor Confirmation Modal */}
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete floor"
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
        <p className="text-sm text-navy-700">
          This will permanently delete floor <strong>{toDelete?.floor_number}</strong> and unlink any units placed on it.
        </p>
      </Modal>
    </DashboardLayout>
  );
}

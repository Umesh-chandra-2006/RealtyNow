import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Edit3, Percent, Trash2, UserCog, Users, User, Camera } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getBuilderSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n';
import { DataTable } from '../../components/data-table';
import type { Column } from '../../components/data-table';
import { Badge, Button, EmptyState, Input, Modal, Select } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useRealtimeMulti } from '../../lib/realtime';
import { logBuilderAudit } from '../../lib/builder-audit';
import { uploadFile } from '../../lib/storage';

type BuilderAgentStatus = 'active' | 'inactive';

interface BuilderAgent {
  id: string;
  builder_id: string;
  agent_profile_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url?: string | null;
  commission_percent: number;
  status: BuilderAgentStatus;
  created_at: string;
  updated_at: string;
}

interface BuilderProjectLite {
  id: string;
  name: string;
}

interface BuilderProjectAgentRow {
  id: string;
  project_id: string;
  agent_id: string;
  assigned_at: string;
  builder_projects: { id: string; name: string } | null;
}

interface AgentForm {
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  commission_percent: string;
  status: BuilderAgentStatus;
}

const EMPTY_FORM: AgentForm = {
  name: '',
  email: '',
  phone: '',
  avatar_url: '',
  commission_percent: '',
  status: 'active',
};

export function BuilderAgents() {
  const { user } = useAuth();
  const { t } = useLanguageContext();
  const builderSections = getBuilderSections(t);
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const realtimeTick = useRealtimeMulti(['builder_agents', 'builder_project_agents']);

  const [toDelete, setToDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<BuilderAgent | 'new' | null>(null);
  const [form, setForm] = useState<AgentForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [assigningAgent, setAssigningAgent] = useState<BuilderAgent | null>(null);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [assignSaving, setAssignSaving] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ['builder-projects-lite', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_projects')
        .select('id, name')
        .eq('builder_id', user!.id)
        .order('name');
      if (error) throw error;
      return (data ?? []) as BuilderProjectLite[];
    },
    enabled: !!user,
  });

  const projectIds = useMemo(() => (projects ?? []).map((p) => p.id), [projects]);

  const { data: agents, isLoading, error } = useQuery({
    queryKey: ['builder-agents-full', user?.id, realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_agents')
        .select('*')
        .eq('builder_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BuilderAgent[];
    },
    enabled: !!user,
  });

  const { data: projectAgents } = useQuery({
    queryKey: ['builder-project-agents', user?.id, projectIds.join(','), realtimeTick],
    queryFn: async () => {
      if (!projectIds.length) return [];
      const { data, error } = await supabase
        .from('builder_project_agents')
        .select('*, builder_projects(id, name)')
        .in('project_id', projectIds);
      if (error) throw error;
      return (data ?? []) as BuilderProjectAgentRow[];
    },
    enabled: !!user && projects !== undefined,
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setAvatarPreview('');
    setFormErrors({});
    setEditing('new');
  };

  const openEdit = (a: BuilderAgent) => {
    setForm({
      name: a.name,
      email: a.email ?? '',
      phone: a.phone ?? '',
      avatar_url: a.avatar_url ?? '',
      commission_percent: String(a.commission_percent ?? ''),
      status: a.status,
    });
    setAvatarPreview(a.avatar_url ?? '');
    setFormErrors({});
    setEditing(a);
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('error', 'Please select a valid image file (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('error', 'Image size must be less than 5MB');
      return;
    }

    setAvatarUploading(true);
    setAvatarPreview(URL.createObjectURL(file));

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `builder-${user?.id}/${crypto.randomUUID()}.${ext}`;
      const { url, error } = await uploadFile('agent-avatars', file, path);
      if (error) throw new Error(error);

      setForm((f) => ({ ...f, avatar_url: url }));
      setAvatarPreview(url);
      addToast('success', 'Agent photo uploaded');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setForm((f) => ({ ...f, avatar_url: '' }));
    setAvatarPreview('');
  };

  const save = async () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    const commission = Number(form.commission_percent);
    if (form.commission_percent === '' || Number.isNaN(commission) || commission < 0 || commission > 100) {
      errors.commission_percent = 'Enter a value between 0 and 100';
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email';
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        avatar_url: form.avatar_url || null,
        commission_percent: commission,
        status: form.status,
      };

      if (editing && editing !== 'new') {
        const { error } = await supabase.from('builder_agents').update(payload).eq('id', editing.id);
        if (error) throw error;
        await logBuilderAudit('update', 'builder_agents', editing.id, payload);
        addToast('success', 'Agent updated');
      } else {
        const { data: inserted, error } = await supabase
          .from('builder_agents')
          .insert({ ...payload, builder_id: user!.id })
          .select('id')
          .single();
        if (error) throw error;
        await logBuilderAudit('create', 'builder_agents', inserted?.id ?? null, payload);
        addToast('success', 'Agent added');
      }

      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['builder-agents-full'] });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('builder_agents').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      await logBuilderAudit('delete', 'builder_agents', id);
      queryClient.invalidateQueries({ queryKey: ['builder-agents-full'] });
      queryClient.invalidateQueries({ queryKey: ['builder-project-agents'] });
      setToDelete(null);
      addToast('success', 'Agent removed');
    },
    onError: (err) => addToast('error', err instanceof Error ? err.message : 'Failed to delete agent'),
  });

  const openAssign = (a: BuilderAgent) => {
    const current = new Set((projectAgents ?? []).filter((pa) => pa.agent_id === a.id).map((pa) => pa.project_id));
    setAssignSelected(current);
    setAssigningAgent(a);
  };

  const toggleAssignProject = (projectId: string) => {
    setAssignSelected((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!assigningAgent) return;
    setAssignSaving(true);
    try {
      const current = new Set(
        (projectAgents ?? []).filter((pa) => pa.agent_id === assigningAgent.id).map((pa) => pa.project_id),
      );
      const toAdd = [...assignSelected].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !assignSelected.has(id));

      if (toAdd.length) {
        const { error } = await supabase
          .from('builder_project_agents')
          .insert(toAdd.map((project_id) => ({ project_id, agent_id: assigningAgent.id })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const rowIds = (projectAgents ?? [])
          .filter((pa) => pa.agent_id === assigningAgent.id && toRemove.includes(pa.project_id))
          .map((pa) => pa.id);
        if (rowIds.length) {
          const { error } = await supabase.from('builder_project_agents').delete().in('id', rowIds);
          if (error) throw error;
        }
      }

      await logBuilderAudit('assign_projects', 'builder_agents', assigningAgent.id, { added: toAdd, removed: toRemove });
      addToast('success', 'Project assignments updated');
      setAssigningAgent(null);
      queryClient.invalidateQueries({ queryKey: ['builder-project-agents'] });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to update assignments');
    } finally {
      setAssignSaving(false);
    }
  };

  const columns = useMemo<Column<BuilderAgent>[]>(
    () => [
      {
        key: 'name',
        header: 'Agent',
        sortable: true,
        render: (a) => (
          <div className="flex items-center gap-3">
            {a.avatar_url ? (
              <img
                src={a.avatar_url}
                alt={a.name}
                className="h-10 w-10 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-bold text-navy-900 text-sm shadow-2xs shrink-0">
                {a.name ? a.name.charAt(0).toUpperCase() : <User className="h-5 w-5 text-slate-400" />}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-navy-900 truncate">{a.name}</p>
              {a.email && <p className="text-xs text-slate-500 truncate">{a.email}</p>}
            </div>
          </div>
        ),
      },
      { key: 'phone', header: 'Phone', render: (a) => a.phone ?? '—' },
      {
        key: 'commission_percent',
        header: 'Commission %',
        sortable: true,
        render: (a) => <span className="font-semibold text-navy-900">{a.commission_percent ?? 0}%</span>,
      },
      {
        key: 'status',
        header: 'Status',
        render: (a) => (
          <Badge variant={a.status === 'active' ? 'success' : 'default'} className="capitalize">
            {a.status}
          </Badge>
        ),
      },
      {
        key: 'projects',
        header: 'Assigned Projects',
        render: (a) => {
          const count = (projectAgents ?? []).filter((pa) => pa.agent_id === a.id).length;
          return (
            <button
              type="button"
              onClick={() => openAssign(a)}
              className="text-xs font-bold text-navy-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              {count} project{count === 1 ? '' : 's'}
            </button>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (a) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<UserCog className="h-4 w-4" />} onClick={() => openAssign(a)}>
              Assign
            </Button>
            <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(a)} />
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setToDelete(a.id)}
            />
          </div>
        ),
      },
    ],
    [projectAgents],
  );

  const stats = useMemo(() => {
    const rows = agents ?? [];
    const active = rows.filter((a) => a.status === 'active').length;
    const avgCommission = rows.length ? rows.reduce((sum, a) => sum + (a.commission_percent || 0), 0) / rows.length : 0;
    return { total: rows.length, active, assignedProjects: (projectAgents ?? []).length, avgCommission };
  }, [agents, projectAgents]);

  return (
    <DashboardLayout sections={builderSections} title="Agents" badge="Builder">
      <PageHeader
        title="Sales Agents"
        subtitle="Manage agents, profile photos, and assign them to your construction projects."
        action={
          <Button onClick={openCreate} icon={<Users className="h-4 w-4" />}>
            Add agent
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Agents" value={stats.total} icon={<Users className="h-5 w-5" />} accent="navy" />
        <StatCard label="Active" value={stats.active} icon={<UserCog className="h-5 w-5" />} accent="success" />
        <StatCard label="Project Assignments" value={stats.assignedProjects} icon={<Building2 className="h-5 w-5" />} accent="gold" />
        <StatCard label="Avg. Commission" value={`${stats.avgCommission.toFixed(1)}%`} icon={<Percent className="h-5 w-5" />} accent="navy" />
      </div>

      <DataTable
        columns={columns}
        rows={agents ?? []}
        loading={isLoading}
        error={error instanceof Error ? error.message : null}
        getRowId={(a) => a.id}
        searchKeys={['name', 'email', 'phone']}
        cardRender={(a) => {
          const count = (projectAgents ?? []).filter((pa) => pa.agent_id === a.id).length;
          return (
            <div
              key={a.id}
              className="card p-5 hover:shadow-cardHover transition-all flex flex-col justify-between h-full group bg-white border border-slate-200/80 rounded-2xl"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {a.avatar_url ? (
                      <img
                        src={a.avatar_url}
                        alt={a.name}
                        className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-red-100 shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-bold text-navy-900 text-lg shadow-2xs shrink-0">
                        {a.name ? a.name.charAt(0).toUpperCase() : <User className="h-6 w-6 text-slate-400" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-navy-900 text-base leading-tight truncate">{a.name}</h4>
                      <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{a.email || 'No email'}</p>
                      {a.phone && <p className="text-xs text-slate-500 truncate mt-0.5">{a.phone}</p>}
                    </div>
                  </div>
                  <Badge variant={a.status === 'active' ? 'success' : 'default'} className="capitalize shrink-0">
                    {a.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Commission</span>
                    <span className="font-bold text-navy-900 text-sm">{a.commission_percent ?? 0}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Assigned Projects</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssign(a);
                      }}
                      className="font-bold text-navy-800 hover:text-red-600 inline-flex items-center gap-1 hover:underline text-sm cursor-pointer"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {count} project{count === 1 ? '' : 's'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" icon={<UserCog className="h-4 w-4" />} onClick={() => openAssign(a)}>
                  Assign
                </Button>
                <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(a)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setToDelete(a.id)}
                />
              </div>
            </div>
          );
        }}
        emptyState={
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No agents yet"
            description="Add sales agents with profile photos and assign them to your projects."
            action={
              <Button onClick={openCreate} icon={<Users className="h-4 w-4" />}>
                Add agent
              </Button>
            }
          />
        }
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Remove agent"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete)}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This will permanently remove this agent and their project assignments.
        </p>
      </Modal>

      {/* Add / Edit Agent Modal */}
      <Modal
        open={!!editing}
        onClose={() => {
          setEditing(null);
          setAvatarPreview('');
        }}
        title={editing === 'new' ? 'Add Sales Agent' : 'Edit Sales Agent'}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setAvatarPreview('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={save} loading={saving || avatarUploading}>
              Save agent
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            {/* Avatar Photo Upload Box */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="relative group shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Agent Avatar Preview"
                    className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-red-100"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-white border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                    <User className="h-8 w-8 text-slate-400" />
                  </div>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-slate-900/60 rounded-full flex items-center justify-center">
                    <div className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1.5">
                <label className="block text-xs font-bold text-navy-900">
                  Agent Profile Photo <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <p className="text-xs text-slate-500">
                  Upload a clear portrait (JPG, PNG, WEBP up to 5MB).
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-navy-900 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-2xs">
                    <Camera className="h-3.5 w-3.5 text-red-600" />
                    <span>{avatarPreview ? 'Change Photo' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarSelect}
                      disabled={avatarUploading}
                    />
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Full Name *"
                value={form.name}
                error={formErrors.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Rahul Sharma"
              />
              <Input
                label="Email Address"
                type="email"
                value={form.email}
                error={formErrors.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. rahul@example.com"
              />
              <Input
                label="Phone Number"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. 9876543210"
              />
              <Input
                label="Commission %"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.commission_percent}
                error={formErrors.commission_percent}
                onChange={(e) => setForm((f) => ({ ...f, commission_percent: e.target.value }))}
                placeholder="e.g. 10.0"
              />
              <div className="sm:col-span-2">
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BuilderAgentStatus }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Projects Modal */}
      <Modal
        open={!!assigningAgent}
        onClose={() => setAssigningAgent(null)}
        title={`Assign projects — ${assigningAgent?.name ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssigningAgent(null)}>
              Cancel
            </Button>
            <Button onClick={saveAssignments} loading={assignSaving}>
              Save assignments
            </Button>
          </>
        }
      >
        {(projects ?? []).length === 0 ? (
          <p className="text-sm text-navy-500">You have no projects yet.</p>
        ) : (
          <div className="space-y-2">
            {(projects ?? []).map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded-xl border border-navy-100 px-3 py-2 text-sm hover:bg-navy-50/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={assignSelected.has(p.id)}
                  onChange={() => toggleAssignProject(p.id)}
                  className="rounded border-navy-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
                />
                <span className="font-medium text-navy-900">{p.name}</span>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

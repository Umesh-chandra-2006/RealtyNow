import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit3,
  Trash2,
  ListTodo,
  Clock,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  Calendar,
  Eye,
  FileText,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DataTable, type Column } from '../../components/data-table';
import { Badge, Button, Modal, Input, Textarea, EmptyState } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useRealtimeCount } from '../../lib/realtime';
import { formatDate } from '../../lib/utils';
import { AgentLeadDetailDrawer } from '../../components/agent/AgentLeadDetailDrawer';

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'pending' | 'in_progress' | 'completed';
type TaskType = 'call' | 'follow_up' | 'site_visit' | 'appointment' | 'document' | 'other';

interface AgentTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  task_type: TaskType;
  related_lead_id: string | null;
  created_at: string;
  completed_at?: string | null;
  enquiries: { id: string; name: string | null; phone?: string | null; email?: string | null } | null;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed'];
const TASK_TYPES: { id: TaskType; label: string; icon: any }[] = [
  { id: 'call', label: 'Call Customer', icon: PhoneCall },
  { id: 'follow_up', label: 'Follow Up', icon: Clock },
  { id: 'site_visit', label: 'Site Visit', icon: Eye },
  { id: 'appointment', label: 'Appointment', icon: Calendar },
  { id: 'document', label: 'Document / KYC', icon: FileText },
  { id: 'other', label: 'General Task', icon: ListTodo },
];

function makeEmptyForm() {
  return {
    id: '',
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as TaskPriority,
    status: 'pending' as TaskStatus,
    task_type: 'call' as TaskType,
    related_lead_id: '',
  };
}

function priorityVariant(p: TaskPriority): 'default' | 'warning' | 'error' {
  if (p === 'high') return 'error';
  if (p === 'medium') return 'warning';
  return 'default';
}

function isOverdue(task: AgentTask): boolean {
  if (task.status === 'completed' || !task.due_date) return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

export function AgentTasks() {
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [form, setForm] = useState(makeEmptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AgentTask | null>(null);

  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const realtimeTick = useRealtimeCount('agent_tasks', { column: 'agent_id', value: user?.id ?? '' });

  const { data: leads } = useQuery({
    queryKey: ['agent-tasks-leads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquiries')
        .select('id, name, phone')
        .or(`agent_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['agent-tasks', user?.id, realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*, enquiries:related_lead_id(id, name, phone, email)')
        .eq('agent_id', user!.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentTask[];
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    return {
      total: data.length,
      pending: data.filter((r) => r.status === 'pending').length,
      inProgress: data.filter((r) => r.status === 'in_progress').length,
      completed: data.filter((r) => r.status === 'completed').length,
      overdue: data.filter(isOverdue).length,
    };
  }, [data]);

  const filteredTasks = useMemo(() => {
    return data.filter((task) => {
      if (statusTab === 'pending' && task.status !== 'pending') return false;
      if (statusTab === 'in_progress' && task.status !== 'in_progress') return false;
      if (statusTab === 'completed' && task.status !== 'completed') return false;
      if (statusTab === 'overdue' && !isOverdue(task)) return false;
      if (typeFilter !== 'all' && (task.task_type || 'other') !== typeFilter) return false;
      return true;
    });
  }, [data, statusTab, typeFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agent_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      addToast('success', 'Task deleted');
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
    },
    onError: (err: Error) => addToast('error', err.message || 'Failed to delete task'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from('agent_tasks')
        .update({
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-tasks'] }),
    onError: (err: Error) => addToast('error', err.message || 'Failed to update status'),
  });

  const openCreate = () => {
    setForm(makeEmptyForm());
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (task: AgentTask) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      due_date: task.due_date ?? '',
      priority: task.priority,
      status: task.status,
      task_type: task.task_type || 'call',
      related_lead_id: task.related_lead_id ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenLead = (leadId: string) => {
    supabase
      .from('enquiries')
      .select('*, property:properties(id, title, price, purpose, images, locality_name, city_name, bedrooms, built_up_area, property_types(name))')
      .eq('id', leadId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSelectedLead({
            ...data,
            property: Array.isArray(data.property) ? data.property[0] : data.property,
          });
          setDrawerOpen(true);
        }
      });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        agent_id: user!.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        priority: form.priority,
        status: form.status,
        task_type: form.task_type,
        related_lead_id: form.related_lead_id || null,
        completed_at: form.status === 'completed' ? new Date().toISOString() : null,
      };
      if (form.id) {
        const { error } = await supabase.from('agent_tasks').update(payload).eq('id', form.id);
        if (error) throw error;
        addToast('success', 'Task updated');
      } else {
        const { error } = await supabase.from('agent_tasks').insert(payload);
        if (error) throw error;
        addToast('success', 'Task created');
      }
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<AgentTask>[] = useMemo(
    () => [
      {
        key: 'title',
        header: 'Task & Details',
        sortable: true,
        render: (task) => {
          const typeObj = TASK_TYPES.find((t) => t.id === task.task_type) || TASK_TYPES[5];
          const Icon = typeObj.icon;
          return (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 grid place-items-center shrink-0 mt-0.5 text-slate-700">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-navy-900 text-sm leading-snug">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
                )}
                {task.enquiries?.name && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] text-slate-500">Re:</span>
                    <button
                      type="button"
                      onClick={() => task.related_lead_id && handleOpenLead(task.related_lead_id)}
                      className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      {task.enquiries.name} <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: 'task_type',
        header: 'Type',
        render: (task) => (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
            <Tag className="w-3 h-3 text-slate-400" />
            {(task.task_type || 'other').replace('_', ' ')}
          </span>
        ),
      },
      {
        key: 'due_date',
        header: 'Due Date',
        sortable: true,
        render: (task) => (
          <span className={isOverdue(task) ? 'text-red-600 font-bold flex items-center gap-1 text-xs' : 'text-slate-600 text-xs'}>
            {isOverdue(task) && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            {task.due_date ? formatDate(task.due_date) : '—'}
          </span>
        ),
      },
      {
        key: 'priority',
        header: 'Priority',
        render: (task) => (
          <Badge variant={priorityVariant(task.priority)} className="capitalize text-[10px] font-bold">
            {task.priority}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (task) => (
          <select
            value={task.status}
            onChange={(e) => statusMutation.mutate({ id: task.id, status: e.target.value as TaskStatus })}
            className="py-1 px-2.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 capitalize focus:outline-hidden"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (task) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(task)} />
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setToDelete(task)}
            />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout sections={agentSections} title="Tasks" badge="Agent">
      <PageHeader
        title="Agent Tasks & Reminders"
        subtitle="Manage customer follow-ups, calls, site visits, and daily to-dos."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            New Task
          </Button>
        }
      />

      {/* KPI Metric Summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Tasks" value={stats.total} icon={<ListTodo className="h-5 w-5" />} accent="navy" />
        <StatCard label="Pending" value={stats.pending} icon={<Clock className="h-5 w-5" />} accent="gold" />
        <StatCard label="In Progress" value={stats.inProgress} icon={<Clock className="h-5 w-5" />} accent="navy" />
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Overdue" value={stats.overdue} icon={<AlertTriangle className="h-5 w-5" />} accent="error" />
      </div>

      {/* Toolbar: Status Tabs & Task Type Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
          {(['all', 'pending', 'in_progress', 'overdue', 'completed'] as const).map((tab) => {
            const isActive = statusTab === tab;
            const count =
              tab === 'all'
                ? stats.total
                : tab === 'pending'
                  ? stats.pending
                  : tab === 'in_progress'
                    ? stats.inProgress
                    : tab === 'completed'
                      ? stats.completed
                      : stats.overdue;
            return (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 capitalize ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.replace('_', ' ')}
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Task Types</option>
            {TASK_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredTasks}
        loading={isLoading}
        error={error instanceof Error ? error.message : null}
        getRowId={(t) => t.id}
        searchKeys={['title', 'description']}
        emptyState={
          <EmptyState
            icon={<CheckCircle2 className="h-8 w-8 text-slate-300" />}
            title="No tasks found"
            description="Create a task to keep track of follow-ups, calls, and customer reminders."
          />
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Edit Task' : 'Create New Task'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save Task
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Task Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              error={formErrors.title}
              placeholder="e.g. Call Rajesh regarding pricing breakdown"
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 mb-1 block">Task Type</label>
            <select
              value={form.task_type}
              onChange={(e) => setForm((f) => ({ ...f, task_type: e.target.value as TaskType }))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-red-400"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 mb-1 block">Related Lead</label>
            <select
              value={form.related_lead_id}
              onChange={(e) => setForm((f) => ({ ...f, related_lead_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-red-400"
            >
              <option value="">None / General</option>
              {(leads ?? []).map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name || 'Lead'} {l.phone ? `(${l.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Input
              type="date"
              label="Due Date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 mb-1 block">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 capitalize focus:outline-hidden focus:ring-2 focus:ring-red-400"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          </div>          <div className="sm:col-span-2">
            <Textarea
              label="Description / Notes"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Key talking points or instructions..."
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {toDelete && (
        <Modal
          open={!!toDelete}
          onClose={() => setToDelete(null)}
          title="Delete Task"
          footer={
            <>
              <Button variant="secondary" onClick={() => setToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(toDelete.id)}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong className="text-navy-900">{toDelete.title}</strong>? This action cannot be undone.
          </p>
        </Modal>
      )}

      <AgentLeadDetailDrawer
        lead={selectedLead}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLead(null);
        }}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
        }}
      />
    </DashboardLayout>
  );
}

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  MessageCircle,
  Building2,
  RefreshCw,
  ExternalLink,
  Plus,
  Filter,
  Search,
  CheckSquare,
  Square,
  Trash2,
  Tag,
  AlertTriangle,
  UserCheck,
  Send,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Badge, Input, Select, Textarea } from '../../components/ui';
import { formatDate, formatDateTime, buildWhatsAppUrl, cn } from '../../lib/utils';
import { useToast } from '../../components/toast';

interface PartnerTask {
  id: string;
  title: string;
  referral_id?: string;
  referral_code?: string;
  client_name?: string;
  client_phone?: string;
  task_type: 'call' | 'whatsapp' | 'site_visit' | 'document' | 'negotiation' | 'general';
  due_date: string;
  due_time?: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  completed_at?: string;
  notes?: string;
  created_at: string;
}

const DEFAULT_SAMPLE_TASKS: PartnerTask[] = [
  {
    id: 'pt-1',
    title: 'Call Rahul Sharma regarding Tellapur 3BHK visit',
    referral_code: 'RN-REF-000012',
    client_name: 'Rahul Sharma',
    client_phone: '+91 9876543210',
    task_type: 'call',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '14:30',
    priority: 'high',
    completed: false,
    notes: 'Check if Sunday 11 AM works for developer site tour.',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'pt-2',
    title: 'Collect KYC PAN & Cheque for Gachibowli Flat Booking',
    referral_code: 'RN-REF-000008',
    client_name: 'Anita Deshmukh',
    client_phone: '+91 9123456789',
    task_type: 'document',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '17:00',
    priority: 'high',
    completed: false,
    notes: 'Down payment advance token slip needs to be uploaded.',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'pt-3',
    title: 'Follow up on Home Loan Sanction letter with HDFC',
    referral_code: 'RN-REF-000015',
    client_name: 'Venkatesh Rao',
    client_phone: '+91 9988776655',
    task_type: 'whatsapp',
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    due_time: '11:00',
    priority: 'medium',
    completed: false,
    notes: 'Loan sanction in final stage. Commission unlocks post sanction.',
    created_at: new Date().toISOString(),
  },
];

export function PartnerFollowUpsPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tasks' | 'timeline'>('tasks');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineType, setTimelineType] = useState('ALL');

  // Task creation modal
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    referral_id: '',
    task_type: 'call' as PartnerTask['task_type'],
    due_date: new Date().toISOString().split('T')[0],
    due_time: '12:00',
    priority: 'high' as PartnerTask['priority'],
    notes: '',
  });

  // Local Task Storage helper
  const [localTasks, setLocalTasks] = useState<PartnerTask[]>(() => {
    try {
      const saved = localStorage.getItem('realtynow_partner_tasks');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_SAMPLE_TASKS;
  });

  const saveTasks = (tasks: PartnerTask[]) => {
    setLocalTasks(tasks);
    try {
      localStorage.setItem('realtynow_partner_tasks', JSON.stringify(tasks));
    } catch {
      // ignore
    }
  };

  // 1. Fetch Partner record
  const { data: partner } = useQuery({
    queryKey: ['partner-me', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('partners').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // 2. Fetch Partner's active referrals
  const { data: referrals = [] } = useQuery({
    queryKey: ['partner-referrals-list-for-tasks', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data } = await supabase
        .from('referrals')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  // 3. Fetch referral activities & follow-up events
  const {
    data: activities = [],
    isLoading: isActivitiesLoading,
    refetch: refetchActivities,
  } = useQuery({
    queryKey: ['partner-referral-activities', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data, error } = await supabase
        .from('referral_activities')
        .select(`
          *,
          referral:referrals!inner(id, referral_code, partner_id, status, details, category)
        `)
        .eq('referral.partner_id', partner.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) return [];
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  // Toggle Task Completion
  const handleToggleTask = (taskId: string) => {
    const updated = localTasks.map((t) => {
      if (t.id === taskId) {
        const next = !t.completed;
        return {
          ...t,
          completed: next,
          completed_at: next ? new Date().toISOString() : undefined,
        };
      }
      return t;
    });
    saveTasks(updated);
    addToast('success', 'Task status updated!');
  };

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    const updated = localTasks.filter((t) => t.id !== taskId);
    saveTasks(updated);
    addToast('info', 'Task deleted.');
  };

  // Create Task
  const handleCreateTask = () => {
    if (!taskForm.title.trim()) {
      addToast('warning', 'Please enter a task title');
      return;
    }

    const matchedRef = referrals.find((r: any) => r.id === taskForm.referral_id);
    const newTask: PartnerTask = {
      id: `pt-${Date.now()}`,
      title: taskForm.title.trim(),
      referral_id: taskForm.referral_id || undefined,
      referral_code: matchedRef?.referral_code,
      client_name: matchedRef?.details?.customer_name || matchedRef?.details?.name,
      client_phone: matchedRef?.details?.customer_phone || matchedRef?.details?.phone,
      task_type: taskForm.task_type,
      due_date: taskForm.due_date,
      due_time: taskForm.due_time,
      priority: taskForm.priority,
      completed: false,
      notes: taskForm.notes.trim(),
      created_at: new Date().toISOString(),
    };

    saveTasks([newTask, ...localTasks]);
    setCreateTaskModalOpen(false);
    setTaskForm({
      title: '',
      referral_id: '',
      task_type: 'call',
      due_date: new Date().toISOString().split('T')[0],
      due_time: '12:00',
      priority: 'high',
      notes: '',
    });
    addToast('success', 'New follow-up task scheduled!');
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return localTasks.filter((t) => {
      if (taskFilter === 'pending') return !t.completed;
      if (taskFilter === 'completed') return t.completed;
      return true;
    });
  }, [localTasks, taskFilter]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act: any) => {
      const matchSearch =
        !timelineSearch ||
        act.title?.toLowerCase().includes(timelineSearch.toLowerCase()) ||
        act.notes?.toLowerCase().includes(timelineSearch.toLowerCase()) ||
        act.referral?.referral_code?.toLowerCase().includes(timelineSearch.toLowerCase());

      const matchType =
        timelineType === 'ALL' ||
        act.activity_type?.toLowerCase() === timelineType.toLowerCase();

      return matchSearch && matchType;
    });
  }, [activities, timelineSearch, timelineType]);

  const pendingCount = localTasks.filter((t) => !t.completed).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const dueTodayCount = localTasks.filter((t) => !t.completed && t.due_date === todayStr).length;
  const completedCount = localTasks.filter((t) => t.completed).length;

  return (
    <DashboardLayout sections={sections} title="Follow-ups & Tasks">
      <PageHeader
        title="Follow-ups, Tasks & Live Timeline"
        subtitle="Manage client reminders, schedule site visits, and track chronological updates on your submitted referrals."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateTaskModalOpen(true)}
            >
              Schedule Follow-up
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchActivities()}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Pending Tasks"
          value={pendingCount}
          icon={CalendarClock}
          description="Awaiting your action"
        />
        <StatCard
          label="Due Today"
          value={dueTodayCount}
          icon={AlertCircle}
          description="High-priority actions"
        />
        <StatCard
          label="Completed"
          value={completedCount}
          icon={CheckCircle2}
          description="Finished follow-ups"
        />
        <StatCard
          label="Logged Events"
          value={activities.length}
          icon={Clock}
          description="Live CRM updates"
        />
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('tasks')}
          className={cn(
            'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer',
            activeTab === 'tasks'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          )}
        >
          <CheckSquare className="h-4 w-4" />
          <span>My Follow-up Tasks ({localTasks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer',
            activeTab === 'timeline'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          )}
        >
          <Clock className="h-4 w-4" />
          <span>Referral Activity Stream ({activities.length})</span>
        </button>
      </div>

      {/* TAB 1: Tasks & Follow-ups */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTaskFilter('pending')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  taskFilter === 'pending'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                )}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setTaskFilter('completed')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  taskFilter === 'completed'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                )}
              >
                Completed ({completedCount})
              </button>
              <button
                onClick={() => setTaskFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  taskFilter === 'all'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                )}
              >
                All ({localTasks.length})
              </button>
            </div>

            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setCreateTaskModalOpen(true)}
            >
              Add Task
            </Button>
          </div>

          {filteredTasks.length === 0 ? (
            <Card className="p-12 text-center space-y-3 bg-white border border-slate-200 rounded-2xl">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="font-display text-base font-bold text-slate-900">
                {taskFilter === 'pending' ? 'All caught up! No pending follow-ups' : 'No tasks in this view'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Schedule a follow-up call, site visit, or document collection task for your referrals.
              </p>
              <Button size="sm" onClick={() => setCreateTaskModalOpen(true)}>
                Schedule Follow-up Task
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((t) => {
                const isOverdue = !t.completed && t.due_date < todayStr;
                const isDueToday = !t.completed && t.due_date === todayStr;
                const cleanPhone = (t.client_phone || '').replace(/[^0-9]/g, '');
                const waUrl = buildWhatsAppUrl(
                  cleanPhone,
                  `Hi ${t.client_name || 'Client'}, following up regarding your RealtyNow property enquiry (${t.referral_code || ''}):`
                );

                return (
                  <Card
                    key={t.id}
                    className={cn(
                      'p-4 bg-white border transition-all rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs',
                      t.completed ? 'opacity-65 border-slate-200 bg-slate-50/50' : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleTask(t.id)}
                        className="mt-0.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
                        title={t.completed ? 'Mark pending' : 'Mark complete'}
                      >
                        {t.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={cn(
                              'font-bold text-sm text-slate-900',
                              t.completed && 'line-through text-slate-500'
                            )}
                          >
                            {t.title}
                          </h4>
                          {t.referral_code && (
                            <span className="font-mono text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/60 px-1.5 py-0.2 rounded">
                              {t.referral_code}
                            </span>
                          )}
                          <Badge
                            variant={t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'default'}
                            className="text-[10px] capitalize"
                          >
                            {t.priority}
                          </Badge>
                          <Badge variant="blue" className="text-[10px] uppercase">
                            {t.task_type}
                          </Badge>
                        </div>

                        {t.notes && (
                          <p className="text-xs text-slate-600 font-medium line-clamp-2">{t.notes}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium pt-1">
                          <span
                            className={cn(
                              'flex items-center gap-1 font-semibold',
                              isOverdue ? 'text-red-600' : isDueToday ? 'text-amber-600' : 'text-slate-500'
                            )}
                          >
                            <Calendar className="h-3 w-3" />
                            Due: {formatDate(t.due_date)} {t.due_time ? `at ${t.due_time}` : ''}
                            {isOverdue && ' (Overdue)'}
                            {isDueToday && ' (Today)'}
                          </span>
                          {t.client_name && (
                            <span className="text-slate-600">Client: {t.client_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      {cleanPhone && (
                        <>
                          <a
                            href={`tel:${cleanPhone}`}
                            className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                            title="Call Client"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            title="WhatsApp Client"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 transition cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Live Referral Activity Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <Card className="p-4 bg-white border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search timeline by customer name, referral code, or notes..."
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  className="input pl-9 text-xs w-full"
                />
              </div>
              <div className="md:col-span-4">
                <Select
                  value={timelineType}
                  onChange={(e) => setTimelineType(e.target.value)}
                  className="text-xs"
                >
                  <option value="ALL">All Activity Types</option>
                  <option value="status_change">Status Changes</option>
                  <option value="note">Notes & Updates</option>
                  <option value="assignment">Agent Assignments</option>
                  <option value="commission">Commission Milestones</option>
                </Select>
              </div>
            </div>
          </Card>

          {isActivitiesLoading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <div className="h-6 w-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500 mt-2">Loading activity timeline...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <Card className="p-12 text-center space-y-3 bg-white border border-slate-200 rounded-2xl">
              <CalendarClock className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="font-display text-base font-bold text-slate-900">No activity matching filter</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Chronological updates from our CRM, assigned agents, and verification team will stream here.
              </p>
            </Card>
          ) : (
            <Card className="p-6 bg-white border border-slate-200 space-y-4 rounded-2xl">
              <div className="relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 space-y-6">
                {filteredActivities.map((act: any) => {
                  const ref = act.referral;
                  return (
                    <div key={act.id} className="relative group">
                      <div className="absolute -left-6 top-1 h-5 w-5 rounded-full bg-white border-2 border-red-600 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                      </div>
                      <div className="bg-slate-50/80 hover:bg-slate-50 rounded-2xl p-4 border border-slate-200/80 transition-colors space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{act.title}</span>
                            {ref?.referral_code && (
                              <Link
                                to={`/partner/referrals/${ref.id}`}
                                className="font-mono text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/60 px-1.5 py-0.5 rounded hover:underline"
                              >
                                {ref.referral_code}
                              </Link>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatDateTime(act.created_at)}
                          </span>
                        </div>

                        {act.notes && (
                          <p className="text-xs text-slate-600 font-medium">{act.notes}</p>
                        )}

                        {act.old_value && act.new_value && (
                          <p className="text-[11px] text-slate-500 font-mono">
                            Status changed: <span className="text-slate-400">{act.old_value}</span> →{' '}
                            <span className="font-bold text-emerald-600">{act.new_value}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* MODAL: Create Follow-up Task */}
      {createTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Schedule Follow-up Task
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Set reminders for site tours, client calls, or document submissions.
                </p>
              </div>
              <button
                onClick={() => setCreateTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Task Title / Action *</label>
                <Input
                  placeholder="e.g., Call Rajesh regarding Sunday 11 AM Site Visit"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Task Type</label>
                  <Select
                    value={taskForm.task_type}
                    onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value as any })}
                    className="text-xs mt-1"
                  >
                    <option value="call">Phone Call</option>
                    <option value="whatsapp">WhatsApp Message</option>
                    <option value="site_visit">Site Visit Tour</option>
                    <option value="document">Document Collection</option>
                    <option value="negotiation">Deal Negotiation</option>
                    <option value="general">General Task</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Priority</label>
                  <Select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                    className="text-xs mt-1"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Link to Referral (Optional)</label>
                <Select
                  value={taskForm.referral_id}
                  onChange={(e) => setTaskForm({ ...taskForm, referral_id: e.target.value })}
                  className="text-xs mt-1"
                >
                  <option value="">None / General Task</option>
                  {referrals.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.referral_code} — {r.details?.customer_name || 'Customer'} ({r.category || r.referral_type})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Due Date</label>
                  <Input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Due Time</label>
                  <Input
                    type="time"
                    value={taskForm.due_time}
                    onChange={(e) => setTaskForm({ ...taskForm, due_time: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Notes / Instructions</label>
                <Textarea
                  rows={2}
                  placeholder="Key talking points or customer preference notes..."
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setCreateTaskModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateTask} icon={<Plus className="h-3.5 w-3.5" />}>
                Save Follow-up Task
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default PartnerFollowUpsPage;

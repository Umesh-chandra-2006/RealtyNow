import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, Archive, Trash2, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useRealtimeNotifications } from '../../lib/realtime';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPortalSections, getAgentSections, getAdminSections, getPartnerSections } from './sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Button, Card, EmptyState } from '../../components/ui';
import { useToast } from '../../components/toast';
import type { Notification } from '../../lib/types';
import { NotificationCard } from '../../components/notifications/notification-card';
import { NotificationToolbar, type StatusFilter, type DateFilter, type SortOrder } from '../../components/notifications/notification-toolbar';
import { NotificationPreferencesModal } from '../../components/notifications/notification-preferences-modal';
import { BroadcastPanel } from '../../components/notifications/broadcast-panel';
import { categorize, groupByDate, type NotificationCategory, type UiPriority } from '../../components/notifications/notification-utils';

const PAGE_SIZE = 20;

function fromUiPriority(p: UiPriority): 'low' | 'medium' | 'high' | 'urgent' {
  if (p === 'Critical') return 'urgent';
  if (p === 'High') return 'high';
  if (p === 'Low') return 'low';
  return 'medium';
}

function dateFilterRange(filter: DateFilter): { gte?: string; lt?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);

  if (filter === 'today') return { gte: today.toISOString() };
  if (filter === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { gte: y.toISOString(), lt: today.toISOString() };
  }
  if (filter === 'week') {
    const w = new Date(today);
    w.setDate(w.getDate() - 7);
    return { gte: w.toISOString() };
  }
  if (filter === 'earlier') {
    const w = new Date(today);
    w.setDate(w.getDate() - 7);
    return { lt: w.toISOString() };
  }
  return {};
}

export function PortalNotifications() {
  const { user, profile } = useAuth();
  const userRole = profile?.role || 'customer';
  const { t } = useLanguageContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<UiPriority | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPreferences, setShowPreferences] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const { refetchFlag, unreadCount, setUnreadCount } = useRealtimeNotifications(user?.id);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications-page', user?.id, refetchFlag, statusFilter, priorityFilter, dateFilter, sort, search],
    queryFn: async ({ pageParam }) => {
      if (!user) return { items: [] as Notification[], nextPage: undefined as number | undefined };
      let q = supabase.from('notifications').select('*').eq('user_id', user.id).eq('is_dismissed', false);

      if (statusFilter === 'unread') q = q.is('read_at', null);
      if (priorityFilter !== 'all') q = q.eq('priority', fromUiPriority(priorityFilter));
      const range = dateFilterRange(dateFilter);
      if (range.gte) q = q.gte('created_at', range.gte);
      if (range.lt) q = q.lt('created_at', range.lt);
      if (search.trim()) q = q.or(`title.ilike.%${search.trim()}%,body.ilike.%${search.trim()}%`);
      q = q.order('created_at', { ascending: sort === 'oldest' });

      const from = pageParam * PAGE_SIZE;
      const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const items = (data ?? []) as Notification[];
      return { items, nextPage: items.length === PAGE_SIZE ? pageParam + 1 : undefined };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!user,
  });

  // Category isn't a real column (derived from type/template_key — see notification-utils),
  // so it's filtered client-side per loaded page rather than in the query above.
  const allItems = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const visibleItems = useMemo(
    () => (categoryFilter === 'all' ? allItems : allItems.filter((n) => categorize(n) === categoryFilter)),
    [allItems, categoryFilter],
  );
  const grouped = useMemo(() => groupByDate(visibleItems), [visibleItems]);

  // Infinite scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
  };

  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('fn_mark_notifications_read', { p_notification_ids: ids });
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      invalidate();
      setUnreadCount((c) => Math.max(0, c - ids.length));
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fn_mark_notifications_read', { p_notification_ids: null });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setUnreadCount(0);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) return;
      await supabase.from('notifications').update({ is_dismissed: true }).in('id', ids).eq('user_id', user.id);
    },
    onSuccess: () => {
      invalidate();
      setSelectedIds(new Set());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) return;
      await supabase.from('notifications').delete().in('id', ids).eq('user_id', user.id);
    },
    onSuccess: () => {
      invalidate();
      setSelectedIds(new Set());
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from('notifications').update({ is_dismissed: true }).eq('user_id', user.id).eq('is_dismissed', false);
    },
    onSuccess: () => {
      invalidate();
      toast.addToast('success', 'All notifications cleared');
      setConfirmClearAll(false);
    },
  });

  const handleView = (notif: Notification) => {
    if (!notif.read_at) markReadMutation.mutate([notif.id]);
    const target = notif.action_url || notif.link;
    if (target) navigate(target);
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const sections =
    userRole === 'admin' ? getAdminSections(t) :
    userRole === 'agent' ? getAgentSections(t) :
    userRole === 'partner' ? getPartnerSections(t) :
    getPortalSections(t);
  const selectedArray = [...selectedIds];

  return (
    <DashboardLayout sections={sections} title={t('portal.notifications', 'Notifications')} badge={userRole}>
      <PageHeader
        title={t('portal.notifications', 'Notifications')}
        subtitle={t('portal.notificationsDesc', 'Stay updated with your latest alerts and reminders.')}
      />

      {userRole === 'admin' && <BroadcastPanel />}

      <NotificationToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        sort={sort}
        onSortChange={setSort}
        onMarkAllRead={() => markAllReadMutation.mutate()}
        onClearAll={() => setConfirmClearAll(true)}
        onOpenPreferences={() => setShowPreferences(true)}
        unreadCount={unreadCount}
      />

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 flex items-center justify-between rounded-xl border border-navy-100 bg-navy-50 px-4 py-2.5 dark:border-navy-700 dark:bg-navy-800"
          >
            <span className="text-sm font-semibold text-navy-700 dark:text-navy-200">{selectedIds.size} selected</span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="secondary" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={() => markReadMutation.mutate(selectedArray)}>
                Mark read
              </Button>
              <Button size="sm" variant="secondary" icon={<Archive className="h-3.5 w-3.5" />} onClick={() => archiveMutation.mutate(selectedArray)}>
                Archive
              </Button>
              <Button size="sm" variant="ghost" className="text-error-600" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => deleteMutation.mutate(selectedArray)}>
                Delete
              </Button>
              <button onClick={() => setSelectedIds(new Set())} className="grid h-8 w-8 place-items-center rounded-lg text-navy-400 hover:bg-navy-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-navy-50 dark:bg-navy-900" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title={t('portal.noNotifications', 'No notifications')}
            description={
              statusFilter === 'unread'
                ? t('portal.noUnreadNotifsDesc', "You're all caught up!")
                : t('portal.noNotifsDesc', 'When you get alerts, they will show up here.')
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <h3 className="mb-2.5 text-xs font-bold uppercase tracking-widest text-navy-400">{group}</h3>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {items.map((notif) => (
                    <NotificationCard
                      key={notif.id}
                      notif={notif}
                      selected={selectedIds.has(notif.id)}
                      onToggleSelect={(checked) => toggleSelect(notif.id, checked)}
                      onView={() => handleView(notif)}
                      onMarkRead={() => markReadMutation.mutate([notif.id])}
                      onArchive={() => archiveMutation.mutate([notif.id])}
                      onDelete={() => deleteMutation.mutate([notif.id])}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}

          <div ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-navy-400" />}
          </div>
        </div>
      )}

      <NotificationPreferencesModal open={showPreferences} onClose={() => setShowPreferences(false)} />

      <AnimatePresence>
        {confirmClearAll && (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-navy-900/40 p-4" onClick={() => setConfirmClearAll(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-navy-900"
            >
              <h3 className="font-bold text-navy-900 dark:text-white">Clear all notifications?</h3>
              <p className="mt-1.5 text-sm text-navy-500">
                They'll be archived and removed from this view. This can't be undone from here.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setConfirmClearAll(false)}>
                  Cancel
                </Button>
                <Button onClick={() => clearAllMutation.mutate()} loading={clearAllMutation.isPending}>
                  Clear All
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

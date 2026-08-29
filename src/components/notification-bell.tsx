import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Trash2, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useRealtimeNotifications } from '../lib/realtime';
import { cn, relativeTime } from '../lib/utils';

const PAGE_SIZE = 20;

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { unreadCount, refetchFlag, setUnreadCount } = useRealtimeNotifications(user?.id);

  // Reset pagination whenever the drawer re-opens or Realtime signals a change.
  useEffect(() => {
    setPage(1);
  }, [open, refetchFlag]);

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id, refetchFlag, page],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(0, page * PAGE_SIZE - 1);
      return data ?? [];
    },
    enabled: !!user,
  });

  const hasMore = (notifications?.length ?? 0) === page * PAGE_SIZE;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').delete().eq('id', id);
    },
    onSuccess: (_data, id) => {
      const wasUnread = notifications?.find((n) => n.id === id && !n.read_at);
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setUnreadCount((c) => Math.max(0, c - 1));
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setUnreadCount(0);
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifClick = (notif: { id: string; link: string | null; read_at: string | null }) => {
    if (!notif.read_at) markReadMutation.mutate(notif.id);
    if (notif.link) navigate(notif.link);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid place-items-center rounded-lg p-2 text-navy-500 transition hover:bg-navy-50 hover:text-navy-700"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-[9999] w-80 sm:w-96 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
              <p className="font-display text-sm font-semibold text-navy-900">Notifications</p>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-xs font-medium text-navy-700 hover:text-navy-900"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
                  aria-label="Close notifications"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications && notifications.length > 0 ? (
                <>
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'group flex w-full gap-3 border-b border-navy-50 px-4 py-3 transition hover:bg-navy-50',
                        !notif.read_at && 'bg-gold-50/40',
                      )}
                    >
                      <button onClick={() => handleNotifClick(notif)} className="flex flex-1 min-w-0 gap-3 text-left">
                        <div
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            !notif.read_at ? 'bg-gold-400' : 'bg-transparent',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-navy-900">{notif.title}</p>
                          <p className="mt-0.5 text-xs text-navy-600 line-clamp-2">{notif.body}</p>
                          <p className="mt-1 text-[11px] text-navy-400">{relativeTime(notif.created_at)}</p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(notif.id);
                        }}
                        title="Delete notification"
                        className="shrink-0 self-start rounded-lg p-1.5 text-navy-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {hasMore && (
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="w-full py-3 text-center text-xs font-semibold text-navy-500 hover:bg-navy-50 hover:text-navy-800"
                    >
                      Load more
                    </button>
                  )}
                </>
              ) : (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto h-8 w-8 text-navy-200" />
                  <p className="mt-2 text-sm text-navy-500">No notifications yet</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

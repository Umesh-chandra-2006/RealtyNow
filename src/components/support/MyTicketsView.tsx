import React, { useState } from 'react';
import {
  Ticket,
  Search,
  PlusCircle,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import type { SupportTicket, SupportStatus } from '../../lib/support';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';

interface MyTicketsViewProps {
  tickets: SupportTicket[];
  isLoading: boolean;
  onSelectTicket: (ticket: SupportTicket) => void;
  onRaiseTicket: () => void;
  activeStatusFilter?: string;
  onStatusFilterChange: (status: string) => void;
}

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export const MyTicketsView: React.FC<MyTicketsViewProps> = ({
  tickets,
  isLoading,
  onSelectTicket,
  onRaiseTicket,
  activeStatusFilter = 'All',
  onStatusFilterChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeStatusFilter === 'All') return true;
    if (activeStatusFilter === 'Open') return ['Open', 'Assigned', 'Reopened'].includes(t.status);
    if (activeStatusFilter === 'In Progress') return ['In Progress', 'Waiting for Customer', 'Waiting for Internal Team'].includes(t.status);
    if (activeStatusFilter === 'Resolved') return t.status === 'Resolved';
    if (activeStatusFilter === 'Closed') return t.status === 'Closed';

    return t.status === activeStatusFilter;
  });

  const getStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case 'Open':
      case 'Reopened':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Assigned':
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Waiting for Customer':
      case 'Waiting for Internal Team':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Closed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-50 text-red-700 border-red-200 font-extrabold';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
      case 'Medium':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-red-600" />
            <span>My Support Tickets</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Track progress, view conversation history, and communicate with our helpdesk team.
          </p>
        </div>
        <button
          onClick={onRaiseTicket}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 transition cursor-pointer self-start sm:self-center"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Raise New Ticket</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              onClick={() => onStatusFilterChange(st)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border',
                activeStatusFilter === st
                  ? 'bg-navy-900 text-white border-navy-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              )}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search in tickets */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets by ID or title..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-red-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Ticket List / Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-200/60 animate-pulse" />
          ))}
        </div>
      ) : filteredTickets.length > 0 ? (
        <div className="space-y-3">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelectTicket(t)}
              className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-red-200 hover:shadow-md hover:shadow-slate-200/40 transition gap-4 cursor-pointer"
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black text-slate-900 group-hover:text-red-600 transition">
                    #{t.ticket_number}
                  </span>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', getStatusBadge(t.status))}>
                    {t.status}
                  </span>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', getPriorityBadge(t.priority))}>
                    {t.priority}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {t.category}
                  </span>
                  {t.is_escalated && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      <span>Escalated</span>
                    </span>
                  )}
                </div>

                <h3 className="font-display font-bold text-sm text-slate-900 group-hover:text-red-600 transition truncate">
                  {t.subject}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-1">
                  {t.description}
                </p>

                {t.properties && (
                  <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 pt-0.5">
                    <span>Property:</span>
                    <span className="text-red-600 underline underline-offset-2">{t.properties.title}</span>
                  </p>
                )}
              </div>

              {/* Meta & Action */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 shrink-0 gap-1.5">
                <span className="text-[11px] font-medium text-slate-400">
                  Updated {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-red-600 group-hover:translate-x-0.5 transition">
                  <span>View Ticket</span>
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 mb-3">
            <Ticket className="h-7 w-7" />
          </div>
          <h3 className="font-display font-bold text-base text-slate-800">
            {searchQuery || activeStatusFilter !== 'All'
              ? 'No tickets match your filters'
              : "You haven't raised any support tickets yet"}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {searchQuery || activeStatusFilter !== 'All'
              ? 'Try adjusting your search query or status filter.'
              : 'Need help with property listings, verification, payments, or account settings? Raise a ticket to get dedicated assistance.'}
          </p>
          <button
            onClick={onRaiseTicket}
            className="mt-5 flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 transition cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Raise a Support Ticket</span>
          </button>
        </div>
      )}
    </div>
  );
};

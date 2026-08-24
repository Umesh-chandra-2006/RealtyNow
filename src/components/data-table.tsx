import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, Calendar, LayoutList, LayoutGrid, User, Mail, Phone, Building, FileText } from 'lucide-react';
import { Button, Input, Skeleton, Badge } from './ui';
import { cn, formatDate, formatPrice } from '../lib/utils';
import { StatusBadge } from './property-card';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export type DatePreset = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'custom';

export function isDateInPreset(
  dateStr: string | null | undefined,
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
): boolean {
  if (preset === 'all') return true;
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (preset === 'today') {
    return d >= todayStart && d <= todayEnd;
  }
  if (preset === 'yesterday') {
    const yestStart = new Date(todayStart);
    yestStart.setDate(yestStart.getDate() - 1);
    const yestEnd = new Date(todayEnd);
    yestEnd.setDate(yestEnd.getDate() - 1);
    return d >= yestStart && d <= yestEnd;
  }
  if (preset === '7days') {
    const start7 = new Date(todayStart);
    start7.setDate(start7.getDate() - 7);
    return d >= start7 && d <= todayEnd;
  }
  if (preset === '30days') {
    const start30 = new Date(todayStart);
    start30.setDate(start30.getDate() - 30);
    return d >= start30 && d <= todayEnd;
  }
  if (preset === 'this_month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= monthStart && d <= todayEnd;
  }
  if (preset === 'custom') {
    if (customStart) {
      const cs = new Date(customStart);
      if (d < cs) return false;
    }
    if (customEnd) {
      const ce = new Date(customEnd);
      ce.setHours(23, 59, 59, 999);
      if (d > ce) return false;
    }
    return true;
  }
  return true;
}

export interface ServerPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  /** Non-blocking error banner shown above the table/cards (data, if any, still renders below). */
  error?: string | null;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  dateKey?: keyof T;
  /** Hides the built-in date-preset dropdown — set false when the caller already has its own date filter (e.g. server-side range inputs), so users aren't shown two competing date controls. */
  dateFilterable?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  emptyState?: React.ReactNode;
  getRowId: (row: T) => string;
  cardRender?: (row: T) => React.ReactNode;
  defaultView?: 'table' | 'grid';
  /** Fires with the exact rows currently rendered on screen (after search/date-filter/sort/pagination), so callers (e.g. CSV export) can match the UI exactly. */
  onVisibleRowsChange?: (rows: T[]) => void;
  /** Sticks the toolbar to the top of the scroll container instead of scrolling away with the page. */
  sticky?: boolean;
  /**
   * Opt-in server-side pagination: when set, `rows` is treated as already being exactly the
   * current page (the caller fetched it with its own `.range()` query) — DataTable stops
   * slicing/paginating locally and defers page count/navigation to this prop instead.
   * Client-side search/date-filter here would only ever see one page's worth of rows, so
   * pair this with `searchable={false}` / `dateFilterable={false}` when the caller already
   * has its own server-side equivalents (as every current server-mode page does).
   */
  serverPagination?: ServerPagination;
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  error,
  searchable = true,
  searchPlaceholder = 'Search records…',
  searchKeys,
  dateKey = 'created_at' as keyof T,
  dateFilterable = true,
  pageSize = 15,
  onRowClick,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  emptyState,
  getRowId,
  cardRender,
  defaultView = 'table',
  onVisibleRowsChange,
  sticky = false,
  serverPagination,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [localPage, setLocalPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(defaultView);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // 1. Date Filtering (skipped entirely in server-pagination mode — rows are already final)
  const dateFiltered = useMemo(() => {
    if (serverPagination) return rows;
    return rows.filter((r) => {
      const val = (r as Record<string, unknown>)[dateKey as string] as string | null | undefined;
      return isDateInPreset(val, datePreset, customStart, customEnd);
    });
  }, [rows, dateKey, datePreset, customStart, customEnd, serverPagination]);

  // 2. Search Query Filtering (skipped in server-pagination mode)
  const filtered = useMemo(() => {
    if (serverPagination || !query) return dateFiltered;
    const q = query.toLowerCase();
    if (!searchKeys || searchKeys.length === 0) {
      return dateFiltered.filter((r) =>
        Object.values(r as Record<string, unknown>).some((val) =>
          String(val ?? '')
            .toLowerCase()
            .includes(q),
        ),
      );
    }
    return dateFiltered.filter((r) =>
      searchKeys.some((k) =>
        String((r as Record<string, unknown>)[k as string] ?? '')
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [dateFiltered, query, searchKeys, serverPagination]);

  // 3. Sorting (in server-pagination mode this only reorders the current page, not the full set)
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortable) return filtered;
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir, columns]);

  const effectivePageSize = serverPagination?.pageSize ?? pageSize;
  const totalCount = serverPagination?.totalCount ?? sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const current = serverPagination ? serverPagination.page : Math.min(localPage, totalPages);
  const setPage = serverPagination?.onPageChange ?? setLocalPage;
  const pageRows = useMemo(() => {
    if (serverPagination) return sorted;
    return sorted.slice((current - 1) * effectivePageSize, current * effectivePageSize);
  }, [sorted, current, effectivePageSize, serverPagination]);

  useEffect(() => {
    onVisibleRowsChange?.(pageRows);
  }, [pageRows, onVisibleRowsChange]);
  const allOnPageSelected = selectedIds && pageRows.length > 0 && pageRows.every((r) => selectedIds.has(getRowId(r)));

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm font-medium text-error-700">
          {error}
        </div>
      )}
      {/* Top Filter & Toolbar Bar */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs mb-4',
          sticky && 'sticky top-0 z-20',
        )}
      >
        {/* Left: Search Bar */}
        {searchable && (
          <div className="relative min-w-0 sm:min-w-[240px] flex-1 max-w-md w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={searchPlaceholder ?? "Search records…"}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="pl-10 text-xs sm:text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:border-red-500 rounded-xl h-10 transition-all"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 ml-0 sm:ml-auto w-full sm:w-auto justify-between sm:justify-end">
          {/* Middle: Advanced Date Filter */}
          {dateFilterable && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 h-10">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500 font-medium">Date:</span>
                <select
                  value={datePreset}
                  onChange={(e) => {
                    setDatePreset(e.target.value as DatePreset);
                    setPage(1);
                  }}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="this_month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {datePreset === 'custom' && (
                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/80 text-xs h-10">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800"
                  />
                </div>
              )}
            </div>
          )}

          {/* Right: View Toggle Switcher (Table vs Card Grid) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 h-10">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer h-8',
                viewMode === 'table'
                  ? 'bg-white text-red-600 shadow-2xs border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <LayoutList className={cn('h-3.5 w-3.5', viewMode === 'table' ? 'text-red-600' : 'text-slate-400')} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer h-8',
                viewMode === 'grid'
                  ? 'bg-white text-red-600 shadow-2xs border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-red-600' : 'text-slate-400')} />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Items Counter */}
      {selectedIds && selectedIds.size > 0 && (
        <div className="text-xs font-bold text-navy-600 px-1">{selectedIds.size} item(s) selected</div>
      )}

      {/* View Mode: Table View */}
      {viewMode === 'table' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] relative">
            <table className="min-w-full divide-y divide-navy-100 relative">
              <thead className="bg-slate-50 sticky top-0 z-20 shadow-xs border-b border-slate-200">
                <tr>
                  {onToggleSelect && (
                    <th className="table-cell-head w-10 sticky top-0 z-20 bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!!allOnPageSelected}
                        onChange={() => onSelectAll?.(pageRows.map(getRowId))}
                        className="rounded border-navy-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
                      />
                    </th>
                  )}
                  {columns.map((col) => (
                    <th key={col.key} className={cn('table-cell-head sticky top-0 z-20 bg-slate-50', col.className)}>
                      {col.sortable ? (
                        <button
                          onClick={() => toggleSort(col.key)}
                          className="inline-flex items-center gap-1 hover:text-navy-700"
                        >
                          {col.header}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {onToggleSelect && (
                        <td className="table-cell">
                          <Skeleton className="h-4 w-4" />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className="table-cell">
                          <Skeleton />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + (onToggleSelect ? 1 : 0)} className="p-0">
                      {emptyState ?? (
                        <div className="px-4 py-10 text-center text-sm text-navy-400">No records found.</div>
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const id = getRowId(row);
                    const selected = selectedIds?.has(id);
                    return (
                      <tr
                        key={id}
                        onClick={() => onRowClick?.(row)}
                        className={cn(
                          'transition hover:bg-navy-50/40',
                          onRowClick && 'cursor-pointer',
                          selected && 'bg-navy-50/60',
                        )}
                      >
                        {onToggleSelect && (
                          <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!selected}
                              onChange={() => onToggleSelect(id)}
                              className="rounded border-navy-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
                            />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td key={col.key} className={cn('table-cell', col.className)}>
                            {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* View Mode: Card Grid View */
        <div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : pageRows.length === 0 ? (
            <div className="card p-10 text-center text-sm text-navy-400">{emptyState ?? 'No records found.'}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pageRows.map((row) => {
                const id = getRowId(row);
                if (cardRender) return <div key={id}>{cardRender(row)}</div>;

                // Smart default card render for different entity types
                const rec = row as Record<string, any>;
                const title = rec.title ?? rec.name ?? rec.full_name ?? `Item #${id.slice(0, 6)}`;
                const status = rec.status ?? rec.approval_status ?? rec.lead_status ?? 'active';
                const isPerson = !!(rec.avatar_url || rec.email || rec.phone || rec.role === 'agent' || rec.role === 'builder' || rec.commission_percent !== undefined) && !rec.property_type && !rec.bedrooms && !rec.bhk;
                const realImage = rec.cover_image ?? rec.image_url ?? rec.images?.[0] ?? null;

                if (isPerson) {
                  const avatar = rec.avatar_url ?? rec.photo_url ?? null;
                  const initial = (title && typeof title === 'string') ? title.charAt(0).toUpperCase() : 'U';

                  return (
                    <div
                      key={id}
                      onClick={() => onRowClick?.(row)}
                      className="card p-5 hover:shadow-cardHover transition-all flex flex-col justify-between cursor-pointer group bg-white border border-slate-200/80 rounded-2xl"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={title}
                                className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-red-100 shrink-0"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-bold text-navy-900 text-base shadow-2xs shrink-0">
                                {initial}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="font-bold text-navy-900 text-base truncate">{title}</h4>
                              {rec.role && <p className="text-xs font-semibold text-red-600 capitalize">{rec.role}</p>}
                            </div>
                          </div>
                          <div className="shrink-0">
                            <StatusBadge status={status} />
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                          {rec.email && (
                            <div className="flex items-center gap-2 truncate">
                              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{rec.email}</span>
                            </div>
                          )}
                          {rec.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{rec.phone}</span>
                            </div>
                          )}
                          {rec.commission_percent !== undefined && (
                            <div className="pt-1 flex items-center justify-between font-medium">
                              <span className="text-slate-400">Commission:</span>
                              <span className="font-bold text-navy-900">{rec.commission_percent}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {rec.created_at && (
                        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Joined {formatDate(rec.created_at)}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={id}
                    onClick={() => onRowClick?.(row)}
                    className="card p-4 hover:shadow-cardHover transition-all flex flex-col justify-between cursor-pointer group bg-white border border-slate-200/80 rounded-2xl"
                  >
                    <div>
                      {realImage ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-navy-100">
                          <img
                            src={realImage}
                            alt=""
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-2 right-2">
                            <StatusBadge status={status} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                          <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                            <Building className="h-5 w-5" />
                          </div>
                          <StatusBadge status={status} />
                        </div>
                      )}

                      <h4 className="font-bold text-navy-900 text-base line-clamp-1">{title}</h4>
                      {rec.locality_name && (
                        <p className="text-xs text-navy-500 mt-0.5">
                          {rec.locality_name}, {rec.city_name}
                        </p>
                      )}
                      {rec.price != null && (
                        <p className="font-bold text-navy-900 mt-2 text-lg">{formatPrice(rec.price, rec.purpose)}</p>
                      )}
                      {rec.created_at && <p className="text-xs text-navy-400 mt-1">{formatDate(rec.created_at)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-navy-100 pl-4 pr-24 lg:pr-32 py-3 text-sm bg-white rounded-2xl border">
          <span className="text-navy-500 whitespace-nowrap">
            Showing {(current - 1) * effectivePageSize + 1}–{Math.min(current * effectivePageSize, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <Button variant="ghost" size="sm" disabled={current === 1} onClick={() => setPage(current - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              // Show first, last, current, and adjacent pages
              if (
                p === 1 || 
                p === totalPages || 
                (p >= current - 1 && p <= current + 1)
              ) {
                return (
                  <Button 
                    key={p} 
                    variant={current === p ? "primary" : "ghost"} 
                    size="sm" 
                    onClick={() => setPage(p)}
                    className={current === p ? "h-8 w-8 p-0" : "h-8 w-8 p-0 text-navy-600"}
                  >
                    {p}
                  </Button>
                );
              }
              // Show ellipses
              if (
                p === current - 2 || 
                p === current + 2
              ) {
                return <span key={p} className="px-1 text-navy-400">...</span>;
              }
              return null;
            })}

            <Button variant="ghost" size="sm" disabled={current === totalPages} onClick={() => setPage(current + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BulkActionsBar({
  count,
  onDelete,
  actions,
}: {
  count: number;
  onDelete: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg bg-navy-50 px-4 py-3 border border-navy-200">
      <div className="flex items-center gap-3">
        <Badge variant="info">{count} selected</Badge>
        <span className="text-sm font-medium text-navy-700">Choose action:</span>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button variant="danger" size="sm" onClick={onDelete}>
          Delete selected
        </Button>
      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Download,
  Eye,
  Edit2,
  Phone,
  AlertTriangle,
  ChevronDown,
  RotateCcw,
  LayoutList,
  LayoutGrid,
  MessageCircle,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns as ColumnsIcon,
} from 'lucide-react';
import { Button, Select } from '../ui';
import { formatDate, formatDateTime, formatPrice, buildWhatsAppUrl, exportToCsv, exportToExcel } from '../../lib/utils';
import { useToast } from '../toast';
import { UnifiedLeadDetailModal } from './UnifiedLeadDetailModal';

export interface CrmLeadItem {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  status?: string | null;
  lead_status?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget?: string | number | null;
  message?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  last_contacted_at?: string | null;
  follow_up_at?: string | null;
  contact_count?: number | null;
  preferred_types?: string[] | null;
  preferred_localities?: string[] | null;
  property?: {
    id?: string;
    title?: string;
    price?: number;
    locality_name?: string;
    city_name?: string;
    bedrooms?: number;
    built_up_area?: number;
    property_types?: { name?: string };
    [key: string]: any;
  } | null;
  builder_projects?: {
    id?: string;
    name?: string;
    status?: string;
    cover_image?: string;
    cities?: { name?: string };
    localities?: { name?: string };
    [key: string]: any;
  } | null;
  assignee?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  } | null;
  agent_id?: string | null;
  [key: string]: any;
}

export type CrmColumnKey =
  | 'name'
  | 'contact'
  | 'email'
  | 'source'
  | 'property'
  | 'property_type'
  | 'location'
  | 'budget'
  | 'agent'
  | 'project'
  | 'stage'
  | 'priority'
  | 'last_contacted'
  | 'next_follow_up'
  | 'site_visit'
  | 'negotiation'
  | 'received_on'
  | 'lead_age'
  | 'actions';

export interface ColumnDefinition {
  key: CrmColumnKey;
  label: string;
  mandatory?: boolean;
  defaultVisible?: boolean;
  width?: string;
  sortable?: boolean;
}

export const ALL_CRM_COLUMNS: ColumnDefinition[] = [
  { key: 'name', label: 'Lead Name', mandatory: true, defaultVisible: true, width: 'min-w-[220px]', sortable: true },
  { key: 'contact', label: 'Contact', defaultVisible: true, width: 'min-w-[170px]' },
  { key: 'email', label: 'Email', defaultVisible: true, width: 'min-w-[190px]' },
  { key: 'source', label: 'Source', defaultVisible: true, width: 'min-w-[130px]' },
  { key: 'property', label: 'Property', defaultVisible: true, width: 'min-w-[200px]' },
  { key: 'property_type', label: 'Type', defaultVisible: true, width: 'min-w-[130px]' },
  { key: 'location', label: 'Location', defaultVisible: true, width: 'min-w-[160px]' },
  { key: 'budget', label: 'Budget', defaultVisible: true, width: 'min-w-[150px]', sortable: true },
  { key: 'agent', label: 'Agent', defaultVisible: true, width: 'min-w-[160px]' },
  { key: 'project', label: 'Project', defaultVisible: true, width: 'min-w-[170px]' },
  { key: 'stage', label: 'Stage', defaultVisible: true, width: 'min-w-[140px]', sortable: true },
  { key: 'priority', label: 'Priority', defaultVisible: true, width: 'min-w-[120px]', sortable: true },
  { key: 'last_contacted', label: 'Last Contacted', defaultVisible: true, width: 'min-w-[140px]', sortable: true },
  { key: 'next_follow_up', label: 'Next Follow-up', defaultVisible: true, width: 'min-w-[160px]', sortable: true },
  { key: 'site_visit', label: 'Site Visit', defaultVisible: true, width: 'min-w-[130px]' },
  { key: 'negotiation', label: 'Negotiation', defaultVisible: true, width: 'min-w-[140px]' },
  { key: 'received_on', label: 'Received On', defaultVisible: true, width: 'min-w-[140px]', sortable: true },
  { key: 'lead_age', label: 'Lead Age', defaultVisible: true, width: 'min-w-[120px]', sortable: true },
  { key: 'actions', label: 'Actions', mandatory: true, defaultVisible: true, width: 'min-w-[140px]' },
];

const DEFAULT_VISIBLE_KEYS: Set<CrmColumnKey> = new Set(
  ALL_CRM_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
);

export function calculateLeadAge(dateStr: string | null | undefined): { text: string; days: number } {
  if (!dateStr) return { text: '—', days: 0 };
  try {
    const created = new Date(dateStr).getTime();
    const now = Date.now();
    const diffMs = now - created;
    if (diffMs < 0) return { text: 'Today', days: 0 };
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { text: 'Today', days: 0 };
    if (diffDays === 1) return { text: '1 day', days: 1 };
    if (diffDays < 30) return { text: `${diffDays} days`, days: diffDays };
    const months = Math.floor(diffDays / 30);
    return { text: months === 1 ? '1 mo' : `${months} mos`, days: diffDays };
  } catch {
    return { text: '—', days: 0 };
  }
}

interface ProfessionalCrmTableProps {
  leads: CrmLeadItem[];
  isLoading?: boolean;
  error?: string | null;
  sourceType?: 'builder' | 'agent' | 'admin';
  storageKey?: string;
  onRefresh?: () => void;
  onViewActivity?: (leadId: string) => void;
}

export function ProfessionalCrmTable({
  leads,
  isLoading = false,
  error = null,
  sourceType = 'builder',
  storageKey = 'realtynow_crm_table_columns_v1',
  onRefresh,
  onViewActivity,
}: ProfessionalCrmTableProps) {
  const { addToast } = useToast();

  // Selected lead for detail modal
  const [selectedLead, setSelectedLead] = useState<CrmLeadItem | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Sorting
  const [sortField, setSortField] = useState<CrmColumnKey>('received_on');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Column Visibility Popover & State
  const [visibleColumns, setVisibleColumns] = useState<Set<CrmColumnKey>>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_${sourceType}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const s = new Set<CrmColumnKey>(parsed);
          s.add('name');
          s.add('actions');
          return s;
        }
      }
    } catch {
      // fallback
    }
    return new Set(DEFAULT_VISIBLE_KEYS);
  });

  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Close column dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (key: CrmColumnKey) => {
    if (key === 'name' || key === 'actions') return;
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem(`${storageKey}_${sourceType}`, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(new Set(DEFAULT_VISIBLE_KEYS));
    try {
      localStorage.setItem(`${storageKey}_${sourceType}`, JSON.stringify(Array.from(DEFAULT_VISIBLE_KEYS)));
    } catch {
      // ignore
    }
  };

  // Distinct Stages for Filter Dropdown
  const availableStages = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const st = l.lead_status || l.status;
      if (st) set.add(st);
    });
    return Array.from(set);
  }, [leads]);

  // Distinct Sources for Filter Dropdown
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.source) set.add(l.source);
    });
    return Array.from(set);
  }, [leads]);

  // Filtering Logic
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = lead.name?.toLowerCase().includes(q);
        const phoneMatch = lead.phone?.toLowerCase().includes(q);
        const emailMatch = lead.email?.toLowerCase().includes(q);
        const propMatch = lead.property?.title?.toLowerCase().includes(q);
        const projectMatch = lead.builder_projects?.name?.toLowerCase().includes(q);
        const locMatch =
          lead.property?.locality_name?.toLowerCase().includes(q) ||
          lead.property?.city_name?.toLowerCase().includes(q) ||
          lead.builder_projects?.localities?.name?.toLowerCase().includes(q) ||
          lead.builder_projects?.cities?.name?.toLowerCase().includes(q);

        if (!nameMatch && !phoneMatch && !emailMatch && !propMatch && !projectMatch && !locMatch) {
          return false;
        }
      }

      // 2. Stage Filter
      if (stageFilter !== 'all') {
        const st = (lead.lead_status || lead.status || '').toLowerCase();
        if (st !== stageFilter.toLowerCase()) return false;
      }

      // 3. Source Filter
      if (sourceFilter !== 'all') {
        const src = (lead.source || 'website').toLowerCase();
        if (src !== sourceFilter.toLowerCase()) return false;
      }

      // 4. Priority Filter
      if (priorityFilter !== 'all') {
        const prio = (lead.priority || '').toLowerCase();
        if (prio !== priorityFilter.toLowerCase()) return false;
      }

      // 5. Date Filter
      if (dateFilter !== 'all' && lead.created_at) {
        const created = new Date(lead.created_at).getTime();
        const now = Date.now();
        const diffDays = (now - created) / (1000 * 60 * 60 * 24);
        if (dateFilter === 'today' && diffDays > 1) return false;
        if (dateFilter === 'week' && diffDays > 7) return false;
        if (dateFilter === 'month' && diffDays > 30) return false;
      }

      return true;
    });
  }, [leads, searchQuery, stageFilter, sourceFilter, priorityFilter, dateFilter]);

  // Sorting Logic
  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    list.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      switch (sortField) {
        case 'name':
          valA = a.name?.toLowerCase() || '';
          valB = b.name?.toLowerCase() || '';
          break;
        case 'received_on':
          valA = a.created_at ? new Date(a.created_at).getTime() : 0;
          valB = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
        case 'lead_age':
          valA = calculateLeadAge(a.created_at).days;
          valB = calculateLeadAge(b.created_at).days;
          break;
        case 'budget':
          valA = a.budget_max || a.budget_min || (typeof a.budget === 'number' ? a.budget : 0);
          valB = b.budget_max || b.budget_min || (typeof b.budget === 'number' ? b.budget : 0);
          break;
        case 'stage':
          valA = (a.lead_status || a.status || '').toLowerCase();
          valB = (b.lead_status || b.status || '').toLowerCase();
          break;
        case 'priority':
          valA = (a.priority || '').toLowerCase();
          valB = (b.priority || '').toLowerCase();
          break;
        case 'last_contacted':
          valA = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          valB = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          break;
        case 'next_follow_up':
          valA = a.follow_up_at ? new Date(a.follow_up_at).getTime() : 0;
          valB = b.follow_up_at ? new Date(b.follow_up_at).getTime() : 0;
          break;
        default:
          valA = a.created_at ? new Date(a.created_at).getTime() : 0;
          valB = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLeads, sortField, sortDirection]);

  const handleSort = (field: CrmColumnKey) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    stageFilter !== 'all' ||
    sourceFilter !== 'all' ||
    priorityFilter !== 'all' ||
    dateFilter !== 'all';

  const handleClearFilters = () => {
    setSearchQuery('');
    setStageFilter('all');
    setSourceFilter('all');
    setPriorityFilter('all');
    setDateFilter('all');
  };

  // Export Data Builder
  const handleExport = (type: 'csv' | 'excel') => {
    if (sortedLeads.length === 0) {
      addToast('error', 'No leads available to export');
      return;
    }

    const exportColumns = ALL_CRM_COLUMNS.filter((c) => visibleColumns.has(c.key) && c.key !== 'actions').map((c) => ({
      key: c.key,
      label: c.label,
    }));

    const exportRows = sortedLeads.map((l) => {
      const row: Record<string, any> = {};
      const status = l.lead_status || l.status || 'new';

      if (visibleColumns.has('name')) row.name = l.name || '—';
      if (visibleColumns.has('contact')) row.contact = l.phone || '—';
      if (visibleColumns.has('email')) row.email = l.email || '—';
      if (visibleColumns.has('source')) row.source = l.source || 'Website';
      if (visibleColumns.has('property'))
        row.property = l.property?.title || l.builder_projects?.name || 'General Inquiry';
      if (visibleColumns.has('property_type'))
        row.property_type = l.property?.property_types?.name || l.preferred_types?.[0] || '—';
      if (visibleColumns.has('location')) {
        row.location =
          [l.property?.locality_name, l.property?.city_name].filter(Boolean).join(', ') ||
          [l.builder_projects?.localities?.name, l.builder_projects?.cities?.name].filter(Boolean).join(', ') ||
          '—';
      }
      if (visibleColumns.has('budget')) {
        row.budget = l.budget_max
          ? formatPrice(l.budget_max)
          : l.budget_min
          ? formatPrice(l.budget_min)
          : typeof l.budget === 'number'
          ? formatPrice(l.budget)
          : '—';
      }
      if (visibleColumns.has('agent')) {
        row.agent = l.assignee ? `${l.assignee.first_name || ''} ${l.assignee.last_name || ''}`.trim() : 'Unassigned';
      }
      if (visibleColumns.has('project')) {
        row.project = l.builder_projects?.name || l.property?.title || '—';
      }
      if (visibleColumns.has('stage')) row.stage = status.replace('_', ' ').toUpperCase();
      if (visibleColumns.has('priority')) row.priority = l.priority ? l.priority.toUpperCase() : '—';
      if (visibleColumns.has('last_contacted'))
        row.last_contacted = l.last_contacted_at ? formatDate(l.last_contacted_at) : 'Never';
      if (visibleColumns.has('next_follow_up'))
        row.next_follow_up = l.follow_up_at ? formatDateTime(l.follow_up_at) : '—';
      if (visibleColumns.has('site_visit')) {
        row.site_visit = status === 'site_visit' ? 'Scheduled' : '—';
      }
      if (visibleColumns.has('negotiation')) {
        row.negotiation = status === 'negotiation' ? 'In Progress' : status === 'won' ? 'Completed' : '—';
      }
      if (visibleColumns.has('received_on')) row.received_on = formatDate(l.created_at);
      if (visibleColumns.has('lead_age')) row.lead_age = calculateLeadAge(l.created_at).text;

      return row;
    });

    const filename = `RealtyNow_Leads_${new Date().toISOString().slice(0, 10)}`;
    if (type === 'csv') {
      exportToCsv(filename, exportRows, exportColumns);
    } else {
      exportToExcel(filename, exportRows, exportColumns);
    }
    addToast('success', `Exported ${exportRows.length} leads to ${type.toUpperCase()}`);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Search, Filters, View Modes, Columns, Export */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-0 sm:min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads by name, phone, email, property, locality..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all text-navy-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-navy-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-navy-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            {/* Columns Visibility Dropdown */}
            <div className="relative" ref={columnMenuRef}>
              <button
                type="button"
                onClick={() => setColumnMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
                title="Toggle visible columns"
              >
                <ColumnsIcon className="h-3.5 w-3.5 text-slate-500" />
                <span>Columns</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {columnMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 animate-fade-in max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-navy-900">CRM Columns</span>
                    <button
                      onClick={resetColumns}
                      className="text-[11px] text-red-600 hover:underline font-semibold"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {ALL_CRM_COLUMNS.map((col) => {
                      const isMandatory = col.mandatory;
                      const isChecked = visibleColumns.has(col.key);
                      return (
                        <label
                          key={col.key}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors select-none ${
                            isMandatory ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isMandatory}
                            checked={isChecked}
                            onChange={() => toggleColumn(col.key)}
                            className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                          />
                          <span className="font-medium text-navy-900">
                            {col.label} {isMandatory && <span className="text-[10px] text-slate-400">(Required)</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Export Dropdown */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={() => handleExport('csv')}
                title="Export current view to CSV"
              >
                CSV
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleExport('excel')}
                title="Export current view to Excel (.xlsx)"
              >
                Excel
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
          {/* Stage Filter */}
          <Select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="py-1.5 text-xs capitalize"
          >
            <option value="all">All Stages ({leads.length})</option>
            {availableStages.map((st) => (
              <option key={st} value={st} className="capitalize">
                {st.replace('_', ' ')}
              </option>
            ))}
          </Select>

          {/* Source Filter */}
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="py-1.5 text-xs capitalize"
          >
            <option value="all">All Sources</option>
            {availableSources.map((src) => (
              <option key={src} value={src} className="capitalize">
                {src}
              </option>
            ))}
          </Select>

          {/* Priority Filter */}
          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="py-1.5 text-xs"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          {/* Date Range Filter */}
          <Select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="py-1.5 text-xs"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Past 30 Days</option>
          </Select>

          {/* Clear Filters Button */}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> Clear Filters
            </button>
          ) : (
            <div className="flex items-center justify-center text-[11px] text-slate-400 font-medium">
              Showing {sortedLeads.length} leads
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          {onRefresh && (
            <Button size="sm" variant="secondary" onClick={onRefresh}>
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-200 rounded w-1/6" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : sortedLeads.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-navy-900">No leads found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'No CRM records match your active search filters. Try clearing your filters.'
              : 'You have not received any leads yet. New inquiries will automatically appear here.'}
          </p>
          {hasActiveFilters && (
            <Button size="sm" variant="secondary" onClick={handleClearFilters}>
              Reset Filters
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Horizontal Scroll with Sticky Left Lead Name & Sticky Right Actions) */
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full relative">
            <table className="w-full text-left text-xs border-collapse min-w-[2000px]">
              {/* Header Row */}
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  {/* Sticky 1: Lead Name */}
                  {visibleColumns.has('name') && (
                    <th
                      className="sticky left-0 bg-slate-50 z-20 px-4 py-3.5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] cursor-pointer hover:text-navy-900 transition-colors min-w-[220px]"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Lead Name</span>
                        {sortField === 'name' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-red-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 2: Contact */}
                  {visibleColumns.has('contact') && <th className="px-4 py-3.5 min-w-[170px]">Contact</th>}

                  {/* 3: Email */}
                  {visibleColumns.has('email') && <th className="px-4 py-3.5 min-w-[190px]">Email</th>}

                  {/* 4: Source */}
                  {visibleColumns.has('source') && <th className="px-4 py-3.5 min-w-[130px]">Source</th>}

                  {/* 5: Property */}
                  {visibleColumns.has('property') && <th className="px-4 py-3.5 min-w-[200px]">Interested Property</th>}

                  {/* 6: Type */}
                  {visibleColumns.has('property_type') && <th className="px-4 py-3.5 min-w-[130px]">Type</th>}

                  {/* 7: Location */}
                  {visibleColumns.has('location') && <th className="px-4 py-3.5 min-w-[160px]">Location</th>}

                  {/* 8: Budget */}
                  {visibleColumns.has('budget') && (
                    <th
                      className="px-4 py-3.5 min-w-[150px] cursor-pointer hover:text-navy-900 transition-colors"
                      onClick={() => handleSort('budget')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Budget</span>
                        {sortField === 'budget' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-red-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 9: Assigned Agent */}
                  {visibleColumns.has('agent') && <th className="px-4 py-3.5 min-w-[160px]">Assigned Agent</th>}

                  {/* 10: Project */}
                  {visibleColumns.has('project') && <th className="px-4 py-3.5 min-w-[170px]">Project / Builder</th>}

                  {/* 11: Stage */}
                  {visibleColumns.has('stage') && (
                    <th
                      className="px-4 py-3.5 min-w-[140px] cursor-pointer hover:text-navy-900 transition-colors"
                      onClick={() => handleSort('stage')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Lead Stage</span>
                        {sortField === 'stage' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-red-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 12: Priority */}
                  {visibleColumns.has('priority') && (
                    <th
                      className="px-4 py-3.5 min-w-[120px] cursor-pointer hover:text-navy-900 transition-colors"
                      onClick={() => handleSort('priority')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Priority</span>
                        {sortField === 'priority' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-red-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 13: Last Contacted */}
                  {visibleColumns.has('last_contacted') && (
                    <th
                      className="px-4 py-3.5 min-w-[140px] cursor-pointer hover:text-navy-900 transition-colors"
                      onClick={() => handleSort('last_contacted')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Last Contacted</span>
                        {sortField === 'last_contacted' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-red-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 14: Next Follow-up */}
                  {visibleColumns.has('next_follow_up') && (
                    <th
                      className="px-4 py-3.5 min-w-[160px] cursor-pointer hover:text-navy-900 transition-colors"
                      onClick={() => handleSort('next_follow_up')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Next Follow-up</span>
                        {sortField === 'next_follow_up' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-red-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 15: Site Visit */}
                  {visibleColumns.has('site_visit') && <th className="px-4 py-3.5 min-w-[130px]">Site Visit</th>}

                  {/* 16: Negotiation */}
                  {visibleColumns.has('negotiation') && <th className="px-4 py-3.5 min-w-[140px]">Negotiation</th>}

                  {/* 17: Received On */}
                  {visibleColumns.has('received_on') && (
                    <th
                      className="px-4 py-3.5 min-w-[140px] cursor-pointer hover:text-navy-900 transition-colors"
                      onClick={() => handleSort('received_on')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Received On</span>
                        {sortField === 'received_on' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-red-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 18: Lead Age */}
                  {visibleColumns.has('lead_age') && (
                    <th
                      className="px-4 py-3.5 min-w-[120px] cursor-pointer hover:text-navy-900 transition-colors"
                      onClick={() => handleSort('lead_age')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Lead Age</span>
                        {sortField === 'lead_age' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-red-600" /> : <ArrowDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* Sticky 19: Actions */}
                  {visibleColumns.has('actions') && (
                    <th className="sticky right-0 bg-slate-50 z-20 px-4 py-3.5 text-right shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[140px]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedLeads.map((lead) => {
                  const leadName = lead.name || 'Anonymous';
                  const status = (lead.lead_status || lead.status || 'new').toLowerCase();
                  const phone = lead.phone;
                  const email = lead.email;
                  const isOverdue = lead.follow_up_at && new Date(lead.follow_up_at).getTime() < Date.now();
                  const leadAge = calculateLeadAge(lead.created_at);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Sticky 1: Lead Name */}
                      {visibleColumns.has('name') && (
                        <td className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 px-4 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-bold text-navy-900 text-xs shrink-0 shadow-2xs">
                              {leadName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-navy-900 group-hover:text-red-600 transition-colors truncate">
                                {leadName}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{email || '—'}</p>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* 2: Contact */}
                      {visibleColumns.has('contact') && (
                        <td className="px-4 py-3">
                          {phone ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <span className="font-medium text-navy-900 whitespace-nowrap">{phone}</span>
                              <a
                                href={`tel:${phone}`}
                                className="p-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                title="Call"
                              >
                                <Phone className="h-3 w-3" />
                              </a>
                              <a
                                href={buildWhatsAppUrl(phone, `Hi ${leadName}, connecting regarding your property inquiry.`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="h-3 w-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* 3: Email */}
                      {visibleColumns.has('email') && (
                        <td className="px-4 py-3">
                          {email ? (
                            <a
                              href={`mailto:${email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-600 hover:text-navy-900 truncate block max-w-[180px]"
                              title={email}
                            >
                              {email}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* 4: Source */}
                      {visibleColumns.has('source') && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            {lead.source || 'Website'}
                          </span>
                        </td>
                      )}

                      {/* 5: Property */}
                      {visibleColumns.has('property') && (
                        <td className="px-4 py-3">
                          {lead.property?.title ? (
                            <span className="font-semibold text-navy-900 truncate block max-w-[190px]" title={lead.property.title}>
                              {lead.property.title}
                            </span>
                          ) : lead.builder_projects?.name ? (
                            <span className="font-semibold text-navy-900 truncate block max-w-[190px]" title={lead.builder_projects.name}>
                              {lead.builder_projects.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">General Inquiry</span>
                          )}
                        </td>
                      )}

                      {/* 6: Property Type */}
                      {visibleColumns.has('property_type') && (
                        <td className="px-4 py-3">
                          <span className="text-slate-600 font-medium">
                            {lead.property?.property_types?.name || lead.preferred_types?.[0] || '—'}
                          </span>
                        </td>
                      )}

                      {/* 7: Location */}
                      {visibleColumns.has('location') && (
                        <td className="px-4 py-3">
                          <span className="text-slate-600 truncate block max-w-[150px]">
                            {[lead.property?.locality_name, lead.property?.city_name].filter(Boolean).join(', ') ||
                              [lead.builder_projects?.localities?.name, lead.builder_projects?.cities?.name].filter(Boolean).join(', ') ||
                              lead.preferred_localities?.[0] ||
                              '—'}
                          </span>
                        </td>
                      )}

                      {/* 8: Budget */}
                      {visibleColumns.has('budget') && (
                        <td className="px-4 py-3">
                          <span className="font-bold text-navy-900 whitespace-nowrap">
                            {lead.budget_max
                              ? formatPrice(lead.budget_max)
                              : lead.budget_min
                              ? formatPrice(lead.budget_min)
                              : typeof lead.budget === 'number'
                              ? formatPrice(lead.budget)
                              : typeof lead.budget === 'string' && lead.budget
                              ? `₹${lead.budget}`
                              : '—'}
                          </span>
                        </td>
                      )}

                      {/* 9: Assigned Agent */}
                      {visibleColumns.has('agent') && (
                        <td className="px-4 py-3">
                          <span className="text-slate-700 font-medium">
                            {lead.assignee
                              ? `${lead.assignee.first_name || ''} ${lead.assignee.last_name || ''}`.trim()
                              : lead.agent_id
                              ? 'Assigned'
                              : 'Unassigned'}
                          </span>
                        </td>
                      )}

                      {/* 10: Project / Builder */}
                      {visibleColumns.has('project') && (
                        <td className="px-4 py-3">
                          <span className="text-slate-700 font-medium truncate block max-w-[160px]">
                            {lead.builder_projects?.name || lead.property?.title || '—'}
                          </span>
                        </td>
                      )}

                      {/* 11: Stage */}
                      {visibleColumns.has('stage') && (
                        <td className="px-4 py-3">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLead(lead);
                            }}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-105 ${
                              status === 'won'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : status === 'lost' || status === 'closed'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : status === 'site_visit'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : status === 'negotiation'
                                ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                : status === 'contacted'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </span>
                        </td>
                      )}

                      {/* 12: Priority */}
                      {visibleColumns.has('priority') && (
                        <td className="px-4 py-3">
                          {lead.priority ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                lead.priority === 'urgent' || lead.priority === 'high'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : lead.priority === 'medium'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  lead.priority === 'urgent' || lead.priority === 'high'
                                    ? 'bg-red-500'
                                    : lead.priority === 'medium'
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              {lead.priority}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* 13: Last Contacted */}
                      {visibleColumns.has('last_contacted') && (
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {lead.last_contacted_at ? formatDate(lead.last_contacted_at) : (lead.contact_count && lead.contact_count > 0 ? 'Contacted' : 'Never')}
                        </td>
                      )}

                      {/* 14: Next Follow-up */}
                      {visibleColumns.has('next_follow_up') && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lead.follow_up_at ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                {formatDateTime(lead.follow_up_at)}
                              </span>
                              {isOverdue && (
                                <span className="text-[9px] font-bold px-1 rounded bg-red-100 text-red-700">Overdue</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* 15: Site Visit */}
                      {visibleColumns.has('site_visit') && (
                        <td className="px-4 py-3">
                          {status === 'site_visit' ? (
                            <span className="text-purple-700 font-semibold">Scheduled</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* 16: Negotiation */}
                      {visibleColumns.has('negotiation') && (
                        <td className="px-4 py-3">
                          {status === 'negotiation' ? (
                            <span className="text-orange-700 font-semibold">In Progress</span>
                          ) : status === 'won' ? (
                            <span className="text-emerald-700 font-semibold">Completed</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* 17: Received On */}
                      {visibleColumns.has('received_on') && (
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {formatDate(lead.created_at)}
                        </td>
                      )}

                      {/* 18: Lead Age */}
                      {visibleColumns.has('lead_age') && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-700">{leadAge.text}</span>
                        </td>
                      )}

                      {/* Sticky 19: Actions */}
                      {visibleColumns.has('actions') && (
                        <td className="sticky right-0 bg-white group-hover:bg-slate-50 z-10 px-4 py-3 text-right shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedLead(lead)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedLead(lead)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit Lead"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {onViewActivity && (
                              <button
                                type="button"
                                onClick={() => onViewActivity(lead.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="Activity Timeline"
                              >
                                <Activity className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedLeads.map((lead) => {
            const leadName = lead.name || 'Anonymous';
            const status = (lead.lead_status || lead.status || 'new').toLowerCase();
            const leadAge = calculateLeadAge(lead.created_at);

            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-bold text-navy-900 text-sm shrink-0">
                        {leadName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-navy-900 text-sm truncate group-hover:text-red-600 transition-colors">
                          {leadName}
                        </h4>
                        <p className="text-xs text-slate-500 truncate">
                          {lead.property?.title || lead.builder_projects?.name || 'General Inquiry'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        status === 'won'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status === 'lost' || status === 'closed'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-1.5 py-2 border-t border-slate-100 text-xs text-slate-600">
                    {lead.phone && <p className="truncate">📞 {lead.phone}</p>}
                    {lead.email && <p className="truncate">📧 {lead.email}</p>}
                    {(lead.budget_max || lead.budget_min) && (
                      <p className="font-semibold text-navy-900">
                        💰 Budget:{' '}
                        {lead.budget_max
                          ? formatPrice(lead.budget_max)
                          : lead.budget_min
                          ? formatPrice(lead.budget_min)
                          : '—'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-400">
                  <span>Age: {leadAge.text}</span>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedLead(lead)}>
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Lead Detail Modal */}
      <UnifiedLeadDetailModal
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        sourceType={sourceType}
        onLeadUpdated={() => {
          onRefresh?.();
        }}
      />
    </div>
  );
}

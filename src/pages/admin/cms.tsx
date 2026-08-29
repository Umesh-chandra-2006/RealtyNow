import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layout,
  Sparkles,
  Save,
  Eye,
  Globe,
  Sliders,
  Search,
  Table as TableIcon,
  Grid as GridIcon,
  Plus,
  Edit3,
  Building2,
  MapPin,
  Trash2,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { Button, Input, Textarea, Modal, Badge, Select } from '../../components/ui';
import { useToast } from '../../components/toast';
import { cn } from '../../lib/utils';

function toLocalISOString(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminHomepageCMS() {
  const { t } = useLanguageContext();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const sections = getAdminSections(t);

  // Tab & View States
  const [activeTab, setActiveTab] = useState<'hero' | 'exclusive' | 'sections' | 'search' | 'categories' | 'seo'>('hero');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [sortBy, setSortBy] = useState<'order' | 'name' | 'newest'>('order');

  // Modals State
  const [editModalItem, setEditModalItem] = useState<any | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [formState, setFormState] = useState<any>({});

  // 0. Fetch Properties for Link Selection
  const { data: propertiesList = [] } = useQuery({
    queryKey: ['admin-cms-properties-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, title, price, purpose, images, cover_image_url, rera_number, cities(id, name), localities(id, name)')
        .or('status.eq.published,is_live.eq.true')
        .order('title', { ascending: true });
      return data ?? [];
    },
  });

  // 1. Fetch Hero Banners Config directly from hero_campaigns table
  const { data: heroList = [], isLoading: heroLoading } = useQuery({
    queryKey: ['admin-cms-hero-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_campaigns')
        .select('*, properties(id, title, price, images, cover_image_url, rera_number, cities(name), localities(name))')
        .order('priority', { ascending: false })
        .order('order_no', { ascending: true })
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((c: any, idx: number) => {
        const prop = c.properties;
        const locality = prop?.localities?.name
          ? `${prop.localities.name}, ${prop?.cities?.name || ''}`
          : prop?.cities?.name || '';
        const priceText = prop?.price
          ? prop.price >= 10000000
            ? `₹${(prop.price / 10000000).toFixed(2)} Cr`
            : `₹${(prop.price / 100000).toFixed(2)} L`
          : c.price_text || '';

        const image = c.banner_image || prop?.cover_image_url || (Array.isArray(prop?.images) ? prop.images[0] : null) || '';

        return {
          id: c.id,
          title: c.title || prop?.title || 'Hero Campaign',
          subtitle: c.subtitle || prop?.title || '',
          badge_text: c.package_tier || c.campaign_type || 'Hero Banner',
          bg_image_url: image,
          image_url: image,
          mobile_banner: c.mobile_banner || '',
          primary_btn_text: c.cta_text || 'Explore Project',
          primary_btn_link: c.cta_url || (c.property_id ? `/property/${c.property_id}` : '/search'),
          cta_text: c.cta_text || 'Explore Project',
          cta_link: c.cta_url || (c.property_id ? `/property/${c.property_id}` : '/search'),
          is_visible: c.status === 'Active',
          status: c.status,
          sort_order: c.priority ?? c.order_no ?? idx + 1,
          priority: c.priority ?? 1,
          locality,
          price_text: priceText,
          rera_no: prop?.rera_number || c.rera_number || '',
          property_id: c.property_id,
          start_date: c.start_date,
          end_date: c.end_date,
          package_tier: c.package_tier || 'Featured',
          display_type: c.display_type || 'Hero Banner',
          created_at: c.created_at,
          raw_data: c,
        };
      });
    },
  });

  // 2. Fetch RealtyNow Exclusive Properties Banners
  const { data: exclusiveList = [], isLoading: exclusiveLoading } = useQuery({
    queryKey: ['admin-cms-exclusive-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_exclusive_properties')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error || !data || data.length === 0) {
        return [];
      }
      return data;
    },
  });

  // 3. Fetch CMS Sections (Master control)
  const { data: cmsSections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ['admin-cms-sections'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cms_sections').select('*').order('sort_order', { ascending: true });
      if (error || !data || data.length === 0) {
        return [
          { id: 'sec-1', section_key: 'hero_banner', title: 'Hero Banner & AI Search', is_visible: true, sort_order: 1, type: 'Banner' },
          { id: 'sec-2', section_key: 'realtynow_exclusive', title: 'RealtyNow Exclusive Projects', is_visible: true, sort_order: 2, type: 'Carousel' },
          { id: 'sec-3', section_key: 'featured_properties', title: 'Featured Verified Properties', is_visible: true, sort_order: 3, type: 'Listings' },
          { id: 'sec-4', section_key: 'ai_property_advisor', title: 'AI Match & Recommendations Widget', is_visible: true, sort_order: 4, type: 'AI Feature' },
          { id: 'sec-5', section_key: 'top_localities', title: 'Top Localities & Neighborhoods', is_visible: true, sort_order: 5, type: 'Content' },
          { id: 'sec-6', section_key: 'top_agents', title: 'Top Rated Agents & Builders', is_visible: true, sort_order: 6, type: 'Profiles' },
          { id: 'sec-7', section_key: 'latest_blogs', title: 'Latest Insights & Market News', is_visible: true, sort_order: 7, type: 'Articles' },
        ];
      }
      return data;
    },
  });

  // 4. Fetch Search Bar Config
  const { data: searchConfig = [], isLoading: searchLoading } = useQuery({
    queryKey: ['admin-cms-search-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cms_search_config').select('*');
      if (error || !data || data.length === 0) {
        return [
          {
            id: 'srch-1',
            title: 'AI Smart Search',
            heading: 'AI-Powered Property Search',
            search_placeholder: 'Search by city, locality, project or builder...',
            enable_voice: true,
            enable_image_search: true,
            enable_ai_suggestions: true,
            is_visible: true,
            sort_order: 1,
          },
        ];
      }
      return data;
    },
  });

  // 5. Fetch Property Categories Config
  const { data: categoryList = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['admin-cms-categories'],
    queryFn: async () => {
      const { data: props } = await supabase
        .from('properties')
        .select('purpose, property_type_id, property_types(name, category)')
        .or('status.eq.published,is_live.eq.true');

      const all = (props ?? []) as any[];
      const aptCount = all.filter((p) => p.purpose === 'Sale' && (p.property_types?.name?.includes('Apartment') || p.property_types?.category === 'Residential')).length;
      const villaCount = all.filter((p) => p.property_types?.name?.includes('Villa') || p.property_types?.category === 'Villa').length;
      const rentCount = all.filter((p) => p.purpose === 'Rent').length;
      const commCount = all.filter((p) => p.purpose === 'Commercial' || p.property_types?.category === 'Commercial').length;
      const plotCount = all.filter((p) => p.property_types?.category === 'Plot' || p.property_types?.name?.includes('Plot') || p.property_types?.name?.includes('Land')).length;

      return [
        { id: 'cat-1', title: 'Buy Apartments', code: 'buy_apartments', is_visible: true, sort_order: 1, count: `${aptCount} Listings` },
        { id: 'cat-2', title: 'Luxury Villas', code: 'luxury_villas', is_visible: true, sort_order: 2, count: `${villaCount} Listings` },
        { id: 'cat-3', title: 'Rental Homes', code: 'rentals', is_visible: true, sort_order: 3, count: `${rentCount} Listings` },
        { id: 'cat-4', title: 'Commercial Spaces', code: 'commercial', is_visible: true, sort_order: 4, count: `${commCount} Listings` },
        { id: 'cat-5', title: 'Residential Plots', code: 'plots', is_visible: true, sort_order: 5, count: `${plotCount} Listings` },
      ];
    },
  });

  // 6. Fetch SEO Config
  const { data: seoList = [], isLoading: seoLoading } = useQuery({
    queryKey: ['admin-cms-seo-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cms_seo').select('*');
      if (error || !data || data.length === 0) {
        return [
          {
            id: 'seo-1',
            page_key: 'home',
            meta_title: 'RealtyNow - AI-Powered Real Estate & Property Search Platform',
            meta_description: 'Find verified properties for sale and rent in top Indian cities. Powered by AI search.',
            meta_keywords: 'real estate, apartments in Hyderabad, villas for sale, 3BHK flats',
            is_visible: true,
          },
          {
            id: 'seo-2',
            page_key: 'search',
            meta_title: 'Search Verified Properties Across India | RealtyNow',
            meta_description: 'Browse apartments, plots, villas, and commercial spaces with AI smart filters.',
            meta_keywords: 'property search, buy flats, rent homes, verified real estate',
            is_visible: true,
          },
        ];
      }
      return data;
    },
  });

  const getTableName = () => {
    if (activeTab === 'hero') return 'hero_campaigns';
    if (activeTab === 'exclusive') return 'cms_exclusive_properties';
    if (activeTab === 'sections') return 'cms_sections';
    if (activeTab === 'search') return 'cms_search_config';
    if (activeTab === 'seo') return 'cms_seo';
    return 'cms_categories';
  };

  // Real-time Update Mutations
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ table, id, is_visible }: { table: string; id: string; is_visible: boolean }) => {
      if (table === 'hero_campaigns') {
        const { error } = await supabase
          .from('hero_campaigns')
          .update({ status: is_visible ? 'Active' : 'Inactive', updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(table)
          .update({ is_visible, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`admin-cms-${variables.table}`] });
      queryClient.invalidateQueries({ queryKey: ['admin-cms-hero-list'] });
      queryClient.invalidateQueries({ queryKey: ['hero-campaigns'] });
      addToast('success', 'Real-time visibility updated!');
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async ({ table, item }: { table: string; item: any }) => {
      if (table === 'hero_campaigns') {
        const payload = {
          title: item.title?.trim() || 'Hero Campaign',
          subtitle: item.subtitle?.trim() || null,
          banner_image: item.image_url || item.bg_image_url || '',
          mobile_banner: item.mobile_banner || null,
          cta_text: item.cta_text || item.primary_btn_text || 'Explore Project',
          cta_url: item.cta_link || item.primary_btn_link || (item.property_id ? `/property/${item.property_id}` : '/search'),
          property_id: item.property_id || null,
          priority: parseInt(item.priority || item.sort_order, 10) || 1,
          order_no: parseInt(item.sort_order, 10) || 0,
          package_tier: item.package_tier || item.badge_text || 'Featured',
          display_type: item.display_type || 'Hero Banner',
          status: item.is_visible !== false ? 'Active' : 'Inactive',
          start_date: item.start_date ? new Date(item.start_date).toISOString() : null,
          end_date: item.end_date ? new Date(item.end_date).toISOString() : null,
          updated_at: new Date().toISOString(),
        };

        if (item.id && !String(item.id).startsWith('new_')) {
          const { error } = await supabase.from('hero_campaigns').update(payload).eq('id', item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('hero_campaigns').insert(payload);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from(table).upsert({ ...item, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cms-hero-list'] });
      queryClient.invalidateQueries({ queryKey: ['hero-campaigns'] });
      queryClient.invalidateQueries();
      addToast('success', 'Changes saved successfully to database!');
      setEditModalItem(null);
      setIsCreatingNew(false);
    },
    onError: (err: any) => {
      addToast('error', err.message || 'Failed to save changes');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cms-hero-list'] });
      queryClient.invalidateQueries({ queryKey: ['hero-campaigns'] });
      queryClient.invalidateQueries();
      addToast('success', 'Record deleted successfully!');
    },
    onError: (err: any) => {
      addToast('error', err.message || 'Failed to delete record');
    },
  });

  // Filter & Search Logic for Active Tab Items
  const currentTabItems = useMemo(() => {
    let items: any[] = [];
    if (activeTab === 'hero') items = heroList;
    else if (activeTab === 'exclusive') items = exclusiveList;
    else if (activeTab === 'sections') items = cmsSections;
    else if (activeTab === 'search') items = searchConfig;
    else if (activeTab === 'categories') items = categoryList;
    else if (activeTab === 'seo') items = seoList;

    return items
      .filter((item) => {
        const titleMatch = (item.title || item.heading || item.meta_title || item.section_key || item.locality || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        if (statusFilter === 'visible') return titleMatch && (item.is_visible ?? true);
        if (statusFilter === 'hidden') return titleMatch && item.is_visible === false;
        return titleMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return (a.title || a.meta_title || '').localeCompare(b.title || b.meta_title || '');
        if (sortBy === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
  }, [activeTab, heroList, exclusiveList, cmsSections, searchConfig, categoryList, seoList, searchQuery, statusFilter, sortBy]);

  const handleOpenEdit = (item: any) => {
    setEditModalItem(item);
    setFormState({
      ...item,
      start_date: item.start_date ? toLocalISOString(new Date(item.start_date)) : '',
      end_date: item.end_date ? toLocalISOString(new Date(item.end_date)) : '',
    });
    setIsCreatingNew(false);
  };

  const handleOpenCreate = () => {
    setIsCreatingNew(true);
    setEditModalItem({ id: `new_${Date.now()}` });
    if (activeTab === 'hero') {
      setFormState({
        title: '',
        subtitle: '',
        property_id: '',
        locality: '',
        price_text: '',
        badge_text: 'Featured',
        package_tier: 'Featured',
        display_type: 'Hero Banner',
        image_url: '',
        bg_image_url: '',
        mobile_banner: '',
        cta_text: 'Explore Project',
        cta_link: '/search',
        is_visible: true,
        priority: 5,
        sort_order: heroList.length + 1,
        start_date: toLocalISOString(new Date()),
        end_date: '',
      });
    } else {
      setFormState({
        title: '',
        subtitle: '',
        locality: '',
        price_text: 'Starting at ₹1.0 Cr.',
        badge_text: 'Exclusive Project',
        rera_no: 'RERA Approved',
        image_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        cta_text: 'Enquire Now',
        cta_link: '/search',
        is_visible: true,
        sort_order: currentTabItems.length + 1,
      });
    }
  };

  return (
    <DashboardLayout sections={sections} title={t('admin.cms', 'Homepage CMS Console')} badge="Real-time Control">
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Homepage CMS & Layout Builder"
          subtitle="Complete control over homepage sections, hero banners, RealtyNow Exclusive projects, AI search, and SEO metadata."
          action={
            <div className="flex items-center gap-3">
              {/* Table / Card View Toggle */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer',
                    viewMode === 'table' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <TableIcon className="h-3.5 w-3.5" /> Tabular View
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer',
                    viewMode === 'cards' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <GridIcon className="h-3.5 w-3.5" /> Card View
                </button>
              </div>

              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-red-500 text-slate-700 font-bold text-xs shadow-xs transition-all"
              >
                <Eye className="w-4 h-4 text-red-600" /> Preview Live Homepage
              </a>
            </div>
          }
        />

        {/* CMS Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
          {[
            { key: 'hero', label: `Hero Banners & Media (${heroList.length})`, icon: Sparkles },
            { key: 'exclusive', label: `RealtyNow Exclusive (${exclusiveList.length})`, icon: Building2 },
            { key: 'sections', label: `Master Sections Manager (${cmsSections.length})`, icon: Layout },
            { key: 'search', label: 'AI Search Bar Config', icon: Search },
            { key: 'categories', label: 'Property Categories', icon: Sliders },
            { key: 'seo', label: 'SEO & Metadata', icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap',
                  isActive
                    ? 'bg-navy-950 text-white shadow-md shadow-navy-950/20 ring-2 ring-navy-950'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                )}
              >
                <Icon className="w-4 h-4 text-red-500" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ADVANCED FILTER & SEARCH BAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search CMS items, keys, titles..."
                className="pl-9 text-xs"
              />
            </div>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-36 text-xs"
            >
              <option value="all">All Status</option>
              <option value="visible">Visible / Active</option>
              <option value="hidden">Hidden / Disabled</option>
            </Select>

            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-36 text-xs"
            >
              <option value="order">Sort Order (Asc)</option>
              <option value="name">Title (A-Z)</option>
              <option value="newest">Newest First</option>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleOpenCreate} icon={<Plus className="h-4 w-4" />}>
              Add New Record
            </Button>
          </div>
        </div>

        {/* CONTENT RENDER: TABULAR vs CARDS */}
        {viewMode === 'table' ? (
          /* TABULAR / DATA TABLE VIEW */
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-[11px] text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5 w-16">Order</th>
                    <th className="px-4 py-3.5">Title / Project</th>
                    <th className="px-4 py-3.5">Details & Spec</th>
                    <th className="px-4 py-3.5">Location & Price</th>
                    <th className="px-4 py-3.5 w-32">Status</th>
                    <th className="px-4 py-3.5 w-36 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentTabItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No CMS records found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    currentTabItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-4 font-mono font-bold text-slate-900">
                          #{item.sort_order ?? idx + 1}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {(item.image_url || item.bg_image_url) && (
                              <img src={item.image_url || item.bg_image_url} alt="" className="h-10 w-14 object-cover rounded-lg border border-slate-200 shrink-0" />
                            )}
                            <div>
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                <span>{item.title || item.heading || item.meta_title || 'CMS Item'}</span>
                                {item.cta_link && (
                                  <a href={item.cta_link} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-red-600" title="Open Link">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">{item.badge_text || item.section_key || item.code || item.page_key || item.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 max-w-xs">
                          <p className="text-xs text-slate-700 font-medium line-clamp-1">{item.subtitle || item.search_placeholder || item.meta_description || '—'}</p>
                          {item.rera_no && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.rera_no}</p>}
                        </td>
                        <td className="px-4 py-4">
                          {item.locality && (
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                              <MapPin className="h-3 w-3 text-red-500 shrink-0" /> {item.locality}
                            </div>
                          )}
                          {item.price_text && (
                            <div className="text-xs font-extrabold text-amber-600 mt-0.5">{item.price_text}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                table: getTableName(),
                                id: item.id,
                                is_visible: !(item.is_visible ?? true),
                              })
                            }
                            className="inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {item.is_visible ?? true ? (
                              <Badge variant="success">Visible</Badge>
                            ) : (
                              <Badge variant="warning">Hidden</Badge>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(item)} icon={<Edit3 className="h-3.5 w-3.5" />}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-400 hover:text-red-600"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this CMS record?')) {
                                  deleteItemMutation.mutate({ table: getTableName(), id: item.id });
                                }
                              }}
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* CARD VIEW GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {currentTabItems.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200">
                No items found for this filter.
              </div>
            ) : (
              currentTabItems.map((item, idx) => (
                <div key={item.id || idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-700">
                        #{item.sort_order ?? idx + 1}
                      </span>
                      <button
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            table: getTableName(),
                            id: item.id,
                            is_visible: !(item.is_visible ?? true),
                          })
                        }
                      >
                        {item.is_visible ?? true ? (
                          <Badge variant="success">Visible</Badge>
                        ) : (
                          <Badge variant="warning">Hidden</Badge>
                        )}
                      </button>
                    </div>

                    {(item.image_url || item.bg_image_url) && (
                      <img src={item.image_url || item.bg_image_url} alt="" className="h-36 w-full object-cover rounded-xl mb-3 border border-slate-100" />
                    )}

                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.title || item.heading || item.meta_title}</h4>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{item.subtitle || item.search_placeholder || item.meta_description || item.badge_text || 'No description'}</p>
                    
                    {item.locality && (
                      <div className="mt-2 flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <MapPin className="h-3.5 w-3.5 text-red-500" /> {item.locality}
                        </span>
                        <span className="font-extrabold text-amber-600">{item.price_text}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] text-slate-400">{item.rera_no || item.section_key || item.page_key || item.id}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(item)} icon={<Edit3 className="h-3.5 w-3.5" />}>
                        Configure
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this CMS record?')) {
                            deleteItemMutation.mutate({ table: getTableName(), id: item.id });
                          }
                        }}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* EDIT / CREATE ITEM MODAL */}
        <Modal
          open={!!editModalItem}
          onClose={() => setEditModalItem(null)}
          title={isCreatingNew ? `Add New ${activeTab === 'hero' ? 'Hero Banner' : activeTab.toUpperCase()} Record` : `Edit ${editModalItem?.title || 'CMS Record'}`}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditModalItem(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  saveItemMutation.mutate({
                    table: getTableName(),
                    item: formState,
                  })
                }
                loading={saveItemMutation.isPending}
                icon={<Save className="h-4 w-4" />}
              >
                Save Record
              </Button>
            </>
          }
        >
          {formState && (
            <div className="space-y-4">
              {activeTab === 'hero' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Link Property (Optional - Select to auto-fill banner data)
                  </label>
                  <select
                    value={formState.property_id || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const chosen: any = propertiesList.find((p: any) => p.id === selectedId);
                      if (chosen) {
                        const cityName = Array.isArray(chosen.cities) ? chosen.cities[0]?.name : chosen.cities?.name;
                        const localityName = Array.isArray(chosen.localities) ? chosen.localities[0]?.name : chosen.localities?.name;
                        const loc = localityName ? `${localityName}, ${cityName || ''}` : cityName || '';
                        const pText = chosen.price
                          ? chosen.price >= 10000000
                            ? `₹${(chosen.price / 10000000).toFixed(2)} Cr`
                            : `₹${(chosen.price / 100000).toFixed(2)} L`
                          : '';
                        const img = chosen.cover_image_url || (Array.isArray(chosen.images) ? chosen.images[0] : null) || '';
                        setFormState((prev: any) => ({
                          ...prev,
                          property_id: chosen.id,
                          title: chosen.title || prev.title,
                          subtitle: loc ? `${loc} • ${pText}` : chosen.title,
                          locality: loc,
                          price_text: pText,
                          image_url: img || prev.image_url,
                          bg_image_url: img || prev.bg_image_url,
                          cta_text: 'Explore Project',
                          cta_link: `/property/${chosen.id}`,
                          rera_no: chosen.rera_number || prev.rera_no,
                        }));
                      } else {
                        setFormState((prev: any) => ({ ...prev, property_id: '' }));
                      }
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:border-red-500"
                  >
                    <option value="">-- Custom Banner (No property link) --</option>
                    {propertiesList.map((p: any) => {
                      const cName = Array.isArray(p.cities) ? p.cities[0]?.name : p.cities?.name;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.title} ({cName || 'India'})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Project / Item Title *</label>
                <Input
                  value={formState.title || formState.heading || formState.meta_title || ''}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value, heading: e.target.value, meta_title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subtitle / Specification *</label>
                <Textarea
                  rows={2}
                  value={formState.subtitle || formState.search_placeholder || formState.meta_description || ''}
                  onChange={(e) => setFormState({ ...formState, subtitle: e.target.value, search_placeholder: e.target.value, meta_description: e.target.value })}
                />
              </div>

              {activeTab === 'hero' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Package Tier / Badge</label>
                      <Select
                        value={formState.package_tier || formState.badge_text || 'Featured'}
                        onChange={(e) => setFormState({ ...formState, package_tier: e.target.value, badge_text: e.target.value })}
                      >
                        <option value="Platinum">⚡ Platinum Tier</option>
                        <option value="Gold">🌟 Gold Tier</option>
                        <option value="Silver">✨ Silver Tier</option>
                        <option value="Featured">Featured</option>
                        <option value="Paid">Paid Campaign</option>
                        <option value="Free">Free</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Priority (1-10)</label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={formState.priority || formState.sort_order || 1}
                        onChange={(e) => setFormState({ ...formState, priority: parseInt(e.target.value, 10), sort_order: parseInt(e.target.value, 10) })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Desktop Hero Background Image URL *</label>
                    <Input
                      value={formState.image_url || formState.bg_image_url || ''}
                      onChange={(e) => setFormState({ ...formState, image_url: e.target.value, bg_image_url: e.target.value })}
                      placeholder="https://images.unsplash.com/... or storage URL"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Button Text</label>
                      <Input
                        value={formState.cta_text || formState.primary_btn_text || 'Explore Project'}
                        onChange={(e) => setFormState({ ...formState, cta_text: e.target.value, primary_btn_text: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Button Link</label>
                      <Input
                        value={formState.cta_link || formState.primary_btn_link || '/search'}
                        onChange={(e) => setFormState({ ...formState, cta_link: e.target.value, primary_btn_link: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Schedule Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Start Date & Time</label>
                        <button
                          type="button"
                          onClick={() => setFormState((f: any) => ({ ...f, start_date: toLocalISOString(new Date()) }))}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-md transition"
                        >
                          <Clock className="h-3 w-3" /> Set to Now
                        </button>
                      </div>
                      <Input
                        type="datetime-local"
                        value={formState.start_date || ''}
                        onChange={(e) => setFormState((f: any) => ({ ...f, start_date: e.target.value }))}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">End Date & Time</label>
                        {formState.end_date && (
                          <button
                            type="button"
                            onClick={() => setFormState((f: any) => ({ ...f, end_date: '' }))}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <Input
                        type="datetime-local"
                        value={formState.end_date || ''}
                        onChange={(e) => setFormState((f: any) => ({ ...f, end_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Quick Duration Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">Quick Duration:</span>
                    {[
                      { label: '+7 Days', days: 7 },
                      { label: '+15 Days', days: 15 },
                      { label: '+30 Days', days: 30 },
                      { label: '+90 Days', days: 90 },
                      { label: '+1 Year', days: 365 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const base = formState.start_date ? new Date(formState.start_date) : new Date();
                          const target = new Date(base.getTime() + preset.days * 86400000);
                          setFormState((f: any) => ({ ...f, end_date: toLocalISOString(target) }));
                        }}
                        className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 transition"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'exclusive' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Locality & City *</label>
                      <Input
                        value={formState.locality || ''}
                        onChange={(e) => setFormState({ ...formState, locality: e.target.value })}
                        placeholder="e.g. Attapur, Hyderabad"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Price Text *</label>
                      <Input
                        value={formState.price_text || ''}
                        onChange={(e) => setFormState({ ...formState, price_text: e.target.value })}
                        placeholder="e.g. Starting at ₹1.29 Cr."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Badge Tag</label>
                      <Input
                        value={formState.badge_text || ''}
                        onChange={(e) => setFormState({ ...formState, badge_text: e.target.value })}
                        placeholder="e.g. Sponsored Project / Exclusive"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">RERA Number / Permit</label>
                      <Input
                        value={formState.rera_no || ''}
                        onChange={(e) => setFormState({ ...formState, rera_no: e.target.value })}
                        placeholder="e.g. Phase 1 P02500004287"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Banner Image URL *</label>
                    <Input
                      value={formState.image_url || ''}
                      onChange={(e) => setFormState({ ...formState, image_url: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Button Text</label>
                      <Input
                        value={formState.cta_text || 'Enquire Now'}
                        onChange={(e) => setFormState({ ...formState, cta_text: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Button Link</label>
                      <Input
                        value={formState.cta_link || '/search'}
                        onChange={(e) => setFormState({ ...formState, cta_link: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sort Order</label>
                  <Input
                    type="number"
                    value={formState.sort_order || 1}
                    onChange={(e) => setFormState({ ...formState, sort_order: parseInt(e.target.value, 10) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Visibility Status</label>
                  <Select
                    value={formState.is_visible ? 'true' : 'false'}
                    onChange={(e) => setFormState({ ...formState, is_visible: e.target.value === 'true' })}
                  >
                    <option value="true font-bold">Visible on Homepage</option>
                    <option value="false">Hidden</option>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}

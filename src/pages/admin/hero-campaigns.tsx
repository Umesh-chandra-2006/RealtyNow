import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ImageIcon,
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Search,
  Download,
  MapPin,
  BadgeCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Eye,
  Sliders,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Smartphone,
  Monitor,
  Tablet,
  Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader, StatCard } from '../../components/dashboard-layout';
import { getAdminSections } from '../portal/sections';
import { Card, Button, Modal, Input, Textarea, Badge, Skeleton, EmptyState, Select } from '../../components/ui';
import { exportToCsv, formatNumber, cn } from '../../lib/utils';
import { useRealtimeCount } from '../../lib/realtime';
import { uploadFile } from '../../lib/storage';
import type { HeroCampaign } from '../../lib/types';
import { fetchAllIndianCities, type CityOption } from '../../lib/indian-cities';

const defaultFeatures = [
  'Premium 2 & 3 BHK Luxury Apartments',
  'Gated Community with 80% Open Green Space',
  'Ultra-Modern Clubhouse, Swimming Pool & Gym',
  'Strategic Location with Instant ORR Connectivity',
];

// Helper to format date into local datetime-local string (YYYY-MM-DDTHH:mm) without UTC shifting
const toLocalISOString = (d: Date = new Date()) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const initialForm = {
  title: '',
  subtitle: '',
  description: '',
  banner_image: '',
  mobile_banner: '',
  logo: '',
  developer_logo: '',
  rera_number: '',
  overlay_position: 'right' as 'left' | 'right' | 'center' | 'both',
  overlay_opacity: 0.85,
  content_alignment: 'left' as 'left' | 'center' | 'right',
  cta_enabled: true,
  cta_text: 'Explore Now',
  cta_url: '',
  features: defaultFeatures as string[],
  city_id: '',
  campaign_type: 'Free' as 'Free' | 'Paid',
  package_tier: 'Free' as 'Platinum' | 'Gold' | 'Silver' | 'Featured' | 'Free',
  property_id: '',
  is_pinned: false,
  display_type: 'Hero Banner' as 'Hero Banner' | 'Featured Slider' | 'Premium Card',
  priority: 1,
  start_date: toLocalISOString(),
  end_date: '',
  order_no: 0,
  status: 'Active' as 'Active' | 'Inactive',
};

export function AdminHeroCampaigns() {
  const { t } = useLanguageContext();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<HeroCampaign | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [newFeatureText, setNewFeatureText] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const realtimeTick = useRealtimeCount('hero_campaigns');

  const [form, setForm] = useState(initialForm);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingDevLogo, setUploadingDevLogo] = useState(false);

  const { data: cities = [] } = useQuery<CityOption[]>({
    queryKey: ['cities-all-dropdown'],
    queryFn: fetchAllIndianCities,
    staleTime: 1000 * 60 * 30,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-hero-campaigns', realtimeTick],
    queryFn: async () => {
      const { data } = await supabase
        .from('hero_campaigns')
        .select('*, cities(name), hero_campaign_features(*)')
        .order('order_no', { ascending: true });
      return (data ?? []) as HeroCampaign[];
    },
  });

  const filtered = (data ?? []).filter((c) => {
    const matchesSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(search.toLowerCase())) ||
      (c.rera_number && c.rera_number.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status.toLowerCase() === statusFilter;
    const matchesType = typeFilter === 'all' || c.campaign_type.toLowerCase() === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = (data ?? []).filter((c) => c.status === 'Active').length;
  const paidCount = (data ?? []).filter((c) => c.campaign_type === 'Paid').length;

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Property / Campaign Name is required');
      if (!form.banner_image.trim()) throw new Error('Hero Background Image is required');

      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        subtitle: form.subtitle?.trim() || null,
        description: form.description?.trim() || null,
        banner_image: form.banner_image.trim(),
        mobile_banner: form.mobile_banner?.trim() || null,
        logo: form.logo?.trim() || null,
        developer_logo: form.developer_logo?.trim() || null,
        rera_number: form.rera_number?.trim() || null,
        overlay_position: form.overlay_position,
        overlay_opacity: Number(form.overlay_opacity) || 0.85,
        content_alignment: form.content_alignment,
        cta_enabled: form.cta_enabled,
        cta_text: form.cta_text?.trim() || 'Explore Now',
        cta_url: form.cta_url?.trim() || null,
        features: form.features.filter(Boolean),
        city_id: form.city_id || null,
        campaign_type: form.campaign_type,
        package_tier: form.package_tier || 'Free',
        property_id: form.property_id?.trim() || null,
        is_pinned: form.is_pinned,
        display_type: form.display_type,
        priority: Number(form.priority) || 1,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : new Date().toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        order_no: Number(form.order_no) || 0,
        status: form.status,
      };

      let campaignId = editing?.id;

      if (editing) {
        const { error } = await supabase.from('hero_campaigns').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('hero_campaigns')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        campaignId = inserted?.id;
      }

      // Sync normalized hero_campaign_features child table
      if (campaignId) {
        // Delete previous features
        await supabase.from('hero_campaign_features').delete().eq('hero_campaign_id', campaignId);

        // Insert fresh features
        if (form.features.length > 0) {
          const featureRows = form.features.map((feat, idx) => ({
            hero_campaign_id: campaignId,
            feature_text: feat,
            display_order: idx,
          }));
          await supabase.from('hero_campaign_features').insert(featureRows);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hero-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['hero-campaigns'] });
      setShowForm(false);
      setEditing(null);
      setForm(initialForm);
      setActiveTab('edit');
    },
    onError: (err: Error) => alert(err.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hero_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hero-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['hero-campaigns'] });
    },
  });

  const toggle = useMutation({
    mutationFn: async (c: HeroCampaign) => {
      const { error } = await supabase
        .from('hero_campaigns')
        .update({ status: c.status === 'Active' ? 'Inactive' : 'Active' })
        .eq('id', c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hero-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['hero-campaigns'] });
    },
  });

  const handleUploadBanner = async (file: File) => {
    setUploadingBanner(true);
    const { url, error } = await uploadFile('advertisements', file);
    if (!error && url) setForm((f) => ({ ...f, banner_image: url }));
    else if (error) alert('Upload failed: ' + error);
    setUploadingBanner(false);
  };

  const handleUploadMobile = async (file: File) => {
    setUploadingMobile(true);
    const { url, error } = await uploadFile('advertisements', file);
    if (!error && url) setForm((f) => ({ ...f, mobile_banner: url }));
    else if (error) alert('Upload failed: ' + error);
    setUploadingMobile(false);
  };

  const handleUploadLogo = async (file: File) => {
    setUploadingLogo(true);
    const { url, error } = await uploadFile('advertisements', file);
    if (!error && url) setForm((f) => ({ ...f, logo: url }));
    else if (error) alert('Upload failed: ' + error);
    setUploadingLogo(false);
  };

  const handleUploadDevLogo = async (file: File) => {
    setUploadingDevLogo(true);
    const { url, error } = await uploadFile('advertisements', file);
    if (!error && url) setForm((f) => ({ ...f, developer_logo: url }));
    else if (error) alert('Upload failed: ' + error);
    setUploadingDevLogo(false);
  };

  const addFeature = () => {
    if (!newFeatureText.trim()) return;
    setForm((f) => ({
      ...f,
      features: [...f.features, newFeatureText.trim()],
    }));
    setNewFeatureText('');
  };

  const removeFeature = (index: number) => {
    setForm((f) => ({
      ...f,
      features: f.features.filter((_, idx) => idx !== index),
    }));
  };

  const moveFeature = (index: number, direction: 'up' | 'down') => {
    setForm((f) => {
      const copy = [...f.features];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return f;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return { ...f, features: copy };
    });
  };

  const updateFeatureText = (index: number, text: string) => {
    setForm((f) => {
      const copy = [...f.features];
      copy[index] = text;
      return { ...f, features: copy };
    });
  };

  const openEdit = (c: HeroCampaign) => {
    setEditing(c);

    // Extract features from joined child table or jsonb
    let featureList: string[] = [];
    if (Array.isArray(c.hero_campaign_features) && c.hero_campaign_features.length > 0) {
      featureList = [...c.hero_campaign_features]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((f) => f.feature_text)
        .filter(Boolean);
    } else if (Array.isArray(c.features) && c.features.length > 0) {
      featureList = c.features.filter(Boolean);
    } else if (c.description) {
      featureList = c.description
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else {
      featureList = defaultFeatures;
    }

    setForm({
      title: c.title ?? '',
      subtitle: c.subtitle ?? '',
      description: c.description ?? '',
      banner_image: c.banner_image ?? '',
      mobile_banner: c.mobile_banner ?? '',
      logo: c.logo ?? '',
      developer_logo: c.developer_logo ?? '',
      rera_number: c.rera_number ?? '',
      overlay_position: (c.overlay_position as any) || 'right',
      overlay_opacity: typeof c.overlay_opacity === 'number' ? c.overlay_opacity : 0.85,
      content_alignment: (c.content_alignment as any) || 'left',
      cta_enabled: c.cta_enabled !== false,
      cta_text: c.cta_text ?? 'Explore Now',
      cta_url: c.cta_url ?? '',
      features: featureList.length > 0 ? featureList : defaultFeatures,
      city_id: c.city_id ?? '',
      campaign_type: (c.campaign_type as 'Free' | 'Paid') ?? 'Free',
      package_tier: (c.package_tier as any) ?? 'Free',
      property_id: c.property_id ?? '',
      is_pinned: c.is_pinned ?? false,
      display_type: (c.display_type as any) ?? 'Hero Banner',
      priority: c.priority ?? 1,
      start_date: c.start_date ? c.start_date.slice(0, 16) : new Date().toISOString().slice(0, 16),
      end_date: c.end_date ? c.end_date.slice(0, 16) : '',
      order_no: c.order_no ?? 0,
      status: (c.status as 'Active' | 'Inactive') ?? 'Active',
    });
    setActiveTab('edit');
    setShowForm(true);
  };

  const handleExport = () => {
    exportToCsv('hero-campaigns', filtered as unknown as Record<string, unknown>[], [
      { key: 'title', label: 'Property / Title' },
      { key: 'rera_number', label: 'RERA Number' },
      { key: 'overlay_position', label: 'Overlay Position' },
      { key: 'campaign_type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'order_no', label: 'Order' },
    ]);
  };

  // Preview overlay gradient calculator
  const getPreviewOverlayStyle = () => {
    const opacity = form.overlay_opacity || 0.85;
    if (form.overlay_position === 'right') {
      return {
        background: `linear-gradient(to right, transparent 0%, rgba(10, 25, 47, 0.25) 30%, rgba(10, 25, 47, ${opacity * 0.85}) 55%, rgba(10, 25, 47, ${opacity}) 100%)`,
      };
    }
    if (form.overlay_position === 'left') {
      return {
        background: `linear-gradient(to left, transparent 0%, rgba(10, 25, 47, 0.25) 30%, rgba(10, 25, 47, ${opacity * 0.85}) 55%, rgba(10, 25, 47, ${opacity}) 100%)`,
      };
    }
    return {
      background: `radial-gradient(ellipse at center, rgba(10, 25, 47, ${opacity * 0.9}) 0%, rgba(10, 25, 47, ${opacity * 0.75}) 70%, rgba(10, 25, 47, 0.4) 100%), linear-gradient(to top, rgba(10, 25, 47, 0.95), transparent)`,
    };
  };

  return (
    <DashboardLayout
      sections={getAdminSections(t)}
      title={t('portal.heroCampaigns', 'Hero Campaigns')}
      badge="Admin"
    >
      <PageHeader
        title="Hero Banner Campaigns (CMS)"
        subtitle="Manage the homepage cinematic hero carousel with dynamic property branding, RERA numbers, features, and adaptive gradient overlays."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              Export CSV
            </Button>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setForm(initialForm);
                setEditing(null);
                setActiveTab('edit');
                setShowForm(true);
              }}
            >
              Add Hero Campaign
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Campaigns"
          value={(data ?? []).length}
          icon={<ImageIcon className="h-5 w-5" />}
          accent="navy"
        />
        <StatCard
          label="Active Live"
          value={activeCount}
          icon={<ToggleRight className="h-5 w-5" />}
          accent="success"
        />
        <StatCard
          label="Paid Campaigns"
          value={paidCount}
          icon={<BadgeCheck className="h-5 w-5" />}
          accent="gold"
        />
        <StatCard
          label="Total Banners"
          value={formatNumber((data ?? []).length)}
          icon={<ExternalLink className="h-5 w-5" />}
          accent="navy"
        />
      </div>

      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
          <Input
            placeholder="Search campaigns, RERA, or titles..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-32 text-xs"
          >
            <option value="all">All Types</option>
            <option value="paid">Paid</option>
            <option value="free">Free</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-32 text-xs"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : pageItems.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((c) => {
            const featCount = Array.isArray(c.hero_campaign_features)
              ? c.hero_campaign_features.length
              : Array.isArray(c.features)
              ? c.features.length
              : 0;

            return (
              <Card key={c.id} className="overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all border border-navy-100/80">
                <div>
                  <div className="relative h-44 w-full overflow-hidden bg-navy-950">
                    <img
                      src={c.banner_image || '/hero-ramky.jpg'}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                    {/* Visual overlay badge on thumbnail */}
                    <div
                      className={cn(
                        'absolute inset-y-0 w-1/2 pointer-events-none opacity-80',
                        c.overlay_position === 'right' ? 'right-0 bg-gradient-to-l from-navy-950 to-transparent' : 'left-0 bg-gradient-to-r from-navy-950 to-transparent',
                      )}
                    />

                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10">
                      <div className="flex gap-1">
                        <Badge variant={c.campaign_type === 'Paid' ? 'gold' : 'default'} className="text-[10px] uppercase font-bold tracking-wide">
                          {c.campaign_type}
                        </Badge>
                        <Badge variant="default" className="text-[10px]">
                          Overlay: {c.overlay_position || 'Right'}
                        </Badge>
                      </div>
                      {c.package_tier && c.package_tier !== 'Free' && (
                        <Badge variant="gold" className="text-[10px] uppercase font-bold bg-navy-900 text-gold-400 border border-gold-500/30 shadow-md">
                          {c.package_tier}
                        </Badge>
                      )}
                    </div>

                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                      <Badge variant={c.status === 'Active' ? 'success' : 'default'}>{c.status}</Badge>
                      {c.is_pinned && (
                        <Badge variant="success" className="text-[10px] bg-red-600 border-none text-white shadow-md flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Pinned
                        </Badge>
                      )}
                    </div>

                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
                      {c.developer_logo && (
                        <img
                          src={c.developer_logo}
                          alt="Dev logo"
                          className="h-7 w-auto object-contain bg-white/90 rounded p-1 shadow-sm"
                        />
                      )}
                      {c.logo && (
                        <img
                          src={c.logo}
                          alt="Logo"
                          className="h-7 w-auto object-contain bg-white/90 rounded p-1 shadow-sm"
                        />
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-navy-900 text-base line-clamp-1">{c.title}</h4>
                      <Badge variant="default" className="text-[10px] shrink-0 font-mono">
                        #{c.order_no ?? 0}
                      </Badge>
                    </div>

                    {c.subtitle && <p className="text-xs text-navy-500 line-clamp-1 mt-0.5">{c.subtitle}</p>}

                    {c.rera_number && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[220px]">{c.rera_number}</span>
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-navy-600 bg-navy-50/70 p-2.5 rounded-xl">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-navy-400" />
                        <span className="font-semibold">{c.cities?.name ?? 'All Cities'}</span>
                      </div>
                      <span className="text-navy-300">•</span>
                      <span className="text-navy-500 font-medium">{featCount} features</span>
                      {c.cta_enabled !== false && (
                        <>
                          <span className="text-navy-300">•</span>
                          <span className="text-red-600 font-medium">{c.cta_text || 'CTA'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-navy-100/60 flex items-center justify-between mt-2">
                  <span className="text-[11px] text-navy-400">
                    {c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'} →{' '}
                    {c.end_date ? new Date(c.end_date).toLocaleDateString() : 'No end date'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Edit2 className="h-4 w-4" />}
                      onClick={() => openEdit(c)}
                      title="Edit Campaign"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={
                        c.status === 'Active' ? (
                          <ToggleRight className="h-4 w-4 text-success-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-navy-400" />
                        )
                      }
                      onClick={() => toggle.mutate(c)}
                      title={c.status === 'Active' ? 'Deactivate' : 'Activate'}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-error-600"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => {
                        if (confirm('Delete this hero campaign?')) del.mutate(c.id);
                      }}
                      title="Delete"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<ImageIcon className="h-8 w-8 text-navy-400" />}
            title="No hero campaigns"
            description="Create hero banner campaigns to display on the homepage carousel."
            action={
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setForm(initialForm);
                  setEditing(null);
                  setActiveTab('edit');
                  setShowForm(true);
                }}
              >
                Add Hero Campaign
              </Button>
            }
          />
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-navy-100 px-4 py-3 text-sm">
          <span className="text-navy-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Hero Campaign Editor & Live Preview Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Hero Campaign & Visibility' : 'Create Hero Campaign & Visibility'}
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant={activeTab === 'edit' ? 'primary' : 'ghost'}
                size="sm"
                icon={<Sliders className="h-4 w-4" />}
                onClick={() => setActiveTab('edit')}
              >
                Form Settings
              </Button>
              <Button
                variant={activeTab === 'preview' ? 'primary' : 'ghost'}
                size="sm"
                icon={<Eye className="h-4 w-4" />}
                onClick={() => setActiveTab('preview')}
              >
                Live Preview
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                loading={save.isPending || uploadingBanner || uploadingMobile || uploadingLogo || uploadingDevLogo}
                onClick={() => save.mutate()}
              >
                {editing ? 'Update Campaign' : 'Publish Campaign'}
              </Button>
            </div>
          </div>
        }
      >
        {/* Tab selector on top */}
        <div className="flex items-center justify-between border-b border-navy-100 pb-3 mb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeTab === 'edit'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'bg-navy-50 text-navy-600 hover:bg-navy-100',
              )}
            >
              CMS Configuration
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeTab === 'preview'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-navy-50 text-navy-600 hover:bg-navy-100',
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Live Visual Preview
            </button>
          </div>

          {activeTab === 'preview' && (
            <div className="flex items-center gap-1 bg-navy-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={cn('p-1.5 rounded-md text-xs font-semibold flex items-center gap-1', previewDevice === 'desktop' ? 'bg-white shadow text-navy-950' : 'text-navy-600')}
              >
                <Monitor className="h-3.5 w-3.5" /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('tablet')}
                className={cn('p-1.5 rounded-md text-xs font-semibold flex items-center gap-1', previewDevice === 'tablet' ? 'bg-white shadow text-navy-950' : 'text-navy-600')}
              >
                <Tablet className="h-3.5 w-3.5" /> Tablet
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={cn('p-1.5 rounded-md text-xs font-semibold flex items-center gap-1', previewDevice === 'mobile' ? 'bg-white shadow text-navy-950' : 'text-navy-600')}
              >
                <Smartphone className="h-3.5 w-3.5" /> Mobile
              </button>
            </div>
          )}
        </div>

        {activeTab === 'preview' ? (
          /* Live Interactive Preview Screen */
          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            <div className="p-3 bg-navy-50 rounded-xl border border-navy-100 text-xs text-navy-600 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold-500 shrink-0" />
              <span>
                <strong>Live Simulation:</strong> This preview matches the 99acres-style overlay treatment rendered on the live website.
              </span>
            </div>

            <div
              className={cn(
                'mx-auto border border-navy-300 rounded-2xl overflow-hidden shadow-2xl transition-all relative bg-navy-950',
                previewDevice === 'desktop' && 'w-full h-[380px]',
                previewDevice === 'tablet' && 'w-[680px] max-w-full h-[360px]',
                previewDevice === 'mobile' && 'w-[360px] max-w-full h-[480px]',
              )}
            >
              {/* Background cover image */}
              <img
                src={
                  (previewDevice === 'mobile' && form.mobile_banner) ||
                  form.banner_image ||
                  '/hero-ramky.jpg'
                }
                alt="Preview background"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />

              {/* Dynamic Gradient Overlay */}
              <div
                className="absolute inset-0 pointer-events-none transition-all duration-300"
                style={
                  previewDevice === 'mobile'
                    ? {
                        background: `linear-gradient(to top, rgba(10, 25, 47, 0.98) 0%, rgba(10, 25, 47, ${form.overlay_opacity}) 60%, rgba(10, 25, 47, 0.35) 100%)`,
                      }
                    : getPreviewOverlayStyle()
                }
              />

              {/* Foreground Content Box */}
              <div
                className={cn(
                  'relative z-10 h-full w-full p-6 sm:p-8 flex flex-col justify-center',
                  previewDevice === 'mobile'
                    ? 'justify-end pb-8'
                    : form.overlay_position === 'right'
                    ? 'items-end text-left'
                    : form.overlay_position === 'left'
                    ? 'items-start text-left'
                    : 'items-center text-center',
                )}
              >
                <div
                  className={cn(
                    'w-full max-w-md flex flex-col gap-2',
                    previewDevice === 'mobile' && 'max-w-full',
                  )}
                >
                  {/* Logos & RERA Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    {form.developer_logo && (
                      <div className="h-7 px-2 py-0.5 rounded bg-white/95 shadow-sm flex items-center justify-center">
                        <img src={form.developer_logo} alt="Builder logo" className="max-h-full max-w-[80px] object-contain" />
                      </div>
                    )}
                    {form.logo && (
                      <div className="h-7 px-2 py-0.5 rounded bg-white/95 shadow-sm flex items-center justify-center">
                        <img src={form.logo} alt="Project logo" className="max-h-full max-w-[90px] object-contain" />
                      </div>
                    )}
                    {form.rera_number && (
                      <div className="inline-flex items-center gap-1 rounded bg-navy-900/80 border border-white/20 px-2 py-0.5 text-[10px] text-white/95 font-medium backdrop-blur-md">
                        <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{form.rera_number}</span>
                      </div>
                    )}
                  </div>

                  {/* Headline Title */}
                  <h2 className="font-display text-lg sm:text-2xl font-black uppercase text-white tracking-tight leading-tight [text-shadow:0_2px_10px_rgba(0,0,0,0.6)]">
                    {form.title || 'OWN A SPACIOUS 2 & 3 BHK NEAR ORR'}
                  </h2>

                  {/* Subtitle */}
                  {form.subtitle && (
                    <p className="text-xs sm:text-sm font-medium text-slate-200/90 leading-snug line-clamp-2">
                      {form.subtitle}
                    </p>
                  )}

                  {/* Dynamic Features Bullet List */}
                  {form.features && form.features.length > 0 && (
                    <div className="space-y-1 my-1">
                      {form.features.slice(0, previewDevice === 'mobile' ? 3 : 4).map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-1.5 text-xs text-white/95 font-medium leading-snug [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-gold-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Optional CTA */}
                  {form.cta_enabled && form.cta_text && (
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-2 text-xs font-bold shadow-lg shadow-red-900/40">
                        {form.cta_text}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Form Settings Tab */
          <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1 text-navy-800">
            {/* Section: Basic Property Information */}
            <div className="p-4 bg-navy-50/50 rounded-2xl border border-navy-100 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-red-600" />
                1. Property & Campaign Identity
              </h3>

              <Input
                label="Property / Campaign Name *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. OWN A SPACIOUS 2 & 3 BHK NEAR ORR"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Subtitle / Developer Details"
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="e.g. Hallmark Skyrena — Luxury High-Rise Gated Community"
                />
                <Input
                  label="RERA Registration Number"
                  value={form.rera_number}
                  onChange={(e) => setForm((f) => ({ ...f, rera_number: e.target.value }))}
                  placeholder="e.g. RERA No.: P01100004147 | rerait.telangana.gov.in"
                />
              </div>

              <Textarea
                label="Short Description (Optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Additional notes or promotional highlights..."
              />
            </div>

            {/* Section: Dynamic Property Features */}
            <div className="p-4 bg-navy-50/50 rounded-2xl border border-navy-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  2. Dynamic Property Features & Highlights ({form.features.length})
                </h3>
                <span className="text-[11px] text-navy-500 font-medium">Reorder or edit feature bullet points</span>
              </div>

              <div className="flex gap-2">
                <Input
                  value={newFeatureText}
                  onChange={(e) => setNewFeatureText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  placeholder="e.g. Earn ₹ 35,000 - 50,000/month for 1 year"
                  className="text-xs"
                />
                <Button size="sm" onClick={addFeature} icon={<Plus className="h-4 w-4" />}>
                  Add
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {form.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-navy-200/80 shadow-sm"
                  >
                    <span className="text-[11px] font-bold text-navy-400 w-5 text-center">{idx + 1}</span>
                    <input
                      type="text"
                      value={feat}
                      onChange={(e) => updateFeatureText(idx, e.target.value)}
                      className="flex-1 text-xs text-navy-900 font-medium bg-transparent border-none focus:outline-none focus:ring-0"
                    />
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveFeature(idx, 'up')}
                        className="p-1 rounded text-navy-400 hover:text-navy-900 disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === form.features.length - 1}
                        onClick={() => moveFeature(idx, 'down')}
                        className="p-1 rounded text-navy-400 hover:text-navy-900 disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete Feature"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Overlay Position & Readability Configuration */}
            <div className="p-4 bg-navy-50/50 rounded-2xl border border-navy-100 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-blue-600" />
                3. Overlay & Readability Controls
              </h3>

              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  label="Overlay Position"
                  value={form.overlay_position}
                  onChange={(e) => setForm((f) => ({ ...f, overlay_position: e.target.value as any }))}
                >
                  <option value="right">Right Side (Recommended for Left-Tower Photos)</option>
                  <option value="left">Left Side (For Right-Tower Photos)</option>
                  <option value="center">Center / Radial</option>
                  <option value="both">Both Sides (Full Scrim)</option>
                </Select>

                <div>
                  <label className="label">
                    Overlay Strength ({Math.round((form.overlay_opacity || 0.85) * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.4"
                    max="0.98"
                    step="0.05"
                    value={form.overlay_opacity}
                    onChange={(e) => setForm((f) => ({ ...f, overlay_opacity: parseFloat(e.target.value) }))}
                    className="w-full mt-2 accent-red-600 cursor-pointer"
                  />
                </div>

                <Select
                  label="Content Alignment"
                  value={form.content_alignment}
                  onChange={(e) => setForm((f) => ({ ...f, content_alignment: e.target.value as any }))}
                >
                  <option value="left">Left Aligned</option>
                  <option value="center">Center Aligned</option>
                  <option value="right">Right Aligned</option>
                </Select>
              </div>

              {/* Composition Guidance Alert */}
              <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  {form.overlay_position === 'right' && (
                    <span>
                      <strong>Composition Guidance:</strong> Content is positioned on the <strong>Right</strong>. Upload an image where the main building towers / scenic view is on the <strong>Left</strong> side so it remains fully visible.
                    </span>
                  )}
                  {form.overlay_position === 'left' && (
                    <span>
                      <strong>Composition Guidance:</strong> Content is positioned on the <strong>Left</strong>. Upload an image where the main building towers are on the <strong>Right</strong> side.
                    </span>
                  )}
                  {form.overlay_position === 'center' && (
                    <span>
                      <strong>Composition Guidance:</strong> Content is centered. The background image should feature wide symmetry.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Images and Logos Upload */}
            <div className="p-4 bg-navy-50/50 rounded-2xl border border-navy-100 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-navy-700" />
                4. Background Images & Brand Logos
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label font-bold text-xs uppercase tracking-wider text-navy-800 block mb-1">
                    Desktop Hero Background *
                  </label>
                  {form.banner_image && (
                    <div className="mb-2 relative rounded-xl overflow-hidden border border-navy-200 max-h-28 shadow-sm">
                      <img src={form.banner_image} alt="Banner" className="w-full h-24 object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUploadBanner(e.target.files[0])}
                    className="text-xs text-navy-500 file:mr-2 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-white file:font-semibold hover:file:bg-navy-800"
                  />
                  {uploadingBanner && <span className="text-xs text-red-600 font-bold animate-pulse block mt-1">Uploading...</span>}
                </div>

                <div>
                  <label className="label font-bold text-xs uppercase tracking-wider text-navy-800 block mb-1">
                    Mobile Banner Image (Optional)
                  </label>
                  {form.mobile_banner && (
                    <div className="mb-2 relative rounded-xl overflow-hidden border border-navy-200 max-h-28 shadow-sm">
                      <img src={form.mobile_banner} alt="Mobile banner" className="w-full h-24 object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUploadMobile(e.target.files[0])}
                    className="text-xs text-navy-500 file:mr-2 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-white file:font-semibold hover:file:bg-navy-800"
                  />
                  {uploadingMobile && <span className="text-xs text-red-600 font-bold animate-pulse block mt-1">Uploading...</span>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-navy-100">
                <div>
                  <label className="label font-bold text-xs uppercase tracking-wider text-navy-800 block mb-1">
                    Project Logo (Optional)
                  </label>
                  {form.logo && (
                    <div className="mb-2 h-14 w-28 bg-white rounded-lg p-1.5 border border-navy-200 flex items-center justify-center shadow-sm">
                      <img src={form.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUploadLogo(e.target.files[0])}
                    className="text-xs text-navy-500 file:mr-2 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-white file:font-semibold hover:file:bg-navy-800"
                  />
                  {uploadingLogo && <span className="text-xs text-red-600 font-bold animate-pulse block mt-1">Uploading...</span>}
                </div>

                <div>
                  <label className="label font-bold text-xs uppercase tracking-wider text-navy-800 block mb-1">
                    Builder / Developer Logo (Optional)
                  </label>
                  {form.developer_logo && (
                    <div className="mb-2 h-14 w-28 bg-white rounded-lg p-1.5 border border-navy-200 flex items-center justify-center shadow-sm">
                      <img src={form.developer_logo} alt="Dev logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUploadDevLogo(e.target.files[0])}
                    className="text-xs text-navy-500 file:mr-2 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-white file:font-semibold hover:file:bg-navy-800"
                  />
                  {uploadingDevLogo && <span className="text-xs text-red-600 font-bold animate-pulse block mt-1">Uploading...</span>}
                </div>
              </div>
            </div>

            {/* Section: Optional CTA & Navigation */}
            <div className="p-4 bg-navy-50/50 rounded-2xl border border-navy-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5 text-red-600" />
                  5. CTA Button Configuration
                </h3>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-navy-700">
                  <input
                    type="checkbox"
                    checked={form.cta_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, cta_enabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-navy-300 text-red-600 focus:ring-red-600 accent-red-600 cursor-pointer"
                  />
                  Enable CTA Button
                </label>
              </div>

              {form.cta_enabled && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="CTA Button Label"
                    value={form.cta_text}
                    onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
                    placeholder="e.g. Explore Now"
                  />
                  <Input
                    label="CTA Destination URL"
                    value={form.cta_url}
                    onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                    placeholder="/search?purpose=Buy or https://..."
                  />
                </div>
              )}
            </div>

            {/* Section: Display Settings & Targeting */}
            <div className="p-4 bg-navy-50/50 rounded-2xl border border-navy-100 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-navy-700" />
                6. Display Settings & Targeting
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Target City</label>
                  <Select value={form.city_id} onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}>
                    <option value="">All Cities</option>
                    {(cities ?? []).map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Select
                  label="Campaign Tier"
                  value={form.package_tier}
                  onChange={(e) => setForm((f) => ({ ...f, package_tier: e.target.value as any }))}
                >
                  <option value="Free">Free (Standard)</option>
                  <option value="Featured">Featured</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </Select>
              </div>

              <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-navy-200">
                <input
                  type="checkbox"
                  id="is_pinned"
                  checked={form.is_pinned}
                  onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                  className="h-4 w-4 rounded border-navy-300 text-red-600 focus:ring-red-600 accent-red-600 cursor-pointer"
                />
                <label htmlFor="is_pinned" className="text-xs font-semibold text-navy-900 cursor-pointer">
                  Pin as Top First Slide (Forces this banner to appear 1st)
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-navy-900">Start Date & Time</label>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, start_date: toLocalISOString() }))}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                    >
                      Set to Now
                    </button>
                  </div>
                  <Input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-navy-900">End Date & Time (Optional)</label>
                    {form.end_date && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, end_date: '' }))}
                        className="text-[11px] font-medium text-navy-500 hover:text-red-600 underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <Input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Quick Duration Presets */}
              <div className="flex flex-wrap items-center gap-1.5 -mt-1 mb-1">
                <span className="text-[11px] font-semibold text-navy-600 mr-1">Quick Duration:</span>
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
                      const base = form.start_date ? new Date(form.start_date) : new Date();
                      const target = new Date(base.getTime() + preset.days * 24 * 60 * 60 * 1000);
                      setForm((f) => ({ ...f, end_date: toLocalISOString(target) }));
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-navy-200 bg-white text-navy-800 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Carousel Order No."
                  type="number"
                  min="0"
                  value={form.order_no}
                  onChange={(e) => setForm((f) => ({ ...f, order_no: parseInt(e.target.value) || 0 }))}
                />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))}
                >
                  <option value="Active">Active (Live)</option>
                  <option value="Inactive">Inactive</option>
                </Select>
                <Input
                  label="Linked Property ID"
                  value={form.property_id}
                  onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
                  placeholder="UUID (Optional)"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

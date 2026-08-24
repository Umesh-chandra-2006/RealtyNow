import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Sparkles,
  SlidersHorizontal,
  Building2,
  Award,
  LayoutGrid,
  Zap,
  Plus,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Eye,
} from 'lucide-react';
import { DashboardLayout, PageHeader } from '../../../components/dashboard-layout';
import { getAdminSections } from '../../portal/sections';
import { useLanguageContext } from '../../../lib/i18n/language-context';
import { Card, Button, Badge, Modal, Input, Select, Skeleton } from '../../../components/ui';
import { useToast } from '../../../components/toast';
import {
  type CampaignType,
  CAMPAIGN_SECTIONS_CONFIG,
  fetchCampaignDashboardStats,
  fetchAdminCampaigns,
  createCampaign,
} from '../../../lib/paid-campaigns-api';
import { FeaturedScheduleControl } from '../../../components/admin/featured-schedule-control';

export function PaidCampaignDashboardPage() {
  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CampaignType>('FEATURED_PROPERTIES');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignSubtitle, setCampaignSubtitle] = useState('');
  const [badgeLabel, setBadgeLabel] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [endAt, setEndAt] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-paid-campaign-stats'],
    queryFn: fetchCampaignDashboardStats,
  });

  // Fetch recent campaigns
  const { data: recentCampaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['admin-recent-campaigns'],
    queryFn: () => fetchAdminCampaigns(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!campaignTitle.trim()) {
        throw new Error('Please provide a campaign title.');
      }
      return await createCampaign({
        campaign_type: selectedType,
        title: campaignTitle,
        subtitle: campaignSubtitle,
        badge_label: badgeLabel || CAMPAIGN_SECTIONS_CONFIG[selectedType].badgeDefault,
        cta_label: ctaLabel || CAMPAIGN_SECTIONS_CONFIG[selectedType].ctaDefault,
        cta_url: ctaUrl || CAMPAIGN_SECTIONS_CONFIG[selectedType].ctaUrlDefault,
        image_url: imageUrl,
        priority,
        start_at: startAt,
        end_at: endAt,
        is_active: isActive,
        status: isActive ? 'ACTIVE' : 'DRAFT',
      });
    },
    onSuccess: () => {
      addToast('success', 'Paid campaign created successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaign-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-recent-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-paid-campaigns'] });
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => addToast('error', err?.message || 'Failed to create campaign'),
  });

  const resetForm = () => {
    setCampaignTitle('');
    setCampaignSubtitle('');
    setBadgeLabel('');
    setCtaLabel('');
    setCtaUrl('');
    setImageUrl('');
    setPriority('High');
    setStartAt(null);
    setEndAt(null);
    setIsActive(true);
  };

  const SECTIONS_LIST: { type: CampaignType; icon: any; color: string; bg: string }[] = [
    {
      type: 'FEATURED_PROPERTIES',
      icon: Sparkles,
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-100',
    },
    {
      type: 'TWO_COLUMN_SLIDER',
      icon: SlidersHorizontal,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 border-indigo-100',
    },
    {
      type: 'EXPLORE_BUILDERS',
      icon: Building2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-100',
    },
    {
      type: 'SIGNATURE_COLLECTION',
      icon: Award,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-100',
    },
    {
      type: 'THREE_COLUMN_PROPERTIES',
      icon: LayoutGrid,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-100',
    },
    {
      type: 'REALTYNOW_EXCLUSIVE',
      icon: Zap,
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-100',
    },
  ];

  return (
    <DashboardLayout sections={adminSections} title="Paid Campaign CMS">
      <PageHeader
        title="Paid Campaign"
        subtitle="Centralized management and real-time control for all monetized promotional homepage sections"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchStats()}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
              className="bg-[#C91F2B] hover:bg-[#b01b25] text-white gap-1.5 shadow-md shadow-red-600/20"
            >
              <Plus className="h-4 w-4" /> Create Campaign
            </Button>
          </div>
        }
      />

      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-4 border-l-4 border-l-slate-700 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Campaigns</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.total ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Across all 6 homepage sections</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Live & Active</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-emerald-600">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.active ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Currently visible to users</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Scheduled</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-amber-600">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.scheduled ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Future start date configured</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Draft / Inactive</span>
            <FileEdit className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-blue-600">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (stats?.draft ?? 0) + (stats?.inactive ?? 0)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Draft or paused items</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-rose-500 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Expired</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-rose-600">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.expired ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Past end-date schedule</p>
        </Card>
      </div>

      {/* ── 6 CAMPAIGN SECTIONS CARDS ── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Campaign Categories</h2>
            <p className="text-xs text-slate-500">Select any section to manage its properties, items, ordering, and schedule</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SECTIONS_LIST.map((sec) => {
            const config = CAMPAIGN_SECTIONS_CONFIG[sec.type];
            const count = stats?.byType?.[sec.type] ?? 0;
            const Icon = sec.icon;

            return (
              <Card
                key={sec.type}
                className="group relative flex flex-col justify-between p-5 border border-slate-200/90 hover:border-red-300 hover:shadow-xl transition-all duration-300 rounded-2xl bg-white"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={`h-11 w-11 rounded-xl ${sec.bg} flex items-center justify-center ${sec.color} border shadow-xs group-hover:scale-105 transition-transform`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-700">
                      {count} {count === 1 ? 'Campaign' : 'Campaigns'}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                    {config.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                    {config.description}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {config.badgeDefault}
                  </span>
                  <Link
                    to={config.route}
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Manage Section <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── CREATE CAMPAIGN MODAL ── */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Paid Campaign"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* Section Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Section *</label>
            <Select
              value={selectedType}
              onChange={(e) => {
                const t = e.target.value as CampaignType;
                setSelectedType(t);
                setBadgeLabel(CAMPAIGN_SECTIONS_CONFIG[t].badgeDefault);
                setCtaLabel(CAMPAIGN_SECTIONS_CONFIG[t].ctaDefault);
                setCtaUrl(CAMPAIGN_SECTIONS_CONFIG[t].ctaUrlDefault);
              }}
            >
              {Object.entries(CAMPAIGN_SECTIONS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-slate-400 mt-1">{CAMPAIGN_SECTIONS_CONFIG[selectedType].description}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Title *</label>
            <Input
              placeholder="e.g. Ultra-Luxury Penthouses in Jubilee Hills"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Subtitle / Locality</label>
            <Input
              placeholder="e.g. Starting from ₹4.50 Cr | Ready to Move"
              value={campaignSubtitle}
              onChange={(e) => setCampaignSubtitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Badge Tag</label>
              <Input
                placeholder={CAMPAIGN_SECTIONS_CONFIG[selectedType].badgeDefault}
                value={badgeLabel}
                onChange={(e) => setBadgeLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CTA Label</label>
              <Input
                placeholder={CAMPAIGN_SECTIONS_CONFIG[selectedType].ctaDefault}
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CTA Destination URL</label>
              <Input
                placeholder={CAMPAIGN_SECTIONS_CONFIG[selectedType].ctaUrlDefault}
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Custom Image URL (Optional)</label>
            <Input
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          {/* Date & Time Scheduling Control */}
          <div className="pt-2">
            <FeaturedScheduleControl
              startAt={startAt}
              endAt={endAt}
              isActive={isActive}
              onStartAtChange={setStartAt}
              onEndAtChange={setEndAt}
              onIsActiveChange={setIsActive}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={createMutation.isPending || !campaignTitle.trim()}
              onClick={() => createMutation.mutate()}
              className="bg-[#C91F2B] hover:bg-[#b01b25] text-white"
            >
              {createMutation.isPending ? 'Saving...' : 'Create Campaign'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

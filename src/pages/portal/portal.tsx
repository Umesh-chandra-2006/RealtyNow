import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, Heart, MessageSquare, Eye, Wallet, TrendingUp, Home, Plus, Clock, CheckCircle2, Star, Crown, Sparkles, Building } from 'lucide-react';
import { PlanDetailsModal } from '../../components/portal/plan-details-modal';
import { PackageRenewalWidget } from '../../components/portal/PackageRenewalWidget';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, StatCard, PageHeader } from '../../components/dashboard-layout';
import { Card, Button, EmptyState, Skeleton, Badge } from '../../components/ui';
import { PropertyCard, PropertyCardSkeleton } from '../../components/property-card';
import { getPortalSections } from './sections';
import { mapJoined } from '../../lib/join-helpers';
import { formatPrice, formatDate , generatePropertyUrl} from '../../lib/utils';
import { useToast } from '../../components/toast';
import { fetchComparedProperties, toggleCompareProperty, clearCompareList } from '../../lib/compare';
import { RemindersWidget } from '../../components/reminders-widget';
import { motion } from 'framer-motion';
import type { Property } from '../../lib/types';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';

export function PortalDashboard() {
  const { t } = useLanguageContext();
  const { user, profile } = useAuth();
  const sections = getPortalSections(t);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['portal-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const [properties, favorites, enquiries, views] = await Promise.all([
        supabase.from('properties').select('id, status, view_count').eq('owner_id', user.id),
        supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('customer_id', user.id),
        supabase.from('property_views').select('id', { count: 'exact', head: true }),
      ]);
      const props = properties.data ?? [];
      return {
        total: props.length,
        published: props.filter((p) => p.status === 'published').length,
        pending: props.filter((p) => ['submitted', 'pending_verification', 'approved'].includes(p.status)).length,
        drafts: props.filter((p) => p.status === 'draft').length,
        views: props.reduce((a, p) => a + (p.view_count ?? 0), 0),
        favorites: favorites.count ?? 0,
        enquiries: enquiries.count ?? 0,
      };
    },
    enabled: !!user,
  });

  const { data: myProperties } = useQuery({
    queryKey: ['portal-my-latest', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('*, cities(name), localities(name), property_types(name)')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
      return (data ?? []).map((p) => mapJoined(p as unknown as Record<string, unknown>)) as unknown as Property[];
    },
    enabled: !!user,
  });

  const { data: recentEnquiries } = useQuery({
    queryKey: ['portal-enquiries-latest', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('enquiries')
        .select('*, property:properties(title)')
        .eq('customer_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout
      sections={sections}
      title={t('nav.dashboard', 'Dashboard')}
      badge={profile?.first_name ?? undefined}
    >
      <PageHeader
        title={`${t('portal.welcomeBack', 'Welcome back')}, ${profile?.first_name ?? ''}`}
        subtitle={t('portal.activityOverview', "Here's an overview of your real estate activity.")}
        action={
          <PostPropertyLink to="/portal/list-property">
            <Button icon={<Plus className="h-4 w-4" />}>{t('forms.postProperty', 'List Property')}</Button>
          </PostPropertyLink>
        }
      />

      <div className="mb-6">
        <PackageRenewalWidget />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              label={t('portal.myProperties', 'My Properties')}
              value={stats.total}
              icon={<Building2 className="h-5 w-5" />}
              accent="navy"
              to="/portal/my-properties"
            />
            <StatCard
              label={t('portal.published', 'Published')}
              value={stats.published}
              icon={<Home className="h-5 w-5" />}
              accent="success"
              trend={`${stats.pending} ${t('portal.pending', 'pending')}`}
              to="/portal/my-properties"
            />
            <StatCard
              label={t('portal.totalViews', 'Total Views')}
              value={stats.views}
              icon={<Eye className="h-5 w-5" />}
              accent="gold"
              to="/portal/my-properties"
            />
            <StatCard
              label={t('portal.savedAndEnquiries', 'Saved & Enquiries')}
              value={`${stats.favorites} / ${stats.enquiries}`}
              icon={<Heart className="h-5 w-5" />}
              accent="navy"
              to="/portal/saved-properties"
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              {t('portal.latestProps', 'My latest properties')}
            </h3>
            <Link to="/portal/my-properties" className="text-sm font-medium text-navy-700 hover:text-navy-900">
              {t('home.viewAll', 'View all')}
            </Link>
          </div>
          {!myProperties ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <PropertyCardSkeleton />
              <PropertyCardSkeleton />
            </div>
          ) : myProperties.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {myProperties.map((p) => (
                <PropertyCard key={p.id} property={p} compact />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title={t('portal.noPropertiesTitle', 'No properties yet')}
                description={t('portal.noPropertiesDesc', 'List your first property to reach thousands of buyers.')}
                action={
                  <PostPropertyLink to="/portal/list-property">
                    <Button icon={<Plus className="h-4 w-4" />}>{t('forms.postProperty', 'List Property')}</Button>
                  </PostPropertyLink>
                }
              />
            </Card>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              {t('portal.recentEnquiries', 'Recent enquiries')}
            </h3>
            <Link to="/portal/enquiries" className="text-sm font-medium text-navy-700 hover:text-navy-900">
              {t('home.viewAll', 'View all')}
            </Link>
          </div>
          <Card className="divide-y divide-navy-50">
            {!recentEnquiries ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentEnquiries.length > 0 ? (
              recentEnquiries.map((e) => (
                <div key={e.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-navy-900 truncate">
                      {(e as Record<string, unknown>).property
                        ? ((e as { property: { title: string } }).property?.title ??
                          t('portal.propEnquiry', 'Property enquiry'))
                        : t('portal.propEnquiry', 'Property enquiry')}
                    </p>
                    <Badge variant={e.status === 'new' ? 'info' : 'default'}>{e.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-navy-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDate(e.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title={t('portal.noEnquiries', 'No enquiries yet')}
                description={t('portal.enquiriesAppearHere', 'Enquiries on your listings will appear here.')}
              />
            )}
          </Card>
          <div className="mt-6">
            <RemindersWidget />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export function PortalSaved() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const sections = getPortalSections(t);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-saved', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('favorites')
        .select('id, property:properties(*, cities(name), localities(name), property_types(name))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return (data ?? []).map((f) => ({
        ...f,
        property: Array.isArray(f.property) ? f.property[0] : f.property,
      })) as unknown as { id: string; property: Property }[];
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout sections={sections} title={t('common.saved', 'Saved Properties')}>
      <PageHeader
        title={t('common.saved', 'Saved properties')}
        subtitle={t('portal.bookmarkedSub', "Properties you've bookmarked for later.")}
      />
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PropertyCardSkeleton key={i} />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((f) => f.property && <PropertyCard key={f.id} property={f.property} />)}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title={t('portal.noSavedProps', 'No saved properties')}
            description={t('portal.heartToSave', 'Tap the heart icon on any listing to save it here.')}
            action={
              <Link to="/search">
                <Button variant="secondary">{t('search.browseAll', 'Browse properties')}</Button>
              </Link>
            }
          />
        </Card>
      )}
    </DashboardLayout>
  );
}

export function PortalCompare() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const { addToast } = useToast();
  const sections = getPortalSections(t);

  const {
    data: properties,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['portal-compare-list', user?.id],
    queryFn: () => fetchComparedProperties(user?.id),
  });

  const items = properties ?? [];

  const handleRemove = async (id: string) => {
    try {
      await toggleCompareProperty(id, user?.id);
      addToast('success', t('compare.removedToast', 'Property removed from comparison'));
      refetch();
    } catch {
      addToast('error', t('common.error', 'Failed to remove property'));
    }
  };

  const handleClearAll = async () => {
    try {
      await clearCompareList(user?.id);
      addToast('success', t('compare.clearedToast', 'Comparison list cleared'));
      refetch();
    } catch {
      addToast('error', t('common.error', 'Failed to clear list'));
    }
  };

  const specs = [
    {
      label: t('property.price', 'Price'),
      render: (p: Property) => <span className="font-bold text-red-600">{formatPrice(p.price, p.purpose)}</span>,
    },
    {
      label: t('search.purposeLabel', 'Purpose'),
      render: (p: Property) => (
        <Badge variant={p.purpose === 'Rent' ? 'info' : 'gold'}>
          {p.purpose === 'Rent' ? t('property.forRent', 'For Rent') : t('property.forSale', 'For Sale')}
        </Badge>
      ),
    },
    { label: t('search.propertyTypeLabel', 'Property Type'), render: (p: Property) => p.property_type_name ?? '—' },
    {
      label: t('property.bedrooms', 'Bedrooms (BHK)'),
      render: (p: Property) => (p.bedrooms ? `${p.bedrooms} BHK` : '—'),
    },
    { label: t('property.bathrooms', 'Bathrooms'), render: (p: Property) => p.bathrooms ?? '—' },
    {
      label: t('property.builtUpArea', 'Built-up Area'),
      render: (p: Property) => (p.built_up_area ? `${p.built_up_area} sqft` : '—'),
    },
    { label: t('search.furnishingLabel', 'Furnishing'), render: (p: Property) => p.furnishing ?? '—' },
    { label: t('search.facingLabel', 'Facing'), render: (p: Property) => p.facing ?? '—' },
    {
      label: t('property.parking', 'Parking'),
      render: (p: Property) => (p.parking ? t('common.yes', 'Available') : t('common.no', 'No')),
    },
    { label: t('search.cityLabel', 'City'), render: (p: Property) => p.city_name ?? '—' },
    { label: t('search.localityLabel', 'Locality'), render: (p: Property) => p.locality_name ?? '—' },
  ];

  return (
    <DashboardLayout sections={sections} title={t('compare.title', 'Compare')}>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title={t('compare.title', 'Compare Properties')}
          subtitle={t('compare.subtitle', 'Side-by-side comparison of your selected properties (up to 4).')}
        />
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-error-600 hover:bg-error-50">
            {t('search.clearAll', 'Clear All')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TrendingUp className="h-8 w-8 text-navy-400" />}
            title={t('compare.emptyTitle', 'No properties selected to compare')}
            description={t(
              'compare.emptyDesc',
              'Click the compare icon on any property card or detail page to add up to 4 properties side-by-side.',
            )}
            action={
              <Link to="/search">
                <Button variant="primary">{t('search.browseAll', 'Browse Properties')}</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/50">
                <th className="p-4 font-semibold text-navy-500 w-48 sticky left-0 bg-navy-50 z-10">
                  {t('compare.propertyCol', 'Property')}
                </th>
                {items.map((p) => (
                  <th key={p.id} className="p-4 min-w-[240px] max-w-[280px] align-top border-l border-navy-100">
                    <div className="space-y-2">
                      <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-navy-100">
                        <img
                          src={getPropertyCoverImage(p)}
                          alt={p.title}
                          onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                          className="h-full w-full object-cover"
                        />
                        <button
                          onClick={() => handleRemove(p.id)}
                          className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-navy-950/70 text-white hover:bg-error-600 transition cursor-pointer"
                          title={t('compare.remove', 'Remove from comparison')}
                        >
                          ✕
                        </button>
                      </div>
                      <Link
                        to={generatePropertyUrl(p)}
                        className="font-display font-bold text-navy-900 hover:text-red-600 line-clamp-2 block"
                      >
                        {p.title}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {specs.map((s) => (
                <tr key={s.label} className="hover:bg-navy-50/30">
                  <td className="p-4 font-medium text-navy-700 sticky left-0 bg-white z-10 border-r border-navy-100">
                    {s.label}
                  </td>
                  {items.map((p) => (
                    <td key={p.id} className="p-4 text-navy-800 border-l border-navy-100">
                      {s.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-4 font-medium text-navy-700 sticky left-0 bg-white z-10 border-r border-navy-100">
                  {t('portal.actions', 'Action')}
                </td>
                {items.map((p) => (
                  <td key={p.id} className="p-4 border-l border-navy-100">
                    <Link to={generatePropertyUrl(p)}>
                      <Button size="sm" variant="secondary" className="w-full">
                        {t('compare.viewProperty', 'View Details')}
                      </Button>
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </DashboardLayout>
  );
}

import { RazorpayCheckout } from '../../components/payments/razorpay-checkout';
import { PostPropertyLink } from '../../components/post-property-link';
import {
  fetchSubscriptionPlans,
  fetchActiveCustomerSubscription,
  fetchCustomerSubscriptionHistory,
  type SubscriptionPlan,
  type ActiveSubscriptionSummary,
} from '../../lib/subscriptions';
import { Zap, Shield, Phone, Calendar, ArrowRight, Check } from 'lucide-react';

export function PortalSubscription() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const sections = getPortalSections(t);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  // 1. Fetch Active Subscription
  const { data: mySub, refetch: refetchMySub, isLoading: loadingMySub } = useQuery({
    queryKey: ['customer-active-subscription', user?.id],
    queryFn: () => (user ? fetchActiveCustomerSubscription(user.id) : null),
    enabled: !!user,
  });

  // 2. Fetch Available Plans
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['customer-subscription-plans'],
    queryFn: () => fetchSubscriptionPlans(false),
  });

  // 3. Fetch Subscription History
  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['customer-subscription-history', user?.id],
    queryFn: () => (user ? fetchCustomerSubscriptionHistory(user.id) : []),
    enabled: !!user,
  });

  const handleSubscriptionSuccess = () => {
    refetchMySub();
    refetchHistory();
  };

  return (
    <DashboardLayout sections={sections} title={t('portal.subscription', 'Subscription')}>
      <PageHeader
        title={t('portal.subscription', 'Subscription & Listing Plans')}
        subtitle="Choose a package tailored to your property listing volume, search visibility, and exposure goals."
      />

      {/* ─── 1. MY ACTIVE SUBSCRIPTION CARD ─── */}
      {mySub && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold tracking-wider uppercase shadow-xs">
                    ACTIVE SUBSCRIPTION
                  </span>
                  {mySub.remaining_days <= 5 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      Expiring in {mySub.remaining_days} days
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-navy-900">
                  {mySub.plan_name}
                </h2>
                <p className="text-xs sm:text-sm text-navy-600 mt-1 flex flex-wrap items-center gap-3">
                  <span>
                    Valid until: <strong>{formatDate(mySub.expiry_date)}</strong>
                  </span>
                  <span className="text-navy-300">•</span>
                  <span>
                    Remaining: <strong>{mySub.remaining_days} Days</strong>
                  </span>
                </p>
              </div>

              {/* Usage Stats Box */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="px-4 py-3 bg-white/90 rounded-2xl border border-emerald-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-navy-400 block">Listings Used</span>
                  <span className="text-xl font-extrabold text-navy-900">
                    {mySub.listings_used} <span className="text-xs text-navy-400 font-semibold">/ {mySub.listing_limit} max</span>
                  </span>
                  <div className="w-24 h-1.5 bg-navy-100 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (mySub.listings_used / Math.max(1, mySub.listing_limit)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="px-4 py-3 bg-white/90 rounded-2xl border border-emerald-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-navy-400 block">Search Visibility</span>
                  <span className="text-sm font-extrabold text-emerald-700 block mt-0.5">
                    {mySub.visibility_level} Tier
                  </span>
                  <span className="text-[10px] text-navy-500 font-medium">Rank Boost Active</span>
                </div>
              </div>
            </div>

            {/* Active Perks List */}
            <div className="mt-5 pt-5 border-t border-emerald-200/60 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-navy-700">Active Perks:</span>
              <span className="px-2.5 py-1 rounded-xl bg-white border border-emerald-200 text-navy-800 font-semibold">
                ✓ {mySub.listing_limit} Property Capacity
              </span>
              {mySub.premium_placement && (
                <span className="px-2.5 py-1 rounded-xl bg-amber-100 border border-amber-200 text-amber-900 font-semibold">
                  ★ Featured Placement
                </span>
              )}
              {mySub.account_manager && (
                <span className="px-2.5 py-1 rounded-xl bg-white border border-emerald-200 text-navy-800 font-semibold">
                  ✓ Relationship Manager
                </span>
              )}
              {mySub.phone_privacy && (
                <span className="px-2.5 py-1 rounded-xl bg-white border border-emerald-200 text-navy-800 font-semibold">
                  ✓ Phone Privacy Shield
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── 2. HERO HIGHLIGHT ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10 relative overflow-hidden rounded-[2rem] bg-navy-950 text-white shadow-xl"
      >
        <div className="absolute inset-0 z-0 opacity-20">
          <img
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2000"
            alt="Real Estate"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 to-transparent" />
        </div>

        <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                RealtyNow Listing Packages
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white leading-tight mb-3">
              Reach more serious buyers & maximize listing inquiries.
            </h2>
            <p className="text-navy-200 text-sm sm:text-base leading-relaxed">
              Flexible property listing plans with enhanced visibility, direct buyer connection, and verified lead management.
            </p>
          </div>

          <div className="hidden lg:flex items-center justify-center h-32 w-32 rounded-3xl bg-red-600/20 border border-red-500/30 text-red-400">
            <Building2 className="h-16 w-16 text-white" />
          </div>
        </div>
      </motion.div>

      {/* ─── 3. AVAILABLE PLANS COMPARISON GRID ─── */}
      <div className="mb-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-navy-900">
            Choose Your Listing Plan
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Pick from RealtyNow Starter, Growth, or Premium packages. Upgrade anytime.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {plans.map((plan, i) => {
            const isCurrent = mySub?.plan_id === plan.id;
            const isGrowth = plan.slug === 'growth';
            const isPremium = plan.slug === 'premium';

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`relative flex flex-col p-6 sm:p-8 rounded-3xl transition-all duration-300 bg-white shadow-md hover:shadow-xl ${
                  plan.is_popular
                    ? 'border-2 border-red-500 ring-4 ring-red-500/10'
                    : 'border border-navy-100'
                }`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                    <span className="bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider py-1 px-4 rounded-full shadow-md flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" /> MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    {isPremium ? (
                      <Crown className="h-5 w-5 text-amber-500" />
                    ) : isGrowth ? (
                      <Zap className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-slate-500" />
                    )}
                    <h3 className="font-display text-xl font-extrabold text-navy-900">{plan.name}</h3>
                  </div>

                  <p className="text-xs text-navy-500 leading-relaxed min-h-[36px]">
                    {plan.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-navy-50 flex items-baseline">
                    <span className="text-4xl font-display font-extrabold text-navy-900">
                      {plan.price === 0 ? 'Free' : `₹${Number(plan.price).toLocaleString('en-IN')}`}
                    </span>
                    {plan.price > 0 && <span className="text-xs text-navy-500 font-semibold ml-1">+ 18% GST</span>}
                  </div>

                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-navy-50 text-navy-700 text-xs font-bold">
                    <Calendar className="h-3.5 w-3.5 text-navy-400" />
                    {plan.validity_days} Days Listing Validity
                  </div>
                </div>

                {/* Feature Metric Highlights */}
                <div className="p-3 rounded-2xl bg-navy-50/70 border border-navy-100/70 mb-6 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-navy-400 block">Listings Allowed</span>
                    <span className="font-extrabold text-navy-900">{plan.listing_limit} Properties</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-navy-400 block">Search Visibility</span>
                    <span className="font-extrabold text-navy-900">{plan.visibility_level}</span>
                  </div>
                </div>

                {/* Feature Bullets List */}
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features_list.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs font-medium text-navy-700">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          plan.is_popular ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Action Button */}
                <div className="mt-auto pt-4 border-t border-navy-50">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-xs cursor-default flex items-center justify-center gap-2"
                    >
                      <Check className="h-4 w-4" /> Current Active Plan
                    </button>
                  ) : (
                    <RazorpayCheckout
                      planId={plan.id}
                      planName={plan.name}
                      amount={plan.price}
                      validityDays={plan.validity_days}
                      buttonText={plan.price === 0 ? 'Select Starter Plan' : `Choose ${plan.name}`}
                      className={`w-full py-3 rounded-xl font-extrabold text-xs shadow-md transition-all ${
                        plan.is_popular
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700'
                          : 'bg-navy-900 text-white hover:bg-navy-800'
                      }`}
                      onSuccess={handleSubscriptionSuccess}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ─── 4. SUBSCRIPTION HISTORY SECTION ─── */}
      {history.length > 0 && (
        <div className="bg-white rounded-3xl border border-navy-100 p-6 sm:p-8 shadow-sm">
          <h3 className="font-display text-xl font-extrabold text-navy-900 mb-4">
            Subscription History & Invoices
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50 text-navy-600 uppercase font-bold border-b border-navy-100">
                <tr>
                  <th className="px-4 py-3">Plan Name</th>
                  <th className="px-4 py-3">Amount Paid</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-700">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-navy-50/40 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-navy-900">
                      {record.plan?.name || 'RealtyNow Subscription'}
                    </td>
                    <td className="px-4 py-3.5">
                      {Number(record.amount_paid) === 0 ? 'Free' : `₹${Number(record.amount_paid).toLocaleString('en-IN')}`}
                    </td>
                    <td className="px-4 py-3.5 text-navy-600">{formatDate(record.start_date)}</td>
                    <td className="px-4 py-3.5 text-navy-600">{formatDate(record.expiry_date)}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          record.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export function PortalInvoices() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const sections = getPortalSections(t);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-invoices', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout sections={sections} title={t('portal.invoices', 'Invoices')}>
      <PageHeader
        title={t('portal.invoices', 'Invoices')}
        subtitle={t('portal.paymentHistory', 'Your payment history.')}
      />
      <Card className="divide-y divide-navy-50">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          data.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold text-navy-900">
                  {p.invoice_number ?? p.reference ?? t('portal.payment', 'Payment')}
                </p>
                <p className="text-xs text-navy-500">{formatDate(p.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-navy-900">{formatPrice(p.amount)}</span>
                <Badge variant={p.status === 'paid' ? 'success' : p.status === 'pending' ? 'warning' : 'error'}>
                  {p.status}
                </Badge>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title={t('portal.noInvoices', 'No invoices yet')}
            description={t('portal.invoicesAppearHere', 'Your payment history will appear here.')}
          />
        )}
      </Card>
    </DashboardLayout>
  );
}


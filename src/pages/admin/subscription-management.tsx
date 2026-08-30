import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Crown,
  Zap,
  Edit3,
  Plus,
  ToggleLeft,
  ToggleRight,
  Users,
  CreditCard,
  Calendar,
  Eye,
  Shield,
  Layers,
  Search,
  Check,
  X,
  TrendingUp,
  Package,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/dashboard-layout';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { getAdminSections } from '../portal/sections';
import { useToast } from '../../components/toast';
import {
  fetchSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  toggleSubscriptionPlanStatus,
  type SubscriptionPlan,
} from '../../lib/subscriptions';
import { formatNumber, formatDate } from '../../lib/utils';

export function AdminSubscriptionManagement() {
  const { t } = useLanguageContext();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const sections = getAdminSections(t);

  const [activeTab, setActiveTab] = useState<'plans' | 'subscribers'>('plans');
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // 1. Fetch Subscription Plans
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: () => fetchSubscriptionPlans(true),
  });

  // 2. Fetch Customer Subscriptions Audit Log
  const { data: customerSubs = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['admin-customer-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_subscriptions')
        .select(`
          *,
          plan:subscription_plans(name, slug, price, validity_days, listing_limit, visibility_level)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch customer subscriptions:', error);
        return [];
      }
      return data || [];
    },
  });

  // 3. Stats computation
  const totalActiveSubs = customerSubs.filter((s) => s.status === 'ACTIVE').length;
  const totalRevenue = customerSubs.reduce((acc, s) => acc + Number(s.amount_paid || 0), 0);
  const activePlansCount = plans.filter((p) => p.is_active).length;

  // Toggle Plan Status Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await toggleSubscriptionPlanStatus(id, isActive);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      addToast('success', 'Plan status updated successfully');
    },
    onError: (err: any) => {
      addToast('error', err?.message || 'Failed to update plan status');
    },
  });

  // Save/Update Plan Mutation
  const savePlanMutation = useMutation({
    mutationFn: async (planData: Partial<SubscriptionPlan>) => {
      if (planData.id) {
        return updateSubscriptionPlan(planData.id, planData);
      } else {
        return createSubscriptionPlan(planData as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      setIsCreateModalOpen(false);
      setEditingPlan(null);
      addToast('success', 'Subscription plan saved successfully');
    },
    onError: (err: any) => {
      addToast('error', err?.message || 'Failed to save subscription plan');
    },
  });

  const filteredPlans = plans.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.slug.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'active') return matchesSearch && p.is_active;
    if (statusFilter === 'inactive') return matchesSearch && !p.is_active;
    return matchesSearch;
  });

  return (
    <DashboardLayout sections={sections} title="Subscription Management">
      <div className="space-y-8 pb-16">
        {/* Header with Title and Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
                Subscription Plans Management
              </h1>
            </div>
            <p className="text-sm text-navy-500 mt-1">
              Configure RealtyNow Starter, Growth, and Premium packages, validity days, property listing limits, and visibility tiers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingPlan({
                  name: '',
                  slug: '',
                  description: '',
                  price: 0,
                  currency: 'INR',
                  tax_gst_pct: 18,
                  validity_days: 30,
                  listing_limit: 5,
                  enquiry_limit: 20,
                  visibility_level: 'Standard',
                  premium_placement: false,
                  photoshoot_support: false,
                  account_manager: false,
                  field_assistance: false,
                  phone_privacy: false,
                  features_list: ['Standard Listing Visibility', 'Property Management'],
                  display_order: plans.length + 1,
                  is_popular: false,
                  is_active: true,
                });
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create New Plan
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-navy-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-navy-500 uppercase tracking-wider">Active Subscriptions</p>
              <h3 className="text-2xl font-extrabold text-navy-900 mt-1">{totalActiveSubs}</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Real-time subscribers</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Users className="h-6 w-6" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-navy-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-navy-500 uppercase tracking-wider">Total Revenue</p>
              <h3 className="text-2xl font-extrabold text-navy-900 mt-1">₹{formatNumber(totalRevenue)}</h3>
              <p className="text-[11px] text-navy-500 font-semibold mt-0.5">Subscription billing</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-navy-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-navy-500 uppercase tracking-wider">Configured Plans</p>
              <h3 className="text-2xl font-extrabold text-navy-900 mt-1">{plans.length}</h3>
              <p className="text-[11px] text-navy-500 font-semibold mt-0.5">{activePlansCount} currently active</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <Layers className="h-6 w-6" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-navy-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-navy-500 uppercase tracking-wider">Pricing Architecture</p>
              <h3 className="text-xl font-extrabold text-navy-900 mt-1">Plan-Based</h3>
              <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Configurable Validity</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-navy-100">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'plans'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            Subscription Plans ({plans.length})
          </button>
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'subscribers'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            Subscriber Audit Log ({customerSubs.length})
          </button>
        </div>

        {activeTab === 'plans' ? (
          <>
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
                <input
                  type="text"
                  placeholder="Search plan name or slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-navy-200 rounded-xl text-xs font-semibold text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs font-bold text-navy-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-navy-200 rounded-xl text-xs font-bold text-navy-700 focus:outline-none focus:border-red-500"
                >
                  <option value="all">All Plans</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => {
                return (
                  <div
                    key={plan.id}
                    className={`rounded-3xl border transition-all duration-200 bg-white overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md ${
                      plan.is_popular ? 'border-red-300 ring-2 ring-red-500/20' : 'border-navy-100'
                    } ${!plan.is_active ? 'opacity-60 bg-slate-50' : ''}`}
                  >
                    {/* Card Top Banner */}
                    <div className="p-6 border-b border-navy-100 relative">
                      {plan.is_popular && (
                        <span className="absolute top-4 right-4 px-3 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                          POPULAR CHOICE
                        </span>
                      )}

                      <div className="flex items-center gap-2.5">
                        <div className={`p-2.5 rounded-2xl ${
                          plan.visibility_level === 'Premium'
                            ? 'bg-amber-100 text-amber-800'
                            : plan.visibility_level === 'Enhanced'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {plan.visibility_level === 'Premium' ? (
                            <Crown className="h-5 w-5" />
                          ) : plan.visibility_level === 'Enhanced' ? (
                            <Zap className="h-5 w-5" />
                          ) : (
                            <Package className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-display text-xl font-extrabold text-navy-900">{plan.name}</h3>
                          <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">
                            Slug: {plan.slug} · Order #{plan.display_order}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-navy-600 leading-relaxed line-clamp-2">
                        {plan.description || 'No description provided.'}
                      </p>

                      {/* Pricing and Validity */}
                      <div className="mt-4 pt-4 border-t border-navy-50 flex items-baseline justify-between">
                        <div>
                          <span className="text-3xl font-display font-extrabold text-navy-900">
                            {plan.price === 0 ? 'Free' : `₹${formatNumber(plan.price)}`}
                          </span>
                          {plan.price > 0 && <span className="text-xs text-navy-500 font-semibold ml-1">+ 18% GST</span>}
                        </div>
                        <div className="px-3 py-1 rounded-xl bg-navy-50 border border-navy-100 text-navy-700 text-xs font-bold flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-navy-400" />
                          {plan.validity_days} Days Validity
                        </div>
                      </div>
                    </div>

                    {/* Feature Highlights & Limits */}
                    <div className="p-6 space-y-4 flex-1">
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                        <div className="p-2.5 rounded-xl bg-navy-50/70 border border-navy-100/70">
                          <span className="text-navy-400 text-[10px] block uppercase">Listing Quota</span>
                          <span className="text-navy-900 font-extrabold text-sm">{plan.listing_limit} Properties</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-navy-50/70 border border-navy-100/70">
                          <span className="text-navy-400 text-[10px] block uppercase">Enquiry Cap</span>
                          <span className="text-navy-900 font-extrabold text-sm">{plan.enquiry_limit} Leads</span>
                        </div>
                      </div>

                      {/* Visibility and Services Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                          plan.visibility_level === 'Premium'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : plan.visibility_level === 'Enhanced'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}>
                          <Eye className="inline h-3 w-3 mr-1" /> {plan.visibility_level} Visibility
                        </span>

                        {plan.premium_placement && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            ★ Featured Placement
                          </span>
                        )}
                        {plan.account_manager && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            ✓ Relationship Mgr
                          </span>
                        )}
                        {plan.phone_privacy && (
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-bold">
                            <Shield className="inline h-2.5 w-2.5 mr-0.5" /> Privacy Shield
                          </span>
                        )}
                      </div>

                      {/* Marketing feature list */}
                      <div className="pt-2 border-t border-navy-50 space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-navy-400 block">
                          Included Benefits ({plan.features_list.length}):
                        </span>
                        {plan.features_list.slice(0, 4).map((f, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-navy-700 font-medium">
                            <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                            <span className="line-clamp-1">{f}</span>
                          </div>
                        ))}
                        {plan.features_list.length > 4 && (
                          <span className="text-[11px] text-navy-400 font-semibold">
                            +{plan.features_list.length - 4} more benefits
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-4 bg-navy-50/50 border-t border-navy-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleMutation.mutate({ id: plan.id, isActive: !plan.is_active })}
                          className={`p-2 rounded-xl transition-all cursor-pointer ${
                            plan.is_active
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                              : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                          }`}
                          title={plan.is_active ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {plan.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        <span className="text-xs font-bold text-navy-600">
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setEditingPlan(plan);
                          setIsCreateModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-navy-200 text-navy-700 font-bold text-xs shadow-xs hover:bg-navy-50 hover:text-navy-900 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit Plan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Subscribers Audit Table */
          <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-50/80 text-navy-600 uppercase font-bold border-b border-navy-100">
                  <tr>
                    <th className="px-5 py-3.5">Subscriber / Customer</th>
                    <th className="px-5 py-3.5">Plan Tier</th>
                    <th className="px-5 py-3.5">Amount Paid</th>
                    <th className="px-5 py-3.5">Start Date</th>
                    <th className="px-5 py-3.5">Expiry Date</th>
                    <th className="px-5 py-3.5">Usage</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50 font-medium text-navy-700">
                  {customerSubs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-navy-400">
                        No active subscriber records found.
                      </td>
                    </tr>
                  ) : (
                    customerSubs.map((sub) => (
                      <tr key={sub.id} className="hover:bg-navy-50/40 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-navy-900">{sub.customer_id.slice(0, 12)}...</p>
                          <span className="text-[10px] text-navy-400">ID: {sub.id.slice(0, 8)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-navy-900">{sub.plan?.name || 'RealtyNow Package'}</span>
                          <span className="block text-[10px] text-navy-400">{sub.plan?.validity_days || 30} Days Plan</span>
                        </td>
                        <td className="px-5 py-4 font-bold text-navy-900">
                          {Number(sub.amount_paid) === 0 ? 'Free' : `₹${formatNumber(sub.amount_paid)}`}
                        </td>
                        <td className="px-5 py-4 text-navy-600">{formatDate(sub.start_date)}</td>
                        <td className="px-5 py-4 text-navy-600">{formatDate(sub.expiry_date)}</td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-navy-900">{sub.listings_used || 0}</span>
                          <span className="text-navy-400"> / {sub.plan?.listing_limit || 5} Listings</span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              sub.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : sub.status === 'EXPIRING_SOON'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create / Edit Plan Modal */}
        {isCreateModalOpen && editingPlan && (
          <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full border border-navy-100 shadow-2xl p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-navy-100 pb-4 mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-navy-900">
                    {editingPlan.id ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
                  </h2>
                  <p className="text-xs text-navy-500 mt-0.5">
                    Configure pricing, validity duration, property quotas, and promotional features.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingPlan(null);
                  }}
                  className="p-2 rounded-xl text-navy-400 hover:text-navy-900 hover:bg-navy-50 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  savePlanMutation.mutate(editingPlan);
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-navy-700 block mb-1">Plan Name *</label>
                    <input
                      type="text"
                      required
                      value={editingPlan.name || ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      placeholder="e.g. RealtyNow Growth"
                      className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-semibold text-navy-900 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-navy-700 block mb-1">Slug Identifier *</label>
                    <input
                      type="text"
                      required
                      value={editingPlan.slug || ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      placeholder="e.g. growth"
                      className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-semibold text-navy-900 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-navy-700 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={editingPlan.description || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                    placeholder="Short marketing description of the target user..."
                    className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-medium text-navy-900 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-navy-700 block mb-1">Price (₹ INR) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editingPlan.price ?? 0}
                      onChange={(e) => setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-bold text-navy-900 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-navy-700 block mb-1">Validity (Days) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editingPlan.validity_days ?? 30}
                      onChange={(e) => setEditingPlan({ ...editingPlan, validity_days: parseInt(e.target.value) || 30 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-bold text-navy-900 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-navy-700 block mb-1">Display Order</label>
                    <input
                      type="number"
                      min={1}
                      value={editingPlan.display_order ?? 1}
                      onChange={(e) => setEditingPlan({ ...editingPlan, display_order: parseInt(e.target.value) || 1 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-bold text-navy-900 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-navy-700 block mb-1">Listing Limit *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editingPlan.listing_limit ?? 5}
                      onChange={(e) => setEditingPlan({ ...editingPlan, listing_limit: parseInt(e.target.value) || 5 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-bold text-navy-900 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-navy-700 block mb-1">Enquiry Limit *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editingPlan.enquiry_limit ?? 20}
                      onChange={(e) => setEditingPlan({ ...editingPlan, enquiry_limit: parseInt(e.target.value) || 20 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-bold text-navy-900 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-navy-700 block mb-1">Visibility Level *</label>
                    <select
                      value={editingPlan.visibility_level || 'Standard'}
                      onChange={(e: any) => setEditingPlan({ ...editingPlan, visibility_level: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-bold text-navy-900 focus:outline-none focus:border-red-500"
                    >
                      <option value="Standard">Standard Visibility</option>
                      <option value="Enhanced">Enhanced Visibility</option>
                      <option value="Premium">Premium Visibility</option>
                    </select>
                  </div>
                </div>

                {/* Service Feature Toggles */}
                <div className="p-4 rounded-2xl bg-navy-50/60 border border-navy-100 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-navy-600 block">
                    Promotional & Managed Service Toggles
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPlan.premium_placement)}
                        onChange={(e) => setEditingPlan({ ...editingPlan, premium_placement: e.target.checked })}
                        className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span>Featured / Priority Placement Badge</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPlan.account_manager)}
                        onChange={(e) => setEditingPlan({ ...editingPlan, account_manager: e.target.checked })}
                        className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span>Dedicated Relationship Manager</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPlan.photoshoot_support)}
                        onChange={(e) => setEditingPlan({ ...editingPlan, photoshoot_support: e.target.checked })}
                        className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span>Photoshoot & Media Assistance</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPlan.field_assistance)}
                        onChange={(e) => setEditingPlan({ ...editingPlan, field_assistance: e.target.checked })}
                        className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span>Field & Showing Assistance</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPlan.phone_privacy)}
                        onChange={(e) => setEditingPlan({ ...editingPlan, phone_privacy: e.target.checked })}
                        className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span>Privacy Shield (Phone Masking)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingPlan.is_popular)}
                        onChange={(e) => setEditingPlan({ ...editingPlan, is_popular: e.target.checked })}
                        className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span>Highlight as "Most Popular"</span>
                    </label>
                  </div>
                </div>

                {/* Features List Bullet Points */}
                <div>
                  <label className="text-xs font-bold text-navy-700 block mb-1">
                    Marketing Features (One per line)
                  </label>
                  <textarea
                    rows={4}
                    value={Array.isArray(editingPlan.features_list) ? editingPlan.features_list.join('\n') : ''}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        features_list: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="5 Property Listings&#10;30 Days Validity&#10;Standard Reach"
                    className="w-full px-3.5 py-2 rounded-xl border border-navy-200 text-xs font-medium text-navy-900 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setEditingPlan(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white border border-navy-200 text-navy-700 font-bold text-xs hover:bg-navy-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savePlanMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {savePlanMutation.isPending ? 'Saving...' : 'Save Plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

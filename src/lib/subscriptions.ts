import { supabase } from './supabase';

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  tax_gst_pct: number;
  validity_days: number;
  listing_limit: number;
  enquiry_limit: number;
  visibility_level: 'Standard' | 'Enhanced' | 'Premium';
  premium_placement: boolean;
  photoshoot_support: boolean;
  account_manager: boolean;
  field_assistance: boolean;
  phone_privacy: boolean;
  features_list: string[];
  display_order: number;
  is_popular: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerSubscription {
  id: string;
  customer_id: string;
  plan_id: string;
  amount_paid: number;
  currency: string;
  start_date: string;
  expiry_date: string;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'CANCELLED' | 'PAYMENT_FAILED';
  listings_used: number;
  enquiries_used: number;
  auto_renew: boolean;
  plan?: SubscriptionPlan;
  created_at: string;
}

export interface ActiveSubscriptionSummary {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  plan_slug: string;
  status: string;
  amount_paid: number;
  currency: string;
  start_date: string;
  expiry_date: string;
  remaining_days: number;
  listing_limit: number;
  listings_used: number;
  enquiry_limit: number;
  enquiries_used: number;
  visibility_level: 'Standard' | 'Enhanced' | 'Premium';
  premium_placement: boolean;
  photoshoot_support: boolean;
  account_manager: boolean;
  field_assistance: boolean;
  phone_privacy: boolean;
  features_list: string[];
}

export interface SubscriptionPaymentRecord {
  id: string;
  subscription_id: string | null;
  customer_id: string;
  plan_id: string;
  payment_gateway: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  plan?: SubscriptionPlan;
}

/**
 * Built-in default plans adhering to RealtyNow monetization architecture
 */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter_plan_default',
    name: 'RealtyNow Starter',
    slug: 'starter',
    description: 'Perfect for individual property owners and first-time sellers listing single or few units.',
    price: 0,
    currency: 'INR',
    tax_gst_pct: 18,
    validity_days: 30,
    listing_limit: 5,
    enquiry_limit: 10,
    visibility_level: 'Standard',
    premium_placement: false,
    photoshoot_support: false,
    account_manager: false,
    field_assistance: false,
    phone_privacy: false,
    features_list: [
      'Up to 5 Property Listings',
      '30 Days Active Validity',
      'Standard Search Rank Visibility',
      'Direct Buyer Messaging',
      'Real-Time Dashboard Analytics',
      'Community & Help Center Support'
    ],
    display_order: 1,
    is_popular: false,
    is_active: true,
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
  },
  {
    id: 'growth_plan_default',
    name: 'RealtyNow Growth',
    slug: 'growth',
    description: 'Designed for active landlords, independent agents, and investors seeking higher buyer conversion.',
    price: 1999,
    currency: 'INR',
    tax_gst_pct: 18,
    validity_days: 30,
    listing_limit: 15,
    enquiry_limit: 50,
    visibility_level: 'Enhanced',
    premium_placement: false,
    photoshoot_support: false,
    account_manager: true,
    field_assistance: false,
    phone_privacy: true,
    features_list: [
      'Up to 15 Property Listings',
      '30 Days Active Validity',
      'Enhanced Search Rank Boost (+15 Score)',
      '50 Verified Buyer Enquiries',
      'Dedicated Relationship Manager',
      'Instant SMS & WhatsApp Lead Alerts',
      'Phone Privacy Shield Protection'
    ],
    display_order: 2,
    is_popular: true,
    is_active: true,
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
  },
  {
    id: 'premium_plan_default',
    name: 'RealtyNow Premium',
    slug: 'premium',
    description: 'Maximum visibility and priority placement for professional brokers, multi-unit owners, and developers.',
    price: 4999,
    currency: 'INR',
    tax_gst_pct: 18,
    validity_days: 30,
    listing_limit: 50,
    enquiry_limit: 200,
    visibility_level: 'Premium',
    premium_placement: true,
    photoshoot_support: true,
    account_manager: true,
    field_assistance: true,
    phone_privacy: true,
    features_list: [
      'Up to 50 Property Listings',
      '30 Days Active Validity',
      'Premium Search Priority & Featured Badging',
      'Unlimited Buyer Lead Access',
      'Senior Relationship Manager',
      'Professional HD Photoshoot Support',
      'Field & On-site Verification Assistance',
      'Priority Customer Care (24/7)'
    ],
    display_order: 3,
    is_popular: false,
    is_active: true,
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
  },
];

/**
 * Fetch all active public plans (or all plans for admin) with immediate fallback
 */
export async function fetchSubscriptionPlans(includeInactive = false): Promise<SubscriptionPlan[]> {
  try {
    let query = supabase.from('subscription_plans').select('*').order('display_order', { ascending: true });
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return includeInactive ? DEFAULT_SUBSCRIPTION_PLANS : DEFAULT_SUBSCRIPTION_PLANS.filter((p) => p.is_active);
    }
    return (data || []).map((row) => ({
      ...row,
      price: Number(row.price || 0),
      tax_gst_pct: Number(row.tax_gst_pct || 18),
      features_list: Array.isArray(row.features_list) ? row.features_list : [],
    }));
  } catch {
    return includeInactive ? DEFAULT_SUBSCRIPTION_PLANS : DEFAULT_SUBSCRIPTION_PLANS.filter((p) => p.is_active);
  }
}

/**
 * Fetch active subscription summary for a given customer
 */
export async function fetchActiveCustomerSubscription(userId: string): Promise<ActiveSubscriptionSummary | null> {
  if (!userId) return null;

  try {
    // 1. Try DB RPC
    const { data, error } = await supabase.rpc('get_active_customer_subscription', {
      p_customer_id: userId,
    });

    if (!error && data && data.length > 0) {
      const row = data[0];
      return {
        subscription_id: row.subscription_id,
        plan_id: row.plan_id,
        plan_name: row.plan_name,
        plan_slug: row.plan_slug,
        status: row.status,
        amount_paid: Number(row.amount_paid || 0),
        currency: row.currency || 'INR',
        start_date: row.start_date,
        expiry_date: row.expiry_date,
        remaining_days: Number(row.remaining_days || 0),
        listing_limit: Number(row.listing_limit || 5),
        listings_used: Number(row.listings_used || 0),
        enquiry_limit: Number(row.enquiry_limit || 20),
        enquiries_used: Number(row.enquiries_used || 0),
        visibility_level: row.visibility_level || 'Standard',
        premium_placement: Boolean(row.premium_placement),
        photoshoot_support: Boolean(row.photoshoot_support),
        account_manager: Boolean(row.account_manager),
        field_assistance: Boolean(row.field_assistance),
        phone_privacy: Boolean(row.phone_privacy),
        features_list: Array.isArray(row.features_list) ? row.features_list : [],
      };
    }

    // 2. Direct table fallback query
    const { data: directData } = await supabase
      .from('customer_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('customer_id', userId)
      .eq('status', 'ACTIVE')
      .gt('expiry_date', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (directData && directData.plan) {
      const plan = directData.plan;
      const expiry = new Date(directData.expiry_date);
      const now = new Date();
      const remainingDays = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      const { count: propertyCount } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .neq('status', 'draft');

      return {
        subscription_id: directData.id,
        plan_id: plan.id,
        plan_name: plan.name,
        plan_slug: plan.slug,
        status: remainingDays <= 5 ? 'EXPIRING_SOON' : 'ACTIVE',
        amount_paid: Number(directData.amount_paid || 0),
        currency: directData.currency || 'INR',
        start_date: directData.start_date,
        expiry_date: directData.expiry_date,
        remaining_days: remainingDays,
        listing_limit: plan.listing_limit,
        listings_used: propertyCount || 0,
        enquiry_limit: plan.enquiry_limit,
        enquiries_used: directData.enquiries_used || 0,
        visibility_level: plan.visibility_level || 'Standard',
        premium_placement: Boolean(plan.premium_placement),
        photoshoot_support: Boolean(plan.photoshoot_support),
        account_manager: Boolean(plan.account_manager),
        field_assistance: Boolean(plan.field_assistance),
        phone_privacy: Boolean(plan.phone_privacy),
        features_list: Array.isArray(plan.features_list) ? plan.features_list : [],
      };
    }

    // 3. No localStorage fallback: the active subscription must always reflect
    //    the authoritative server state. A client-cached (or user-editable)
    //    "active" record here would let a session appear entitled without a
    //    real, server-verified subscription.

    return null;
  } catch (err) {
    console.error('Error in fetchActiveCustomerSubscription:', err);
    return null;
  }
}

/**
 * Fetch customer subscription history
 */
export async function fetchCustomerSubscriptionHistory(userId: string): Promise<CustomerSubscription[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('customer_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }
    return (data || []).map((row) => ({
      ...row,
      amount_paid: Number(row.amount_paid || 0),
    }));
  } catch {
    return [];
  }
}

/**
 * Create a new plan from Admin Panel
 */
export async function createSubscriptionPlan(
  plan: Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>
): Promise<SubscriptionPlan | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .insert([plan])
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create subscription plan:', error);
    throw error;
  }
  return data;
}

/**
 * Update an existing plan from Admin Panel
 */
export async function updateSubscriptionPlan(
  id: string,
  updates: Partial<SubscriptionPlan>
): Promise<SubscriptionPlan | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Failed to update subscription plan:', error);
    throw error;
  }
  return data;
}

/**
 * Toggle plan active status
 */
export async function toggleSubscriptionPlanStatus(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('subscription_plans')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Failed to toggle plan status:', error);
    throw error;
  }
}

/**
 * Activate subscription upon confirmed payment.
 *
 * SECURITY (audit finding, closes the self-grant + client-supplied-amount hole):
 * This no longer calls the `activate_subscription_payment` RPC directly from
 * the browser. A browser session cannot mint its own subscription — the amount
 * would be client-supplied and fabricated order/payment ids could be passed.
 * Instead the caller must submit the REAL Razorpay order/payment/signature ids
 * from a successful checkout to the `payment-gateway` edge function, which,
 * under the service key, verifies the Razorpay HMAC signature, recomputes the
 * amount from the server-side plan price, and only then performs activation.
 */
export async function activateSubscription(
  userId: string,
  planId: string,
  opts: {
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    razorpaySignature?: string;
  } = {}
): Promise<string> {
  const { gatewayOrderId, gatewayPaymentId, razorpaySignature } = opts;

  // Free plans still route through the server so activation is never a purely
  // client-side decision; the edge function treats a 0-price plan as "Free"
  // (no signature required) and a paid plan as requiring a verified signature.
  const { data, error } = await supabase.functions.invoke('payment-gateway', {
    headers: { 'x-action': 'subscription-activate' },
    body: {
      plan_id: planId,
      razorpay_order_id: gatewayOrderId || null,
      razorpay_payment_id: gatewayPaymentId || null,
      razorpay_signature: razorpaySignature || null,
    },
  });

  if (error) {
    console.error('subscription activation failed:', error.message);
    throw new Error(`Subscription activation requires a verified payment (${error.message})`);
  }

  const subId = (data as { subscription_id?: string })?.subscription_id;
  if (!subId) {
    throw new Error('Subscription activation returned no subscription id');
  }

  return subId;
}

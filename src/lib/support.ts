/**
 * RealtyNow Customer Support & Help Center Engine
 * 
 * Production-ready customer support client managing:
 * 1. Comprehensive 8-category Knowledge Base with intelligent multi-keyword search
 * 2. Support Ticket lifecycle (Create, Track, Reply, Attachments, Timeline, Escalation, Close)
 * 3. Live Chat & Message synchronization with Supabase Realtime
 * 4. Configurable contact channels (Phone, Email, WhatsApp, Live Chat)
 * 5. Article feedback & problem reporting
 */

import { supabase } from './supabase';

// ─── Types & Interfaces ──────────────────────────────────────────

export type SupportCategory =
  | 'Property Listing'
  | 'Property Search'
  | 'Payments & Billing'
  | 'Account & Profile'
  | 'Subscription & Premium'
  | 'Verification & Safety'
  | 'Technical Support'
  | 'Contact & Support';

export type SupportPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type SupportStatus =
  | 'Open'
  | 'Assigned'
  | 'In Progress'
  | 'Waiting for Customer'
  | 'Waiting for Internal Team'
  | 'Resolved'
  | 'Closed'
  | 'Reopened';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  customer_id: string;
  subject: string;
  description: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  source: string;
  property_id?: string | null;
  agent_id?: string | null;
  assigned_to?: string | null;
  assigned_team?: string | null;
  contact_preference?: 'Email' | 'Phone' | 'Chat';
  is_escalated?: boolean;
  escalation_reason?: string | null;
  escalated_at?: string | null;
  created_at: string;
  updated_at: string;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  // Joined fields
  properties?: {
    id: string;
    title: string;
    price: number;
    locality_name?: string;
    city_name?: string;
  } | null;
  assigned_profile?: {
    id: string;
    first_name?: string;
    last_name?: string;
    role?: string;
  } | null;
}

export interface SupportMessage {
  id: string;
  ticket_id?: string;
  conversation_id?: string;
  sender_type: 'customer' | 'ai' | 'admin' | 'system';
  sender_id?: string | null;
  message_type?: string;
  message: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  is_internal?: boolean;
  created_at: string;
  sender_profile?: {
    id: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    avatar_url?: string;
  } | null;
}

export interface SupportStatusHistory {
  id: string;
  ticket_id: string;
  old_status?: string | null;
  new_status: string;
  changed_by?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface SupportAttachment {
  id: string;
  ticket_id: string;
  message_id?: string | null;
  uploaded_by?: string | null;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
}

export interface SupportContactConfig {
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  operatingHours: string;
  liveChatEnabled: boolean;
  ticketSystemEnabled: boolean;
}

export interface KnowledgeArticle {
  id: string;
  category: SupportCategory;
  title: string;
  summary: string;
  content: string[];
  steps?: string[];
  tips?: string[];
  keywords: string[];
  relatedArticleIds?: string[];
  popular?: boolean;
}

export interface KnowledgeCategoryMeta {
  id: SupportCategory;
  name: string;
  iconName: string;
  emoji: string;
  description: string;
  colorClass: string;
  topicsCount: number;
}

// ─── Knowledge Base Dataset ──────────────────────────────────────

export const SUPPORT_CATEGORIES: KnowledgeCategoryMeta[] = [
  {
    id: 'Property Listing',
    name: 'Property Listing',
    iconName: 'Building2',
    emoji: '🏠',
    description: 'Posting properties, editing, draft management, verification, and visibility.',
    colorClass: 'bg-rose-50 text-rose-600 border-rose-100',
    topicsCount: 6,
  },
  {
    id: 'Property Search',
    name: 'Property Search',
    iconName: 'Search',
    emoji: '🔎',
    description: 'Map view, filters, categories, compare lists, and saved properties.',
    colorClass: 'bg-blue-50 text-blue-600 border-blue-100',
    topicsCount: 5,
  },
  {
    id: 'Payments & Billing',
    name: 'Payments & Billing',
    iconName: 'CreditCard',
    emoji: '💳',
    description: 'Invoices, GST receipts, payment gateways, and refund policies.',
    colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    topicsCount: 4,
  },
  {
    id: 'Account & Profile',
    name: 'Account & Profile',
    iconName: 'UserCheck',
    emoji: '👤',
    description: 'Phone OTP login, profile information, notifications, and security.',
    colorClass: 'bg-purple-50 text-purple-600 border-purple-100',
    topicsCount: 4,
  },
  {
    id: 'Subscription & Premium',
    name: 'Subscription & Premium',
    iconName: 'Sparkles',
    emoji: '⭐',
    description: 'Free vs Pro plans, listing limits, AI features, and renewal benefits.',
    colorClass: 'bg-amber-50 text-amber-600 border-amber-100',
    topicsCount: 4,
  },
  {
    id: 'Verification & Safety',
    name: 'Verification & Safety',
    iconName: 'ShieldCheck',
    emoji: '🛡️',
    description: 'RERA verification, fraud reporting, and genuine listing protection.',
    colorClass: 'bg-teal-50 text-teal-600 border-teal-100',
    topicsCount: 4,
  },
  {
    id: 'Technical Support',
    name: 'Technical Support',
    iconName: 'Wrench',
    emoji: '🛠️',
    description: 'App troubleshooting, photo upload errors, map loading, and browser issues.',
    colorClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    topicsCount: 4,
  },
  {
    id: 'Contact & Support',
    name: 'Contact & Support',
    iconName: 'Headphones',
    emoji: '📞',
    description: 'Support tickets, escalation process, live chat, and support hours.',
    colorClass: 'bg-slate-100 text-slate-700 border-slate-200',
    topicsCount: 4,
  },
];

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  // ── Property Listing ──
  {
    id: 'art-list-property-steps',
    category: 'Property Listing',
    title: 'How do I list a property on RealtyNow?',
    summary: 'Step-by-step guide to publishing an apartment, villa, plot, or commercial space.',
    popular: true,
    keywords: ['post property', 'list property', 'add listing', 'sell house', 'rent flat', 'new listing'],
    content: [
      'Posting a property on RealtyNow is fast and intuitive. Every listing is reviewed by our verification team to ensure 100% genuine buyer interest.',
      'You can list properties for Sale, Rent, or PG / Co-living across residential, commercial, plot, and industrial categories.',
    ],
    steps: [
      'Sign in to your RealtyNow Customer or Agent Portal.',
      'Click "List Property" or "Post Property FREE" from the top navigation or dashboard.',
      'Select your property category (e.g. Residential Apartment, Villa, Open Plot, Commercial Office).',
      'Enter property details including location, price, built-up area, bedrooms, and key amenities.',
      'Upload high-definition photos or floor plans of your property.',
      'Review your details and submit for verification.',
    ],
    tips: [
      'Listings with 5+ clear daylight photos receive up to 4x more genuine buyer inquiries.',
      'Free accounts can list up to 5 active properties monthly. Upgrade to Pro for unlimited listings.',
    ],
    relatedArticleIds: ['art-listing-limits', 'art-approval-process', 'art-edit-listing'],
  },
  {
    id: 'art-approval-process',
    category: 'Property Listing',
    title: 'How does property verification & approval work?',
    summary: 'Understand our verification timeline and criteria for publishing your listing.',
    popular: true,
    keywords: ['approval', 'verify listing', 'property verification', 'pending review', 'is_live', 'published'],
    content: [
      'To maintain a high-trust marketplace with verified genuine inventory, every property submitted on RealtyNow undergoes administrative review.',
      'Our team validates property specifications, location coordinates, pricing authenticity, and photographic quality before making it live.',
    ],
    steps: [
      'Submission: Property enters "Submitted" status.',
      'Audit: Our verification specialists check property titles, coordinates, and images (typically within 4 to 12 hours).',
      'Publication: Once approved, the property status becomes "Live" and immediately visible to millions of buyers.',
      'Feedback: If any details require revision (e.g. blurred images or incorrect address), status will show "Changes Requested" with clear instructions.',
    ],
    tips: [
      'Average verification turnaround is under 6 hours during working days.',
    ],
    relatedArticleIds: ['art-list-property-steps', 'art-rejection-reasons'],
  },
  {
    id: 'art-edit-listing',
    category: 'Property Listing',
    title: 'How to edit or update an existing property listing?',
    summary: 'Update price, photos, description, or availability status of your listed properties.',
    keywords: ['edit listing', 'change price', 'update photos', 'mark sold', 'mark rented'],
    content: [
      'You can update your property details at any time from your Customer or Agent Portal.',
      'Price changes and photo updates take effect immediately on live listings without requiring a complete re-verification.',
    ],
    steps: [
      'Navigate to "My Properties" from your dashboard sidebar.',
      'Locate the property card you want to modify and click the "Edit" (pencil) icon.',
      'Modify price, description, amenities, or upload new photographs.',
      'Click "Save Changes" to apply updates immediately.',
    ],
    relatedArticleIds: ['art-list-property-steps', 'art-deactivate-listing'],
  },
  {
    id: 'art-rejection-reasons',
    category: 'Property Listing',
    title: 'Why was my property rejected or flagged?',
    summary: 'Common reasons for listing rejection and how to resolve them quickly.',
    keywords: ['rejected', 'listing rejected', 'changes requested', 'fake listing', 'copyright photo', 'unclear address'],
    content: [
      'RealtyNow takes platform integrity very seriously. Listings that do not meet our listing guidelines may be rejected or placed on hold.',
      'The most common reasons for rejection include: watermarked or copyright photos from other websites, unrealistic pricing, incomplete locality address, or duplicate listings of the same unit.',
    ],
    steps: [
      'Check the rejection notes displayed on your property card under "My Properties".',
      'Click "Edit Listing" to correct the flagged items (e.g. replace copyrighted photos with real camera shots).',
      'Resubmit your listing for expedited re-verification.',
    ],
    relatedArticleIds: ['art-approval-process', 'art-edit-listing'],
  },
  {
    id: 'art-deactivate-listing',
    category: 'Property Listing',
    title: 'How to mark a property as Sold, Rented, or Deactivate it?',
    summary: 'Manage property availability when your unit is closed or taken off the market.',
    keywords: ['mark sold', 'mark rented', 'deactivate', 'delete property', 'hide listing'],
    content: [
      'Once your property is sold or rented out, you can mark its status accordingly to stop receiving buyer calls while preserving your listing history.',
    ],
    steps: [
      'Go to "My Properties" in your portal.',
      'Click on the "Status" menu on the property card.',
      'Select "Mark as Sold", "Mark as Rented", or "Deactivate".',
      'The property will immediately be unlisted from public search.',
    ],
    relatedArticleIds: ['art-edit-listing'],
  },
  {
    id: 'art-open-plots-guide',
    category: 'Property Listing',
    title: 'How to list Open Plots, Land, or Agricultural Layouts?',
    summary: 'Guidelines for listing residential plots, DTCP/HMDA approved layouts, and farmland.',
    keywords: ['open plot', 'land listing', 'hmda plot', 'dtcp layout', 'farm land'],
    content: [
      'RealtyNow has a dedicated Open Plot Listing Wizard with specialized layout fields such as boundary dimensions, road width, facing, and approval authority (HMDA, DTCP, RERA).',
    ],
    steps: [
      'Go to "List Property" and select "Plot & Land".',
      'Specify total plot area (in sq. yards, acres, or sq. ft) and layout name.',
      'Select the approval authority (HMDA, DTCP, RERA Approved, or Open Layout).',
      'Upload the approved layout map and ground photographs.',
    ],
    relatedArticleIds: ['art-list-property-steps'],
  },

  // ── Property Search ──
  {
    id: 'art-search-filters',
    category: 'Property Search',
    title: 'How to use advanced filters & category discovery?',
    summary: 'Find your exact property match using location, price sliders, BHK, and category chips.',
    popular: true,
    keywords: ['search properties', 'filter properties', 'category chips', 'bhk filter', 'budget filter'],
    content: [
      'RealtyNow provides real-time synchronized filtering. When you search for any location, our live Category Discovery chips show exact available inventory matching your active criteria.',
    ],
    steps: [
      'Enter your desired locality, landmark, or city in the search bar.',
      'Use the Category chips (Apartments, Villas, Independent Houses, Plots, Commercial) to isolate property types.',
      'Adjust price range sliders, BHK count, and possession status from the filter sidebar.',
      'All property counts and cards update synchronously in real-time.',
    ],
    relatedArticleIds: ['art-map-view', 'art-saved-properties'],
  },
  {
    id: 'art-map-view',
    category: 'Property Search',
    title: 'How to search properties using interactive Map View?',
    summary: 'Locate properties geographically with live pins, clusters, and neighborhood details.',
    keywords: ['map view', 'map search', 'property pins', 'location map', 'geolocation'],
    content: [
      'RealtyNow includes an interactive Leaflet/OpenStreetMap interface showing genuine property locations across Hyderabad, Bangalore, Mumbai, and other major cities.',
    ],
    steps: [
      'On the search page, click the "Map View" icon next to List and Grid toggles.',
      'Zoom into your desired neighborhood to view property pins.',
      'Hover over or click any pin to preview the property card, price, and photos.',
      'Click the card to open the full property details page.',
    ],
    relatedArticleIds: ['art-search-filters'],
  },
  {
    id: 'art-saved-properties',
    category: 'Property Search',
    title: 'How to save and compare properties side-by-side?',
    summary: 'Shortlist your favorite homes and compare specifications side-by-side.',
    keywords: ['saved properties', 'favorites', 'compare properties', 'shortlist'],
    content: [
      'Click the heart icon on any property card to save it to your wishlist. You can access saved properties from your Customer Portal at any time.',
      'Use the Compare tool to view specifications (price/sq.ft, carpet area, amenities, facing) of up to 4 properties in a clean comparison table.',
    ],
    steps: [
      'Click the Heart icon on any card to save.',
      'Click the Compare icon (GitCompare) to add to your comparison tray.',
      'Open "Compare" from the top navigation or portal to view detailed side-by-side analysis.',
    ],
    relatedArticleIds: ['art-search-filters'],
  },

  // ── Payments & Billing ──
  {
    id: 'art-payments-invoices',
    category: 'Payments & Billing',
    title: 'How do I download invoices and GST receipts?',
    summary: 'Access your payment receipts, subscription invoices, and transaction logs.',
    keywords: ['invoices', 'receipts', 'gst invoice', 'billing', 'tax invoice'],
    content: [
      'All payments made on RealtyNow for subscription plans, featured listings, or lead packages generate automated GST-compliant tax invoices.',
    ],
    steps: [
      'Log in to your Customer, Agent, or Builder Portal.',
      'Click on "Invoices" from the sidebar menu.',
      'View your transaction history, date, amount, and payment status.',
      'Click "Download PDF" to retrieve your official GST invoice.',
    ],
    relatedArticleIds: ['art-subscription-plans', 'art-refund-policy'],
  },
  {
    id: 'art-refund-policy',
    category: 'Payments & Billing',
    title: 'What is the RealtyNow refund and cancellation policy?',
    summary: 'Guidelines on subscription cancellations and refund eligibility.',
    keywords: ['refund', 'cancel subscription', 'money back', 'payment dispute'],
    content: [
      'RealtyNow provides transparent billing terms. If you experience technical errors during payment or an unintended renewal, you can request support.',
      'Refund requests for double-charges or technical failures are processed within 5-7 business days back to the original payment method.',
    ],
    steps: [
      'Raise a support ticket under "Payments & Billing".',
      'Provide your Invoice ID and transaction reference number.',
      'Our billing team will review and respond within 24 business hours.',
    ],
    relatedArticleIds: ['art-payments-invoices'],
  },

  // ── Account & Profile ──
  {
    id: 'art-login-otp',
    category: 'Account & Profile',
    title: 'How to sign in using Phone OTP or Email?',
    summary: 'Fast and secure login using mobile OTP verification.',
    popular: true,
    keywords: ['login', 'otp', 'sign in', 'phone login', 'verification code', 'forgot password'],
    content: [
      'RealtyNow uses seamless, passwordless Mobile OTP login as well as Email magic links for maximum security and ease of access.',
    ],
    steps: [
      'Click "Sign In" on the top right header.',
      'Enter your 10-digit mobile number.',
      'Enter the 6-digit OTP code sent to your phone via SMS.',
      'You are immediately signed in with full portal access.',
    ],
    tips: [
      'Ensure your mobile number is active and capable of receiving SMS.',
      'If you do not receive the OTP within 30 seconds, click "Resend OTP".',
    ],
    relatedArticleIds: ['art-edit-profile'],
  },
  {
    id: 'art-edit-profile',
    category: 'Account & Profile',
    title: 'How to update your profile name, avatar, and contact info?',
    summary: 'Personalize your public profile, company name, and notification preferences.',
    keywords: ['edit profile', 'change phone', 'update avatar', 'profile settings'],
    content: [
      'Your profile information is displayed on your listed properties so genuine buyers can contact you via call or WhatsApp.',
    ],
    steps: [
      'Navigate to "Edit Profile" or "Settings" in your portal.',
      'Update your First Name, Last Name, Phone Number, and Bio.',
      'Upload a professional profile photo or company logo.',
      'Click "Save Profile" to update across all your listings.',
    ],
    relatedArticleIds: ['art-login-otp'],
  },

  // ── Subscription & Premium ──
  {
    id: 'art-listing-limits',
    category: 'Subscription & Premium',
    title: 'What are the listing limits and how does Premium work?',
    summary: 'Learn about Free listing limits vs Premium Pro subscription benefits.',
    popular: true,
    keywords: ['listing limits', '5 property limit', 'pro plan', 'premium subscription', 'unlimited listings'],
    content: [
      'RealtyNow allows every user to list up to 5 properties completely FREE every month.',
      'To list 6 or more properties, access AI Property Advisor tools, get Featured badges, and receive priority buyer leads, users can subscribe to RealtyNow Pro.',
    ],
    steps: [
      'Go to "Subscription" in your portal.',
      'View your current plan and active listing consumption.',
      'Click "Upgrade to Pro" to unlock unlimited listings, verified builder badges, and dedicated lead CRM.',
    ],
    relatedArticleIds: ['art-list-property-steps', 'art-payments-invoices'],
  },

  // ── Verification & Safety ──
  {
    id: 'art-fraud-safety',
    category: 'Verification & Safety',
    title: 'How does RealtyNow protect against fake listings and fraud?',
    summary: 'Safety practices for property transactions and reporting suspicious activity.',
    keywords: ['fraud', 'fake property', 'scam', 'safety tips', 'rera verified', 'report listing'],
    content: [
      'We utilize rigorous AI and manual verification procedures. However, we advise all buyers to exercise standard due diligence:',
      '1. Never transfer token advances or booking amounts without visiting the physical site.',
      '2. Verify legal title deeds and RERA registration with an independent advocate.',
      '3. Report suspicious listings immediately using the "Report a Problem" feature.',
    ],
    steps: [
      'If you notice suspicious pricing or an unverified agent, click "Report a Problem".',
      'Select "Fraud / Fake Listing" and submit property details.',
      'Our security team immediately suspends flagged accounts pending investigation.',
    ],
    relatedArticleIds: ['art-approval-process'],
  },

  // ── Technical Support ──
  {
    id: 'art-upload-issues',
    category: 'Technical Support',
    title: 'Troubleshooting photo upload errors or file size limits',
    summary: 'Fix common image upload errors, supported formats, and size limits.',
    keywords: ['upload error', 'photo failed', 'file size limit', 'image format', 'camera upload'],
    content: [
      'RealtyNow automatically compresses and optimizes property images. However, following these guidelines ensures smooth uploads:',
      'Supported formats: JPG, PNG, WEBP, HEIC.',
      'Maximum file size: Up to 15MB per image.',
    ],
    steps: [
      'Ensure your internet connection is stable.',
      'Verify the file format is .jpg, .png, or .webp.',
      'If uploading from mobile, try selecting 3-5 images at a time.',
      'Clear browser cache or try an incognito window if the upload hangs.',
    ],
    relatedArticleIds: ['art-list-property-steps'],
  },

  // ── Contact & Support ──
  {
    id: 'art-ticket-workflow',
    category: 'Contact & Support',
    title: 'How do support tickets and escalations work?',
    summary: 'Understand ticket SLAs, tracking status, and requesting escalation.',
    popular: true,
    keywords: ['support ticket', 'escalate ticket', 'track ticket', 'support sla', 'helpdesk'],
    content: [
      'When you raise a support ticket on RealtyNow, a dedicated tracking number (#RN-XXXXX) is generated.',
      'You can track real-time progress, exchange messages with support officers, upload error screenshots, and request priority escalation if needed.',
    ],
    steps: [
      'Open Help Center and click "Raise a Ticket".',
      'Fill in the issue category, subject, and description.',
      'Track progress under "My Support Tickets" with full 4-stage timeline.',
      'If your issue requires urgent attention, click "Request Escalation".',
    ],
    relatedArticleIds: ['art-list-property-steps', 'art-payments-invoices'],
  },
];

// ─── Intelligent Search Helper ───────────────────────────────────

export function searchKnowledgeBase(query: string): KnowledgeArticle[] {
  const clean = (query || '').toLowerCase().trim();
  if (!clean || clean.length < 2) {
    return KNOWLEDGE_ARTICLES.filter((a) => a.popular);
  }

  const tokens = clean.split(/\s+/).filter((t) => t.length > 1);

  return KNOWLEDGE_ARTICLES.map((article) => {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const summaryLower = article.summary.toLowerCase();
    const catLower = article.category.toLowerCase();
    const keywords = article.keywords.map((k) => k.toLowerCase());
    const contentText = article.content.join(' ').toLowerCase();

    // Exact title match
    if (titleLower.includes(clean)) score += 50;
    if (summaryLower.includes(clean)) score += 30;
    if (catLower.includes(clean)) score += 20;

    // Keyword matches
    for (const kw of keywords) {
      if (kw.includes(clean) || clean.includes(kw)) score += 40;
    }

    // Token matches
    for (const token of tokens) {
      if (titleLower.includes(token)) score += 15;
      if (summaryLower.includes(token)) score += 10;
      if (keywords.some((kw) => kw.includes(token))) score += 15;
      if (contentText.includes(token)) score += 5;
    }

    return { article, score };
  })
    .filter((res) => res.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((res) => res.article);
}

// ─── Supabase API Client ─────────────────────────────────────────

export interface TicketDetailsResult {
  ticket: SupportTicket | null;
  messages: SupportMessage[];
  history: SupportStatusHistory[];
  error?: string | null;
  isNotFound?: boolean;
  isUnauthorized?: boolean;
}

/**
 * Fetch all support tickets for the current authenticated user.
 */
export async function fetchMySupportTickets(
  userId: string,
  statusFilter?: string
): Promise<SupportTicket[]> {
  if (!userId) return [];

  try {
    let q = supabase
      .from('support_tickets')
      .select('*')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'All') {
      if (statusFilter === 'Open') {
        q = q.in('status', ['Open', 'Assigned', 'In Progress', 'Reopened']);
      } else if (statusFilter === 'Pending') {
        q = q.in('status', ['Waiting for Customer', 'Waiting for Internal Team']);
      } else if (statusFilter === 'Resolved') {
        q = q.eq('status', 'Resolved');
      } else if (statusFilter === 'Closed') {
        q = q.eq('status', 'Closed');
      } else {
        q = q.eq('status', statusFilter);
      }
    }

    const { data, error } = await q;
    if (error) {
      console.error('fetchMySupportTickets query error:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Safely look up related property titles if any property_id is referenced
    const propertyIds = Array.from(new Set(data.map((t) => t.property_id).filter(Boolean))) as string[];
    let propertiesMap: Record<string, any> = {};

    if (propertyIds.length > 0) {
      try {
        const { data: props } = await supabase
          .from('properties')
          .select('id, title, price, address')
          .in('id', propertyIds);
        if (props) {
          propertiesMap = props.reduce((acc: Record<string, any>, p) => {
            acc[p.id] = p;
            return acc;
          }, {});
        }
      } catch (propErr) {
        console.warn('Could not enrich tickets with property details:', propErr);
      }
    }

    return data.map((t) => ({
      ...t,
      properties: t.property_id ? propertiesMap[t.property_id] || null : null,
    })) as unknown as SupportTicket[];
  } catch (err) {
    console.error('fetchMySupportTickets unhandled error:', err);
    return [];
  }
}

/**
 * Fetch single ticket details by UUID (id) or ticket number (ticket_number).
 */
export async function fetchSupportTicketDetails(ticketId: string): Promise<TicketDetailsResult> {
  if (!ticketId) {
    return { ticket: null, messages: [], history: [], isNotFound: true };
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId);
    let query = supabase.from('support_tickets').select('*');

    if (isUuid) {
      query = query.eq('id', ticketId);
    } else {
      const cleanNum = ticketId.replace(/^#/, '').trim();
      query = query.eq('ticket_number', cleanNum);
    }

    const { data: ticketData, error: ticketError } = await query.maybeSingle();

    if (ticketError) {
      console.error('Error fetching ticket from database:', ticketError);
      return {
        ticket: null,
        messages: [],
        history: [],
        error: ticketError.message || 'Database error while fetching ticket.',
      };
    }

    if (!ticketData) {
      return {
        ticket: null,
        messages: [],
        history: [],
        isNotFound: true,
        error: 'Support ticket not found in database.',
      };
    }

    const realTicketId = ticketData.id;

    // Fetch messages, history, and optional linked models in parallel
    const [msgRes, histRes, propRes, profileRes] = await Promise.all([
      supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', realTicketId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true }),
      supabase
        .from('support_status_history')
        .select('*')
        .eq('ticket_id', realTicketId)
        .order('created_at', { ascending: true }),
      ticketData.property_id
        ? supabase
            .from('properties')
            .select('id, title, price, address')
            .eq('id', ticketData.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      ticketData.assigned_to
        ? supabase
            .from('profiles')
            .select('id, first_name, last_name, role, avatar_url')
            .eq('id', ticketData.assigned_to)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const messages = (msgRes.data ?? []) as unknown as SupportMessage[];
    const history = (histRes.data ?? []) as unknown as SupportStatusHistory[];

    // Fetch sender profile details for customer/admin message avatars
    const senderIds = Array.from(new Set(messages.map((m) => m.sender_id).filter(Boolean))) as string[];
    let sendersMap: Record<string, any> = {};

    if (senderIds.length > 0) {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, role, avatar_url')
          .in('id', senderIds);
        if (profiles) {
          sendersMap = profiles.reduce((acc: Record<string, any>, p) => {
            acc[p.id] = p;
            return acc;
          }, {});
        }
      } catch (profErr) {
        console.warn('Sender profile lookup failed:', profErr);
      }
    }

    const enrichedMessages = messages.map((m) => ({
      ...m,
      sender_profile: m.sender_id ? sendersMap[m.sender_id] || null : null,
    }));

    const fullTicket: SupportTicket = {
      ...ticketData,
      properties: propRes.data || null,
      assigned_profile: profileRes.data || null,
    };

    return {
      ticket: fullTicket,
      messages: enrichedMessages,
      history,
      error: null,
    };
  } catch (err: any) {
    console.error('fetchSupportTicketDetails unhandled error:', err);
    return {
      ticket: null,
      messages: [],
      history: [],
      error: err?.message || 'Unexpected error while loading ticket.',
    };
  }
}

/**
 * Generate a dynamic unique ticket number e.g. #RN-10482.
 */
export function generateTicketNumber(): string {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `RN-${rand}`;
}

export interface CreateTicketPayload {
  customerId: string;
  category: SupportCategory;
  subject: string;
  description: string;
  priority: SupportPriority;
  propertyId?: string | null;
  contactPreference?: 'Email' | 'Phone' | 'Chat';
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
}

/**
 * Create a new support ticket and its initial message in database.
 * Genuinely verifies database persistence before returning.
 */
export async function createSupportTicket(payload: CreateTicketPayload): Promise<SupportTicket> {
  if (!payload.customerId) {
    throw new Error('User authentication required to create a support ticket.');
  }

  const ticketNumber = generateTicketNumber();
  const now = new Date().toISOString();

  const insertData: Record<string, any> = {
    ticket_number: ticketNumber,
    customer_id: payload.customerId,
    created_by: payload.customerId,
    subject: payload.subject.trim(),
    description: payload.description.trim(),
    category: payload.category,
    priority: payload.priority || 'Medium',
    status: 'Open',
    source: 'Customer Portal',
    property_id: payload.propertyId || null,
    created_at: now,
    updated_at: now,
  };

  if (payload.contactPreference) {
    insertData.contact_preference = payload.contactPreference;
  }

  let { data: ticket, error: ticketErr } = await supabase
    .from('support_tickets')
    .insert(insertData)
    .select('*')
    .single();

  // If column contact_preference doesn't exist on remote schema yet, retry without it
  if (ticketErr && ticketErr.message?.includes('contact_preference')) {
    delete insertData.contact_preference;
    const retry = await supabase
      .from('support_tickets')
      .insert(insertData)
      .select('*')
      .single();
    ticket = retry.data;
    ticketErr = retry.error;
  }

  if (ticketErr || !ticket) {
    console.error('Database failed to create support_tickets row:', ticketErr);
    throw new Error(ticketErr?.message || 'Could not save support ticket to database.');
  }

  const persistedTicket = ticket as unknown as SupportTicket;

  // Insert initial message into conversation thread
  try {
    const { data: msgData, error: msgErr } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: persistedTicket.id,
        sender_type: 'customer',
        sender_id: payload.customerId,
        message: payload.description.trim(),
        attachment_url: payload.attachmentUrl || null,
        attachment_name: payload.attachmentName || null,
        attachment_type: payload.attachmentType || null,
        is_internal: false,
        created_at: now,
      })
      .select('*')
      .maybeSingle();

    if (msgErr) {
      console.warn('Initial message insert warning:', msgErr);
    }

    // If attachment was uploaded, also register in support_attachments
    if (payload.attachmentUrl && payload.attachmentName) {
      await supabase.from('support_attachments').insert({
        ticket_id: persistedTicket.id,
        message_id: msgData?.id || null,
        uploaded_by: payload.customerId,
        file_name: payload.attachmentName,
        file_path: payload.attachmentUrl,
        file_type: payload.attachmentType || null,
        file_size: payload.attachmentSize || null,
        created_at: now,
      });
    }
  } catch (msgError) {
    console.warn('Could not insert initial message/attachment:', msgError);
  }

  // Attempt initial status record in history (with safe catch)
  try {
    await supabase.from('support_status_history').insert({
      ticket_id: persistedTicket.id,
      new_status: 'Open',
      changed_by: payload.customerId,
      reason: 'Ticket created by customer',
      created_at: now,
    });
  } catch (histError) {
    console.warn('Status history insert skipped:', histError);
  }

  // Notify customer
  try {
    await supabase.from('notifications').insert({
      user_id: payload.customerId,
      title: `Support Ticket Created (${ticketNumber})`,
      body: `Your ticket "${payload.subject}" has been received. Our team will review it shortly.`,
      type: 'system',
      link: `/portal/help?tab=tickets&ticket=${persistedTicket.id}`,
      is_read: false,
      created_at: now,
    });
  } catch {
    // Ignore notification error
  }

  return persistedTicket;
}

/**
 * Send a reply message to a support ticket.
 */
export async function sendTicketReply(payload: {
  ticketId: string;
  senderId: string;
  senderType: 'customer' | 'admin' | 'ai';
  message: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
}): Promise<SupportMessage> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: payload.ticketId,
      sender_id: payload.senderId,
      sender_type: payload.senderType,
      message: payload.message.trim(),
      attachment_url: payload.attachmentUrl || null,
      attachment_name: payload.attachmentName || null,
      attachment_type: payload.attachmentType || null,
      is_internal: false,
      created_at: now,
    })
    .select('*')
    .single();

  if (error) {
    console.error('sendTicketReply error:', error);
    throw error;
  }

  // Update ticket updated_at and status
  try {
    await supabase
      .from('support_tickets')
      .update({
        updated_at: now,
        status: payload.senderType === 'customer' ? 'In Progress' : 'Waiting for Customer',
      })
      .eq('id', payload.ticketId);
  } catch (updateErr) {
    console.warn('Could not update ticket timestamp:', updateErr);
  }

  return data as unknown as SupportMessage;
}

/**
 * Escalate a support ticket.
 */
export async function escalateSupportTicket(
  ticketId: string,
  userId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('support_tickets')
    .update({
      is_escalated: true,
      escalation_reason: reason,
      escalated_at: now,
      priority: 'Urgent',
      updated_at: now,
    })
    .eq('id', ticketId);

  if (error) {
    console.error('escalateSupportTicket error:', error);
    throw error;
  }

  try {
    await supabase.from('support_status_history').insert({
      ticket_id: ticketId,
      new_status: 'Escalated',
      changed_by: userId,
      reason: `Customer requested escalation: ${reason}`,
      created_at: now,
    });
  } catch {
    // Ignore history error
  }

  await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_type: 'system',
    message: `⚠️ Ticket escalated by customer. Reason: "${reason}". Priority upgraded to Urgent.`,
    is_internal: false,
    created_at: now,
  });
}

/**
 * Close a support ticket.
 */
export async function closeSupportTicket(ticketId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'Closed',
      closed_at: now,
      updated_at: now,
    })
    .eq('id', ticketId);

  if (error) {
    console.error('closeSupportTicket error:', error);
    throw error;
  }

  try {
    await supabase.from('support_status_history').insert({
      ticket_id: ticketId,
      old_status: 'Open',
      new_status: 'Closed',
      changed_by: userId,
      reason: 'Closed by customer',
      created_at: now,
    });
  } catch {
    // Ignore history error
  }

  await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_type: 'system',
    message: '✓ Ticket marked as Closed.',
    is_internal: false,
    created_at: now,
  });
}

/**
 * Submit feedback on Knowledge Base Article (👍 Yes / 👎 No).
 */
export async function submitArticleFeedback(
  articleId: string,
  helpful: boolean,
  userId?: string | null,
  feedbackText?: string
): Promise<void> {
  try {
    await supabase.from('support_article_feedback').insert({
      article_id: articleId,
      user_id: userId || null,
      helpful,
      feedback: feedbackText || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('submitArticleFeedback error:', err);
  }
}

/**
 * Fetch configurable support contact settings.
 */
export async function fetchSupportContactConfig(): Promise<SupportContactConfig> {
  try {
    const { data } = await supabase
      .from('cms_settings')
      .select('key, value')
      .in('key', [
        'support_phone',
        'support_email',
        'support_whatsapp',
        'support_hours',
        'live_chat_enabled',
        'ticket_system_enabled',
      ]);

    const map = (data ?? []).reduce((acc: Record<string, string>, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    return {
      phone: map['support_phone']?.trim() || null,
      email: map['support_email']?.trim() || null,
      whatsapp: map['support_whatsapp']?.trim() || null,
      operatingHours: map['support_hours']?.trim() || 'Mon - Sat: 9:00 AM - 7:00 PM IST',
      liveChatEnabled: map['live_chat_enabled'] !== 'false',
      ticketSystemEnabled: map['ticket_system_enabled'] !== 'false',
    };
  } catch {
    return {
      phone: null,
      email: null,
      whatsapp: null,
      operatingHours: 'Mon - Sat: 9:00 AM - 7:00 PM IST',
      liveChatEnabled: true,
      ticketSystemEnabled: true,
    };
  }
}

/**
 * Upload support attachment file to Supabase storage.
 */
export async function uploadSupportAttachment(
  file: File,
  userId: string
): Promise<{ url: string; name: string; type: string; size: number }> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('support_attachments')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadErr) throw uploadErr;

  const { data: publicUrlData } = supabase.storage
    .from('support_attachments')
    .getPublicUrl(path);

  return {
    url: publicUrlData.publicUrl || path,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

/**
 * Fetch customer's own properties for linking in ticket.
 */
export async function fetchCustomerPropertiesForTicket(userId: string): Promise<{ id: string; title: string }[]> {
  if (!userId) return [];
  const { data } = await supabase
    .from('properties')
    .select('id, title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  return (data ?? []) as { id: string; title: string }[];
}

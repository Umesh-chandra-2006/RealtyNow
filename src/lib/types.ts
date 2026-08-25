export type UserRole = 'customer' | 'agent' | 'admin' | 'builder' | 'partner' | 'super_admin';

export type PropertyStatus =
  | 'draft'
  | 'submitted'
  | 'pending_verification'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'archived';

export type PropertyPurpose =
  | 'Sale'
  | 'Resale'
  | 'Rent'
  | 'Lease'
  | 'PG'
  | 'CoLiving'
  | 'Hostel'
  | 'Short Stay'
  | 'Vacation Rental'
  | 'Commercial';

export type Furnishing = 'Unfurnished' | 'Semi-Furnished' | 'Fully Furnished';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  agent_id: string | null;
  bio: string | null;
  company: string | null;
  company_logo_url: string | null;
  license_number: string | null;
  assigned_areas: string[] | null;
  specialization: string | null;
  two_factor_enabled: boolean;
  rera_document_url: string | null;
  rera_verified: boolean;
  rera_verification_status: 'not_submitted' | 'pending' | 'under_review' | 'verified' | 'rejected';
  rera_verified_at: string | null;
  rera_verified_by: string | null;
  rera_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  name: string;
  state: string | null;
  country: string;
  created_at: string;
}

export interface Locality {
  id: string;
  city_id: string;
  name: string;
  pincode: string | null;
  created_at: string;
}

export interface PropertyType {
  id: string;
  name: string;
  category: string;
  icon: string | null;
  created_at: string;
}

export interface Amenity {
  id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

export interface Builder {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  established_year: number | null;
}

export interface Property {
  id: string;
  owner_id: string;
  listed_by_user_id?: string | null;
  listed_by_mobile?: string | null;
  title: string;
  description: string | null;
  property_type_id: string | null;
  property_sub_type?: string | null;
  listing_category?: string | null;
  purpose: PropertyPurpose;
  city_id: string | null;
  locality_id: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  price: number;
  rent_amount: number | null;
  security_deposit: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  balconies: number | null;
  floor_number: number | null;
  total_floors: number | null;
  built_up_area: number | null;
  carpet_area: number | null;
  plot_area: number | null;
  area_unit: string | null;
  price_per_unit: number | null;
  facing: string | null;
  furnishing: Furnishing | null;
  parking: number;
  age_of_property: number | null;
  ownership_type: string | null;
  legal_approved: boolean;
  amenities: string[] | null;
  features: Record<string, unknown> | null;
  images: string[] | null;
  videos: string[] | null;
  floor_plans: string[] | null;
  documents: string[] | null;
  builder_id: string | null;
  project_id: string | null;
  status: PropertyStatus;
  approval_status?: 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Changes Requested' | null;
  is_live?: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  is_featured: boolean;
  is_luxury: boolean;
  view_count: number;
  ai_description: string | null;
  ai_seo: string | null;
  ai_tags: string[] | null;
  assigned_agent_id: string | null;
  rejection_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  cover_image_url?: string | null;
  // AI Verified Listings (denormalized from ai_verifications for fast badge rendering)
  verification_status?: 'Pending AI' | 'AI Verified' | 'Manual Review' | 'Rejected' | null;
  ai_verified_at?: string | null;
  // joined fields (from view)
  city_name?: string;
  locality_name?: string;
  property_type_name?: string;
  property_type_category?: string;
  builder_name?: string;
  project_name?: string;
  // 360° Virtual Tour fields
  has_virtual_tour?: boolean;
  virtual_tour_cover?: string | null;
  virtual_tour_count?: number;
  virtual_tours?: VirtualTour[];
  current_step?: number;
  completed_steps?: number[];
  draft_data?: Record<string, any> | null;
  completion_percentage?: number;
  is_draft?: boolean;
  last_saved_at?: string | null;
  nearby_places?: { metro?: string; hospital?: string; school?: string; mall?: string; airport?: string } | null;
  place_id?: string | null;
  verified_status?: string | null;
  ai_score?: number | null;
  possession_status?: 'Ready to Move' | 'Under Construction' | 'New Launch' | null;
  // AI-generated SEO metadata (generatePropertySeo edge function) — admin can view/override,
  // customers no longer enter these directly (see docs/AI_FEATURES.md).
  seo_title?: string | null;
  seo_description?: string | null;
  seo_slug?: string | null;
  seo_keywords?: string[] | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image?: string | null;
  canonical_url?: string | null;
  json_ld?: Record<string, unknown> | null;
  image_alt_text?: string[] | null;
  seo_generated_at?: string | null;
}

export interface VirtualTour {
  id: string;
  property_id: string;
  room_name: string;
  title: string | null;
  image_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  is_cover: boolean;
  floor_number: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface VirtualTourUploadItem {
  file: File;
  preview: string;
  room_name: string;
  title: string;
  floor_number: number;
  is_cover: boolean;
  sort_order: number;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string;
  url?: string;
  thumbnail_url?: string;
}

export interface Enquiry {
  id: string;
  property_id: string | null;
  customer_id: string | null;
  agent_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  property?: Pick<Property, 'id' | 'title'>;
}

export interface Appointment {
  id: string;
  property_id: string | null;
  customer_id: string;
  agent_id: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
  created_at: string;
  property?: Pick<Property, 'id' | 'title'>;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  receiver_id: string;
  property_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  // Enterprise notification columns (migration 0035)
  channel?: string[];
  delivered_via?: string[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  template_key?: string | null;
  template_vars?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  is_dismissed?: boolean;
  action_url?: string | null;
  action_label?: string | null;
  expires_at?: string | null;
  group_key?: string | null;
  updated_at?: string;
}

export interface NotificationPreferences {
  user_id: string;
  in_app: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  marketing: boolean;
  property_updates: boolean;
  lead_updates: boolean;
  payment_updates: boolean;
  system_alerts: boolean;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
  property?: Property;
}

export interface Subscription {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[] | null;
  is_active: boolean;
}

export interface CustomerSubscription {
  id: string;
  user_id: string;
  subscription_id: string | null;
  status: string;
  started_at: string;
  ends_at: string | null;
  subscription?: Subscription;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  reference: string | null;
  invoice_number: string | null;
  created_at: string;
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image: string | null;
  author_id: string | null;
  tags: string[] | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
}

export interface CmsPage {
  id: string;
  title: string;
  slug: string;
  body: string;
  published: boolean;
  created_at: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  avatar_url: string | null;
  rating: number;
  body: string;
  is_active: boolean;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  is_active: boolean;
}

export interface Advertisement {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  banner_type?: string | null;
  placement: string;
  image_url: string | null;
  image_desktop?: string | null;
  image_mobile?: string | null;
  video_url?: string | null;
  html_content?: string | null;
  button_text?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  link_url?: string | null;
  redirect_type?: string | null;
  property_id?: string | null;
  category_name?: string | null;
  company_logo?: string | null;
  price_text?: string | null;
  location_text?: string | null;
  priority?: number;
  display_order?: number;
  start_date?: string | null;
  end_date?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  auto_publish?: boolean;
  schedule_publishing?: boolean;
  target_audience?: string | null;
  city_targeting?: string | null;
  device_targeting?: string | null;
  impression_limit?: number;
  impressions?: number;
  clicks?: number;
  seo_alt_text?: string | null;
  image_caption?: string | null;
  banner_tags?: string[] | null;
  internal_comments?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HeroCampaignFeature {
  id?: string;
  hero_campaign_id?: string;
  feature_text: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface HeroCampaign {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  banner_image?: string | null;
  mobile_banner?: string | null;
  logo?: string | null;
  developer_logo?: string | null;
  rera_number?: string | null;
  overlay_position?: 'left' | 'right' | 'center' | 'both';
  overlay_opacity?: number | null;
  content_alignment?: 'left' | 'center' | 'right';
  cta_enabled?: boolean;
  cta_text?: string | null;
  cta_url?: string | null;
  features?: string[] | null;
  city_id?: string | null;
  campaign_type: 'Paid' | 'Free';
  package_tier?: 'Platinum' | 'Gold' | 'Silver' | 'Featured' | 'Free' | null;
  property_id?: string | null;
  is_pinned?: boolean;
  display_type?: 'Hero Banner' | 'Featured Slider' | 'Premium Card' | null;
  priority?: number;
  start_date?: string | null;
  end_date?: string | null;
  order_no?: number;
  status: 'Active' | 'Inactive';
  created_at?: string;
  updated_at?: string;
  cities?: { name: string } | null;
  property?: Property | null;
  hero_campaign_features?: HeroCampaignFeature[];
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface PropertyStatusHistory {
  id: string;
  property_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface AiVerificationCheckResult {
  passed: boolean;
  reason: string;
  score?: number;
}

export interface AiVerification {
  id: string;
  property_id: string;
  ai_score: number;
  verification_status: 'Pending AI' | 'AI Verified' | 'Manual Review' | 'Rejected';
  check_results: Record<string, AiVerificationCheckResult>;
  verified_at: string;
  verified_by: string;
  admin_override: boolean;
  admin_remarks: string | null;
  created_at: string;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  caption: string | null;
  position: number;
}

export type ApplicationStatus =
  | 'submitted'
  | 'pending_review'
  | 'document_verification'
  | 'identity_verification'
  | 'company_verification'
  | 'project_verification'
  | 'rera_verification'
  | 'background_verification'
  | 'final_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'suspended'
  | 'cancelled';

export interface AgentApplication {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  license_number: string | null;
  specialization: string | null;
  assigned_areas: string[] | null;
  experience_years: number | null;
  company: string | null;
  bio: string | null;
  profile_image: string | null;
  id_doc_url: string | null;
  license_doc_url: string | null;
  verification_state?: Record<string, StepVerificationState> | null;
  verification_timeline?: any[] | null;
  status: ApplicationStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StepVerificationState {
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  completed_at?: string;
  completed_by?: string;
  checks?: Record<string, boolean>;
  notes?: string;
}

export interface BuilderApplication {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  gst_number: string | null;
  rera_number: string | null;
  established_year: number | null;
  city: string | null;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  gst_doc_url: string | null;
  rera_doc_url: string | null;
  pan_doc_url: string | null;
  verification_state?: Record<string, StepVerificationState> | null;
  verification_timeline?: any[] | null;
  status: ApplicationStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerApplication {
  id: string;
  application_number: string | null;
  full_name: string;
  mobile_number: string;
  email: string | null;
  partner_type: string;
  company_name: string | null;
  business_registration_number: string | null;
  gst_number: string | null;
  pan_number: string | null;
  years_of_experience: number | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  district: string | null;
  pincode: string | null;
  professional_experience: string | null;
  area_of_expertise: string | null;
  preferred_property_types: string[] | null;
  preferred_locations: string[] | null;
  expected_monthly_leads: number | null;
  current_business_volume: string | null;
  real_estate_experience: string | null;
  description: string | null;
  pan_doc_url: string | null;
  id_doc_url: string | null;
  gst_doc_url: string | null;
  business_reg_doc_url: string | null;
  address_proof_doc_url: string | null;
  other_doc_url: string | null;
  verification_state?: Record<string, StepVerificationState> | null;
  verification_timeline?: any[] | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  rejection_reason: string | null;
  assigned_admin: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  partner_code: string | null;
  application_id: string | null;
  user_id: string;
  full_name: string;
  mobile_number: string;
  email: string | null;
  partner_type: string | null;
  company_name: string | null;
  status: 'active' | 'suspended' | 'inactive';
  verification_status: string | null;
  gst_number: string | null;
  pan_number: string | null;
  website: string | null;
  business_registration_number: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  district: string | null;
  pincode: string | null;
  approved_by: string | null;
  approved_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// account_number is intentionally omitted — REVOKEd at the DB column level,
// only readable via the audited admin_reveal_partner_bank_account_number() RPC.
export interface PartnerBankAccount {
  id: string;
  user_id: string;
  partner_id: string | null;
  account_holder_name: string;
  bank_name: string;
  account_number_last4: string | null;
  ifsc_code: string;
  branch: string | null;
  account_type: 'savings' | 'current';
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export type PartnerDocumentType =
  | 'aadhaar' | 'pan' | 'govt_id' | 'cancelled_cheque' | 'bank_proof' | 'passbook'
  | 'gst_certificate' | 'business_registration' | 'address_proof' | 'other';

export type PartnerDocumentStatus = 'uploaded' | 'under_review' | 'verified' | 'rejected' | 'resubmission_required';

export interface PartnerDocument {
  id: string;
  partner_id: string | null;
  user_id: string;
  document_type: PartnerDocumentType;
  storage_path: string;
  status: PartnerDocumentStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export type KycIdType = 'aadhaar' | 'pan' | 'passport' | 'voter_id' | 'driving_license';
export type KycStatus = 'pending' | 'verified' | 'rejected';

export interface KycVerification {
  id: string;
  user_id: string;
  id_type: KycIdType;
  id_number: string | null;
  front_url: string | null;
  back_url: string | null;
  selfie_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Builder Portal ERP
// ============================================================

export type BuilderProjectStatus = 'upcoming' | 'ongoing' | 'completed';
export type BuilderTowerStatus = 'planned' | 'under_construction' | 'ready';
export type BuilderUnitStatus = 'available' | 'booked' | 'sold';
export type BuilderLeadStatus = 'new' | 'contacted' | 'site_visit' | 'negotiation' | 'won' | 'lost' | 'closed';
export type BuilderBookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type BuilderPaymentStatus = 'pending' | 'paid' | 'overdue' | 'partial';
export type BuilderInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type BuilderMilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';
export type BuilderCampaignStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';
export type BuilderCampaignChannel = 'social' | 'email' | 'sms' | 'print' | 'other';
export type BuilderDocumentVisibility = 'private' | 'customers' | 'public';
export type BuilderLeadActivityType = 'note' | 'call' | 'email' | 'meeting' | 'site_visit' | 'status_change';

export interface BuilderProject {
  id: string;
  builder_id: string;
  name: string;
  rera_id: string | null;
  description: string | null;
  status: BuilderProjectStatus;
  city_id: string | null;
  locality_id: string | null;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuilderTower {
  id: string;
  project_id: string;
  name: string;
  total_floors: number;
  status: BuilderTowerStatus;
  created_at: string;
  updated_at: string;
}

export interface BuilderFloor {
  id: string;
  tower_id: string;
  floor_number: number;
  name: string | null;
  status: BuilderTowerStatus;
  created_at: string;
  updated_at: string;
}

export interface BuilderUnit {
  id: string;
  tower_id: string;
  floor_id: string | null;
  unit_number: string;
  type: string;
  size_sqft: number | null;
  price: number | null;
  status: BuilderUnitStatus;
  created_at: string;
  updated_at: string;
}

export interface BuilderPricingRule {
  id: string;
  project_id: string;
  tower_id: string | null;
  unit_type: string;
  base_price: number;
  price_per_sqft: number | null;
  discount_percent: number;
  effective_from: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuilderLead {
  id: string;
  builder_id: string;
  project_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: BuilderLeadStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuilderLeadActivity {
  id: string;
  lead_id: string;
  builder_id: string;
  activity_type: BuilderLeadActivityType;
  notes: string | null;
  activity_date: string;
  created_at: string;
}

export interface BuilderCustomer {
  id: string;
  builder_id: string;
  lead_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  kyc_doc_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuilderBooking {
  id: string;
  unit_id: string;
  customer_id: string | null;
  lead_id: string | null;
  booking_date: string;
  amount: number | null;
  status: BuilderBookingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuilderAgent {
  id: string;
  builder_id: string;
  agent_profile_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  commission_percent: number | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface BuilderProjectAgent {
  id: string;
  project_id: string;
  agent_id: string;
  assigned_at: string;
}

export interface BuilderConstructionMilestone {
  id: string;
  project_id: string;
  tower_id: string | null;
  title: string;
  planned_date: string | null;
  actual_date: string | null;
  percent_complete: number;
  status: BuilderMilestoneStatus;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface BuilderPayment {
  id: string;
  booking_id: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: BuilderPaymentStatus;
  payment_mode: string | null;
  reference_no: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuilderInvoice {
  id: string;
  builder_id: string;
  booking_id: string | null;
  customer_id: string | null;
  invoice_number: string;
  amount: number;
  tax_amount: number;
  total_amount: number | null;
  status: BuilderInvoiceStatus;
  due_date: string | null;
  issued_date: string;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuilderDocument {
  id: string;
  builder_id: string;
  project_id: string | null;
  category: string;
  title: string;
  file_url: string;
  file_path: string | null;
  visibility: BuilderDocumentVisibility;
  created_at: string;
}

export interface BuilderFloorPlan {
  id: string;
  project_id: string;
  tower_id: string | null;
  unit_type: string | null;
  name: string;
  image_url: string;
  size_sqft: number | null;
  bedrooms: number | null;
  created_at: string;
  updated_at: string;
}

export interface BuilderMediaGalleryItem {
  id: string;
  project_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface BuilderMarketingCampaign {
  id: string;
  builder_id: string;
  project_id: string | null;
  title: string;
  channel: BuilderCampaignChannel;
  status: BuilderCampaignStatus;
  content: string | null;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Agent Portal Ecosystem
// ============================================================

export type AgentNegotiationStatus = 'open' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
export type AgentTaskPriority = 'low' | 'medium' | 'high';
export type AgentTaskStatus = 'pending' | 'in_progress' | 'completed';
export type AgentDocumentVisibility = 'private' | 'client' | 'public';

export interface AgentNegotiation {
  id: string;
  agent_id: string;
  lead_id: string;
  property_id: string | null;
  round_number: number;
  offer_amount: number;
  counter_amount: number | null;
  status: AgentNegotiationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentDocument {
  id: string;
  agent_id: string;
  lead_id: string | null;
  property_id: string | null;
  category: string;
  title: string;
  file_url: string;
  file_path: string | null;
  visibility: AgentDocumentVisibility;
  created_at: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: AgentTaskPriority;
  status: AgentTaskStatus;
  related_lead_id: string | null;
  related_property_id: string | null;
  created_at: string;
  updated_at: string;
}

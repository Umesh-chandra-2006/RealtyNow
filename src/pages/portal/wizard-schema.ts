import { z } from 'zod';

export const propertyWizardSchema = z.object({
  purpose: z.enum(['Sale', 'Rent', 'Lease', 'PG', 'CoLiving', 'Hostel', 'Short Stay', 'Vacation Rental']),
  category: z.enum(['Residential', 'Commercial', 'Land', 'Luxury', 'Rental Living']).optional(),
  property_type_id: z.string().optional(),
  property_sub_type: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  age_of_property: z.string().optional(),
  facing: z.string().optional(),
  floor_number: z.string().optional(),
  total_floors: z.string().optional(),
  furnishing: z.string().optional(),
  construction_status: z.string().optional(),
  availability_date: z.string().optional(),
  
  // New Area & Config Fields
  balcony_size: z.string().optional(),
  bedroom_size: z.string().optional(),
  plot_area: z.string().optional(),
  super_area: z.string().optional(),
  built_up_area: z.string().optional(),
  carpet_area: z.string().optional(),
  parking_indoor: z.string().optional(),
  parking_outdoor: z.string().optional(),
  source_urls: z.string().optional(),

  // PG & CoLiving specifics
  pg_details: z
    .object({
      pg_name: z.string().optional(),
      suitable_for: z.string().optional(),
      occupancy: z.array(z.string()).optional(),
      room_types: z.array(z.string()).optional(),
      food_included: z.boolean().optional(),
      curfew_timing: z.string().optional(),
      gate_closing_time: z.string().optional(),
      visitor_policy: z.string().optional(),
      available_beds: z.string().optional(),
      notice_period: z.string().optional(),
      monthly_rent: z.string().optional(),
      security_deposit: z.string().optional(),
      maintenance: z.string().optional(),
      food_charges: z.string().optional(),
      electricity_charges: z.string().optional(),
      water_charges: z.string().optional(),
    })
    .optional(),

  // Location
  city_name: z.string().optional(),
  locality_name: z.string().optional(),
  state_name: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  place_id: z.string().optional(),
  nearby_places: z
    .object({
      metro: z.string().optional(),
      hospital: z.string().optional(),
      school: z.string().optional(),
      mall: z.string().optional(),
      airport: z.string().optional(),
    })
    .optional(),

  // Amenities
  amenities: z.array(z.string()).default([]),

  // Media
  images: z.array(z.string()).default([]),
  cover_image_url: z.string().optional().nullable().or(z.literal('')),
  media_urls: z
    .object({
      videos: z.array(z.string().optional().nullable().or(z.literal(''))).optional(),
      // Present only when the video/virtual tour was uploaded to Supabase Storage
      // (not pasted as an external URL) — needed to delete the file on replace.
      video_bucket: z.string().optional().nullable(),
      video_path: z.string().optional().nullable(),
      virtual_tour: z.string().optional().nullable().or(z.literal('')),
      virtual_tour_bucket: z.string().optional().nullable(),
      virtual_tour_path: z.string().optional().nullable(),
      floor_plan: z.string().optional().nullable().or(z.literal('')),
      brochure: z.string().optional().nullable().or(z.literal('')),
    })
    .optional(),

  // Pricing
  price: z.string().optional(),
  rent_amount: z.string().optional(),
  security_deposit: z.string().optional(),
  maintenance: z.string().optional(),
  brokerage: z.string().optional(),
  negotiable: z.boolean().default(true),

  // Availability
  visiting_hours: z.string().optional(),
  open_house_schedule: z.string().optional(),

  // Ownership & Legal
  ownership_role: z.string().optional(),
  ownership_type: z.string().optional(),
  rera_number: z.string().optional(),
  property_tax_id: z.string().optional(),

  // Rent / Lease Specific
  minimum_rental_period: z.string().optional(),
  notice_period: z.string().optional(),
  preferred_tenant: z.string().optional(),
  family_bachelor: z.string().optional(),
  pets_allowed: z.boolean().optional(),
  lease_duration: z.string().optional(),
  lock_in_period: z.string().optional(),
  escalation_percentage: z.string().optional(),
  renewal_terms: z.string().optional(),
  maintenance_responsibility: z.string().optional(),
  registration_charges: z.string().optional(),

  // PG / Hostel / CoLiving Specific
  total_beds: z.string().optional(),
  available_beds: z.string().optional(),
  room_size: z.string().optional(),
  attached_bathroom: z.boolean().optional(),
  ac_non_ac: z.string().optional(),
  food_availability: z.string().optional(), // 'Breakfast,Lunch,Dinner'
  total_rooms: z.string().optional(),

  // Vacation Specific
  maximum_guests: z.string().optional(),
  beds: z.string().optional(),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  minimum_stay: z.string().optional(),
  maximum_stay: z.string().optional(),
  weekday_price: z.string().optional(),
  weekend_price: z.string().optional(),
  seasonal_price: z.string().optional(),
  cleaning_fee: z.string().optional(),
  extra_guest_fee: z.string().optional(),
  cancellation_policy: z.string().optional(),
  
  // SEO Metadata
  seo_metadata: z.object({
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    slug: z.string().optional(),
    keywords: z.string().optional()
  }).optional(),
});

export type PropertyWizardForm = z.infer<typeof propertyWizardSchema>;

export const WIZARD_STEPS = [
  'Purpose',
  'Category',
  'Property Type',
  'Basic Details',
  'Location',
  'Amenities',
  'Media',
  'Pricing',
  'Availability',
  'Ownership',
  'SEO',
  'Review',
];

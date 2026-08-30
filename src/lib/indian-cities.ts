import { supabase } from './supabase';
import { cachedLoader, createTtlCache } from './ttl-cache';

// Cities and property types are reference data: they change rarely and are
// fetched on many mounts (search page, home filters, admin dropdowns). A 30
// minute TTL cache prevents hammering Supabase with the same read.
const citiesCache = createTtlCache<Promise<CityOption[]>>(30 * 60 * 1000);
const propertyTypesCache = createTtlCache<Promise<PropertyTypeOption[]>>(30 * 60 * 1000);

export interface IndianCity {
  id?: string;
  name: string;
  state: string;
  tier?: 'Metro' | 'Tier-1' | 'Tier-2' | 'Tier-3';
}

export const ALL_INDIAN_CITIES: IndianCity[] = [
  // Telangana
  { name: 'Hyderabad', state: 'Telangana', tier: 'Metro' },
  { name: 'Secunderabad', state: 'Telangana', tier: 'Metro' },
  { name: 'Warangal', state: 'Telangana', tier: 'Tier-2' },
  { name: 'Nizamabad', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Karimnagar', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Khammam', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Ramagundam', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Mahbubnagar', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Nalgonda', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Adilabad', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Siddipet', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Suryapet', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Miryalaguda', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Jagtial', state: 'Telangana', tier: 'Tier-3' },
  { name: 'Mancherial', state: 'Telangana', tier: 'Tier-3' },

  // Andhra Pradesh
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', tier: 'Tier-1' },
  { name: 'Vijayawada', state: 'Andhra Pradesh', tier: 'Tier-2' },
  { name: 'Guntur', state: 'Andhra Pradesh', tier: 'Tier-2' },
  { name: 'Nellore', state: 'Andhra Pradesh', tier: 'Tier-2' },
  { name: 'Kurnool', state: 'Andhra Pradesh', tier: 'Tier-2' },
  { name: 'Rajahmundry', state: 'Andhra Pradesh', tier: 'Tier-2' },
  { name: 'Tirupati', state: 'Andhra Pradesh', tier: 'Tier-2' },
  { name: 'Kakinada', state: 'Andhra Pradesh', tier: 'Tier-2' },
  { name: 'Kadapa', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Anantapur', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Vizianagaram', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Eluru', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Ongole', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Nandyal', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Machilipatnam', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Tenali', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Proddatur', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Chittoor', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Hindupur', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Bhimavaram', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Madanapalle', state: 'Andhra Pradesh', tier: 'Tier-3' },
  { name: 'Amaravati', state: 'Andhra Pradesh', tier: 'Tier-2' },
  { name: 'Srikakulam', state: 'Andhra Pradesh', tier: 'Tier-3' },

  // Karnataka
  { name: 'Bengaluru', state: 'Karnataka', tier: 'Metro' },
  { name: 'Mysuru', state: 'Karnataka', tier: 'Tier-2' },
  { name: 'Hubballi-Dharwad', state: 'Karnataka', tier: 'Tier-2' },
  { name: 'Mangaluru', state: 'Karnataka', tier: 'Tier-2' },
  { name: 'Belagavi', state: 'Karnataka', tier: 'Tier-2' },
  { name: 'Kalaburagi', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Davanagere', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Ballari', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Vijayapura', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Shivamogga', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Tumakuru', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Raichur', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Bidar', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Hosapete', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Hassan', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Udupi', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Mandya', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Chikmagalur', state: 'Karnataka', tier: 'Tier-3' },
  { name: 'Kolar', state: 'Karnataka', tier: 'Tier-3' },

  // Maharashtra
  { name: 'Mumbai', state: 'Maharashtra', tier: 'Metro' },
  { name: 'Pune', state: 'Maharashtra', tier: 'Metro' },
  { name: 'Nagpur', state: 'Maharashtra', tier: 'Tier-1' },
  { name: 'Thane', state: 'Maharashtra', tier: 'Metro' },
  { name: 'Nashik', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Navi Mumbai', state: 'Maharashtra', tier: 'Metro' },
  { name: 'Chhatrapati Sambhaji Nagar', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Solapur', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Kalyan-Dombivli', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Vasai-Virar', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Mira-Bhayandar', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Bhiwandi', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Amravati', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Nanded', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Kolhapur', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Sangli', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Malegaon', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Jalgaon', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Akola', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Latur', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Dhule', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Ahmednagar', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Chandrapur', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Panvel', state: 'Maharashtra', tier: 'Tier-2' },
  { name: 'Satara', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Ratnagiri', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Alibag', state: 'Maharashtra', tier: 'Tier-3' },
  { name: 'Shirdi', state: 'Maharashtra', tier: 'Tier-3' },

  // Delhi NCR / Delhi / Haryana / UP
  { name: 'Delhi', state: 'Delhi', tier: 'Metro' },
  { name: 'New Delhi', state: 'Delhi', tier: 'Metro' },
  { name: 'Gurugram', state: 'Haryana', tier: 'Metro' },
  { name: 'Noida', state: 'Uttar Pradesh', tier: 'Metro' },
  { name: 'Greater Noida', state: 'Uttar Pradesh', tier: 'Tier-1' },
  { name: 'Ghaziabad', state: 'Uttar Pradesh', tier: 'Metro' },
  { name: 'Faridabad', state: 'Haryana', tier: 'Tier-2' },
  { name: 'Sonipat', state: 'Haryana', tier: 'Tier-3' },
  { name: 'Panipat', state: 'Haryana', tier: 'Tier-3' },
  { name: 'Karnal', state: 'Haryana', tier: 'Tier-3' },
  { name: 'Ambala', state: 'Haryana', tier: 'Tier-3' },
  { name: 'Hisar', state: 'Haryana', tier: 'Tier-3' },
  { name: 'Panchkula', state: 'Haryana', tier: 'Tier-2' },
  { name: 'Rohtak', state: 'Haryana', tier: 'Tier-3' },

  // Tamil Nadu
  { name: 'Chennai', state: 'Tamil Nadu', tier: 'Metro' },
  { name: 'Coimbatore', state: 'Tamil Nadu', tier: 'Tier-2' },
  { name: 'Madurai', state: 'Tamil Nadu', tier: 'Tier-2' },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu', tier: 'Tier-2' },
  { name: 'Salem', state: 'Tamil Nadu', tier: 'Tier-2' },
  { name: 'Tiruppur', state: 'Tamil Nadu', tier: 'Tier-2' },
  { name: 'Erode', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Tirunelveli', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Vellore', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Thoothukudi', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Dindigul', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Thanjavur', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Hosur', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Kanchipuram', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Nagercoil', state: 'Tamil Nadu', tier: 'Tier-3' },
  { name: 'Ooty', state: 'Tamil Nadu', tier: 'Tier-3' },

  // Gujarat
  { name: 'Ahmedabad', state: 'Gujarat', tier: 'Metro' },
  { name: 'Surat', state: 'Gujarat', tier: 'Tier-1' },
  { name: 'Vadodara', state: 'Gujarat', tier: 'Tier-2' },
  { name: 'Rajkot', state: 'Gujarat', tier: 'Tier-2' },
  { name: 'Bhavnagar', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Jamnagar', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Gandhinagar', state: 'Gujarat', tier: 'Tier-2' },
  { name: 'Junagadh', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Anand', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Navsari', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Morbi', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Vapi', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Valsad', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Bharuch', state: 'Gujarat', tier: 'Tier-3' },
  { name: 'Bhuj', state: 'Gujarat', tier: 'Tier-3' },

  // West Bengal
  { name: 'Kolkata', state: 'West Bengal', tier: 'Metro' },
  { name: 'Howrah', state: 'West Bengal', tier: 'Tier-2' },
  { name: 'Durgapur', state: 'West Bengal', tier: 'Tier-2' },
  { name: 'Asansol', state: 'West Bengal', tier: 'Tier-2' },
  { name: 'Siliguri', state: 'West Bengal', tier: 'Tier-2' },
  { name: 'Kharagpur', state: 'West Bengal', tier: 'Tier-3' },
  { name: 'Haldia', state: 'West Bengal', tier: 'Tier-3' },
  { name: 'Darjeeling', state: 'West Bengal', tier: 'Tier-3' },

  // Uttar Pradesh
  { name: 'Lucknow', state: 'Uttar Pradesh', tier: 'Tier-1' },
  { name: 'Kanpur', state: 'Uttar Pradesh', tier: 'Tier-2' },
  { name: 'Varanasi', state: 'Uttar Pradesh', tier: 'Tier-2' },
  { name: 'Agra', state: 'Uttar Pradesh', tier: 'Tier-2' },
  { name: 'Prayagraj', state: 'Uttar Pradesh', tier: 'Tier-2' },
  { name: 'Meerut', state: 'Uttar Pradesh', tier: 'Tier-2' },
  { name: 'Bareilly', state: 'Uttar Pradesh', tier: 'Tier-3' },
  { name: 'Aligarh', state: 'Uttar Pradesh', tier: 'Tier-3' },
  { name: 'Moradabad', state: 'Uttar Pradesh', tier: 'Tier-3' },
  { name: 'Saharanpur', state: 'Uttar Pradesh', tier: 'Tier-3' },
  { name: 'Gorakhpur', state: 'Uttar Pradesh', tier: 'Tier-3' },
  { name: 'Firozabad', state: 'Uttar Pradesh', tier: 'Tier-3' },
  { name: 'Jhansi', state: 'Uttar Pradesh', tier: 'Tier-3' },
  { name: 'Mathura', state: 'Uttar Pradesh', tier: 'Tier-3' },
  { name: 'Ayodhya', state: 'Uttar Pradesh', tier: 'Tier-3' },

  // Rajasthan
  { name: 'Jaipur', state: 'Rajasthan', tier: 'Tier-1' },
  { name: 'Jodhpur', state: 'Rajasthan', tier: 'Tier-2' },
  { name: 'Kota', state: 'Rajasthan', tier: 'Tier-2' },
  { name: 'Bikaner', state: 'Rajasthan', tier: 'Tier-3' },
  { name: 'Ajmer', state: 'Rajasthan', tier: 'Tier-3' },
  { name: 'Udaipur', state: 'Rajasthan', tier: 'Tier-2' },
  { name: 'Bhilwara', state: 'Rajasthan', tier: 'Tier-3' },
  { name: 'Alwar', state: 'Rajasthan', tier: 'Tier-3' },
  { name: 'Sikar', state: 'Rajasthan', tier: 'Tier-3' },
  { name: 'Sri Ganganagar', state: 'Rajasthan', tier: 'Tier-3' },

  // Kerala
  { name: 'Kochi', state: 'Kerala', tier: 'Tier-2' },
  { name: 'Thiruvananthapuram', state: 'Kerala', tier: 'Tier-2' },
  { name: 'Kozhikode', state: 'Kerala', tier: 'Tier-2' },
  { name: 'Thrissur', state: 'Kerala', tier: 'Tier-3' },
  { name: 'Kollam', state: 'Kerala', tier: 'Tier-3' },
  { name: 'Kannur', state: 'Kerala', tier: 'Tier-3' },
  { name: 'Alappuzha', state: 'Kerala', tier: 'Tier-3' },
  { name: 'Kottayam', state: 'Kerala', tier: 'Tier-3' },
  { name: 'Palakkad', state: 'Kerala', tier: 'Tier-3' },
  { name: 'Malappuram', state: 'Kerala', tier: 'Tier-3' },

  // Madhya Pradesh
  { name: 'Indore', state: 'Madhya Pradesh', tier: 'Tier-2' },
  { name: 'Bhopal', state: 'Madhya Pradesh', tier: 'Tier-2' },
  { name: 'Jabalpur', state: 'Madhya Pradesh', tier: 'Tier-2' },
  { name: 'Gwalior', state: 'Madhya Pradesh', tier: 'Tier-2' },
  { name: 'Ujjain', state: 'Madhya Pradesh', tier: 'Tier-3' },
  { name: 'Sagar', state: 'Madhya Pradesh', tier: 'Tier-3' },
  { name: 'Dewas', state: 'Madhya Pradesh', tier: 'Tier-3' },
  { name: 'Satna', state: 'Madhya Pradesh', tier: 'Tier-3' },
  { name: 'Ratlam', state: 'Madhya Pradesh', tier: 'Tier-3' },
  { name: 'Rewa', state: 'Madhya Pradesh', tier: 'Tier-3' },

  // Punjab & Chandigarh
  { name: 'Chandigarh', state: 'Chandigarh', tier: 'Tier-2' },
  { name: 'Ludhiana', state: 'Punjab', tier: 'Tier-2' },
  { name: 'Amritsar', state: 'Punjab', tier: 'Tier-2' },
  { name: 'Jalandhar', state: 'Punjab', tier: 'Tier-2' },
  { name: 'Patiala', state: 'Punjab', tier: 'Tier-3' },
  { name: 'Bathinda', state: 'Punjab', tier: 'Tier-3' },
  { name: 'Mohali', state: 'Punjab', tier: 'Tier-2' },
  { name: 'Pathankot', state: 'Punjab', tier: 'Tier-3' },

  // Odisha
  { name: 'Bhubaneswar', state: 'Odisha', tier: 'Tier-2' },
  { name: 'Cuttack', state: 'Odisha', tier: 'Tier-2' },
  { name: 'Rourkela', state: 'Odisha', tier: 'Tier-3' },
  { name: 'Berhampur', state: 'Odisha', tier: 'Tier-3' },
  { name: 'Sambalpur', state: 'Odisha', tier: 'Tier-3' },
  { name: 'Puri', state: 'Odisha', tier: 'Tier-3' },

  // Bihar
  { name: 'Patna', state: 'Bihar', tier: 'Tier-2' },
  { name: 'Gaya', state: 'Bihar', tier: 'Tier-3' },
  { name: 'Bhagalpur', state: 'Bihar', tier: 'Tier-3' },
  { name: 'Muzaffarpur', state: 'Bihar', tier: 'Tier-3' },
  { name: 'Purnia', state: 'Bihar', tier: 'Tier-3' },
  { name: 'Darbhanga', state: 'Bihar', tier: 'Tier-3' },
  { name: 'Bihar Sharif', state: 'Bihar', tier: 'Tier-3' },

  // Jharkhand
  { name: 'Ranchi', state: 'Jharkhand', tier: 'Tier-2' },
  { name: 'Jamshedpur', state: 'Jharkhand', tier: 'Tier-2' },
  { name: 'Dhanbad', state: 'Jharkhand', tier: 'Tier-2' },
  { name: 'Bokaro Steel City', state: 'Jharkhand', tier: 'Tier-3' },
  { name: 'Deoghar', state: 'Jharkhand', tier: 'Tier-3' },
  { name: 'Hazaribagh', state: 'Jharkhand', tier: 'Tier-3' },

  // Assam & Northeast
  { name: 'Guwahati', state: 'Assam', tier: 'Tier-2' },
  { name: 'Silchar', state: 'Assam', tier: 'Tier-3' },
  { name: 'Dibrugarh', state: 'Assam', tier: 'Tier-3' },
  { name: 'Jorhat', state: 'Assam', tier: 'Tier-3' },
  { name: 'Shillong', state: 'Meghalaya', tier: 'Tier-3' },
  { name: 'Imphal', state: 'Manipur', tier: 'Tier-3' },
  { name: 'Agartala', state: 'Tripura', tier: 'Tier-3' },
  { name: 'Aizawl', state: 'Mizoram', tier: 'Tier-3' },
  { name: 'Kohima', state: 'Nagaland', tier: 'Tier-3' },
  { name: 'Dimapur', state: 'Nagaland', tier: 'Tier-3' },
  { name: 'Gangtok', state: 'Sikkim', tier: 'Tier-3' },
  { name: 'Itanagar', state: 'Arunachal Pradesh', tier: 'Tier-3' },

  // Chhattisgarh
  { name: 'Raipur', state: 'Chhattisgarh', tier: 'Tier-2' },
  { name: 'Bhilai', state: 'Chhattisgarh', tier: 'Tier-3' },
  { name: 'Bilaspur', state: 'Chhattisgarh', tier: 'Tier-3' },
  { name: 'Korba', state: 'Chhattisgarh', tier: 'Tier-3' },
  { name: 'Durg', state: 'Chhattisgarh', tier: 'Tier-3' },

  // Uttarakhand
  { name: 'Dehradun', state: 'Uttarakhand', tier: 'Tier-2' },
  { name: 'Haridwar', state: 'Uttarakhand', tier: 'Tier-3' },
  { name: 'Roorkee', state: 'Uttarakhand', tier: 'Tier-3' },
  { name: 'Haldwani', state: 'Uttarakhand', tier: 'Tier-3' },
  { name: 'Rishikesh', state: 'Uttarakhand', tier: 'Tier-3' },
  { name: 'Nainital', state: 'Uttarakhand', tier: 'Tier-3' },

  // Himachal Pradesh
  { name: 'Shimla', state: 'Himachal Pradesh', tier: 'Tier-3' },
  { name: 'Dharamshala', state: 'Himachal Pradesh', tier: 'Tier-3' },
  { name: 'Solan', state: 'Himachal Pradesh', tier: 'Tier-3' },
  { name: 'Mandi', state: 'Himachal Pradesh', tier: 'Tier-3' },
  { name: 'Kullu', state: 'Himachal Pradesh', tier: 'Tier-3' },
  { name: 'Manali', state: 'Himachal Pradesh', tier: 'Tier-3' },

  // Goa
  { name: 'Goa', state: 'Goa', tier: 'Tier-2' },
  { name: 'Panaji', state: 'Goa', tier: 'Tier-3' },
  { name: 'Margao', state: 'Goa', tier: 'Tier-3' },
  { name: 'Vasco da Gama', state: 'Goa', tier: 'Tier-3' },
  { name: 'Mapusa', state: 'Goa', tier: 'Tier-3' },

  // Jammu & Kashmir / Ladakh
  { name: 'Srinagar', state: 'Jammu and Kashmir', tier: 'Tier-2' },
  { name: 'Jammu', state: 'Jammu and Kashmir', tier: 'Tier-2' },
  { name: 'Leh', state: 'Ladakh', tier: 'Tier-3' },

  // Union Territories
  { name: 'Puducherry', state: 'Puducherry', tier: 'Tier-3' },
  { name: 'Port Blair', state: 'Andaman and Nicobar Islands', tier: 'Tier-3' },
];

export interface CityOption {
  id: string;
  name: string;
  state?: string | null;
}

export interface PropertyTypeOption {
  id: string;
  name: string;
  category?: string | null;
}

export const DEFAULT_PROPERTY_TYPES: PropertyTypeOption[] = [
  { id: 'pt-1', name: 'Residential Apartment', category: 'Residential' },
  { id: 'pt-2', name: 'Independent House', category: 'Residential' },
  { id: 'pt-3', name: 'Villa', category: 'Residential' },
  { id: 'pt-4', name: 'Builder Floor', category: 'Residential' },
  { id: 'pt-5', name: 'Residential Land', category: 'Plot' },
  { id: 'pt-6', name: 'Commercial Land', category: 'Plot' },
  { id: 'pt-7', name: 'Agricultural Land / Farm House', category: 'Plot' },
  { id: 'pt-fcda', name: 'FCDA Layout Plot', category: 'Plot' },
  { id: 'pt-8', name: 'Office Space', category: 'Commercial' },
  { id: 'pt-9', name: 'Shop', category: 'Commercial' },
  { id: 'pt-10', name: 'Showroom', category: 'Commercial' },
  { id: 'pt-11', name: 'Warehouse', category: 'Commercial' },
  { id: 'pt-12', name: 'Industrial Building', category: 'Commercial' },
  { id: 'pt-13', name: 'Penthouse', category: 'Luxury' },
  { id: 'pt-14', name: 'Luxury Villa', category: 'Luxury' },
  { id: 'pt-15', name: 'Studio Apartment', category: 'Residential' },
  { id: 'pt-16', name: 'Duplex', category: 'Residential' },
  { id: 'pt-17', name: 'Farm House', category: 'Residential' },
];

/**
 * Fetches all cities from Supabase `cities` table and merges with the master Indian cities list.
 * Ensures the returned list is never empty, always contains all Indian cities, and includes real UUIDs when available.
 */
export async function fetchAllIndianCities(): Promise<CityOption[]> {
  return cachedLoader(citiesCache, 'all', loadAllIndianCities);
}

async function loadAllIndianCities(): Promise<CityOption[]> {
  try {
    const { data: dbCities, error } = await supabase
      .from('cities')
      .select('id, name, state')
      .order('name');

    if (error) {
      console.warn('Supabase fetch cities warning:', error);
    }

    const cityMap = new Map<string, CityOption>();

    // 1. First add all master Indian cities with synthetic fallback IDs
    for (const city of ALL_INDIAN_CITIES) {
      const key = city.name.toLowerCase().trim();
      cityMap.set(key, {
        id: `city-seed-${key}`,
        name: city.name,
        state: city.state,
      });
    }

    // 2. Overlay actual database cities with true UUIDs
    if (dbCities && dbCities.length > 0) {
      for (const dbCity of dbCities) {
        if (!dbCity.name) continue;
        const key = dbCity.name.toLowerCase().trim();
        cityMap.set(key, {
          id: dbCity.id,
          name: dbCity.name,
          state: dbCity.state || cityMap.get(key)?.state || null,
        });
      }
    }

    // Sort alphabetically
    return Array.from(cityMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Failed to load cities master:', err);
    return ALL_INDIAN_CITIES.map((c) => ({
      id: `city-${c.name.toLowerCase()}`,
      name: c.name,
      state: c.state,
    }));
  }
}

/**
 * Fetches property types from Supabase and merges with defaults
 */
export async function fetchAllPropertyTypes(): Promise<PropertyTypeOption[]> {
  return cachedLoader(propertyTypesCache, 'all', loadAllPropertyTypes);
}

async function loadAllPropertyTypes(): Promise<PropertyTypeOption[]> {
  try {
    const { data: dbTypes, error } = await supabase
      .from('property_types')
      .select('id, name, category')
      .order('name');

    if (error) {
      console.warn('Supabase fetch property_types warning:', error);
    }

    const typeMap = new Map<string, PropertyTypeOption>();

    for (const type of DEFAULT_PROPERTY_TYPES) {
      typeMap.set(type.name.toLowerCase().trim(), type);
    }

    if (dbTypes && dbTypes.length > 0) {
      for (const dbType of dbTypes) {
        if (!dbType.name) continue;
        typeMap.set(dbType.name.toLowerCase().trim(), {
          id: dbType.id,
          name: dbType.name,
          category: dbType.category,
        });
      }
    }

    return Array.from(typeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Failed to load property types:', err);
    return DEFAULT_PROPERTY_TYPES;
  }
}

/**
 * Helper to ensure a selected city has a valid database record before saving
 */
export async function ensureCityInDatabase(cityName: string, stateName?: string): Promise<string | null> {
  if (!cityName || !cityName.trim()) return null;
  const cleanName = cityName.trim();

  try {
    // Check if exists
    const { data: existing } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', cleanName)
      .maybeSingle();

    if (existing?.id) {
      return existing.id;
    }

    // Find state from master list if not provided
    const matchedMaster = ALL_INDIAN_CITIES.find(
      (c) => c.name.toLowerCase() === cleanName.toLowerCase()
    );
    const resolvedState = stateName || matchedMaster?.state || null;

    // Insert new city
    const { data: inserted, error } = await supabase
      .from('cities')
      .insert({
        name: cleanName,
        state: resolvedState,
        country: 'India',
      })
      .select('id')
      .single();

    if (error) {
      console.warn('Could not insert new city, attempting retry select:', error);
      const { data: retry } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', cleanName)
        .maybeSingle();
      return retry?.id ?? null;
    }

    return inserted?.id ?? null;
  } catch (err) {
    console.error('Error ensuring city in DB:', err);
    return null;
  }
}

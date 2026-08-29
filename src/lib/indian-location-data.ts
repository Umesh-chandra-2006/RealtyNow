/**
 * indian-location-data.ts
 *
 * Hierarchical Indian location dataset for State -> City -> District.
 * Supports dynamic cascading dropdowns:
 *   1. Selecting a State loads its associated Cities.
 *   2. Selecting a City loads its associated Districts.
 */

export interface LocationCityData {
  name: string;
  districts: string[];
}

export interface LocationStateData {
  state: string;
  cities: LocationCityData[];
}

export const INDIAN_LOCATION_HIERARCHY: LocationStateData[] = [
  {
    state: 'Telangana',
    cities: [
      {
        name: 'Hyderabad',
        districts: ['Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Sangareddy'],
      },
      {
        name: 'Secunderabad',
        districts: ['Hyderabad', 'Medchal-Malkajgiri'],
      },
      {
        name: 'Warangal',
        districts: ['Warangal', 'Hanamkonda', 'Jangaon', 'Mahabubabad', 'Jayashankar Bhupalpally'],
      },
      {
        name: 'Nizamabad',
        districts: ['Nizamabad', 'Kamareddy', 'Banswada'],
      },
      {
        name: 'Karimnagar',
        districts: ['Karimnagar', 'Peddapalli', 'Jagtial', 'Rajanna Sircilla'],
      },
      {
        name: 'Khammam',
        districts: ['Khammam', 'Bhadradri Kothagudem'],
      },
      {
        name: 'Ramagundam',
        districts: ['Peddapalli', 'Mancherial'],
      },
      {
        name: 'Mahbubnagar',
        districts: ['Mahbubnagar', 'Narayanpet', 'Nagarkurnool', 'Wanaparthy', 'Jogulamba Gadwal'],
      },
      {
        name: 'Nalgonda',
        districts: ['Nalgonda', 'Suryapet', 'Yadadri Bhuvanagiri'],
      },
      {
        name: 'Adilabad',
        districts: ['Adilabad', 'Nirmal', 'Mancherial', 'Kumuram Bheem Asifabad'],
      },
      {
        name: 'Siddipet',
        districts: ['Siddipet', 'Medak', 'Sangareddy'],
      },
      {
        name: 'Suryapet',
        districts: ['Suryapet', 'Kodad', 'Huzurnagar'],
      },
      {
        name: 'Miryalaguda',
        districts: ['Nalgonda', 'Miryalaguda'],
      },
      {
        name: 'Jagtial',
        districts: ['Jagtial', 'Korutla', 'Metpally'],
      },
      {
        name: 'Mancherial',
        districts: ['Mancherial', 'Bellampalli', 'Mandamarri'],
      },
    ],
  },
  {
    state: 'Andhra Pradesh',
    cities: [
      {
        name: 'Visakhapatnam',
        districts: ['Visakhapatnam', 'Anakapalli', 'Alluri Sitharama Raju'],
      },
      {
        name: 'Vijayawada',
        districts: ['NTR', 'Krishna', 'Guntur'],
      },
      {
        name: 'Guntur',
        districts: ['Guntur', 'Palnadu', 'Bapatla'],
      },
      {
        name: 'Nellore',
        districts: ['SPSR Nellore', 'Tirupati', 'Kavali'],
      },
      {
        name: 'Kurnool',
        districts: ['Kurnool', 'Nandyal', 'Adoni'],
      },
      {
        name: 'Rajahmundry',
        districts: ['East Godavari', 'Kakinada', 'Dr. B.R. Ambedkar Konaseema'],
      },
      {
        name: 'Tirupati',
        districts: ['Tirupati', 'Chittoor', 'Annamayya'],
      },
      {
        name: 'Kakinada',
        districts: ['Kakinada', 'East Godavari'],
      },
      {
        name: 'Kadapa',
        districts: ['YSR Kadapa', 'Annamayya', 'Proddatur'],
      },
      {
        name: 'Anantapur',
        districts: ['Ananthapuramu', 'Sri Sathya Sai', 'Guntakal'],
      },
      {
        name: 'Vizianagaram',
        districts: ['Vizianagaram', 'Parvathipuram Manyam'],
      },
      {
        name: 'Eluru',
        districts: ['Eluru', 'West Godavari'],
      },
      {
        name: 'Ongole',
        districts: ['Prakasam', 'Bapatla'],
      },
      {
        name: 'Nandyal',
        districts: ['Nandyal', 'Allagadda', 'Nandikotkur'],
      },
      {
        name: 'Amaravati',
        districts: ['Guntur', 'NTR'],
      },
      {
        name: 'Srikakulam',
        districts: ['Srikakulam', 'Palasa', 'Tekkali'],
      },
    ],
  },
  {
    state: 'Karnataka',
    cities: [
      {
        name: 'Bengaluru',
        districts: ['Bengaluru Urban', 'Bengaluru Rural', 'Ramanagara', 'Chikkaballapura'],
      },
      {
        name: 'Mysuru',
        districts: ['Mysuru', 'Mandya', 'Chamarajanagar', 'Hassan'],
      },
      {
        name: 'Hubballi-Dharwad',
        districts: ['Dharwad', 'Gadag', 'Haveri', 'Belagavi'],
      },
      {
        name: 'Mangaluru',
        districts: ['Dakshina Kannada', 'Udupi', 'Uttara Kannada'],
      },
      {
        name: 'Belagavi',
        districts: ['Belagavi', 'Chikkodi', 'Bagalkote'],
      },
      {
        name: 'Kalaburagi',
        districts: ['Kalaburagi', 'Yadgir', 'Bidar'],
      },
      {
        name: 'Davanagere',
        districts: ['Davanagere', 'Chitradurga', 'Shivamogga'],
      },
      {
        name: 'Ballari',
        districts: ['Ballari', 'Vijayanagara', 'Koppal'],
      },
      {
        name: 'Vijayapura',
        districts: ['Vijayapura', 'Bagalkote'],
      },
      {
        name: 'Shivamogga',
        districts: ['Shivamogga', 'Bhadravati', 'Sagar'],
      },
      {
        name: 'Tumakuru',
        districts: ['Tumakuru', 'Madhugiri', 'Tiptur'],
      },
      {
        name: 'Udupi',
        districts: ['Udupi', 'Kundapura', 'Karkala'],
      },
    ],
  },
  {
    state: 'Maharashtra',
    cities: [
      {
        name: 'Mumbai',
        districts: ['Mumbai City', 'Mumbai Suburban', 'Thane'],
      },
      {
        name: 'Pune',
        districts: ['Pune', 'Haveli', 'Pimpri-Chinchwad', 'Baramati'],
      },
      {
        name: 'Nagpur',
        districts: ['Nagpur', 'Wardha', 'Bhandara', 'Gondia'],
      },
      {
        name: 'Thane',
        districts: ['Thane', 'Kalyan', 'Bhiwandi', 'Mira-Bhayandar'],
      },
      {
        name: 'Nashik',
        districts: ['Nashik', 'Malegaon', 'Sinnar', 'Niphad'],
      },
      {
        name: 'Navi Mumbai',
        districts: ['Thane', 'Raigad'],
      },
      {
        name: 'Chhatrapati Sambhaji Nagar',
        districts: ['Chhatrapati Sambhaji Nagar', 'Jalna', 'Beed'],
      },
      {
        name: 'Solapur',
        districts: ['Solapur', 'Pandharpur', 'Barshi'],
      },
      {
        name: 'Kolhapur',
        districts: ['Kolhapur', 'Ichalkaranji', 'Sangli'],
      },
      {
        name: 'Amravati',
        districts: ['Amravati', 'Achalpur', 'Akola'],
      },
    ],
  },
  {
    state: 'Tamil Nadu',
    cities: [
      {
        name: 'Chennai',
        districts: ['Chennai', 'Chengalpattu', 'Kanchipuram', 'Tiruvallur'],
      },
      {
        name: 'Coimbatore',
        districts: ['Coimbatore', 'Tiruppur', 'Erode', 'Nilgiris'],
      },
      {
        name: 'Madurai',
        districts: ['Madurai', 'Dindigul', 'Theni', 'Virudhunagar'],
      },
      {
        name: 'Tiruchirappalli',
        districts: ['Tiruchirappalli', 'Karur', 'Perambalur', 'Pudukkottai'],
      },
      {
        name: 'Salem',
        districts: ['Salem', 'Namakkal', 'Dharmapuri'],
      },
      {
        name: 'Tirunelveli',
        districts: ['Tirunelveli', 'Tenkasi', 'Thoothukudi'],
      },
    ],
  },
  {
    state: 'Delhi',
    cities: [
      {
        name: 'New Delhi',
        districts: ['New Delhi', 'Central Delhi', 'South Delhi', 'South West Delhi', 'South East Delhi'],
      },
      {
        name: 'North Delhi',
        districts: ['North Delhi', 'North West Delhi', 'North East Delhi'],
      },
      {
        name: 'East Delhi',
        districts: ['East Delhi', 'Shahdara'],
      },
      {
        name: 'West Delhi',
        districts: ['West Delhi', 'South West Delhi'],
      },
    ],
  },
  {
    state: 'Gujarat',
    cities: [
      {
        name: 'Ahmedabad',
        districts: ['Ahmedabad', 'Gandhinagar', 'Kheda', 'Sanand'],
      },
      {
        name: 'Surat',
        districts: ['Surat', 'Navsari', 'Tapi'],
      },
      {
        name: 'Vadodara',
        districts: ['Vadodara', 'Anand', 'Bharuch'],
      },
      {
        name: 'Rajkot',
        districts: ['Rajkot', 'Morbi', 'Jamnagar'],
      },
      {
        name: 'Gandhinagar',
        districts: ['Gandhinagar', 'Kalol', 'Mansa'],
      },
    ],
  },
  {
    state: 'Uttar Pradesh',
    cities: [
      {
        name: 'Noida / Greater Noida',
        districts: ['Gautam Buddha Nagar', 'Ghaziabad', 'Bulandshahr'],
      },
      {
        name: 'Ghaziabad',
        districts: ['Ghaziabad', 'Hapur', 'Meerut'],
      },
      {
        name: 'Lucknow',
        districts: ['Lucknow', 'Unnao', 'Barabanki', 'Sitapur'],
      },
      {
        name: 'Kanpur',
        districts: ['Kanpur Nagar', 'Kanpur Dehat'],
      },
      {
        name: 'Varanasi',
        districts: ['Varanasi', 'Chandauli', 'Mirzapur'],
      },
      {
        name: 'Agra',
        districts: ['Agra', 'Mathura', 'Firozabad'],
      },
    ],
  },
  {
    state: 'Haryana',
    cities: [
      {
        name: 'Gurugram',
        districts: ['Gurugram', 'Faridabad', 'Rewari', 'Nuh'],
      },
      {
        name: 'Faridabad',
        districts: ['Faridabad', 'Palwal'],
      },
      {
        name: 'Panchkula',
        districts: ['Panchkula', 'Ambala', 'Yamunanagar'],
      },
      {
        name: 'Panipat',
        districts: ['Panipat', 'Karnal', 'Sonipat'],
      },
    ],
  },
  {
    state: 'Kerala',
    cities: [
      {
        name: 'Kochi',
        districts: ['Ernakulam', 'Thrissur', 'Alappuzha', 'Kottayam'],
      },
      {
        name: 'Thiruvananthapuram',
        districts: ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta'],
      },
      {
        name: 'Kozhikode',
        districts: ['Kozhikode', 'Malappuram', 'Wayanad', 'Kannur'],
      },
    ],
  },
  {
    state: 'West Bengal',
    cities: [
      {
        name: 'Kolkata',
        districts: ['Kolkata', 'North 24 Parganas', 'South 24 Parganas', 'Howrah', 'Hooghly'],
      },
      {
        name: 'Siliguri',
        districts: ['Darjeeling', 'Jalpaiguri'],
      },
      {
        name: 'Durgapur',
        districts: ['Paschim Bardhaman', 'Purba Bardhaman'],
      },
    ],
  },
  {
    state: 'Rajasthan',
    cities: [
      {
        name: 'Jaipur',
        districts: ['Jaipur', 'Dausa', 'Tonk', 'Sikar'],
      },
      {
        name: 'Jodhpur',
        districts: ['Jodhpur', 'Pali', 'Nagaur'],
      },
      {
        name: 'Udaipur',
        districts: ['Udaipur', 'Rajsamand', 'Chittorgarh'],
      },
    ],
  },
  {
    state: 'Madhya Pradesh',
    cities: [
      {
        name: 'Indore',
        districts: ['Indore', 'Ujjain', 'Dewas', 'Dhar'],
      },
      {
        name: 'Bhopal',
        districts: ['Bhopal', 'Sehore', 'Raisen'],
      },
      {
        name: 'Gwalior',
        districts: ['Gwalior', 'Morena', 'Bhind'],
      },
    ],
  },
  {
    state: 'Punjab',
    cities: [
      {
        name: 'Ludhiana',
        districts: ['Ludhiana', 'Jalandhar', 'Fatehgarh Sahib'],
      },
      {
        name: 'Amritsar',
        districts: ['Amritsar', 'Tarn Taran', 'Gurdaspur'],
      },
      {
        name: 'Mohali',
        districts: ['SAS Nagar (Mohali)', 'Patiala', 'Rupnagar'],
      },
    ],
  },
  {
    state: 'Goa',
    cities: [
      {
        name: 'Panaji',
        districts: ['North Goa', 'Tiswadi', 'Bardez'],
      },
      {
        name: 'Margao',
        districts: ['South Goa', 'Salcete', 'Mormugao'],
      },
    ],
  },
];

/**
 * Returns all available Indian states.
 */
export function getIndianStates(): string[] {
  return INDIAN_LOCATION_HIERARCHY.map((s) => s.state);
}

/**
 * Returns all available cities for a selected state.
 */
export function getCitiesForState(stateName: string): string[] {
  if (!stateName) return [];
  const stateData = INDIAN_LOCATION_HIERARCHY.find(
    (s) => s.state.toLowerCase() === stateName.toLowerCase()
  );
  if (!stateData) return [];
  return stateData.cities.map((c) => c.name);
}

/**
 * Returns all available districts for a selected state & city.
 */
export function getDistrictsForCity(stateName: string, cityName: string): string[] {
  if (!stateName) return [];
  const stateData = INDIAN_LOCATION_HIERARCHY.find(
    (s) => s.state.toLowerCase() === stateName.toLowerCase()
  );
  if (!stateData) return [];

  if (!cityName) {
    // Return unique union of all districts in the state
    const allDistricts = new Set<string>();
    stateData.cities.forEach((c) => c.districts.forEach((d) => allDistricts.add(d)));
    return Array.from(allDistricts);
  }

  const cityData = stateData.cities.find(
    (c) => c.name.toLowerCase() === cityName.toLowerCase()
  );
  if (!cityData) {
    // Fallback to all state districts
    const allDistricts = new Set<string>();
    stateData.cities.forEach((c) => c.districts.forEach((d) => allDistricts.add(d)));
    return Array.from(allDistricts);
  }

  return cityData.districts;
}

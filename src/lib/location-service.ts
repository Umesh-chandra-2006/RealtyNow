
export interface StructuredCity {
  id: string;
  name: string;
  state: string;
  country: string;
  isPopular?: boolean;
}

export interface StructuredArea {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  state: string;
  country: string;
  isPopular?: boolean;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  formattedAddress?: string;
}

export interface UnifiedLocationSelection {
  cityId?: string;
  cityName?: string;
  localityId?: string;
  localityName?: string;
  state?: string;
  country?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
}

// ── Active Operational Cities (Currently Hyderabad only) ───────────────────
export const POPULAR_CITIES: StructuredCity[] = [
  { id: 'Hyderabad', name: 'Hyderabad', state: 'Telangana', country: 'India', isPopular: true },
];

// ── Curated Offline/Instant Master Areas per City ───────────────────────────
export const CITY_AREAS_MASTER: Record<string, string[]> = {
  hyderabad: [
    // Top Tier & IT Corridor
    'Banjara Hills',
    'Jubilee Hills',
    'Madhapur',
    'Gachibowli',
    'Kondapur',
    'Hitech City',
    'Kokapet',
    'Financial District',
    'Nanakramguda',
    'Puppalguda',
    'Tellapur',
    'Manikonda',
    'Nallagandla',
    'Narsingi',
    'Khajaguda',
    'Raidurg',
    'Gandipet',
    'Shankarpalli',
    'Mokila',
    'Kollur',
    'Osman Nagar',
    'Velimela',

    // North & West Hotspots
    'Kukatpally',
    'KPHB Colony',
    'Miyapur',
    'Bachupally',
    'Nizampet',
    'Pragathi Nagar',
    'Chandanagar',
    'Hafeezpet',
    'Madeenaguda',
    'Patancheru',
    'Ameerpet',
    'Begumpet',
    'Somajiguda',
    'Panjagutta',
    'Sanath Nagar',
    'Kompally',
    'Medchal',
    'Bowenpally',
    'Alwal',
    'Sainikpuri',
    'Yapral',
    'Dammaiguda',
    'Nagaram',
    'Rampally',
    'Jawaharnagar',
    'Keesara',

    // East & Industrial Corridor
    'Boduppal',
    'Uppal',
    'Nagole',
    'Peerzadiguda',
    'Medipally',
    'Ghatkesar',
    'Pocharam',
    'Chengicherla',
    'Bandlaguda',
    'Kapra',
    'Kushaiguda',
    'Nacharam',
    'Mallapur',
    'AS Rao Nagar',
    'Moula Ali',
    'Malkajgiri',
    'Cherlapally',
    'ECIL',
    'Habsiguda',
    'Tarnaka',
    'Ramanthapur',
    'LB Nagar',
    'Dilsukhnagar',
    'Kothapet',
    'Saroornagar',
    'Hayathnagar',
    'Vanasthalipuram',

    // Central & Old City
    'Secunderabad',
    'Himayatnagar',
    'Abids',
    'Narayanaguda',
    'Chikkadpally',
    'Kachiguda',
    'Nallakunta',
    'Barkatpura',
    'Vidyanagar',
    'Amberpet',
    'Mehdipatnam',
    'Tolichowki',
    'Shaikpet',
    'Attapur',
    'Rajendranagar',
    'Charminar',
    'Chandrayangutta',
    'Santoshnagar',

    // South & Airport / Growth Corridor
    'Shamshabad',
    'Tukkuguda',
    'Adibatla',
    'Bongloor',
    'Ibrahimpatnam',
    'Maheswaram',
    'Kandukur',
    'Shadnagar',
    'Kothur',
    'Thimmapur',
  ],

  bengaluru: [
    'Koramangala',
    'Indiranagar',
    'Whitefield',
    'HSR Layout',
    'Electronic City',
    'Jayanagar',
    'JP Nagar',
    'Marathahalli',
    'Bellandur',
    'Sarjapur Road',
    'Hebbal',
    'Yelahanka',
    'Banashankari',
    'Malleshwaram',
    'Rajajinagar',
    'Thanisandra',
  ],

  vijayawada: [
    'Benz Circle',
    'MG Road',
    'Governorpet',
    'Poranki',
    'Kanuru',
    'Enikepadu',
    'Gollapudi',
    'Bhavanipuram',
    'Auto Nagar',
    'Gunadala',
    'Tadepalli',
    'Mangalagiri',
  ],

  visakhapatnam: [
    'MVP Colony',
    'Beach Road',
    'Siripuram',
    'Gajuwaka',
    'Madhurawada',
    'Seethammadhara',
    'Rushikonda',
    'Yendada',
    'Waltair Uplands',
    'Pendurthi',
  ],

  mumbai: [
    'Bandra West',
    'Andheri West',
    'Juhu',
    'Powai',
    'Worli',
    'Lower Parel',
    'Dadar',
    'Thane West',
    'Navi Mumbai',
    'Borivali West',
    'Malad West',
    'Goregaon West',
  ],

  pune: [
    'Baner',
    'Wakad',
    'Hinjewadi',
    'Kharadi',
    'Viman Nagar',
    'Koregaon Park',
    'Kothrud',
    'Hadapsar',
    'Aundh',
    'Magarpatta',
    'Bavdhan',
  ],

  chennai: [
    'Anna Nagar',
    'T. Nagar',
    'Adyar',
    'Besant Nagar',
    'OMR',
    'Velachery',
    'Thiruvanmiyur',
    'ECR',
    'Porur',
    'Guindy',
    'Nungambakkam',
  ],

  'delhi ncr': [
    'Golf Course Road',
    'Cyber City',
    'DLF Phase 5',
    'Sohna Road',
    'Noida Sector 150',
    'Noida Sector 62',
    'Greater Noida',
    'Vasant Kunj',
    'Dwarka',
  ],
};

/**
 * Normalizes city strings for dictionary lookups
 */
export function normalizeCityKey(cityName: string): string {
  const c = cityName.toLowerCase().trim();
  if (c.includes('bangalore') || c.includes('bengaluru')) return 'bengaluru';
  if (c.includes('delhi') || c.includes('gurgaon') || c.includes('noida')) return 'delhi ncr';
  if (c.includes('vizag') || c.includes('visakhapatnam')) return 'visakhapatnam';
  return c;
}

/**
 * Gets popular offline areas for a specific city
 */
export function getPopularAreasForCity(cityName: string): string[] {
  if (!cityName) return [];
  const key = normalizeCityKey(cityName);
  return CITY_AREAS_MASTER[key] ?? CITY_AREAS_MASTER['hyderabad'] ?? [];
}

/**
 * Searches cities across master list + Supabase DB records
 */
export async function searchCities(query: string): Promise<StructuredCity[]> {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_CITIES;

  return POPULAR_CITIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
  );
}

/**
 * Searches areas/localities strictly scoped to the selected city.
 * Combines curated master areas + live Google Places Autocomplete.
 */
export async function searchAreasForCity({
  cityName,
  stateName,
  query,
}: {
  cityName: string;
  stateName?: string;
  query: string;
}): Promise<StructuredArea[]> {
  if (!cityName) return [];

  const q = query.trim().toLowerCase();
  const popularList = getPopularAreasForCity(cityName);
  const cityId = cityName;
  const state = stateName || (POPULAR_CITIES.find((c) => c.name.toLowerCase() === cityName.toLowerCase())?.state ?? 'Telangana');

  // 1. Filter local curated areas with fuzzy/substring matching
  const matchingCurated: StructuredArea[] = popularList
    .filter((areaName) => {
      if (!q) return true;
      const lower = areaName.toLowerCase();
      if (lower.includes(q)) return true;
      // Alias/fuzzy matching for common prefixes e.g. bodi -> boduppal, kphb -> kphb colony
      if (q.startsWith('bod') && lower.startsWith('bod')) return true;
      if (q.startsWith('gach') && lower.startsWith('gach')) return true;
      if (q.startsWith('madh') && lower.startsWith('madh')) return true;
      if (q.startsWith('kond') && lower.startsWith('kond')) return true;
      if (q.startsWith('kukat') && lower.startsWith('kukat')) return true;
      if (q.startsWith('tell') && lower.startsWith('tell')) return true;
      if (q.startsWith('koka') && lower.startsWith('koka')) return true;
      return false;
    })
    .map((areaName) => ({
      id: areaName,
      name: areaName,
      cityId,
      cityName,
      state,
      country: 'India',
      isPopular: true,
      formattedAddress: `${areaName}, ${cityName}, ${state}, India`,
    }));

  // If query is short or empty, return curated list immediately
  if (!q || q.length < 2) {
    return matchingCurated;
  }

  // 2. Fetch Google Places Autocomplete predictions scoped to the city
  try {
    const placesPredictions = await getGooglePlacesAreaPredictions(q, cityName, state);
    
    // Combine and deduplicate
    const areaMap = new Map<string, StructuredArea>();
    for (const a of matchingCurated) {
      areaMap.set(a.name.toLowerCase(), a);
    }

    for (const p of placesPredictions) {
      const cleanName = p.name.trim();
      const key = cleanName.toLowerCase();
      if (!areaMap.has(key)) {
        areaMap.set(key, {
          id: cleanName,
          name: cleanName,
          cityId,
          cityName,
          state,
          country: 'India',
          isPopular: false,
          placeId: p.placeId,
          formattedAddress: p.formattedAddress || `${cleanName}, ${cityName}, ${state}, India`,
        });
      }
    }

    // If query has no matches, provide the query itself as a searchable locality
    if (areaMap.size === 0 && q.length >= 2) {
      const customTitle = query.trim().charAt(0).toUpperCase() + query.trim().slice(1);
      areaMap.set(q, {
        id: customTitle,
        name: customTitle,
        cityId,
        cityName,
        state,
        country: 'India',
        isPopular: false,
        formattedAddress: `${customTitle}, ${cityName}, ${state}, India`,
      });
    }

    return Array.from(areaMap.values()).sort((a, b) => {
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    console.warn('Google Places autocomplete fallback to local areas:', err);
    return matchingCurated;
  }
}

/**
 * Calls Google Places Autocomplete service / API scoped to city
 */
async function getGooglePlacesAreaPredictions(
  query: string,
  cityName: string,
  stateName?: string
): Promise<{ name: string; placeId?: string; formattedAddress?: string }[]> {
  // If Google Maps JavaScript SDK is already loaded in window
  if (typeof window !== 'undefined' && (window as any).google?.maps?.places?.AutocompleteService) {
    return new Promise((resolve) => {
      const service = new (window as any).google.maps.places.AutocompleteService();
      const scopedInput = `${query}, ${cityName}`;
      service.getPlacePredictions(
        {
          input: scopedInput,
          componentRestrictions: { country: 'in' },
          types: ['geocode', 'sublocality', 'neighborhood'],
        },
        (predictions: any[], status: any) => {
          if (status !== (window as any).google.maps.places.PlacesServiceStatus.OK || !predictions) {
            resolve([]);
            return;
          }

          const results = predictions.map((p) => {
            const mainText = p.structured_formatting?.main_text || p.description.split(',')[0];
            return {
              name: mainText,
              placeId: p.place_id,
              formattedAddress: p.description,
            };
          });
          resolve(results);
        }
      );
    });
  }

  // Direct REST API fallback if API key is present
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  try {
    const input = encodeURIComponent(`${query}, ${cityName}`);
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}&components=country:in&types=geocode&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'OK' || !Array.isArray(data.predictions)) return [];

    return data.predictions.map((p: any) => ({
      name: p.structured_formatting?.main_text || p.description.split(',')[0],
      placeId: p.place_id,
      formattedAddress: p.description,
    }));
  } catch {
    return [];
  }
}

export interface DetectedLocationResult {
  city: string;
  area?: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

export async function detectCurrentLocationCoordinates(): Promise<{ lat: number; lng: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/**
 * Detects user's current city and sub-area/locality via Google Geocoding or OSM Nominatim
 */
export async function detectUserCurrentCityAndArea(): Promise<DetectedLocationResult> {
  const { lat, lng } = await detectCurrentLocationCoordinates();

  // 1. Try Google Geocoding if API key is present
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          const first = data.results[0];
          const components = first.address_components || [];

          const getComp = (types: string[]) => {
            const match = components.find((c: any) => types.some((t) => c.types.includes(t)));
            return match?.long_name || '';
          };

          const area = getComp(['sublocality_level_1', 'sublocality', 'neighborhood', 'locality']);
          const city = getComp(['locality', 'administrative_area_level_2', 'administrative_area_level_3']) || 'Hyderabad';
          const state = getComp(['administrative_area_level_1']) || 'Telangana';
          const country = getComp(['country']) || 'India';

          return {
            city: city.replace(/ (District|City|Mandal)$/i, ''),
            area: area && area.toLowerCase() !== city.toLowerCase() ? area : undefined,
            state,
            country,
            latitude: lat,
            longitude: lng,
            formattedAddress: first.formatted_address,
          };
        }
      }
    } catch (e) {
      console.warn('Google reverse geocoding fallback to Nominatim:', e);
    }
  }

  // 2. Fallback to OpenStreetMap Nominatim
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
    {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'RealtyNow/1.0 (contact@realtynow.in)',
      },
    }
  );
  const data = await res.json();
  const addr = data?.address || {};
  const area = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || addr.subdistrict;
  const city = addr.city || addr.town || addr.state_district || addr.county || 'Hyderabad';
  const state = addr.state || 'Telangana';
  const country = addr.country || 'India';

  return {
    city: String(city).replace(/ (District|City|Mandal)$/i, ''),
    area: area ? String(area) : undefined,
    state,
    country,
    latitude: lat,
    longitude: lng,
    formattedAddress: data?.display_name,
  };
}

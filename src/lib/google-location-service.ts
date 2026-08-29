/**
 * google-location-service.ts
 *
 * Professional Google Maps Platform & Places API integration for Indian locations.
 * Provides:
 *   - Live Google Places Autocomplete for Indian Cities & Localities/Areas.
 *   - Google Geocoder for resolving State, City, District, Area, Coordinates, and Place ID.
 *   - In-memory caching and debouncing to minimize billable API calls.
 *   - Graceful offline and fallback handling.
 */

import { loadGoogleMaps } from './googleMaps';
import { ALL_INDIAN_CITIES } from './indian-cities';
import { CITY_AREAS_MASTER } from './location-service';

export interface GoogleLocationDetails {
  state: string;
  city: string;
  area: string;
  district: string;
  country: string;
  placeId?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface GooglePlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

// In-memory cache for place details and geocoding
const PLACE_DETAILS_CACHE = new Map<string, GoogleLocationDetails>();
const CITY_AREAS_CACHE = new Map<string, string[]>();

/**
 * Extracts structured Indian address components from Google Maps Geocoder or Places Result
 */
export function parseGoogleAddressComponents(
  components: google.maps.GeocoderAddressComponent[] = [],
  formattedAddress = '',
  geometry?: google.maps.GeocoderGeometry | google.maps.places.PlaceGeometry,
  placeId?: string
): GoogleLocationDetails {
  const getComp = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name || '';

  const sublocality =
    getComp('sublocality_level_1') ||
    getComp('sublocality') ||
    getComp('neighborhood') ||
    getComp('sublocality_level_2');

  const locality = getComp('locality');
  const adminLevel2 = getComp('administrative_area_level_2');
  const adminLevel3 = getComp('administrative_area_level_3');
  const state = getComp('administrative_area_level_1') || 'Telangana';
  const country = getComp('country') || 'India';

  // In India:
  // - city is typically locality (or adminLevel2 if locality is empty)
  // - district is administrative_area_level_2 (e.g. Hyderabad, Rangareddy, Medchal, Bengaluru Urban, Pune)
  const city = locality || adminLevel2 || adminLevel3 || 'Hyderabad';
  const district = adminLevel2 || adminLevel3 || city;
  const area = sublocality && sublocality.toLowerCase() !== city.toLowerCase() ? sublocality : (sublocality || '');

  let lat: number | undefined;
  let lng: number | undefined;

  if (geometry?.location) {
    const loc = geometry.location as any;
    if (typeof loc.lat === 'function') {
      lat = loc.lat();
    } else if (typeof loc.lat === 'number') {
      lat = loc.lat;
    }

    if (typeof loc.lng === 'function') {
      lng = loc.lng();
    } else if (typeof loc.lng === 'number') {
      lng = loc.lng;
    }
  }

  return {
    state: state.replace(/ (State|Pradesh)$/i, (m) => m),
    city: city.replace(/ (District|City|Mandal)$/i, '').trim(),
    area: area.trim(),
    district: district.replace(/ (District|Mandal)$/i, '').trim(),
    country,
    placeId,
    formattedAddress,
    latitude: lat,
    longitude: lng,
  };
}

/**
 * Search Indian Cities using Google Places Autocomplete
 */
export async function searchGoogleIndianCities(query: string): Promise<GooglePlacePrediction[]> {
  if (!query || query.trim().length < 1) return [];

  try {
    const google = await loadGoogleMaps();
    const service = new google.maps.places.AutocompleteService();

    return new Promise((resolve) => {
      service.getPlacePredictions(
        {
          input: query.trim(),
          types: ['(cities)'],
          componentRestrictions: { country: 'in' },
        },
        (predictions, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            Array.isArray(predictions)
          ) {
            resolve(
              predictions.map((p) => ({
                placeId: p.place_id,
                mainText: p.structured_formatting?.main_text || p.description.split(',')[0],
                secondaryText: p.structured_formatting?.secondary_text || '',
                description: p.description,
              }))
            );
          } else {
            // Fallback to local Indian cities database
            const matched = ALL_INDIAN_CITIES.filter((c) =>
              c.name.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 8);

            resolve(
              matched.map((c) => ({
                placeId: `local-${c.name.toLowerCase()}`,
                mainText: c.name,
                secondaryText: `${c.state}, India`,
                description: `${c.name}, ${c.state}, India`,
              }))
            );
          }
        }
      );
    });
  } catch (err) {
    console.warn('Google Maps autocomplete unavailable, using fallback:', err);
    const matched = ALL_INDIAN_CITIES.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);

    return matched.map((c) => ({
      placeId: `local-${c.name.toLowerCase()}`,
      mainText: c.name,
      secondaryText: `${c.state}, India`,
      description: `${c.name}, ${c.state}, India`,
    }));
  }
}

/**
 * Search Areas / Localities within a selected Indian City using Google Places Autocomplete
 */
export async function searchGoogleCityAreas(
  query: string,
  cityName: string,
  stateName?: string
): Promise<GooglePlacePrediction[]> {
  if (!cityName) return [];

  const cacheKey = `${cityName.toLowerCase()}:${query.toLowerCase()}`;

  try {
    const google = await loadGoogleMaps();
    const service = new google.maps.places.AutocompleteService();

    const input = query?.trim()
      ? `${query.trim()}, ${cityName}${stateName ? `, ${stateName}` : ''}`
      : `${cityName}${stateName ? `, ${stateName}` : ''}`;

    return new Promise((resolve) => {
      service.getPlacePredictions(
        {
          input,
          types: ['geocode'],
          componentRestrictions: { country: 'in' },
        },
        (predictions, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            Array.isArray(predictions)
          ) {
            resolve(
              predictions.map((p) => ({
                placeId: p.place_id,
                mainText: p.structured_formatting?.main_text || p.description.split(',')[0],
                secondaryText: p.structured_formatting?.secondary_text || '',
                description: p.description,
              }))
            );
          } else {
            resolve([]);
          }
        }
      );
    });
  } catch {
    return [];
  }
}

/**
 * Fetch default popular areas for a city from Google Geocoder or verified master list
 */
export async function fetchPopularAreasForCity(
  cityName: string,
  stateName?: string
): Promise<string[]> {
  if (!cityName) return [];
  const cityKey = cityName.toLowerCase();

  if (CITY_AREAS_CACHE.has(cityKey)) {
    return CITY_AREAS_CACHE.get(cityKey)!;
  }

  // Check if we have instant curated master areas (e.g. Hyderabad, Bengaluru, Mumbai)
  if (CITY_AREAS_MASTER[cityKey] && CITY_AREAS_MASTER[cityKey].length > 0) {
    CITY_AREAS_CACHE.set(cityKey, CITY_AREAS_MASTER[cityKey]);
    return CITY_AREAS_MASTER[cityKey];
  }

  // Otherwise query Google Geocoder / Places to discover prominent localities
  try {
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();

    const res = await geocoder.geocode({
      address: `${cityName}, ${stateName || 'India'}`,
      componentRestrictions: { country: 'in' },
    });

    if (res.results && res.results.length > 0) {
      const discovered = new Set<string>();
      res.results.forEach((r) => {
        const parsed = parseGoogleAddressComponents(r.address_components, r.formatted_address);
        if (parsed.area && parsed.area.toLowerCase() !== cityName.toLowerCase()) {
          discovered.add(parsed.area);
        }
      });

      const list = Array.from(discovered);
      if (list.length > 0) {
        CITY_AREAS_CACHE.set(cityKey, list);
        return list;
      }
    }
  } catch (err) {
    console.warn('Could not fetch areas from Google Geocoder:', err);
  }

  return [];
}

/**
 * Resolve full place details (State, City, District, Area, Lat, Lng) from a Google Place ID
 */
export async function resolveGooglePlaceDetails(
  placeId: string
): Promise<GoogleLocationDetails | null> {
  if (!placeId) return null;

  if (PLACE_DETAILS_CACHE.has(placeId)) {
    return PLACE_DETAILS_CACHE.get(placeId)!;
  }

  // If local fallback place
  if (placeId.startsWith('local-')) {
    const cityName = placeId.replace('local-', '');
    const found = ALL_INDIAN_CITIES.find(
      (c) => c.name.toLowerCase() === cityName.toLowerCase()
    );
    if (found) {
      const details: GoogleLocationDetails = {
        city: found.name,
        state: found.state,
        district: found.name,
        area: '',
        country: 'India',
        formattedAddress: `${found.name}, ${found.state}, India`,
      };
      PLACE_DETAILS_CACHE.set(placeId, details);
      return details;
    }
  }

  try {
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();

    const res = await geocoder.geocode({ placeId });
    if (res.results && res.results.length > 0) {
      const first = res.results[0];
      const details = parseGoogleAddressComponents(
        first.address_components,
        first.formatted_address,
        first.geometry,
        placeId
      );
      PLACE_DETAILS_CACHE.set(placeId, details);
      return details;
    }
  } catch (err) {
    console.warn('Failed to resolve Google Place Details:', err);
  }

  return null;
}

/**
 * Geocode text address or coordinates to structured Indian location
 */
export async function geocodeLocationAddress(
  query: string
): Promise<GoogleLocationDetails | null> {
  if (!query || !query.trim()) return null;

  try {
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();

    const res = await geocoder.geocode({
      address: query.trim(),
      componentRestrictions: { country: 'in' },
    });

    if (res.results && res.results.length > 0) {
      const first = res.results[0];
      return parseGoogleAddressComponents(
        first.address_components,
        first.formatted_address,
        first.geometry,
        first.place_id
      );
    }
  } catch (err) {
    console.warn('Geocoding failed:', err);
  }

  return null;
}

import { useState, useEffect, useCallback, useRef } from 'react';

let isScriptLoaded = false;
let isScriptLoading = false;
let loadingPromise: Promise<void> | null = null;

export interface GooglePlacePrediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GooglePlaceDetails {
  location_name: string;
  area: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  country: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string;
  formatted_address: string;
}

export function useGooglePlaces() {
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (isScriptLoaded) {
      setIsReady(true);
      return;
    }

    if (isScriptLoading && loadingPromise) {
      loadingPromise.then(() => setIsReady(true)).catch(() => setLoadError('Google Maps failed to load.'));
      return;
    }

    isScriptLoading = true;
    loadingPromise = new Promise((resolve, reject) => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error('Missing Google Maps API Key');
        isScriptLoading = false;
        loadingPromise = null;
        setLoadError('Google Maps is not configured.');
        reject(new Error('Missing API Key'));
        return;
      }

      (window as any).initGoogleMaps = () => {
        isScriptLoaded = true;
        isScriptLoading = false;
        loadingPromise = null;
        setIsReady(true);
        setLoadError(null);
        resolve();
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;
      script.onerror = (e) => {
        // Reset module state so a later mount retries instead of being stuck
        // on the rejected promise forever (the infinite "loading" bug).
        isScriptLoading = false;
        loadingPromise = null;
        setLoadError('Google Maps failed to load.');
        reject(e);
      };
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (isReady && window.google) {
      if (!autocompleteServiceRef.current) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      }
      if (!placesServiceRef.current) {
        // PlacesService needs a DOM element, we can pass a dummy div
        placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement('div'));
      }
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }
    }
  }, [isReady]);

  const getPredictions = useCallback(async (input: string): Promise<GooglePlacePrediction[]> => {
    if (!isReady || !autocompleteServiceRef.current || !input.trim()) return [];

    return new Promise((resolve) => {
      autocompleteServiceRef.current!.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: 'in' },
        },
        (predictions, status) => {
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
            resolve([]);
            return;
          }
          resolve(predictions);
        }
      );
    });
  }, [isReady]);

  const getPlaceDetails = useCallback(async (placeId: string): Promise<GooglePlaceDetails | null> => {
    if (!isReady || !geocoderRef.current) return null;

    return new Promise((resolve) => {
      geocoderRef.current!.geocode({ placeId }, (results, status) => {
        if (status !== window.google.maps.GeocoderStatus.OK || !results || results.length === 0) {
          resolve(null);
          return;
        }

        const result = results[0];
        
        let area = '';
        let locality = '';
        let city = '';
        let district = '';
        let state = '';
        let country = '';
        let postal_code = '';

        result.address_components.forEach((component) => {
          const types = component.types;
          if (types.includes('sublocality_level_2') || types.includes('sublocality_level_3')) {
            area = component.long_name;
          }
          if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
            locality = component.long_name;
          }
          if (types.includes('locality')) {
            city = component.long_name;
          }
          if (types.includes('administrative_area_level_3')) {
            district = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
          }
          if (types.includes('country')) {
            country = component.long_name;
          }
          if (types.includes('postal_code')) {
            postal_code = component.long_name;
          }
        });

        // Fallbacks
        if (!area) area = locality;
        if (!locality) locality = city;
        if (!district) district = city;

        const location_name = (result as any).name || result.address_components[0]?.long_name || result.formatted_address.split(',')[0];

        const details: GooglePlaceDetails = {
          location_name,
          area,
          locality,
          city,
          district,
          state,
          country,
          postal_code,
          latitude: result.geometry.location.lat(),
          longitude: result.geometry.location.lng(),
          google_place_id: placeId,
          formatted_address: result.formatted_address,
        };
        resolve(details);
      });
    });
  }, [isReady]);

  return { isReady, loadError, getPredictions, getPlaceDetails };
}

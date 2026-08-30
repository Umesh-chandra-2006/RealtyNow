import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { generatePropertyUrl, buildWhatsAppUrl, cn } from '../lib/utils';
import { getPropertyPricingDisplay } from '../lib/plot-pricing';
import { resolvePropertyCoordinates, ResolvedCoordinates, CITY_COORDINATES } from '../lib/geo-coordinates';
import {
  MapPin,
  Maximize2,
  Bed,
  Bath,
  Sparkles,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import type { Property } from '../lib/types';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../lib/property-images';

// Fix for default marker icon in leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface PropertyMapProps {
  properties: Property[];
  selectedPropertyId?: string | null;
  hoveredPropertyId?: string | null;
  onSelectProperty?: (property: Property) => void;
  height?: string;
  className?: string;
  defaultCity?: string;
  showControls?: boolean;
}

interface MappedPropertyItem {
  property: Property;
  coords: ResolvedCoordinates;
}

// Custom HTML price badge generator
function createPricePinIcon(
  p: Property,
  isSelected: boolean,
  isHovered: boolean
): L.DivIcon {
  const isRent = ['Rent', 'Lease', 'PG', 'CoLiving', 'Hostel'].includes(p.purpose || '');
  const isLuxury = p.is_luxury || p.price >= 30000000;
  const isFeatured = p.is_featured;

  const pricing = getPropertyPricingDisplay(p, { compactConstructed: true });
  const displayPrice = pricing.primaryPrice;

  let themeClass = 'bg-white text-slate-900 border-slate-300 shadow-md';
  let badgeColor = 'bg-slate-700';

  if (isLuxury) {
    themeClass = 'bg-gradient-to-r from-slate-900 to-navy-950 text-amber-300 border-amber-400/60 shadow-lg shadow-amber-900/20';
    badgeColor = 'bg-amber-400 text-navy-950';
  } else if (isRent) {
    themeClass = 'bg-white text-emerald-800 border-emerald-400 shadow-md';
    badgeColor = 'bg-emerald-600 text-white';
  } else {
    themeClass = 'bg-white text-red-700 border-red-300 shadow-md';
    badgeColor = 'bg-red-600 text-white';
  }

  if (isSelected || isHovered) {
    themeClass = 'bg-red-600 text-white border-white ring-4 ring-red-600/30 scale-110 shadow-xl z-50';
  }

  const html = `
    <div class="group relative flex cursor-pointer items-center transition-all duration-200 ${isSelected || isHovered ? 'z-50' : 'z-10'}">
      <div class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black tracking-tight ${themeClass}">
        ${isLuxury ? '<span class="text-[10px]">✨</span>' : ''}
        <span>${displayPrice}</span>
      </div>
      <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b ${isSelected || isHovered ? 'bg-red-600 border-red-600' : isLuxury ? 'bg-navy-950 border-amber-400/60' : 'bg-white border-slate-300'}"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-property-pin-wrapper',
    html,
    iconSize: [85, 36],
    iconAnchor: [42, 36],
    popupAnchor: [0, -36],
  });
}

// Helper to fit bounds to available properties
function MapBoundsUpdater({
  mappedItems,
  selectedPropertyId,
}: {
  mappedItems: MappedPropertyItem[];
  selectedPropertyId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedPropertyId) {
      const target = mappedItems.find((m) => m.property.id === selectedPropertyId);
      if (target) {
        map.flyTo([target.coords.lat, target.coords.lng], Math.max(map.getZoom(), 15), {
          duration: 0.8,
        });
        return;
      }
    }

    if (mappedItems && mappedItems.length > 0) {
      const bounds = L.latLngBounds(mappedItems.map((m) => [m.coords.lat, m.coords.lng]));
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 14,
        animate: true,
      });
    }
  }, [map, mappedItems, selectedPropertyId]);

  return null;
}

export function PropertyMap({
  properties,
  selectedPropertyId,
  hoveredPropertyId,
  onSelectProperty,
  height = '560px',
  className = '',
  defaultCity = 'Hyderabad',
  showControls = true,
}: PropertyMapProps) {
  const [tileMode, setTileMode] = useState<'standard' | 'voyager' | 'satellite'>('standard');
  const [activePopupId, setActivePopupId] = useState<string | null>(selectedPropertyId || null);
  const mapRef = useRef<L.Map | null>(null);

  // Synchronize active popup with selected property
  useEffect(() => {
    if (selectedPropertyId) {
      setActivePopupId(selectedPropertyId);
    }
  }, [selectedPropertyId]);

  // Resolve authentic coordinates for every property
  const mappedItems: MappedPropertyItem[] = useMemo(() => {
    if (!properties || properties.length === 0) return [];
    return properties
      .map((p, idx) => {
        const coords = resolvePropertyCoordinates(p as any, idx);
        if (!coords) return null;
        return { property: p, coords };
      })
      .filter((item): item is MappedPropertyItem => item !== null);
  }, [properties]);

  // Determine initial center
  const defaultCenter = useMemo((): [number, number] => {
    if (mappedItems.length > 0) {
      return [mappedItems[0].coords.lat, mappedItems[0].coords.lng];
    }
    const cityKey = (defaultCity || 'hyderabad').toLowerCase();
    return CITY_COORDINATES[cityKey] || CITY_COORDINATES.hyderabad;
  }, [mappedItems, defaultCity]);

  // Tile layer URLs
  const tileConfig = {
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
  }[tileMode];

  const handleFitBounds = () => {
    if (mapRef.current && mappedItems.length > 0) {
      const bounds = L.latLngBounds(mappedItems.map((m) => [m.coords.lat, m.coords.lng]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  return (
    <div
      className={cn(
        'group/map relative w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-50 shadow-sm transition-all duration-300',
        className
      )}
      style={{ height }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={12}
        ref={mapRef}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        scrollWheelZoom={true}
        className="z-0"
      >
        <TileLayer attribution={tileConfig.attribution} url={tileConfig.url} />
        <MapBoundsUpdater mappedItems={mappedItems} selectedPropertyId={selectedPropertyId} />

        {mappedItems.map(({ property: p, coords }) => {
          const isSelected = p.id === selectedPropertyId || p.id === activePopupId;
          const isHovered = p.id === hoveredPropertyId;
          const icon = createPricePinIcon(p, isSelected, isHovered);

          const coverImage = getPropertyCoverImage(p);

          const pricing = getPropertyPricingDisplay(p);
          const fullPrice = pricing.primaryPrice;
          const isRent = ['Rent', 'Lease', 'PG', 'CoLiving'].includes(p.purpose || '');
          const localityLabel = [p.locality_name || coords.locality, p.city_name || coords.city]
            .filter(Boolean)
            .join(', ');

          const targetPhone = (p as any).agent?.whatsapp_number || (p as any).agent?.phone_number || (p as any).agent?.phone || (p as any).phone;
          const whatsappUrl = buildWhatsAppUrl(targetPhone, p.title);

          return (
            <Marker
              key={p.id}
              position={[coords.lat, coords.lng]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  setActivePopupId(p.id);
                  onSelectProperty?.(p);
                },
              }}
            >
              <Popup
                className="realtynow-map-popup"
                closeButton={true}
                maxWidth={320}
                minWidth={280}
              >
                <div className="overflow-hidden rounded-2xl bg-white font-sans text-slate-900 shadow-2xl">
                  {/* Thumbnail Banner */}
                  <div className="relative h-36 w-full bg-slate-900 overflow-hidden group">
                    <img
                      src={coverImage}
                      alt={p.title}
                      onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Purpose / Status Badges */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm backdrop-blur-md',
                          isRent
                            ? 'bg-emerald-600/90 text-white'
                            : 'bg-red-600/90 text-white'
                        )}
                      >
                        {p.purpose || 'For Sale'}
                      </span>
                      {p.is_luxury && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-navy-950 shadow-sm">
                          <Sparkles className="h-3 w-3" /> Luxury
                        </span>
                      )}
                    </div>

                    {/* Price Overlay */}
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-baseline justify-between text-white">
                      <div>
                        <span className="text-lg font-black tracking-tight text-white drop-shadow-md">
                          {fullPrice}
                        </span>
                      </div>
                      {pricing.areaDisplay ? (
                        <span className="text-xs font-semibold text-slate-200 drop-shadow">
                          {pricing.areaDisplay}
                        </span>
                      ) : p.built_up_area ? (
                        <span className="text-xs font-semibold text-slate-200 drop-shadow">
                          {p.built_up_area} sq.ft
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 space-y-2.5">
                    <div>
                      <h4
                        className="font-bold text-sm text-slate-900 line-clamp-1 leading-snug hover:text-red-600 transition"
                        title={p.title}
                      >
                        {p.title}
                      </h4>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 line-clamp-1">
                        <MapPin className="h-3 w-3 shrink-0 text-red-500" />
                        <span>{localityLabel || 'Hyderabad'}</span>
                      </p>
                    </div>

                    {/* Quick Specs */}
                    <div className="flex items-center gap-3 border-y border-slate-100 py-2 text-xs text-slate-600">
                      {p.bedrooms != null && p.bedrooms > 0 && (
                        <div className="flex items-center gap-1">
                          <Bed className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">{p.bedrooms}</span> Beds
                        </div>
                      )}
                      {p.bathrooms != null && p.bathrooms > 0 && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">{p.bathrooms}</span> Baths
                        </div>
                      )}
                      {p.property_type_name && (
                        <div className="ml-auto truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {p.property_type_name}
                        </div>
                      )}
                    </div>

                    {/* Action Links */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <Link
                        to={generatePropertyUrl(p)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 active:scale-95 transition"
                      >
                        <span>View Details</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 active:scale-95 transition"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Map Controls & Overlays */}
      {showControls && (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          {/* Properties Count Pill */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/95 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-800 shadow-md border border-slate-200/60">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {mappedItems.length} {mappedItems.length === 1 ? 'Property' : 'Properties'} on Map
            </span>
          </div>
        </div>
      )}

      {showControls && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-2xl bg-white/95 backdrop-blur-md p-1 shadow-md border border-slate-200/60">
          <button
            onClick={() => setTileMode('standard')}
            className={cn(
              'rounded-xl px-2.5 py-1 text-xs font-bold transition',
              tileMode === 'standard'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Streets
          </button>
          <button
            onClick={() => setTileMode('voyager')}
            className={cn(
              'rounded-xl px-2.5 py-1 text-xs font-bold transition',
              tileMode === 'voyager'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Clean
          </button>
          <button
            onClick={() => setTileMode('satellite')}
            className={cn(
              'rounded-xl px-2.5 py-1 text-xs font-bold transition',
              tileMode === 'satellite'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Satellite
          </button>

          <button
            onClick={handleFitBounds}
            className="ml-1 rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            title="Fit all properties on map"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Global CSS Overrides for Leaflet Popup and Pins */}
      <style>{`
        .custom-property-pin-wrapper {
          background: transparent !important;
          border: none !important;
        }
        .realtynow-map-popup .leaflet-popup-content-wrapper {
          padding: 0 !important;
          border-radius: 1rem !important;
          overflow: hidden !important;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
          border: 1px solid rgb(226 232 240) !important;
        }
        .realtynow-map-popup .leaflet-popup-content {
          margin: 0 !important;
          width: 280px !important;
          line-height: 1.4 !important;
        }
        .realtynow-map-popup .leaflet-popup-tip-container {
          margin-top: -1px;
        }
        .leaflet-container {
          font-family: inherit !important;
        }
      `}</style>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { Input, Textarea, Select } from '../../../components/ui';
import { FileUploader } from '../../../components/uploader/file-uploader';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import type { WorkflowField } from '../../../lib/listing-config';
import type { StorageBucket } from '../../../lib/storage';
import { MapPin, Loader2, Search } from 'lucide-react';
import { useGooglePlaces, type GooglePlacePrediction } from '../../../hooks/useGooglePlaces';

interface LocationValue {
  city_id?: string;
  locality_id?: string;
  address?: string;
  location_name?: string;
  area?: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  google_place_id?: string;
  formatted_address?: string;
}

interface DynamicStepRendererProps {
  fields: WorkflowField[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
}

const FIELD_KEY_BUCKET: Record<string, StorageBucket> = {
  images: 'property-images',
  videos: 'property-videos',
  documents: 'property-documents',
};

export function DynamicStepRenderer({ fields, values, errors, onChange }: DynamicStepRendererProps) {
  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.field_key]}
          error={errors[field.field_key]}
          onChange={(v) => onChange(field.field_key, v)}
        />
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: WorkflowField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const labelText = field.label + (field.is_required ? ' *' : '');

  switch (field.field_type) {
    case 'text':
      return (
        <Input
          label={labelText}
          placeholder={field.placeholder ?? undefined}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
    case 'textarea':
      return (
        <Textarea
          label={labelText}
          placeholder={field.placeholder ?? undefined}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          rows={5}
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          label={labelText}
          placeholder={field.placeholder ?? undefined}
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === '' ? '' : val);
          }}
          error={error}
        />
      );
    case 'date':
      return (
        <Input
          type="date"
          label={labelText}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
    case 'boolean':
      return (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-navy-700">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-navy-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
          />
          {field.label}
        </label>
      );
    case 'select':
      if (field.field_key === 'property_type_id') {
        return <PropertyTypeSelect label={labelText} value={value as string} error={error} onChange={onChange} />;
      }
      return (
        <Select label={labelText} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} error={error}>
          <option value="">Select...</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      );
    case 'multiselect':
    case 'checklist':
      return (
        <MultiChoice
          label={labelText}
          options={field.options}
          value={(value as string[]) ?? []}
          error={error}
          onChange={onChange}
        />
      );
    case 'file': {
      const bucket = FIELD_KEY_BUCKET[field.field_key] ?? 'property-documents';
      return (
        <FileUploader
          bucket={bucket}
          label={labelText}
          helpText={field.help_text ?? undefined}
          accept={field.validation.accept}
          multiple={field.validation.multiple ?? true}
          maxFiles={field.validation.maxFiles ?? 10}
          value={(value as { url: string; path: string }[]) ?? []}
          onChange={onChange}
        />
      );
    }
    case 'location':
      return (
        <LocationField
          label={labelText}
          value={(value as LocationValue) ?? {}}
          error={error}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

function PropertyTypeSelect({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase
      .from('property_types')
      .select('id,name')
      .order('name')
      .then(({ data }) => setTypes((data as { id: string; name: string }[]) ?? []));
  }, []);

  return (
    <Select label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} error={error}>
      <option value="">Select property type...</option>
      {types.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  );
}

function LocationField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: LocationValue;
  error?: string;
  onChange: (value: LocationValue) => void;
}) {
  const { isReady, loadError, getPredictions, getPlaceDetails } = useGooglePlaces();
  const [searchTerm, setSearchTerm] = useState(value.formatted_address || value.location_name || value.address || '');
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 1) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    // Debounce
    const timer = setTimeout(async () => {
      setIsLoading(true);
      const results = await getPredictions(searchTerm);
      setPredictions(results);
      setIsOpen(true);
      setSelectedIndex(-1);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, getPredictions]);

  const handleSelect = async (place: GooglePlacePrediction) => {
    setSearchTerm(place.description);
    setIsOpen(false);
    setIsLoading(true);
    
    const details = await getPlaceDetails(place.place_id);
    if (details) {
      onChange({
        ...value,
        location_name: details.location_name,
        area: details.area,
        locality: details.locality,
        city: details.city,
        district: details.district,
        state: details.state,
        country: details.country,
        postal_code: details.postal_code,
        latitude: details.latitude,
        longitude: details.longitude,
        google_place_id: details.google_place_id,
        formatted_address: details.formatted_address,
        address: details.formatted_address,
      });
    }
    
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && predictions[selectedIndex]) {
        handleSelect(predictions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-navy-150 p-4" ref={wrapperRef}>
      <p className="text-sm font-bold text-navy-800">{label}</p>
      
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-navy-400" />
          <input
            type="text"
            className={cn(
              "w-full rounded-lg border border-navy-300 py-2.5 pl-9 pr-10 text-sm outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500",
              error ? "border-error-500" : ""
            )}
            placeholder="Search area, locality, city..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              // If user types, we invalidate the structured selection
              // and only retain the raw text they typed as 'address'
              onChange({ address: e.target.value });
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (predictions.length > 0) setIsOpen(true);
            }}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-navy-400" />
          )}
        </div>

        {isOpen && searchTerm.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-navy-200 bg-white py-1 shadow-lg">
            {predictions.length === 0 && !isLoading ? (
              <div className="px-4 py-3 text-sm text-navy-500">No locations found</div>
            ) : (
              predictions.map((p, idx) => (
                <div
                  key={p.place_id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-navy-50",
                    selectedIndex === idx ? "bg-navy-50" : ""
                  )}
                  onClick={() => handleSelect(p)}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <span className="block font-medium text-navy-900">
                      {p.structured_formatting.main_text}
                    </span>
                    <span className="block text-xs text-navy-500">
                      {p.structured_formatting.secondary_text}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      {error && <p className="text-xs font-semibold text-error-600">{error}</p>}
      
      {loadError ? (
        <p className="text-xs font-semibold text-error-600">Google Maps unavailable — you can still type a location manually.</p>
      ) : !isReady && (
        <p className="text-xs text-navy-400">Loading map services...</p>
      )}
    </div>
  );
}

function MultiChoice({
  label,
  options,
  value,
  error,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  error?: string;
  onChange: (value: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  return (
    <div>
      <p className="label">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => (
          <label
            key={opt}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              value.includes(opt) ? 'border-red-400 bg-red-50 text-red-700' : 'border-navy-150 text-navy-600 hover:bg-navy-50',
            )}
          >
            <input type="checkbox" className="sr-only" checked={value.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-error-600">{error}</p>}
    </div>
  );
}

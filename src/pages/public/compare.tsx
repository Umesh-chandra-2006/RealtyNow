import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitCompare, MapPin, X, CheckCircle2, XCircle, ArrowLeft, Home, Shield, Trash2 } from 'lucide-react';
import { fetchComparedProperties, clearCompareList, toggleCompareProperty } from '../../lib/compare';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { formatPrice, generatePropertyUrl, getPropertyPrice } from '../../lib/utils';
import { getPropertyPricingDisplay } from '../../lib/plot-pricing';
import type { Property } from '../../lib/types';
import { useToast } from '../../components/toast';
import { Spinner } from '../../components/ui';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';

export function ComparePage() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const specRows: { label: string; key: keyof Property; format?: (v: unknown, p: Property) => string }[] = [
    { label: t('property.price', 'Price / Rate'), key: 'price', format: (_, p) => getPropertyPricingDisplay(p).primaryPrice },
    {
      label: 'Plot / Land Area',
      key: 'plot_area',
      format: (_, p) => {
        const pr = getPropertyPricingDisplay(p);
        return pr.isLand && pr.areaDisplay ? pr.areaDisplay : '—';
      },
    },
    {
      label: 'Estimated Total Value',
      key: 'price',
      format: (_, p) => {
        const pr = getPropertyPricingDisplay(p);
        return pr.isLand && pr.totalEstimatedPrice ? pr.totalEstimatedPrice : formatPrice(getPropertyPrice(p), p.purpose);
      },
    },
    { label: t('search.purposeLabel', 'Purpose'), key: 'purpose' },
    { label: t('search.propertyTypeLabel', 'Property Type'), key: 'property_type_name' },
    { label: t('property.bedrooms', 'Bedrooms'), key: 'bedrooms', format: (v) => (v != null ? `${v} BHK` : '') },
    { label: t('property.bathrooms', 'Bathrooms'), key: 'bathrooms', format: (v) => (v != null ? `${v}` : '') },
    { label: t('property.balconies', 'Balconies'), key: 'balconies', format: (v) => (v != null ? `${v}` : '') },
    { label: t('property.carpetArea', 'Carpet Area'), key: 'carpet_area', format: (v) => (v ? `${v} sqft` : '') },
    { label: t('search.furnishingLabel', 'Furnishing'), key: 'furnishing' },
    { label: t('property.floor', 'Floor'), key: 'floor_number', format: (v) => (v != null ? `${v}` : '') },
    { label: t('search.facingLabel', 'Facing'), key: 'facing' },
    { label: t('property.ageOfProperty', 'Age'), key: 'age_of_property', format: (v) => (v != null ? `${v} yrs` : '') },
    {
      label: t('property.parking', 'Parking'),
      key: 'parking',
      format: (v) => (v ? t('common.yes', 'Yes') : t('common.no', 'No')),
    },
    { label: t('search.cityLabel', 'City'), key: 'city_name' },
    { label: t('search.localityLabel', 'Locality'), key: 'locality_name' },
  ];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchComparedProperties(user?.id).then((data) => {
      if (!cancelled) {
        setProperties(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleRemove = async (id: string) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
    await toggleCompareProperty(id, user?.id);
    addToast('success', t('compare.removedToast', 'Property removed from comparison'));
  };

  const handleClear = async () => {
    setProperties([]);
    await clearCompareList(user?.id);
    addToast('success', t('compare.clearedToast', 'Comparison list cleared'));
  };

  const getCellValue = (p: Property, row: (typeof specRows)[0]): string => {
    const raw = p[row.key];
    if (row.format) return row.format(raw, p) || '—';
    if (raw == null || raw === '') return '—';
    return String(raw);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-gray-900 to-red-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-5 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            {t('compare.backToSearch', 'Back to Search')}
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-red-600/30 border border-red-500/40 rounded-xl p-2.5">
                <GitCompare className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t('compare.title', 'Compare Properties')}</h1>
                <p className="text-white/50 text-sm mt-0.5">
                  {properties.length > 0
                    ? `${properties.length} ${t('compare.selectedCount', 'properties selected')}`
                    : t('compare.noSelected', 'No properties selected')}
                </p>
              </div>
            </div>
            {properties.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-2 border border-white/20 hover:bg-white/10 text-white/80 hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {t('search.clearAll', 'Clear All')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner className="h-8 w-8 text-red-500" />
            <p className="text-gray-500 text-sm">{t('common.loading', 'Loading comparison...')}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && properties.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
            <div className="bg-gray-100 rounded-full p-8">
              <GitCompare className="h-14 w-14 text-gray-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {t('compare.emptyTitle', 'No Properties to Compare')}
              </h2>
              <p className="text-gray-500 text-sm max-w-xs">
                {t('compare.emptyDesc', 'Browse properties and click the compare icon on any card to add them here.')}
              </p>
            </div>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
            >
              <Home className="h-4 w-4" />
              {t('common.search', 'Browse Properties')}
            </Link>
          </div>
        )}

        {/* Compare Table */}
        {!loading && properties.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full" style={{ minWidth: `${160 + properties.length * 220}px` }}>
              {/* Property Header Row */}
              <thead>
                <tr className="border-b border-gray-100">
                  {/* Label cell */}
                  <th className="w-40 bg-gray-50 p-4 text-left align-bottom border-r border-gray-100 sticky left-0 z-20">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {t('compare.propertyCol', 'Property')}
                    </span>
                  </th>
                  {/* Property cards */}
                  {properties.map((p, idx) => (
                    <th
                      key={p.id}
                      className="p-4 align-top border-r border-gray-100 last:border-r-0"
                      style={{ minWidth: 220 }}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.07 }}
                        className="flex flex-col gap-3"
                      >
                        {/* Image */}
                        <div className="relative w-full bg-gray-100 rounded-xl overflow-hidden" style={{ height: 160 }}>
                          <img
                            src={getPropertyCoverImage(p)}
                            alt={p.title}
                            className="w-full h-full object-cover"
                            onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                          />
                          {/* Remove btn */}
                          <button
                            onClick={() => handleRemove(p.id)}
                            className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm hover:bg-red-500 hover:text-white text-gray-600 rounded-full p-1.5 shadow transition-all cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          {/* Badge */}
                          <span
                            className={`absolute bottom-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full text-white ${p.purpose === 'Rent' ? 'bg-blue-600' : 'bg-red-600'}`}
                          >
                            {p.purpose === 'Rent'
                              ? t('property.forRent', 'For Rent')
                              : t('property.forSale', 'For Sale')}
                          </span>
                        </div>

                        {/* Title & location */}
                        <div>
                          <Link
                            to={generatePropertyUrl(p)}
                            className="text-sm font-bold text-gray-900 hover:text-red-600 transition-colors line-clamp-2 leading-tight block"
                          >
                            {p.title}
                          </Link>
                          <div className="flex items-center gap-1 text-gray-400 mt-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="text-xs truncate">
                              {[p.locality_name, p.city_name].filter(Boolean).join(', ') || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Price */}
                        <p className="text-lg font-bold text-red-600 border-t border-gray-100 pt-2">
                          {getPropertyPricingDisplay(p, { compactConstructed: true }).primaryPrice}
                        </p>
                      </motion.div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Spec Rows */}
              <tbody>
                {specRows.map((row, ri) => {
                  const values = properties.map((p) => getCellValue(p, row));
                  const allSame = values.every((v) => v === values[0]);
                  const highlight = row.key === 'price' || row.key === 'bedrooms';
                  return (
                    <tr
                      key={row.label}
                      className={`border-b border-gray-50 last:border-b-0 ${highlight ? 'bg-red-50/40' : ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      {/* Label */}
                      <td className="p-3 px-4 border-r border-gray-100 sticky left-0 z-10 bg-inherit">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          {row.label}
                        </span>
                      </td>
                      {/* Values */}
                      {values.map((val, i) => (
                        <td key={i} className="p-3 px-4 text-center border-r border-gray-100 last:border-r-0">
                          {val === '—' ? (
                            <span className="text-gray-200 text-xs">—</span>
                          ) : val === 'Yes' || val === t('common.yes', 'Yes') ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : val === 'No' || val === t('common.no', 'No') ? (
                            <XCircle className="h-4 w-4 text-red-300 mx-auto" />
                          ) : (
                            <span
                              className={`text-sm ${highlight ? 'font-bold text-red-600' : !allSame ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                            >
                              {val}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* Amenities Row */}
                {properties.some((p) => p.amenities && (p.amenities as string[]).length > 0) && (
                  <tr className="border-b border-gray-50">
                    <td className="p-3 px-4 border-r border-gray-100 sticky left-0 bg-gray-50/50 z-10">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" /> {t('property.amenities', 'Amenities')}
                      </span>
                    </td>
                    {properties.map((p) => {
                      const list = (p.amenities as string[] | null) ?? [];
                      return (
                        <td key={p.id} className="p-3 px-4 border-r border-gray-100 last:border-r-0 align-top">
                          {list.length === 0 ? (
                            <span className="text-gray-200 text-xs">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {list.map((a) => (
                                <span
                                  key={a}
                                  className="text-[11px] bg-green-50 border border-green-200 text-green-700 rounded-full px-2 py-0.5"
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* Action Row */}
                <tr>
                  <td className="p-4 border-r border-gray-100 sticky left-0 bg-gray-50 z-10" />
                  {properties.map((p) => (
                    <td key={p.id} className="p-4 border-r border-gray-100 last:border-r-0">
                      <div className="flex flex-col gap-2">
                        <Link
                          to={generatePropertyUrl(p)}
                          className="block text-center bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
                        >
                          {t('compare.viewProperty', 'View Property')}
                        </Link>
                        <button
                          onClick={() => handleRemove(p.id)}
                          className="block w-full text-center border border-gray-200 hover:border-red-300 hover:text-red-600 text-gray-500 py-2 rounded-xl text-sm transition-all cursor-pointer"
                        >
                          {t('compare.remove', 'Remove')}
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


import React from 'react';
import { getPropertyPricingDisplay } from '../../lib/plot-pricing';
import { formatPrice, getPropertyPrice } from '../../lib/utils';
import { isPropertyPublishable } from '../../lib/price-validation';

interface PropertyPriceCellProps {
  property: any;
  showInvalidWarning?: boolean;
  className?: string;
}

export function PropertyPriceCell({
  property,
  showInvalidWarning = true,
  className = '',
}: PropertyPriceCellProps) {
  if (!property) return <span className="text-slate-400 text-xs">—</span>;

  const pricing = getPropertyPricingDisplay(property);
  const isPublishable = isPropertyPublishable(property);

  // 1. Land / Plot Pricing (Per Sq. Yd / Per Sq. Ft + Total)
  if (pricing.isLand && pricing.primaryPriceNumeric) {
    const formattedRate = `₹${new Intl.NumberFormat('en-IN').format(pricing.primaryPriceNumeric)}`;
    const unitText = pricing.unitLabel || '/ Sq. Yd';

    return (
      <div className={`min-w-[155px] whitespace-nowrap space-y-0.5 ${className}`}>
        <div className="flex items-baseline gap-1">
          <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
            {formattedRate}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
            {unitText}
          </span>
        </div>
        {pricing.totalEstimatedPrice && (
          <div className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            Total: <span className="font-bold text-slate-800">{pricing.totalEstimatedPrice}</span>
          </div>
        )}
        {showInvalidWarning && property.status !== 'draft' && !isPublishable && (
          <span className="block text-[11px] font-bold text-red-600">⚠ Invalid Price</span>
        )}
      </div>
    );
  }

  // 2. Standard Constructed / Rental Property Pricing
  const numericPrice = getPropertyPrice(property);
  const formattedFullPrice =
    numericPrice != null
      ? formatPrice(numericPrice, property.purpose)
      : pricing.primaryPrice;

  let mainPrice = formattedFullPrice;
  let unitSuffix = '';

  if (formattedFullPrice && formattedFullPrice.includes('/')) {
    const parts = formattedFullPrice.split('/');
    mainPrice = parts[0].trim();
    unitSuffix = '/' + parts.slice(1).join('/');
  }

  return (
    <div className={`min-w-[145px] whitespace-nowrap space-y-0.5 ${className}`}>
      <div className="flex items-baseline gap-1">
        <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
          {mainPrice}
        </span>
        {unitSuffix && (
          <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
            {unitSuffix}
          </span>
        )}
      </div>
      {showInvalidWarning && property.status !== 'draft' && !isPublishable && (
        <span className="block text-[11px] font-bold text-red-600">⚠ Invalid Price</span>
      )}
    </div>
  );
}

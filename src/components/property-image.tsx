import { useState } from 'react';
import { cn } from '../lib/utils';
import { DEFAULT_PROPERTY_IMAGE, handleImageError } from '../lib/property-images';

export interface PropertyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
}

/**
 * Unified Property Image Component
 * Ensures every property image renders inside its parent's fixed aspect frame with:
 * - object-fit: cover, object-position: center (never stretched or distorted)
 * - Zero layout shifts with smooth opacity fade-in
 * - Instant fallback on network error without collapsing frame dimensions
 */
export function PropertyImage({
  src,
  alt,
  className,
  onError,
  fallbackSrc = DEFAULT_PROPERTY_IMAGE,
  ...rest
}: PropertyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const imgSrc = hasError || !src ? fallbackSrc : src;

  return (
    <img
      {...rest}
      src={imgSrc}
      alt={alt}
      loading={rest.loading ?? 'lazy'}
      decoding="async"
      onLoad={(e) => {
        setIsLoaded(true);
        rest.onLoad?.(e);
      }}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
        handleImageError(e, fallbackSrc);
      }}
      className={cn(
        'block h-full w-full object-cover object-center transition-opacity duration-300',
        !isLoaded ? 'opacity-90' : 'opacity-100',
        className,
      )}
    />
  );
}

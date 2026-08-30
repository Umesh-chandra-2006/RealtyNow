import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { fetchActiveAdvertisements, trackAdImpression, trackAdClick, Advertisement } from '../lib/advertisements';
import { cn } from '../lib/utils';
import { ExternalLink } from 'lucide-react';

// HTML ads are admin-supplied strings rendered into the DOM; always sanitize
// before injecting to prevent stored XSS (audit finding: dangerouslySetInnerHTML).
function sanitizeHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style', 'src'],
  });
}

interface AdvertisementWidgetProps {
  page: string;
  position: string;
  deviceType?: 'Desktop' | 'Mobile' | 'All Devices';
  className?: string;
  onAdLoaded?: (hasAd: boolean) => void;
}

export function AdvertisementWidget({ page, position, deviceType = 'All Devices', className, onAdLoaded }: AdvertisementWidgetProps) {
  const [ad, setAd] = useState<Advertisement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadAd() {
      setLoading(true);
      const ads = await fetchActiveAdvertisements(page, position, deviceType);
      if (mounted) {
        if (ads.length > 0) {
          // Select a random ad if there are multiple with same priority
          const selectedAd = ads[Math.floor(Math.random() * ads.length)];
          setAd(selectedAd);
          onAdLoaded?.(true);
          // Track impression
          trackAdImpression(selectedAd.id);
        } else {
          setAd(null);
          onAdLoaded?.(false);
        }
        setLoading(false);
      }
    }
    loadAd();
    return () => { mounted = false; };
  }, [page, position, deviceType, onAdLoaded]);

  if (loading) {
    return (
      <div className={cn("w-full h-64 bg-slate-100 animate-pulse rounded-2xl border border-slate-200", className)} />
    );
  }

  if (!ad) {
    return null; // No ad to display
  }

  const handleClick = () => {
    trackAdClick(ad.id);
    if (ad.redirect_url) {
      window.open(ad.redirect_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Render HTML content if available
  if (ad.ad_type === 'HTML Advertisement' && ad.html_content) {
    return (
      <div 
        className={cn("relative w-full rounded-2xl overflow-hidden shadow-sm", className)}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ad.html_content) }} 
      />
    );
  }

  // Determine which image to show based on device type or CSS
  const imageUrl = deviceType === 'Mobile' && ad.mobile_image ? ad.mobile_image : (ad.image_url || ad.mobile_image);

  return (
    <div 
      className={cn("relative group overflow-hidden rounded-2xl cursor-pointer shadow-sm border border-slate-200 bg-white transition-all hover:shadow-md", className)}
      onClick={handleClick}
    >
      <div className="absolute top-2 left-2 z-10">
        <span className="bg-black/50 backdrop-blur-md text-white text-[9px] uppercase font-bold px-1.5 py-0.5 rounded">
          Sponsored
        </span>
      </div>

      {ad.video_url ? (
        <video 
          src={ad.video_url} 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-auto object-cover" 
        />
      ) : imageUrl ? (
        <img 
          src={imageUrl} 
          alt={ad.title} 
          className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" 
          loading="lazy"
        />
      ) : (
        <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
          <span className="text-slate-400 font-bold">{ad.title}</span>
        </div>
      )}

      {(ad.title || ad.description) && (
        <div className="p-4 bg-white">
          {ad.title && <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{ad.title}</h4>}
          {ad.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ad.description}</p>}
          
          {ad.button_text && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 group-hover:text-red-700 transition-colors">
              {ad.button_text} <ExternalLink className="h-3 w-3" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

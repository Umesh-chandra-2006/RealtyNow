import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  Mail,
  Send,
  MessageSquare,
  Globe,
  ExternalLink,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { Modal, Button } from './ui';
import { useToast } from './toast';
import {
  getPropertyPublicUrl,
  getPropertyShareCrawlerUrl,
  buildWhatsAppPropertyShareMessage,
  getPropertyLocationText,
  getFormattedPriceText,
  getPropertyCoverImage,
  PropertyShareInput,
} from '../lib/share-service';
import type { Property } from '../lib/types';

interface SharePropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Partial<Property> & { title: string; id?: string };
}

export const SharePropertyModal: React.FC<SharePropertyModalProps> = ({
  isOpen,
  onClose,
  property,
}) => {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const raw = property as any;
  const propInput: PropertyShareInput = {
    id: raw.id,
    title: raw.title,
    price: raw.price,
    purpose: raw.purpose,
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    builtup_area: raw.builtup_area || raw.built_up_area,
    carpet_area: raw.carpet_area,
    area: raw.area,
    locality_name: raw.locality_name || raw.locality,
    city_name: raw.city_name || raw.city,
    locality: raw.locality || raw.locality_name,
    city: raw.city || raw.city_name,
    address: raw.address,
    images: raw.images,
    og_image: raw.og_image,
    slug: raw.slug,
  };

  const publicUrl = getPropertyPublicUrl(propInput);
  // Platform share intents (Facebook/LinkedIn/X/Telegram) fetch whatever URL
  // they're given and unfurl it themselves — must be the crawler URL so they
  // get the RealtyNow logo, not the property's own photo. "Copy Link" below
  // stays on publicUrl (the clean, human-readable page URL).
  const shareCrawlerUrl = getPropertyShareCrawlerUrl(propInput);
  const whatsappMessage = buildWhatsAppPropertyShareMessage(propInput);
  const coverImage = getPropertyCoverImage(propInput);
  const locationText = getPropertyLocationText(propInput);
  const priceText = getFormattedPriceText(propInput);

  const encodedUrl = encodeURIComponent(shareCrawlerUrl);
  const encodedWhatsapp = encodeURIComponent(whatsappMessage);
  const encodedTitle = encodeURIComponent(`RealtyNow: ${property.title}`);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      addToast('success', 'Public property link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('error', 'Failed to copy link');
    }
  };

  const sharePlatforms = [
    {
      name: 'WhatsApp',
      color: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20',
      icon: Send,
      url: `https://wa.me/?text=${encodedWhatsapp}`,
      badge: 'Rich Preview',
    },
    {
      name: 'LinkedIn',
      color: 'bg-[#0077B5] hover:bg-[#006097] text-white shadow-[#0077B5]/20',
      icon: Globe,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: 'Facebook',
      color: 'bg-[#1877F2] hover:bg-[#0d65d9] text-white shadow-[#1877F2]/20',
      icon: Globe,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'X (Twitter)',
      color: 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20',
      icon: MessageSquare,
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(`🏡 Check out this property on @RealtyNow: ${property.title}`)}`,
    },
    {
      name: 'Telegram',
      color: 'bg-[#26A5E4] hover:bg-[#1e8fc7] text-white shadow-[#26A5E4]/20',
      icon: Send,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(`🏡 Check out this property on RealtyNow: ${property.title}`)}`,
    },
    {
      name: 'Gmail / Email',
      color: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20',
      icon: Mail,
      url: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${whatsappMessage}`)}`,
    },
  ];

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: property.title,
          text: whatsappMessage,
          url: shareCrawlerUrl,
        });
        onClose();
      } catch {
        // User dismissed native share sheet
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Share Property" size="md">
      <div className="space-y-4">
        {/* 1. Cinematic Branded Preview Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-32 w-full bg-slate-900 overflow-hidden">
            <img
              src={coverImage}
              alt={property.title}
              className="h-full w-full object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
            
            {/* Top Brand Pill */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white border border-white/10">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              <span className="font-extrabold tracking-wide">REALTYNOW</span>
            </div>

            {/* Price Tag */}
            <div className="absolute right-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white shadow-md">
              {priceText}
            </div>

            {/* Bottom Overlay Title & Location */}
            <div className="absolute bottom-2.5 left-3 right-3 text-white">
              <h4 className="text-sm font-extrabold truncate drop-shadow-sm">{property.title}</h4>
              <p className="text-[11px] text-slate-200 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                <span>{locationText}</span>
                {property.bedrooms ? <span>• {property.bedrooms} BHK</span> : null}
              </p>
            </div>
          </div>

          {/* Copy Public Link Strip */}
          <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Public Share URL</p>
              <p className="text-xs font-semibold text-slate-700 truncate font-mono">{publicUrl}</p>
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shrink-0 flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer active:scale-95"
              title="Copy Public Link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* 2. Social Sharing Platforms */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Share via Social Media
            </p>
            <span className="text-[10px] font-semibold text-slate-400">Cinematic Rich Preview</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sharePlatforms.map((platform) => (
              <a
                key={platform.name}
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onClose()}
                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-98 ${platform.color}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <platform.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">Share on {platform.name}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0 ml-1" />
              </a>
            ))}
          </div>
        </div>

        {/* 3. Native Mobile Share Sheet Button */}
        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
          <div className="border-t border-slate-100 pt-3">
            <Button
              variant="secondary"
              className="w-full justify-center text-xs font-bold py-2.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
              icon={<Share2 className="w-4 h-4" />}
              onClick={handleNativeShare}
            >
              Open Device Share Menu
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

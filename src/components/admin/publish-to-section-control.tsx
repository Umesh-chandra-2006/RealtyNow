import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  hide,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import {
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Clock,
  Zap,
  SlidersHorizontal,
  Award,
  LayoutGrid,
  ShieldCheck,
} from 'lucide-react';
import {
  type CampaignType,
  type PropertySectionAssignment,
  CAMPAIGN_SECTIONS_CONFIG,
  fetchPropertyCampaignAssignments,
  togglePropertyCampaignAssignment,
} from '../../lib/paid-campaigns-api';
import { useToast } from '../toast';
import { cn, formatDate } from '../../lib/utils';

// Global singleton tracker to ensure only ONE PublishTo popover is open at any time
const openPopovers = new Set<() => void>();

export function closeAllPublishPopovers() {
  openPopovers.forEach((close) => close());
  openPopovers.clear();
}

function registerPopover(closeFn: () => void) {
  openPopovers.forEach((fn) => {
    if (fn !== closeFn) fn();
  });
  openPopovers.clear();
  openPopovers.add(closeFn);
}

function unregisterPopover(closeFn: () => void) {
  openPopovers.delete(closeFn);
}

// Eligible property sections for publishing
export const PROPERTY_CAMPAIGN_SECTIONS: {
  type: CampaignType;
  label: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  previewUrl: string;
  description: string;
}[] = [
  {
    type: 'FEATURED_PROPERTIES',
    label: 'Featured Properties',
    badge: 'Featured',
    icon: Zap,
    color: 'text-red-600 bg-red-50 border-red-200',
    previewUrl: '/#featured-properties',
    description: 'Promoted properties in the primary homepage featured showcase',
  },
  {
    type: 'TWO_COLUMN_SLIDER',
    label: 'Two Column Slider Properties',
    badge: 'Two Column',
    icon: SlidersHorizontal,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    previewUrl: '/#two-column-slider',
    description: 'Hero-scale luxury 2-column promotional property slider',
  },
  {
    type: 'SIGNATURE_COLLECTION',
    label: 'Signature Collection',
    badge: 'Signature',
    icon: Sparkles,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    previewUrl: '/#signature-collection',
    description: 'Ultra-luxury curated homes and prime penthouses in dark luxury theme',
  },
  {
    type: 'THREE_COLUMN_PROPERTIES',
    label: 'Three Column Properties',
    badge: '3 Column',
    icon: LayoutGrid,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    previewUrl: '/#three-column-properties',
    description: 'Three-column promotional ad banner grid with high conversion CTAs',
  },
  {
    type: 'REALTYNOW_EXCLUSIVE',
    label: 'RealtyNow Exclusive',
    badge: 'Exclusive',
    icon: Award,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    previewUrl: '/#realtynow-exclusive',
    description: 'Flagship verified projects and exclusive developer launches',
  },
];

interface PublishToSectionControlProps {
  property: {
    id: string;
    title: string;
    status?: string;
    is_featured?: boolean;
    is_live?: boolean;
    [key: string]: any;
  };
  initialAssignments?: PropertySectionAssignment[];
  compact?: boolean;
  onAssignmentChange?: () => void;
  className?: string;
}

export function PublishToSectionControl({
  property,
  initialAssignments,
  compact = false,
  onAssignmentChange,
  className,
}: PublishToSectionControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Floating UI anchor positioning setup
  const { refs, floatingStyles, context, middlewareData } = useFloating({
    open: isOpen,
    onOpenChange: (nextOpen) => {
      setIsOpen(nextOpen);
      if (nextOpen) {
        registerPopover(handleClose);
      } else {
        unregisterPopover(handleClose);
      }
    },
    placement: 'bottom-end',
    middleware: [
      offset(8),
      flip({
        fallbackPlacements: ['top-end', 'bottom-start', 'top-start', 'bottom', 'top'],
        padding: 16,
      }),
      shift({ padding: 16 }),
      hide(), // Detects when reference trigger scrolls out of viewport
    ],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  // If trigger button scrolls outside visible viewport, close popup automatically
  const isReferenceHidden = middlewareData.hide?.referenceHidden;
  useEffect(() => {
    if (isReferenceHidden && isOpen) {
      setIsOpen(false);
    }
  }, [isReferenceHidden, isOpen]);

  // Clean up global popover registry on unmount
  useEffect(() => {
    return () => {
      unregisterPopover(handleClose);
    };
  }, [handleClose]);

  // Fetch live assignments for this property
  const { data: assignments = initialAssignments || [], isLoading } = useQuery({
    queryKey: ['property-section-assignments', property.id],
    queryFn: () => fetchPropertyCampaignAssignments(property.id),
    initialData: initialAssignments,
    staleTime: 1000 * 15,
  });

  const [togglingType, setTogglingType] = useState<CampaignType | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ campaignType, assign }: { campaignType: CampaignType; assign: boolean }) => {
      setTogglingType(campaignType);
      await togglePropertyCampaignAssignment({
        propertyId: property.id,
        campaignType,
        assign,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property-section-assignments', property.id] });
      queryClient.invalidateQueries({ queryKey: ['batch-property-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-luxury'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });

      const config = CAMPAIGN_SECTIONS_CONFIG[variables.campaignType];
      addToast(
        'success',
        variables.assign
          ? `Published to ${config.label}`
          : `Removed from ${config.label}`
      );
      if (onAssignmentChange) onAssignmentChange();
    },
    onError: (err: any) => {
      addToast('error', err?.message || 'Failed to update section assignment');
    },
    onSettled: () => {
      setTogglingType(null);
    },
  });

  const activeAssignments = assignments.filter((a) => a.is_active);
  const activeCount = activeAssignments.length;

  const handleToggle = (campaignType: CampaignType, currentAssigned: boolean) => {
    mutation.mutate({
      campaignType,
      assign: !currentAssigned,
    });
  };

  const hasPublishedSections = activeCount > 0;

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={refs.setReference}
        type="button"
        {...getReferenceProps({
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!isOpen) {
              registerPopover(handleClose);
              setIsOpen(true);
            } else {
              setIsOpen(false);
            }
          },
        })}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer',
          compact ? 'px-2.5 py-1' : 'px-3 py-1.5',
          hasPublishedSections
            ? 'border-red-300 bg-red-50/80 text-red-700 hover:bg-red-100/80 hover:border-red-400'
            : 'border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300',
          className
        )}
        title="Manage Homepage Sections"
      >
        <Layers className={cn('h-3.5 w-3.5 shrink-0', hasPublishedSections ? 'text-red-600' : 'text-slate-400')} />
        
        {hasPublishedSections ? (
          <span className="flex items-center gap-1">
            <span className="font-extrabold">{activeCount} {activeCount === 1 ? 'Section' : 'Sections'}</span>
          </span>
        ) : (
          <span>Publish To</span>
        )}

        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180 text-red-600')} />
      </button>

      {/* Anchored Popover rendered directly in Portal to avoid table/container clipping */}
      {isOpen && !isReferenceHidden && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 9999,
            }}
            {...getFloatingProps({
              onClick: (e: React.MouseEvent) => e.stopPropagation(),
            })}
            className="w-80 sm:w-96 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-100 ring-1 ring-black/5"
          >
            {/* Header */}
            <div className="pb-2.5 px-1 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-red-600 shrink-0" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 truncate">
                    Homepage Publishing
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5" title={property.title}>
                  {property.title}
                </p>
              </div>

              {hasPublishedSections && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs shrink-0">
                  {activeCount} Live
                </span>
              )}
            </div>

            {/* Section Options */}
            <div className="py-2 space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {PROPERTY_CAMPAIGN_SECTIONS.map((sec) => {
                const current = assignments.find((a) => a.campaign_type === sec.type);
                const isAssigned = !!current && current.is_active;
                const isMutating = togglingType === sec.type;
                const Icon = sec.icon;

                return (
                  <div
                    key={sec.type}
                    className={cn(
                      'group flex items-start justify-between gap-2.5 p-2.5 rounded-xl border transition-all',
                      isAssigned
                        ? 'border-red-200/80 bg-red-50/40 shadow-2xs'
                        : 'border-slate-100 bg-slate-50/40 hover:bg-slate-100/70 hover:border-slate-200'
                    )}
                  >
                    <label className="flex items-start gap-2.5 flex-1 cursor-pointer select-none min-w-0">
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        disabled={isMutating}
                        onChange={() => handleToggle(sec.type, isAssigned)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Icon className={cn('h-3.5 w-3.5 shrink-0', isAssigned ? 'text-red-600' : 'text-slate-400')} />
                          <span className={cn('text-xs font-bold truncate', isAssigned ? 'text-slate-900' : 'text-slate-700')}>
                            {sec.label}
                          </span>

                          {isAssigned && current && (
                            <span
                              className={cn(
                                'text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full',
                                current.derived_status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : current.derived_status === 'SCHEDULED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : current.derived_status === 'EXPIRED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-200 text-slate-700'
                              )}
                            >
                              ● {current.derived_status}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {sec.description}
                        </p>

                        {/* Schedule info if present */}
                        {isAssigned && current && (current.start_at || current.end_at) && (
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium mt-1">
                            <Clock className="h-2.5 w-2.5" />
                            <span>
                              {current.start_at ? formatDate(current.start_at) : 'Immediate'}
                              {current.end_at ? ` → ${formatDate(current.end_at)}` : ' (Ongoing)'}
                            </span>
                          </div>
                        )}
                      </div>
                    </label>

                    {/* External preview link */}
                    <a
                      href={sec.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title={`Preview ${sec.label} on homepage`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>

            {/* Footer Notice */}
            <div className="pt-2 px-1 text-[10px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Auto-syncs with homepage
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

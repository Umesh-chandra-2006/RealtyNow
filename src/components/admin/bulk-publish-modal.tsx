import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Check, AlertCircle, Sparkles } from 'lucide-react';
import { Modal, Button } from '../ui';
import {
  type CampaignType,
  bulkAssignPropertiesToSections,
  bulkRemovePropertiesFromSections,
} from '../../lib/paid-campaigns-api';
import { PROPERTY_CAMPAIGN_SECTIONS } from './publish-to-section-control';
import { useToast } from '../toast';
import { cn } from '../../lib/utils';

interface BulkPublishModalProps {
  open: boolean;
  onClose: () => void;
  selectedPropertyIds: string[];
  mode: 'publish' | 'remove';
  onSuccess?: () => void;
}

export function BulkPublishModal({
  open,
  onClose,
  selectedPropertyIds,
  mode,
  onSuccess,
}: BulkPublishModalProps) {
  const [selectedSections, setSelectedSections] = useState<Set<CampaignType>>(new Set());
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const toggleSection = (type: CampaignType) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const types = Array.from(selectedSections);
      if (types.length === 0) throw new Error('Please select at least one section');

      if (mode === 'publish') {
        return await bulkAssignPropertiesToSections({
          propertyIds: selectedPropertyIds,
          campaignTypes: types,
        });
      } else {
        return await bulkRemovePropertiesFromSections({
          propertyIds: selectedPropertyIds,
          campaignTypes: types,
        });
      }
    },
    onSuccess: (res) => {
      // Invalidate queries across admin and public views
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      queryClient.invalidateQueries({ queryKey: ['batch-property-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['property-section-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-luxury'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });

      addToast(
        'success',
        mode === 'publish'
          ? `Successfully published ${selectedPropertyIds.length} properties to ${selectedSections.size} sections.`
          : `Successfully removed ${selectedPropertyIds.length} properties from ${selectedSections.size} sections.`
      );

      setSelectedSections(new Set());
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      addToast('error', err?.message || 'Bulk operation failed');
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === 'publish'
          ? `Publish ${selectedPropertyIds.length} Selected Properties`
          : `Remove ${selectedPropertyIds.length} Selected Properties from Sections`
      }
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={mode === 'publish' ? 'primary' : 'danger'}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={selectedSections.size === 0}
          >
            {mode === 'publish' ? 'Publish to Selected Sections' : 'Remove from Selected Sections'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-600 font-medium">
          {mode === 'publish'
            ? `Choose the homepage sections to publish the ${selectedPropertyIds.length} selected properties to:`
            : `Choose the homepage sections to remove the ${selectedPropertyIds.length} selected properties from:`}
        </p>

        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {PROPERTY_CAMPAIGN_SECTIONS.map((sec) => {
            const isSelected = selectedSections.has(sec.type);
            const Icon = sec.icon;

            return (
              <div
                key={sec.type}
                onClick={() => toggleSection(sec.type)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none',
                  isSelected
                    ? 'border-red-400 bg-red-50/60 shadow-xs'
                    : 'border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300'
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', isSelected ? 'text-red-600' : 'text-slate-400')} />
                    <span className="text-xs font-bold text-slate-900 truncate">{sec.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {sec.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

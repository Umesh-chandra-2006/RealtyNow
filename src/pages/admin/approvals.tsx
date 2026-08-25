import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, X, Eye, Send, FileText, Search, ShieldCheck, ShieldAlert, ShieldQuestion, Star, Sparkles, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { queryClient } from '../../lib/queryClient';
import { getAdminSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Button, Modal, Badge, Input, Textarea, EmptyState, Select } from '../../components/ui';
import { StatusBadge } from '../../components/property-card';
import { DataTable, type Column, BulkActionsBar } from '../../components/data-table';
import { updatePropertyStatus, adminApproveWithAi, adminRejectWithAi } from '../../lib/properties';
import { togglePropertyFeatured } from '../../lib/featured-properties-api';
import { PublishToSectionControl, closeAllPublishPopovers } from '../../components/admin/publish-to-section-control';
import { BulkPublishModal } from '../../components/admin/bulk-publish-modal';
import { mapJoined } from '../../lib/join-helpers';
import { formatPrice, formatDate, cn, generatePropertyUrl } from '../../lib/utils';
import { getPropertyPricingDisplay, getPriceUnitLabel } from '../../lib/plot-pricing';
import { isPropertyPublishable } from '../../lib/price-validation';
import { useRealtimeCount } from '../../lib/realtime';
import { useToast } from '../../components/toast';
import type { Property, AiVerification } from '../../lib/types';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';
import { ExportMenuAsync } from '../../components/export-menu';
import { SavedFiltersMenu } from '../../components/saved-filters-menu';
import { useSavedFilters } from '../../lib/saved-filters';

const ADMIN_PROPERTIES_PAGE_SIZE = 12;
const ADMIN_PROPERTIES_EXPORT_COLUMNS = [
  // Identification
  { key: 'id', label: 'Property ID' },
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'Slug' },
  { key: 'description', label: 'Description' },
  // Classification
  { key: 'purpose', label: 'Purpose' },
  { key: 'property_type_name', label: 'Property Type' },
  { key: 'category', label: 'Category' },
  { key: 'sub_type', label: 'Sub Type' },
  // Status
  { key: 'status', label: 'Status' },
  { key: 'approval_status', label: 'Approval Status' },
  { key: 'is_featured', label: 'Featured' },
  { key: 'is_verified', label: 'Verified' },
  { key: 'is_negotiable', label: 'Negotiable' },
  // Pricing
  { key: 'price', label: 'Price (₹)' },
  { key: 'rent_amount', label: 'Rent Amount (₹)' },
  { key: 'security_deposit', label: 'Security Deposit (₹)' },
  { key: 'maintenance_charges', label: 'Maintenance Charges (₹)' },
  { key: 'price_per_sqft', label: 'Price Per Sqft (₹)' },
  // Location
  { key: 'city_name', label: 'City' },
  { key: 'locality_name', label: 'Locality' },
  { key: 'address', label: 'Address' },
  { key: 'landmark', label: 'Landmark' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'state', label: 'State' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  // Dimensions
  { key: 'area_sqft', label: 'Area (sqft)' },
  { key: 'carpet_area', label: 'Carpet Area (sqft)' },
  { key: 'built_up_area', label: 'Built Up Area (sqft)' },
  { key: 'plot_area', label: 'Plot Area (sqft)' },
  // Rooms
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms' },
  { key: 'balconies', label: 'Balconies' },
  { key: 'parking', label: 'Parking' },
  { key: 'floor_number', label: 'Floor Number' },
  { key: 'total_floors', label: 'Total Floors' },
  // Furnishing & Condition
  { key: 'furnishing_status', label: 'Furnishing Status' },
  { key: 'possession_status', label: 'Possession Status' },
  { key: 'age_of_property', label: 'Age of Property (yrs)' },
  { key: 'facing', label: 'Facing' },
  // Amenities & Media
  { key: 'amenities', label: 'Amenities' },
  { key: 'images', label: 'Image URLs' },
  { key: 'nearby_locations', label: 'Nearby Locations & Landmarks' },
  { key: 'features', label: 'Features & Specifications' },
  // Owner / Agent
  { key: 'owner_name', label: 'Owner Name' },
  { key: 'owner_email', label: 'Owner Email' },
  { key: 'owner_phone', label: 'Owner Phone' },
  { key: 'agent_name', label: 'Agent Name' },
  { key: 'listed_by', label: 'Listed By' },
  // Analytics & Verification
  { key: 'legal_approved', label: 'Legal Approved' },
  { key: 'ai_score', label: 'AI Quality Score' },
  { key: 'view_count', label: 'Views' },
  { key: 'inquiry_count', label: 'Inquiries' },
  { key: 'shortlist_count', label: 'Shortlists' },
  // SEO
  { key: 'seo_title', label: 'SEO Title' },
  { key: 'seo_description', label: 'SEO Description' },
  { key: 'seo_keywords', label: 'SEO Keywords' },
  // Dates & System
  { key: 'country', label: 'Country' },
  { key: 'rejection_reason', label: 'Rejection Reason' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' },
  { key: 'published_at', label: 'Published At' },
  { key: 'available_from', label: 'Available From' },
];


interface AdminPropertiesFilterState {
  tab: string;
  search: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  purpose: string;
  type: string;
  dateFrom: string;
  dateTo: string;
}

interface PendingProperty extends Property {
  owner?: { first_name: string | null; last_name: string | null; email: string; phone?: string | null } | null;
  ai_verification?: AiVerification | null;
}

function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '—';
  const clean = phone.replace(/[^\d]/g, '');
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  if (phone.startsWith('+')) return phone;
  return phone;
}

// AI Confidence Score / Verification Status pill for the admin queue — surfaces the AI
// Verified Listings result inline without restructuring the existing table/card layout.
function AiVerificationPill({ property }: { property: PendingProperty }) {
  const status = property.ai_verification?.verification_status ?? property.verification_status ?? 'Pending AI';
  const score = property.ai_verification?.ai_score ?? property.ai_score;
  const styles: Record<string, string> = {
    'AI Verified': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'Manual Review': 'bg-amber-100 text-amber-800 border-amber-300',
    Rejected: 'bg-error-100 text-error-700 border-error-300',
    'Pending AI': 'bg-navy-100 text-navy-600 border-navy-200',
  };
  const Icon = status === 'AI Verified' ? ShieldCheck : status === 'Rejected' ? ShieldAlert : ShieldQuestion;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold whitespace-nowrap',
        styles[status] ?? styles['Pending AI'],
      )}
      title={score != null ? `AI Score: ${score}/100` : undefined}
    >
      <Icon className="h-3 w-3" /> {status}
      {score != null && <span className="font-normal opacity-75">· {score}</span>}
    </span>
  );
}

function PropertyReviewCard({ property, onReview }: { property: PendingProperty; onReview: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <img
          src={getPropertyCoverImage(property as any)}
          alt=""
          onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
          className="h-20 w-28 shrink-0 rounded-lg object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-navy-900 line-clamp-1">{property.title}</p>
            <StatusBadge status={property.status} />
          </div>
          <p className="text-xs text-navy-500">
            {property.locality_name}, {property.city_name}
          </p>
          <p className="mt-1 font-semibold text-navy-900">{formatPrice(property.price, property.purpose)}</p>
          <p className="text-xs text-navy-400 mt-1">
            by {property.owner?.email ?? 'Unknown'} · {formatDate(property.created_at)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onReview}>
          Review
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<Check className="h-4 w-4" />}
          onClick={() => updatePropertyStatus(property.id, 'approved').then(() => {
            queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
          })}
        >
          Quick approve
        </Button>
      </div>
    </Card>
  );
}

export function AdminApprovals() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<PendingProperty | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [rejectError, setRejectError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showOverride, setShowOverride] = useState(false);
  const [overrideRemarks, setOverrideRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-approvals'],
    queryFn: async () => {
      // Use admin RPC to bypass RLS entirely
      const { data: allProps, error } = await supabase.rpc('admin_get_properties');

      if (error) {
        console.error('admin_get_properties RPC Error:', error);
        throw error;
      }

      // Sorted properties
      // Sorted properties
      const nonPublished = ['pending_approval', 'draft', 'rejected', 'archived', 'in_review'];
      const properties = (allProps ?? [])
        .filter((p: any) => nonPublished.includes(p.status))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const ownerIds = [...new Set(properties.map((p: any) => p.owner_id))].filter(Boolean);

      let profilesMap: Record<string, any> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .in('id', ownerIds);

        if (profiles) {
          profilesMap = profiles.reduce(
            (acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            },
            {} as Record<string, any>,
          );
        }
      }

      // Latest AI verification per property (admin has full read via RLS on ai_verifications).
      const propertyIds = properties.map((p: any) => p.id);
      const verificationMap: Record<string, AiVerification> = {};
      if (propertyIds.length > 0) {
        const { data: verifications } = await supabase
          .from('ai_verifications')
          .select('*')
          .in('property_id', propertyIds)
          .order('created_at', { ascending: false });
        if (verifications) {
          for (const v of verifications as AiVerification[]) {
            if (!verificationMap[v.property_id]) verificationMap[v.property_id] = v; // first = latest (desc order)
          }
        }
      }

      return properties.map((p: any) => {
        const mapped = mapJoined(p as unknown as Record<string, unknown>);
        const owner = profilesMap[p.owner_id] || null;
        return { ...mapped, owner, ai_verification: verificationMap[p.id] ?? null } as unknown as PendingProperty;
      });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-approvals-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const property = data?.find((p: any) => p.id === id);
      if (status === 'published' || status === 'approved') {
        if (property && (!property.title || property.title.trim() === '')) {
          throw new Error('This property cannot be published because the title is missing.');
        }
        if (property && !isPropertyPublishable(property)) {
          throw new Error('This property cannot be published because the price must be greater than ₹0.');
        }
      }

      await updatePropertyStatus(id, status as Property['status'], reason);
      if (['published', 'approved', 'rejected', 'changes_requested'].includes(status)) {
        if (property?.owner?.email || property?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: property.owner_id,
            type: 'property_status',
            title: `Property ${status === 'published' ? 'Live' : status}`,
            body: `Your property "${property.title}" status is now ${status === 'published' ? 'Live' : status}.${reason ? ` Reason: ${reason}` : ''}`,
            link: generatePropertyUrl({ id: id }),
          });
        }
      }
    },
    onSuccess: (_, variables) => {
      setSelected(null);
      setShowReject(false);
      setShowRequestChanges(false);
      setRejectionReason('');
      setRejectError('');
      
      const isLive = variables.status === 'published' || variables.status === 'approved';
      if (isLive) {
        toast.addToast('success', 'Property is now LIVE on customer portal!');
      } else if (variables.status === 'rejected') {
        toast.addToast('success', 'Property rejected successfully.');
      } else {
        toast.addToast('success', `Status updated to ${variables.status}.`);
      }

      // Comprehensive multi-query cache invalidation
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['home-sponsored-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-luxury'] });
      queryClient.invalidateQueries({ queryKey: ['home-exclusive-properties'] });
    },
    onError: (err: unknown) => {
      toast.addToast('error', err instanceof Error ? err.message : 'Failed to update property status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  // Admin override of the AI verification decision (via the verifyProperty/approveProperty/
  // rejectProperty edge functions, which call the existing admin_approve_property /
  // admin_reject_property RPCs and additionally write an audited ai_verifications row with
  // admin_override=true + the remarks entered below).
  const overrideMutation = useMutation({
    mutationFn: async ({ id, decision, remarks }: { id: string; decision: 'approve' | 'reject'; remarks: string }) => {
      if (decision === 'approve') {
        return adminApproveWithAi(id, remarks || undefined);
      }
      return adminRejectWithAi(id, remarks || 'Overridden by admin.', remarks || undefined);
    },
    onSuccess: () => {
      toast.addToast('success', 'AI decision overridden.');
      setShowOverride(false);
      setOverrideRemarks('');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: unknown) => {
      toast.addToast('error', err instanceof Error ? err.message : 'Override failed');
    },
  });

  const columns: Column<PendingProperty>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (p) => <span className="font-mono text-xs text-navy-500">{p.id.slice(0, 8)}</span>,
    },
    {
      key: 'title',
      header: 'Property',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <img
            src={getPropertyCoverImage(p)}
            alt=""
            onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
            className="h-10 w-14 rounded object-cover"
          />
          <div>
            <Link to={generatePropertyUrl(p)} className="font-medium text-navy-900 hover:underline line-clamp-1">
              {p.title}
            </Link>
            <p className="text-xs text-navy-500">{p.property_type_name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (p) => (
        <div>
          <p className="font-medium text-navy-900">
            {p.owner?.first_name || 'Owner'} {p.owner?.last_name || ''}
          </p>
          <p className="text-xs text-navy-500">{p.owner?.email || p.owner_id.slice(0, 8)}</p>
        </div>
      ),
    },
    { key: 'city', header: 'City', render: (p) => p.city_name || '—' },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      render: (p) => (
        <span className="font-semibold">
          {formatPrice(p.price, p.purpose)}
          {p.status !== 'draft' && !isPropertyPublishable(p) && (
            <span className="block text-xs font-bold text-red-600">⚠ Invalid Price</span>
          )}
        </span>
      ),
    },
    { key: 'purpose', header: 'Listing Type', render: (p) => <Badge variant="default">{p.purpose}</Badge> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'ai_verification', header: 'AI Verification', render: (p) => <AiVerificationPill property={p} /> },
    { key: 'created_at', header: 'Submitted Date', sortable: true, render: (p) => formatDate(p.created_at) },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => setSelected(p)}>
            View
          </Button>
          {p.status !== 'approved' && p.status !== 'published' ? (
            <button
              onClick={() => {
                if (!isPropertyPublishable(p)) {
                  toast.addToast('error', 'This property cannot be approved because the price must be greater than ₹0.');
                  return;
                }
                statusMutation.mutate({ id: p.id, status: 'approved' });
              }}
              disabled={statusMutation.isPending || !isPropertyPublishable(p)}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all",
                !isPropertyPublishable(p)
                  ? "bg-slate-150 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              )}
              title={!isPropertyPublishable(p) ? 'Cannot approve: price must be at least ₹1,000' : 'Approve'}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
              <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" /> Approved
            </span>
          )}
          {p.status !== 'rejected' && (
            <Button
              size="sm"
              variant="danger"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={() => {
                setSelected(p);
                setShowReject(true);
              }}
            >
              Reject
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-error-600 hover:bg-error-50"
            onClick={() => {
              if (confirm('Delete this property permanently?')) deleteMutation.mutate(p.id);
            }}
            icon={<X className="h-3.5 w-3.5" />}
            title="Delete"
          />
        </div>
      ),
    },
  ];

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:approvals', 'Approvals')}>
      <PageHeader
        title="Property approvals"
        subtitle="Review and approve submitted properties, then publish to the portal."
      />

      <div className="mb-6">
        <DataTable
          columns={columns}
          rows={data ?? []}
          loading={isLoading}
          getRowId={(p) => p.id}
          pageSize={10}
          selectedIds={selectedIds}
          onToggleSelect={(id) =>
            setSelectedIds((s) => {
              const n = new Set(s);
              n.has(id) ? n.delete(id) : n.add(id);
              return n;
            })
          }
          onSelectAll={(ids) =>
            setSelectedIds((s) => {
              const n = new Set(s);
              ids.forEach((id) => (n.has(id) ? n.delete(id) : n.add(id)));
              return n;
            })
          }
          cardRender={(p) => (
            <Card className="p-4 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
              <div>
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-navy-100">
                  <img
                    src={getPropertyCoverImage(p)}
                    alt=""
                    onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <h4 className="font-bold text-navy-900 text-base line-clamp-1">{p.title}</h4>
                <p className="text-xs text-navy-500 mt-0.5">
                  {p.locality_name ?? '—'}, {p.city_name ?? '—'}
                </p>
                <div className="mt-1.5">
                  <AiVerificationPill property={p} />
                </div>
                <p className="font-bold text-navy-900 mt-2 text-lg">{formatPrice(p.price, p.purpose)}</p>
                <p className="text-xs text-navy-400 mt-1">Owner: {p.owner?.email ?? 'Unknown'}</p>
                <p className="text-xs text-navy-400">Date: {formatDate(p.created_at)}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-navy-100 flex items-center justify-between gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelected(p)}>
                  View
                </Button>
                <div className="flex gap-1.5">
                  {p.status === 'published' ? (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      ✓ Live
                    </span>
                  ) : (
                    <button
                      onClick={() => statusMutation.mutate({ id: p.id, status: 'published' })}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                      title="Make property Live immediately on customer portal"
                    >
                      <Check className="h-3.5 w-3.5" /> Make Live
                    </button>
                  )}
                  {p.status !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<X className="h-3.5 w-3.5" />}
                      onClick={() => {
                        setSelected(p);
                        setShowReject(true);
                      }}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        />
      </div>

      {/* Review Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Review property details"
        size="lg"
        footer={
          selected && (
            <div className="flex flex-wrap gap-2">
              {selected.status !== 'published' ? (
                <Button
                  variant="gold"
                  icon={<Send className="h-4 w-4" />}
                  onClick={() => statusMutation.mutate({ id: selected.id, status: 'published' })}
                  loading={statusMutation.isPending}
                >
                  Make Live (Publish)
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
                  <Check className="h-4 w-4" /> Currently Live on Portal
                </span>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectError('');
                  setShowRequestChanges(true);
                }}
              >
                Request Changes
              </Button>
              <Button
                variant="danger"
                icon={<X className="h-4 w-4" />}
                onClick={() => {
                  setRejectError('');
                  setShowReject(true);
                }}
              >
                Reject
              </Button>
              <Button
                variant="secondary"
                icon={<ShieldQuestion className="h-4 w-4" />}
                onClick={() => {
                  setOverrideRemarks('');
                  setShowOverride(true);
                }}
              >
                Override AI Decision
              </Button>
              <Link to={generatePropertyUrl({ id: selected.id })} target="_blank">
                <Button variant="secondary" icon={<Eye className="h-4 w-4" />}>
                  Open Listing
                </Button>
              </Link>
            </div>
          )
        }
      >
        {selected && (
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <img
              src={getPropertyCoverImage(selected as any)}
              alt=""
              onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
              className="mb-4 aspect-video w-full rounded-lg object-cover"
            />

            <div className="mb-4 rounded-xl border border-navy-100 bg-navy-50/60 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-display text-lg font-bold text-navy-900">AI Verification</h3>
                <AiVerificationPill property={selected} />
              </div>
              {selected.ai_verification ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-navy-500">
                    Verified by <span className="font-medium text-navy-800">{selected.ai_verification.verified_by}</span> on{' '}
                    {formatDate(selected.ai_verification.verified_at)}
                    {selected.ai_verification.admin_override && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        Overridden
                      </span>
                    )}
                  </p>
                  {selected.ai_verification.admin_remarks && (
                    <p className="text-navy-600">
                      <span className="text-navy-500">Admin remarks:</span> {selected.ai_verification.admin_remarks}
                    </p>
                  )}
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {Object.entries(selected.ai_verification.check_results ?? {}).map(([key, result]) => (
                      <div
                        key={key}
                        className={cn(
                          'flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
                          result.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-error-50 text-error-700',
                        )}
                      >
                        {result.passed ? (
                          <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        )}
                        <span>
                          <span className="font-semibold capitalize">{key.replace(/_/g, ' ')}:</span> {result.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-navy-500">
                  No AI verification has run for this property yet (status: {selected.verification_status ?? 'Pending AI'}).
                </p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Basic Information</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-navy-500">Title:</span> <span className="font-medium">{selected.title}</span>
                  </p>
                  <p>
                    <span className="text-navy-500">Property Type:</span>{' '}
                    <span className="font-medium">{selected.property_type_name}</span>
                  </p>
                  <p>
                    <span className="text-navy-500">Listing Type:</span>{' '}
                    <span className="font-medium">{selected.purpose}</span>
                  </p>
                  <p>
                    <span className="text-navy-500">Price:</span>{' '}
                    <span className="font-medium text-navy-900">{formatPrice(selected.price, selected.purpose)}</span>
                  </p>
                  {selected.price_per_unit != null && (
                    <p>
                      <span className="text-navy-500">Price / {getPriceUnitLabel(selected.area_unit)}:</span>{' '}
                      <span className="font-medium text-navy-900">{formatPrice(selected.price_per_unit)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Customer Details</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-navy-500">Name:</span>{' '}
                    <span className="font-medium">
                      {selected.owner?.first_name} {selected.owner?.last_name}
                    </span>
                  </p>
                  <p>
                    <span className="text-navy-500">Email:</span>{' '}
                    <span className="font-medium">{selected.owner?.email}</span>
                  </p>
                </div>
              </div>

              <div className="md:col-span-2">
                <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Location</h3>
                <p className="text-sm text-navy-800">{selected.address}</p>
                <p className="text-sm text-navy-600">
                  {selected.locality_name}, {selected.city_name}
                </p>
              </div>

              <div className="md:col-span-2">
                <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Specifications</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {selected.bedrooms != null && (
                    <div>
                      <p className="text-navy-400">Bedrooms</p>
                      <p className="font-medium">{selected.bedrooms}</p>
                    </div>
                  )}
                  {selected.bathrooms != null && (
                    <div>
                      <p className="text-navy-400">Bathrooms</p>
                      <p className="font-medium">{selected.bathrooms}</p>
                    </div>
                  )}
                  {selected.built_up_area != null && (
                    <div>
                      <p className="text-navy-400">Area</p>
                      <p className="font-medium">{selected.built_up_area} sqft</p>
                    </div>
                  )}
                  {selected.facing != null && (
                    <div>
                      <p className="text-navy-400">Facing</p>
                      <p className="font-medium">{selected.facing}</p>
                    </div>
                  )}
                  {selected.furnishing != null && (
                    <div>
                      <p className="text-navy-400">Furnishing</p>
                      <p className="font-medium">{selected.furnishing}</p>
                    </div>
                  )}
                </div>
              </div>

              {selected.amenities && selected.amenities.length > 0 && (
                <div className="md:col-span-2">
                  <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.amenities.map((a: string) => (
                      <Badge key={a} variant="default">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selected.description && (
                <div className="md:col-span-2">
                  <h3 className="mb-2 font-display text-lg font-bold text-navy-900">Description</h3>
                  <p className="text-sm text-navy-700 whitespace-pre-line">{selected.description}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject reason modal */}
      <Modal
        open={showReject}
        onClose={() => {
          setShowReject(false);
          setRejectError('');
        }}
        title="Reject property"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowReject(false);
                setRejectError('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!rejectionReason.trim()) {
                  setRejectError('Rejection reason is required');
                  return;
                }
                setRejectError('');
                selected && statusMutation.mutate({ id: selected.id, status: 'rejected', reason: rejectionReason });
              }}
              loading={statusMutation.isPending}
            >
              Confirm reject
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason for rejection"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="e.g. Missing ownership documents, images unclear..."
          error={rejectError}
        />
      </Modal>

      {/* Request Changes modal */}
      <Modal
        open={showRequestChanges}
        onClose={() => {
          setShowRequestChanges(false);
          setRejectError('');
        }}
        title="Request Changes"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowRequestChanges(false);
                setRejectError('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!rejectionReason.trim()) {
                  setRejectError('Comments are required');
                  return;
                }
                setRejectError('');
                selected &&
                  statusMutation.mutate({ id: selected.id, status: 'changes_requested', reason: rejectionReason });
              }}
              loading={statusMutation.isPending}
            >
              Send to Customer
            </Button>
          </>
        }
      >
        <Textarea
          label="Comments for customer"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="e.g. Please upload a clearer image of the front facade..."
          error={rejectError}
        />
      </Modal>

      {/* Override AI Decision modal */}
      <Modal
        open={showOverride}
        onClose={() => setShowOverride(false)}
        title="Override AI Decision"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowOverride(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<X className="h-4 w-4" />}
              onClick={() => selected && overrideMutation.mutate({ id: selected.id, decision: 'reject', remarks: overrideRemarks })}
              loading={overrideMutation.isPending}
            >
              Override → Reject
            </Button>
            <Button
              variant="gold"
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => selected && overrideMutation.mutate({ id: selected.id, decision: 'approve', remarks: overrideRemarks })}
              loading={overrideMutation.isPending}
            >
              Override → AI Verified
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-navy-600">
          Manually override the AI verification result for <span className="font-semibold">{selected?.title}</span>. This
          is recorded in the audit trail (verification_logs) and notifies the property owner.
        </p>
        <Textarea
          label="Remarks (optional but recommended)"
          value={overrideRemarks}
          onChange={(e) => setOverrideRemarks(e.target.value)}
          placeholder="e.g. Manually verified ownership documents; AI flagged images incorrectly."
        />
      </Modal>
    </DashboardLayout>
  );
}

export function AdminProperties() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    city: '',
    minPrice: '',
    maxPrice: '',
    purpose: '',
    type: '',
    dateFrom: '',
    dateTo: '',
  });
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleRows, setVisibleRows] = useState<PendingProperty[]>([]);
  const handleVisibleRowsChange = useCallback((rows: PendingProperty[]) => setVisibleRows(rows), []);
  const [exportAllRows, setExportAllRows] = useState<PendingProperty[]>([]);

  // Bulk Publish to Homepage state
  const [bulkPublishOpen, setBulkPublishOpen] = useState(false);
  const [bulkPublishMode, setBulkPublishMode] = useState<'publish' | 'remove'>('publish');

  // Hero Campaign state
  const [heroProperty, setHeroProperty] = useState<PendingProperty | null>(null);
  const [heroForm, setHeroForm] = useState({
    title: '',
    subtitle: '',
    banner_image: '',
    cta_text: 'Explore Project',
    priority: 1,
    start_date: new Date().toISOString().slice(0, 16),
    end_date: ''
  });
  const [savingHero, setSavingHero] = useState(false);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: any; reason?: string }) => {
      await updatePropertyStatus(id, status, reason);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      toast.addToast('success', `Property status updated to ${variables.status}`);
    },
    onError: (err: any) => {
      toast.addToast('error', err?.message || 'Failed to update property status');
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, shouldFeature }: { id: string; shouldFeature: boolean }) => {
      await togglePropertyFeatured(id, shouldFeature, 'Medium');
    },
    onSuccess: (_, vars) => {
      toast.addToast(
        'success',
        vars.shouldFeature ? 'Property added to Featured Properties.' : 'Property removed from Featured Properties.'
      );
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      queryClient.invalidateQueries({ queryKey: ['admin-featured-properties'] });
      queryClient.invalidateQueries({ queryKey: ['home-featured-properties'] });
    },
    onError: (err: any) => {
      toast.addToast('error', err?.message || 'Failed to update featured status');
    },
  });
  
  const saveHeroCampaign = async () => {
    if (!heroProperty) return;
    setSavingHero(true);
    try {
      const payload = {
        title: heroForm.title?.trim() || heroProperty.title,
        subtitle: heroForm.subtitle?.trim() || 'Premium Verified Property',
        banner_image: heroForm.banner_image?.trim() || (Array.isArray(heroProperty.images) ? heroProperty.images[0] : null),
        cta_text: heroForm.cta_text?.trim() || 'Explore Project',
        cta_url: `/property/${heroProperty.id}`,
        property_id: heroProperty.id,
        priority: Number(heroForm.priority) || 1,
        start_date: heroForm.start_date ? new Date(heroForm.start_date).toISOString() : new Date().toISOString(),
        end_date: heroForm.end_date ? new Date(heroForm.end_date).toISOString() : null,
        campaign_type: 'Paid',
        package_tier: 'Featured',
        display_type: 'Hero Banner',
        status: 'Active',
        city_id: heroProperty.city_id || null,
        is_pinned: false,
        order_no: 0
      };
      
      const { error } = await supabase.from('hero_campaigns').insert(payload);
      if (error) throw error;

      // Ensure property status is published
      if (heroProperty.status !== 'published') {
        await updatePropertyStatus(heroProperty.id, 'published');
        queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      }
      
      toast.addToast('success', 'Hero campaign published successfully!');
      setHeroProperty(null);
    } catch (err: any) {
      toast.addToast('error', err?.message || 'Failed to publish hero campaign');
    } finally {
      setSavingHero(false);
    }
  };

  // Real-time Counts
  const [counts, setCounts] = useState<Record<string, number>>({
    all: 0,
    published: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    draft: 0,
  });

  const fetchCounts = useCallback(async () => {
    try {
      const countsMap: Record<string, number> = {
        all: 0,
        published: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        draft: 0,
      };
      
      const queries = [
        supabase.from('properties').select('id', { count: 'exact', head: true }).then(res => countsMap.all = res.count || 0),
        supabase.from('properties').select('id', { count: 'exact', head: true }).in('status', ['published', 'approved']).then(res => countsMap.published = res.count || 0),
        supabase.from('properties').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'pending_verification']).then(res => countsMap.pending = res.count || 0),
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'approved').then(res => countsMap.approved = res.count || 0),
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'rejected').then(res => countsMap.rejected = res.count || 0),
        supabase.from('properties').select('id', { count: 'exact', head: true }).in('status', ['draft', 'submitted']).then(res => countsMap.draft = res.count || 0),
      ];
      await Promise.all(queries);
      setCounts(countsMap);
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    
    // Subscribe to realtime changes on properties to update counts
    const channel = supabase.channel('admin_properties_counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => {
          fetchCounts();
          // Optionally invalidate query to refresh table data if needed, but we don't want to force refresh while typing
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  // Fetch ALL records (no pagination) for export — runs on demand
  const fetchAllForExport = useCallback(async (): Promise<PendingProperty[]> => {
    let q = supabase
      .from('v_properties_search')
      .select('*')
      .order('created_at', { ascending: false });
    if (tab !== 'all') {
      if (tab === 'pending') q = q.in('status', ['submitted', 'pending_verification']);
      else if (tab === 'published' || tab === 'approved') q = q.in('status', ['published', 'approved']);
      else q = q.eq('status', tab);
    }
    if (search) q = q.ilike('search_text', `%${search}%`);
    if (filters.city) q = q.eq('city_id', filters.city);
    if (filters.minPrice) q = q.gte('price', Number(filters.minPrice));
    if (filters.maxPrice) q = q.lte('price', Number(filters.maxPrice));
    if (filters.purpose) q = q.eq('purpose', filters.purpose);
    if (filters.type) q = q.eq('property_type_id', filters.type);
    if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom);
    if (filters.dateTo) q = q.lte('created_at', `${filters.dateTo}T23:59:59Z`);

    const { data: allData } = await q;
    const rows = (allData ?? []) as unknown as PendingProperty[];
    // Flatten owner info from owner_id
    const ownerIds = [...new Set(rows.map((p: any) => p.owner_id))].filter(Boolean);
    let profilesMap: Record<string, any> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, phone')
        .in('id', ownerIds);
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, any>);
      }
    }
    const enriched = rows.map((p: any) => {
      const owner = profilesMap[p.owner_id] || null;
      return {
        ...p,
        owner_name: owner ? `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim() : (p.owner_name ?? ''),
        owner_email: owner?.email ?? p.owner_email ?? '',
        owner_phone: owner?.phone ?? p.owner_phone ?? '',
        amenities: Array.isArray(p.amenities) ? p.amenities.join('; ') : (p.amenities ?? ''),
        images: Array.isArray(p.images) ? p.images.map((img: any) => (typeof img === 'string' ? img : img.url || JSON.stringify(img))).join('; ') : (p.images ?? ''),
        nearby_locations: Array.isArray(p.nearby_locations) ? p.nearby_locations.join('; ') : (typeof p.nearby_locations === 'object' ? JSON.stringify(p.nearby_locations) : (p.nearby_locations ?? p.landmark ?? '')),
        features: typeof p.features === 'object' ? JSON.stringify(p.features) : (p.features ?? ''),
        latitude: p.latitude ?? '',
        longitude: p.longitude ?? '',
        legal_approved: p.legal_approved ? 'Yes' : 'No',
        is_featured: p.is_featured ? 'Yes' : 'No',
        is_verified: (p.verification_status === 'AI Verified' || p.verified_status === 'verified' || !!p.is_verified) ? 'Yes' : 'No',
        is_negotiable: p.is_negotiable ? 'Yes' : 'No',
        country: p.country ?? 'India',
      };
    });
    setExportAllRows(enriched);
    return enriched;
  }, [tab, search, filters]);

  const [editing, setEditing] = useState<PendingProperty | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    price: '',
    purpose: 'Sale',
    city_id: '',
    locality_id: '',
    property_type_id: '',
    status: 'draft',
    seo_title: '',
    seo_description: '',
    seo_slug: '',
    seo_keywords: '',
  });
  const [propertyToReject, setPropertyToReject] = useState<PendingProperty | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [regeneratingSeo, setRegeneratingSeo] = useState(false);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const realtimeTick = useRealtimeCount('properties');
  const savedFilters = useSavedFilters<AdminPropertiesFilterState>('admin-properties');

  const toggleVerifiedMutation = useMutation({
    mutationFn: async ({ id, isVerified }: { id: string; isVerified: boolean }) => {
      const { error } = await supabase
        .from('properties')
        .update({
          verification_status: isVerified ? 'AI Verified' : 'Pending AI',
          verified_status: isVerified ? 'verified' : 'unverified',
          ai_verified_at: isVerified ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.addToast('success', variables.isVerified ? 'Property marked as Verified.' : 'Property verification removed.');
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
    },
    onError: (err: any) => {
      toast.addToast('error', err?.message || 'Failed to update verification status.');
    },
  });

  // Reset to page 1 and close any open popovers whenever the filter/search/tab shape changes underneath the current page.
  useEffect(() => {
    setPage(1);
    closeAllPublishPopovers();
  }, [tab, search, filters]);

  useEffect(() => {
    closeAllPublishPopovers();
  }, [page]);

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['admin-properties', tab, search, filters, page, realtimeTick],
    queryFn: async () => {
      const { data: citiesData } = await supabase.from('cities').select('id, name').order('name');
      const { data: typesData } = await supabase.from('property_types').select('id, name').order('name');
      setCities(citiesData ?? []);
      setPropertyTypes(typesData ?? []);
      let q = supabase
        .from('v_properties_search')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (tab !== 'all') {
        if (tab === 'pending') q = q.in('status', ['submitted', 'pending_verification']);
        else if (tab === 'published' || tab === 'approved') q = q.in('status', ['published', 'approved']);
        else q = q.eq('status', tab);
      }
      if (search) {
        const isNumeric = !isNaN(Number(search)) && search.trim() !== '';
        if (isNumeric) {
          q = q.or(`search_text.ilike.%${search}%,price.eq.${search},rent_amount.eq.${search}`);
        } else {
          q = q.ilike('search_text', `%${search}%`);
        }
      }
      if (filters.city) q = q.eq('city_id', filters.city);
      if (filters.minPrice) q = q.gte('price', Number(filters.minPrice));
      if (filters.maxPrice) q = q.lte('price', Number(filters.maxPrice));
      if (filters.purpose) q = q.eq('purpose', filters.purpose);
      if (filters.type) q = q.eq('property_type_id', filters.type);
      if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom);
      if (filters.dateTo) q = q.lte('created_at', `${filters.dateTo}T23:59:59Z`);

      const from = (page - 1) * ADMIN_PROPERTIES_PAGE_SIZE;
      const queryRes = await q.range(from, from + ADMIN_PROPERTIES_PAGE_SIZE - 1);
      let data = queryRes.data;
      let count = queryRes.count;
      const error = queryRes.error;

      if (error) {
        console.warn('Supabase Query Warning, falling back to raw select:', error);
        const rawRes = await supabase
          .from('v_properties_search')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + ADMIN_PROPERTIES_PAGE_SIZE - 1);
        data = rawRes.data;
        count = rawRes.count;
      }

      const properties = data ?? [];
      const ownerIds = [...new Set(properties.map((p) => p.owner_id))].filter(Boolean);

      let profilesMap: Record<string, any> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, phone')
          .in('id', ownerIds);

        if (profiles) {
          profilesMap = profiles.reduce(
            (acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            },
            {} as Record<string, any>,
          );
        }
      }

      return {
        properties: properties.map((p) => {
          const owner = profilesMap[p.owner_id] || null;
          // The view already returns flattened fields like city_name, so we don't need mapJoined here
          return { ...p, owner } as unknown as PendingProperty;
        }),
        count: count ?? properties.length,
      };
    },
  });

  const properties = data?.properties ?? [];
  const totalCount = data?.count ?? 0;

  const seedSampleProperties = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || '00000000-0000-0000-0000-000000000001';

      const samples = [
        {
          title: 'DLF The Camellias Luxury Penthouse',
          description:
            'Ultra-luxurious 4 BHK penthouse with Golf Course views, private elevator, and smart automation.',
          purpose: 'Buy',
          price: 35000000,
          area_sqft: 4200,
          bedrooms: 4,
          bathrooms: 5,
          address: 'Golf Course Road, Sector 42',
          status: 'published',
          is_featured: true,
          owner_id: userId,
          images: ['https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg'],
        },
        {
          title: 'Prestige Lakeside Habitat Villa',
          description: 'Contemporary 3 BHK independent villa with private garden, swimming pool, and solar power.',
          purpose: 'Buy',
          price: 28000000,
          area_sqft: 3100,
          bedrooms: 3,
          bathrooms: 4,
          address: 'Varthur Main Road, Whitefield',
          status: 'published',
          is_featured: true,
          owner_id: userId,
          images: ['https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg'],
        },
        {
          title: 'Cyber Towers Grade-A Office Space',
          description:
            'Fully furnished commercial office space with 120 workstations, 4 conference rooms, and 100% power backup.',
          purpose: 'Commercial',
          price: 180000,
          area_sqft: 5500,
          bedrooms: 0,
          bathrooms: 4,
          address: 'Hitec City, Madhapur',
          status: 'published',
          is_featured: false,
          owner_id: userId,
          images: ['https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg'],
        },
      ];

      const { error } = await supabase.from('properties').insert(samples);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      toast.addToast('success', 'Restored demo properties successfully!');
    } catch (err) {
      toast.addToast('error', err instanceof Error ? err.message : 'Failed to seed properties');
    }
  };

  const columns: Column<PendingProperty>[] = [
    {
      key: 'title',
      header: 'Property',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <img
            src={getPropertyCoverImage(p as any)}
            alt=""
            onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
            className="h-10 w-14 rounded object-cover"
          />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link to={generatePropertyUrl(p)} className="font-medium text-navy-900 hover:underline line-clamp-1">
                {p.title}
              </Link>
              {p.is_featured && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                  ⚡ Featured
                </span>
              )}
            </div>
            <p className="text-xs text-navy-500">
              {p.locality_name}, {p.city_name}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'lister_mobile',
      header: 'Lister Mobile',
      render: (p) => {
        const mobile = p.listed_by_mobile || p.owner?.phone || (p as any).owner_phone;
        if (!mobile) return <span className="text-slate-400 text-xs">—</span>;
        return (
          <span className="font-mono text-xs font-medium text-slate-800 whitespace-nowrap">
            {formatPhoneNumber(mobile)}
          </span>
        );
      },
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      render: (p) => {
        const pricing = getPropertyPricingDisplay(p);
        return (
          <span className="font-semibold text-slate-900">
            {pricing.primaryPrice}
            {pricing.isLand && pricing.totalEstimatedPrice && (
              <span className="block text-xs font-normal text-slate-500">
                Total: {pricing.totalEstimatedPrice}
              </span>
            )}
            {p.status !== 'draft' && !isPropertyPublishable(p) && (
              <span className="block text-xs font-bold text-red-600">⚠ Invalid Price</span>
            )}
          </span>
        );
      },
    },
    { key: 'purpose', header: 'Purpose', render: (p) => <Badge variant="default">{p.purpose}</Badge> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'view_count', header: 'Views', sortable: true, render: (p) => p.view_count },
    { key: 'created_at', header: 'Created', sortable: true, render: (p) => formatDate(p.created_at) },
    {
      key: 'publish_to',
      header: 'Publish To',
      render: (p) => (
        <PublishToSectionControl
          property={p}
          compact={true}
          onAssignmentChange={() => queryClient.invalidateQueries({ queryKey: ['admin-properties'] })}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <div className="flex gap-1 items-center">
          <Button
            size="sm"
            variant="ghost"
            title="View Public Listing"
            onClick={() => window.open(generatePropertyUrl(p), '_blank')}
            icon={<Eye className="h-4 w-4" />}
          />
          {(p.status === 'submitted' || p.status === 'pending_verification') && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  "hover:bg-emerald-50",
                  !isPropertyPublishable(p) ? "text-slate-300 cursor-not-allowed opacity-50" : "text-emerald-600"
                )}
                title={!isPropertyPublishable(p) ? 'Cannot publish: price must be at least ₹1,000' : 'Make Live (Publish)'}
                disabled={!isPropertyPublishable(p)}
                onClick={() => {
                  if (!isPropertyPublishable(p)) {
                    toast.addToast('error', 'This property cannot be published because the price must be greater than ₹0.');
                    return;
                  }
                  statusMutation.mutate({ id: p.id, status: 'published' });
                }}
                icon={<Check className="h-4 w-4" />}
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-amber-600 hover:bg-amber-50"
                title="Reject Property"
                onClick={() => {
                  setPropertyToReject(p);
                  setRejectReason('');
                  setRejectError('');
                }}
                icon={<X className="h-4 w-4" />}
              />
            </>
          )}
          {p.status === 'published' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                title={p.is_featured ? 'Remove from Featured' : 'Publish to Featured Carousel'}
                className={p.is_featured ? 'text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-red-600'}
                disabled={toggleFeaturedMutation.isPending}
                onClick={() => toggleFeaturedMutation.mutate({ id: p.id, shouldFeature: !p.is_featured })}
                icon={<Sparkles className={cn('h-4 w-4', p.is_featured && 'fill-red-600 text-red-600')} />}
              />
              <Button
                size="sm"
                variant="ghost"
                title="Set as Hero Banner"
                className="text-indigo-600 hover:bg-indigo-50"
                onClick={() => {
                  setHeroProperty(p);
                  setHeroForm({
                    title: p.title || '',
                    subtitle: p.locality_name ? `${p.locality_name}, ${p.city_name}` : (p.city_name || ''),
                    banner_image: p.images?.[0] || '',
                    cta_text: 'Explore Project',
                    priority: 1,
                    start_date: new Date().toISOString().slice(0, 16),
                    end_date: ''
                  });
                }}
                icon={<Star className="h-4 w-4" />}
              />
            </>
          )}
          {(() => {
            const isPropVerified = p.verification_status === 'AI Verified' || p.verified_status === 'verified' || !!p.is_verified;
            return (
              <Button
                size="sm"
                variant="ghost"
                title={isPropVerified ? 'Verified Listing (Click to unverify)' : 'Mark as Verified Listing'}
                className={isPropVerified ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-300 hover:text-emerald-600'}
                disabled={toggleVerifiedMutation.isPending}
                onClick={() => toggleVerifiedMutation.mutate({ id: p.id, isVerified: !isPropVerified })}
                icon={<ShieldCheck className={cn('h-4 w-4', isPropVerified && 'fill-emerald-100')} />}
              />
            );
          })()}
          <Button
            size="sm"
            variant="ghost"
            title="Quick Edit"
            onClick={() => {
              setEditing(p);
              setEditForm({
                title: p.title,
                price: String(p.price),
                purpose: p.purpose,
                city_id: p.city_id ?? '',
                locality_id: p.locality_id ?? '',
                property_type_id: p.property_type_id ?? '',
                status: p.status,
                seo_title: p.seo_title ?? '',
                seo_description: p.seo_description ?? '',
                seo_slug: p.seo_slug ?? '',
                seo_keywords: (p.seo_keywords ?? []).join(', '),
              });
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-error-600"
            title="Delete Property"
            onClick={() => setToDelete(p.id)}
            icon={<X className="h-4 w-4" />}
          />
        </div>
      ),
    },
  ];

  const bulkStatusUpdate = async (status: string) => {
    await Promise.all([...selected].map((id) => updatePropertyStatus(id, status as Property['status'])));
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const results = await Promise.all(
      ids.map(async (id) => {
        const { error, count } = await supabase.from('properties').delete({ count: 'exact' }).eq('id', id);
        return { id, error, count };
      })
    );
    const failed = results.filter((r) => r.error || !r.count);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
    if (failed.length > 0) {
      toast.addToast('error', `Failed to delete ${failed.length} of ${ids.length} propert${ids.length === 1 ? 'y' : 'ies'}.`);
    } else {
      toast.addToast('success', `Deleted ${ids.length} propert${ids.length === 1 ? 'y' : 'ies'}.`);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('properties').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('Property was not found or you do not have permission to delete it.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
      toast.addToast('success', 'Property permanently deleted.');
      setToDelete(null);
    },
    onError: (err: any) => {
      toast.addToast('error', err?.message || 'Failed to delete property');
      setToDelete(null);
    },
  });

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await supabase
      .from('properties')
      .update({
        title: editForm.title,
        price: Number(editForm.price),
        purpose: editForm.purpose as 'Sale' | 'Rent',
        city_id: editForm.city_id,
        locality_id: editForm.locality_id,
        property_type_id: editForm.property_type_id,
        status: editForm.status,
        seo_title: editForm.seo_title || null,
        seo_description: editForm.seo_description || null,
        seo_slug: editForm.seo_slug || null,
        seo_keywords: editForm.seo_keywords
          ? editForm.seo_keywords.split(',').map((k) => k.trim()).filter(Boolean)
          : [],
      })
      .eq('id', editing.id);
    setSaving(false);
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ['admin-properties'] });
  };

  const regenerateSeo = async () => {
    if (!editing) return;
    setRegeneratingSeo(true);
    try {
      const { data, error } = await supabase.functions.invoke('generatePropertySeo', {
        body: { property_id: editing.id },
      });
      if (error) throw error;
      setEditForm((f) => ({
        ...f,
        seo_title: data?.seo_title ?? f.seo_title,
        seo_slug: data?.seo_slug ?? f.seo_slug,
      }));
      const { data: refreshed } = await supabase
        .from('properties')
        .select('seo_title, seo_description, seo_slug, seo_keywords')
        .eq('id', editing.id)
        .single();
      if (refreshed) {
        setEditForm((f) => ({
          ...f,
          seo_title: refreshed.seo_title ?? '',
          seo_description: refreshed.seo_description ?? '',
          seo_slug: refreshed.seo_slug ?? '',
          seo_keywords: (refreshed.seo_keywords ?? []).join(', '),
        }));
      }
      toast.addToast('success', 'SEO regenerated with AI');
    } catch (err: any) {
      toast.addToast('error', err?.message || 'SEO regeneration failed');
    } finally {
      setRegeneratingSeo(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const { t } = useLanguageContext();
  const adminSections = getAdminSections(t);

  return (
    <DashboardLayout sections={adminSections} title={t('dashboard:properties', 'Properties')}>
      <PageHeader
        title="All properties"
        subtitle="Manage every property on the platform."
        action={
          <div className="flex flex-wrap gap-2">
            <SavedFiltersMenu
              presets={savedFilters.presets}
              onSave={(name) => savedFilters.save(name, { tab, search, ...filters })}
              onRemove={savedFilters.remove}
              onApply={(f) => {
                setTab(f.tab);
                setSearch(f.search);
                setFilters({
                  city: f.city,
                  minPrice: f.minPrice,
                  maxPrice: f.maxPrice,
                  purpose: f.purpose,
                  type: f.type,
                  dateFrom: f.dateFrom,
                  dateTo: f.dateTo,
                });
              }}
            />
            <ExportMenuAsync filename="admin-properties" columns={ADMIN_PROPERTIES_EXPORT_COLUMNS} fetchRows={async () => (await fetchAllForExport()) as unknown as Record<string, unknown>[]} />
          </div>
        }
      />
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-navy-50/95 px-1 pb-3 pt-1 backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {['all', 'published', 'pending', 'approved', 'rejected', 'draft'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap flex items-center gap-2',
                  tab === t ? 'bg-navy-700 text-white' : 'text-navy-600 hover:bg-navy-50',
                )}
              >
                <span>{t === 'pending' ? 'Pending' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  tab === t ? "bg-white/20 text-white" : "bg-navy-100 text-navy-500"
                )}>
                  {counts[t] || 0}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
              <Input
                placeholder="Search title or address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Rich filters */}
        <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Select
            value={filters.city}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
            className="text-sm"
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.purpose}
            onChange={(e) => setFilters((f) => ({ ...f, purpose: e.target.value }))}
            className="text-sm"
          >
            <option value="">All purposes</option>
            <option value="Sale">Sale</option>
            <option value="Rent">Rent</option>
          </Select>
          <Select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            className="text-sm"
          >
            <option value="">All types</option>
            {propertyTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            placeholder="Min price"
            value={filters.minPrice}
            onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
            className="text-sm"
          />
          <Input
            type="number"
            placeholder="Max price"
            value={filters.maxPrice}
            onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
            className="text-sm"
          />
          <Input
            type="date"
            placeholder="Date from"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="text-sm"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="date"
            placeholder="Date to"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="text-sm w-auto"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({ city: '', minPrice: '', maxPrice: '', purpose: '', type: '', dateFrom: '', dateTo: '' })
            }
          >
            Clear filters
          </Button>
        </div>
        </Card>
      </div>

      {selected.size > 0 && (
        <BulkActionsBar
          count={selected.size}
          onDelete={bulkDelete}
          actions={
            <>
              <Button
                size="sm"
                variant="secondary"
                icon={<Layers className="h-4 w-4 text-red-600" />}
                onClick={() => {
                  setBulkPublishMode('publish');
                  setBulkPublishOpen(true);
                }}
              >
                Publish to Section
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-600 hover:text-red-600 text-xs"
                onClick={() => {
                  setBulkPublishMode('remove');
                  setBulkPublishOpen(true);
                }}
              >
                Remove from Section
              </Button>
              <Button size="sm" variant="primary" onClick={() => bulkStatusUpdate('approved')} loading={false}>
                Approve selected
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm('Reject selected? Reason will be empty.')) bulkStatusUpdate('rejected');
                }}
              >
                Reject selected
              </Button>
            </>
          }
        />
      )}

      {properties.length === 0 && !isLoading ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No properties found"
            description={
              tab !== 'all' || search || filters.city || filters.type || filters.purpose
                ? 'No properties match the selected filter or status tab.'
                : 'No properties listed on the platform yet.'
            }
            action={
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {(tab !== 'all' || search || filters.city || filters.type || filters.purpose) && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setTab('all');
                      setSearch('');
                      setFilters({
                        city: '',
                        minPrice: '',
                        maxPrice: '',
                        purpose: '',
                        type: '',
                        dateFrom: '',
                        dateTo: '',
                      });
                    }}
                  >
                    Clear All Filters
                  </Button>
                )}
                <Button onClick={seedSampleProperties}>Restore Demo Properties</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={properties}
          loading={isLoading}
          error={queryError instanceof Error ? queryError.message : null}
          searchable={false}
          dateFilterable={false}
          getRowId={(p) => p.id}
          selectedIds={selected}
          onToggleSelect={toggleSelect}
          onSelectAll={(ids) =>
            setSelected((s) => {
              const n = new Set(s);
              ids.forEach((id) => (n.has(id) ? n.delete(id) : n.add(id)));
              return n;
            })
          }
          onVisibleRowsChange={handleVisibleRowsChange}
          serverPagination={{
            page,
            pageSize: ADMIN_PROPERTIES_PAGE_SIZE,
            totalCount,
            onPageChange: setPage,
          }}
        />
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete property"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => toDelete && deleteMutation.mutate(toDelete)}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">This will permanently remove the property and all related data.</p>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit property"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            {editing && (
              <Link to={`/admin/properties/edit/${editing.id}`} target="_blank" className="mr-auto">
                <Button variant="ghost" size="sm" className="text-navy-600 text-xs">
                  Full Property Editor ↗
                </Button>
              </Link>
            )}
            <Button onClick={saveEdit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Title"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <Input
              label="Price"
              type="number"
              value={editForm.price}
              onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
            />
            <Select
              label="Purpose"
              value={editForm.purpose}
              onChange={(e) => setEditForm((f) => ({ ...f, purpose: e.target.value }))}
            >
              <option value="Sale">Sale</option>
              <option value="Rent">Rent</option>
            </Select>
            <Select
              label="City"
              value={editForm.city_id}
              onChange={(e) => setEditForm((f) => ({ ...f, city_id: e.target.value }))}
            >
              <option value="">Select city</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              label="Property type"
              value={editForm.property_type_id}
              onChange={(e) => setEditForm((f) => ({ ...f, property_type_id: e.target.value }))}
            >
              <option value="">Select type</option>
              {propertyTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
            >
              {['draft', 'submitted', 'pending_verification', 'approved', 'published', 'rejected'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>

            {/* Homepage Section Publishing */}
            <div className="sm:col-span-2 pt-3 pb-1 border-t border-slate-100 flex flex-col gap-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Homepage Publishing
              </label>
              <p className="text-xs text-slate-500">
                Control which premium homepage sections this property appears in:
              </p>
              <div>
                <PublishToSectionControl
                  property={editing}
                  compact={false}
                  onAssignmentChange={() => queryClient.invalidateQueries({ queryKey: ['admin-properties'] })}
                />
              </div>
            </div>

            <div className="sm:col-span-2 mt-2 flex items-center justify-between border-t border-navy-100 pt-3">
              <div>
                <h4 className="text-sm font-bold text-navy-900">SEO metadata</h4>
                <p className="text-xs text-navy-500">
                  AI-generated on submit/resubmit. Edits here override the AI output until it's regenerated again.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={regenerateSeo} loading={regeneratingSeo}>
                Regenerate with AI
              </Button>
            </div>
            <div className="sm:col-span-2">
              <Input
                label="SEO title"
                value={editForm.seo_title}
                onChange={(e) => setEditForm((f) => ({ ...f, seo_title: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Meta description"
                rows={2}
                value={editForm.seo_description}
                onChange={(e) => setEditForm((f) => ({ ...f, seo_description: e.target.value }))}
              />
            </div>
            <Input
              label="URL slug"
              value={editForm.seo_slug}
              onChange={(e) => setEditForm((f) => ({ ...f, seo_slug: e.target.value }))}
            />
            <Input
              label="Keywords (comma-separated)"
              value={editForm.seo_keywords}
              onChange={(e) => setEditForm((f) => ({ ...f, seo_keywords: e.target.value }))}
            />
          </div>
        )}
      </Modal>

      <Modal title="Set as Hero Campaign" open={!!heroProperty} onClose={() => setHeroProperty(null)}>
        <div className="space-y-4 py-4">
          <Input
            label="Campaign Heading"
            value={heroForm.title}
            onChange={(e) => setHeroForm(f => ({ ...f, title: e.target.value }))}
          />
          <Input
            label="Subheading / Location"
            value={heroForm.subtitle}
            onChange={(e) => setHeroForm(f => ({ ...f, subtitle: e.target.value }))}
          />
          <Input
            label="Banner Image URL"
            value={heroForm.banner_image}
            onChange={(e) => setHeroForm(f => ({ ...f, banner_image: e.target.value }))}
            placeholder="Ensure high-res landscape image"
          />
          <Input
            label="CTA Text"
            value={heroForm.cta_text}
            onChange={(e) => setHeroForm(f => ({ ...f, cta_text: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="datetime-local"
              value={heroForm.start_date}
              onChange={(e) => setHeroForm((f) => ({ ...f, start_date: e.target.value }))}
            />
            <Input
              label="End Date (Optional)"
              type="datetime-local"
              value={heroForm.end_date}
              onChange={(e) => setHeroForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
          <Input
            label="Priority (Higher number = shows first)"
            type="number"
            min={1}
            value={heroForm.priority}
            onChange={(e) => setHeroForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setHeroProperty(null)}>Cancel</Button>
            <Button onClick={saveHeroCampaign} loading={savingHero}>Publish Campaign</Button>
          </div>
        </div>
      </Modal>

      {/* Reject Property Modal */}
      <Modal
        open={!!propertyToReject}
        onClose={() => {
          setPropertyToReject(null);
          setRejectReason('');
          setRejectError('');
        }}
        title="Reject Property"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPropertyToReject(null);
                setRejectReason('');
                setRejectError('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!rejectReason.trim()) {
                  setRejectError('Please specify a rejection reason');
                  return;
                }
                if (propertyToReject) {
                  statusMutation.mutate({
                    id: propertyToReject.id,
                    status: 'rejected',
                    reason: rejectReason.trim(),
                  });
                  setPropertyToReject(null);
                }
              }}
              loading={statusMutation.isPending}
            >
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div className="space-y-3 pt-1">
          <p className="text-xs text-navy-600">
            Select a common reason or enter feedback for <strong>{propertyToReject?.title}</strong>:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['Incomplete Details', 'Unclear Photos', 'Price Discrepancy', 'Duplicate Listing', 'Missing Ownership Documents'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setRejectReason(tag)}
                className="text-[11px] font-semibold bg-slate-100 hover:bg-red-50 hover:text-red-700 px-2.5 py-1 rounded-lg border border-slate-200 transition"
              >
                {tag}
              </button>
            ))}
          </div>
          <Textarea
            label="Rejection Reason & Feedback"
            value={rejectReason}
            onChange={(e) => {
              setRejectReason(e.target.value);
              if (e.target.value.trim()) setRejectError('');
            }}
            placeholder="e.g. Missing ownership documents, unclear image resolution..."
            error={rejectError}
          />
        </div>
      </Modal>

      {/* Bulk Publish Modal */}
      <BulkPublishModal
        open={bulkPublishOpen}
        onClose={() => setBulkPublishOpen(false)}
        selectedPropertyIds={Array.from(selected)}
        mode={bulkPublishMode}
        onSuccess={() => setSelected(new Set())}
      />
    </DashboardLayout>
  );
}

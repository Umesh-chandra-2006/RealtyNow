import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useToast } from '../toast';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Modal, Button, Textarea } from '../ui';
import {
  CheckCircle2, XCircle, Clock, FileText, User,
  Building2, Phone, Mail, MapPin, Award, BadgeCheck, AlertCircle,
  ChevronRight, History, ShieldCheck, Eye, AlertTriangle,
  Calendar, Globe, Briefcase, Check, Landmark,
} from 'lucide-react';
import { formatDate } from '../../lib/utils';
import type { AgentApplication, BuilderApplication, PartnerApplication, StepVerificationState } from '../../lib/types';
import { parseStorageUrl, getDocumentSignedUrl } from '../../lib/storage';
import { validatePartnerDetailsForSubmission } from '../../lib/partner-validation';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ApplicationReviewDrawerProps {
  open: boolean;
  onClose: () => void;
  application: AgentApplication | BuilderApplication | PartnerApplication | null;
  type: 'agent' | 'builder' | 'partner';
}

interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

// ─── Stage configs per type ───────────────────────────────────────────────────
const AGENT_STAGES = [
  'submitted',
  'pending_review',
  'document_verification',
  'identity_verification',
  'rera_verification',
  'background_verification',
  'final_review',
  'approved',
] as const;

const BUILDER_STAGES = [
  'submitted',
  'pending_review',
  'document_verification',
  'company_verification',
  'rera_verification',
  'project_verification',
  'background_verification',
  'final_review',
  'approved',
] as const;

const PARTNER_STAGES = [
  'submitted',
  'pending_review',
  'document_verification',
  'final_review',
  'approved',
] as const;

export const STAGE_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  pending_review: 'Pending Review',
  document_verification: 'Document Verification',
  identity_verification: 'Identity Verification',
  company_verification: 'Company Verification',
  rera_verification: 'RERA Verification',
  project_verification: 'Project Verification',
  background_verification: 'Background Verification',
  final_review: 'Final Review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested',
};

const STAGE_LABEL_KEYS: Record<string, string> = {
  submitted: 'admin.stageSubmitted',
  pending_review: 'admin.stagePendingReview',
  document_verification: 'admin.stageDocumentVerification',
  identity_verification: 'admin.stageIdentityVerification',
  company_verification: 'admin.stageCompanyVerification',
  rera_verification: 'admin.stageReraVerification',
  project_verification: 'admin.stageProjectVerification',
  background_verification: 'admin.stageBackgroundVerification',
  final_review: 'admin.stageFinalReview',
  approved: 'admin.stageApproved',
  rejected: 'admin.stageRejected',
  changes_requested: 'admin.stageChangesRequested',
};

function stageLabel(stage: string, t: (key: string, fallback?: string) => string): string {
  const fallback = STAGE_LABELS[stage] ?? stage;
  const key = STAGE_LABEL_KEYS[stage];
  return key ? t(key, fallback) : fallback;
}

const AGENT_NEXT_BUTTON: Record<string, string> = {
  submitted: 'Start Review',
  pending_review: 'Mark as Reviewed & Next',
  document_verification: 'Verify Documents & Next',
  identity_verification: 'Verify Identity & Next',
  rera_verification: 'Verify RERA & Next',
  background_verification: 'Complete Background Check & Next',
  final_review: 'Approve Application',
};

const AGENT_NEXT_BUTTON_KEYS: Record<string, string> = {
  submitted: 'admin.agentBtnStartReview',
  pending_review: 'admin.agentBtnMarkReviewedNext',
  document_verification: 'admin.agentBtnVerifyDocsNext',
  identity_verification: 'admin.agentBtnVerifyIdentityNext',
  rera_verification: 'admin.agentBtnVerifyReraNext',
  background_verification: 'admin.agentBtnCompleteBackgroundNext',
  final_review: 'admin.agentBtnApproveApplication',
};

const BUILDER_NEXT_BUTTON: Record<string, string> = {
  submitted: 'Start Review',
  pending_review: 'Mark as Reviewed & Next',
  document_verification: 'Verify Documents & Next',
  company_verification: 'Verify Company & Next',
  rera_verification: 'Verify RERA & Next',
  project_verification: 'Verify Projects & Next',
  background_verification: 'Complete Background Check & Next',
  final_review: 'Approve Builder',
};

const BUILDER_NEXT_BUTTON_KEYS: Record<string, string> = {
  submitted: 'admin.agentBtnStartReview',
  pending_review: 'admin.agentBtnMarkReviewedNext',
  document_verification: 'admin.agentBtnVerifyDocsNext',
  company_verification: 'admin.builderBtnVerifyCompanyNext',
  rera_verification: 'admin.agentBtnVerifyReraNext',
  project_verification: 'admin.builderBtnVerifyProjectsNext',
  background_verification: 'admin.agentBtnCompleteBackgroundNext',
  final_review: 'admin.builderBtnApprove',
};

const PARTNER_NEXT_BUTTON: Record<string, string> = {
  submitted: 'Start Review',
  pending_review: 'Mark as Reviewed & Next',
  document_verification: 'Verify Documents & Next',
  final_review: 'Approve Partner',
};

const PARTNER_NEXT_BUTTON_KEYS: Record<string, string> = {
  submitted: 'admin.agentBtnStartReview',
  pending_review: 'admin.agentBtnMarkReviewedNext',
  document_verification: 'admin.agentBtnVerifyDocsNext',
  final_review: 'admin.partnerBtnApprove',
};

function nextButtonLabel(
  status: string,
  labels: Record<string, string>,
  keys: Record<string, string>,
  t: (key: string, fallback?: string) => string,
): string {
  const fallback = labels[status] ?? 'Mark as Verified & Next';
  const key = keys[status];
  return key ? t(key, fallback) : t('admin.markVerifiedNext', fallback);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStageIndex(stages: readonly string[], status: string): number {
  const idx = stages.indexOf(status as any);
  return idx === -1 ? 0 : idx;
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────
export function InfoBox({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="p-3 bg-navy-50/50 rounded-lg border border-navy-100/50">
      <p className="text-xs text-navy-400 flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="text-sm font-medium text-navy-900 break-all" title={value}>{value}</p>
    </div>
  );
}

export function DocLink({ url, bucket, label }: { url?: string | null; bucket: string; label: string }) {
  const { t } = useLanguageContext();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  if (!url) return null;

  const handleOpen = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let freshUrl = url;
      const parsed = parseStorageUrl(url);

      if (parsed) {
        const { url: newUrl, error } = await getDocumentSignedUrl(parsed.bucket, parsed.path, 600);
        if (error || !newUrl) {
          setErrorMsg(t('admin.docNoLongerAvailable', 'Document file is no longer available. Please ask the user to re-upload.'));
          setLoading(false);
          return;
        }
        freshUrl = newUrl;
      } else if (!url.startsWith('http')) {
        const { url: newUrl, error } = await getDocumentSignedUrl(bucket, url, 600);
        if (error || !newUrl) {
          setErrorMsg(t('admin.docNoLongerAvailable', 'Document file is no longer available. Please ask the user to re-upload.'));
          setLoading(false);
          return;
        }
        freshUrl = newUrl;
      }

      setPreviewUrl(freshUrl);
    } catch (err) {
      console.error(err);
      setErrorMsg(t('admin.docPreviewFailed', 'Document preview failed.'));
    } finally {
      setLoading(false);
    }
  };

  const isPdf = previewUrl?.toLowerCase().split('?')[0].endsWith('.pdf');
  const isImage = previewUrl && /\.(jpg|jpeg|png|webp|heic|gif)/i.test(previewUrl.split('?')[0]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-navy-50 text-navy-700 text-sm font-medium rounded-lg border border-navy-200 transition-colors disabled:opacity-60 w-full"
      >
        <FileText className="h-4 w-4 text-gold-500 shrink-0" />
        <span className="truncate">{loading ? t('admin.openingDocument', 'Opening document...') : label}</span>
        <Eye className="h-3.5 w-3.5 ml-auto text-navy-400" />
      </button>

      {errorMsg && (
        <div className="flex flex-col gap-1 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-error-700">{errorMsg}</p>
          <button onClick={handleOpen} className="text-xs font-semibold text-error-700 self-start hover:underline">
            {t('admin.tryAgain', 'Try Again')}
          </button>
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        open={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        title={label}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreviewUrl(null)}>{t('admin.close', 'Close')}</Button>
            {previewUrl && (
              <>
                <Button variant="secondary" onClick={() => window.open(previewUrl, '_blank', 'noreferrer')}>
                  {t('admin.openInNewTab', 'Open in New Tab')}
                </Button>
                <Button variant="primary" onClick={() => {
                  const a = document.createElement('a');
                  a.href = previewUrl;
                  a.download = label;
                  a.target = '_blank';
                  a.click();
                }}>
                  {t('admin.download', 'Download')}
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-navy-50 rounded-xl overflow-hidden relative">
          {previewUrl && (
            <>
              {isPdf ? (
                <iframe src={previewUrl} className="w-full h-[70vh]" title={label} />
              ) : isImage ? (
                <img
                  src={previewUrl}
                  alt={label}
                  className="max-w-full max-h-[70vh] object-contain"
                  onError={() => {
                    if (retryCount === 0) {
                      setRetryCount(1);
                      handleOpen();
                    } else {
                      setErrorMsg(t('admin.unableToOpenDocument', 'Unable to open this document. Please try again.'));
                      setPreviewUrl(null);
                      setRetryCount(0);
                    }
                  }}
                  onLoad={() => setRetryCount(0)}
                />
              ) : (
                <div className="text-center p-6">
                  <FileText className="h-16 w-16 text-navy-300 mx-auto mb-4" />
                  <p className="text-navy-600 mb-4">{t('admin.previewNotAvailable', 'Preview is not available for this file type.')}</p>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

// ─── Interactive Checkbox Component ───────────────────────────────────────────
function CheckboxItem({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  isError = false,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isError?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-all select-none',
        disabled ? 'cursor-default' : 'cursor-pointer',
        checked
          ? 'bg-success-50/70 border-success-300 text-navy-900 shadow-sm'
          : isError
            ? 'bg-red-50/80 border-red-400 ring-2 ring-red-200 text-red-900'
            : 'bg-white border-navy-200/80 text-navy-700 hover:bg-navy-50/60 hover:border-navy-300',
        disabled && 'opacity-75',
      )}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-navy-300 text-navy-800 focus:ring-navy-500 cursor-pointer accent-navy-800 shrink-0 disabled:cursor-not-allowed"
        />
      </div>
      <span className={cn('text-sm font-medium leading-snug flex-1', isError && !checked ? 'text-red-700 font-semibold' : 'text-navy-800')}>
        {label}
      </span>
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-success-600 shrink-0" />
      ) : isError ? (
        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
      ) : null}
    </label>
  );
}

// ─── Step Status Helper ───────────────────────────────────────────────────────
export function isStepCompleted(
  stage: string,
  idx: number,
  currentIdx: number,
  verificationState: Record<string, StepVerificationState>
): boolean {
  if (stage === 'approved') return false;
  return verificationState[stage]?.status === 'completed' || idx < currentIdx;
}

export function getStepStatus(
  stage: string,
  idx: number,
  currentIdx: number,
  currentStatus: string,
  isRejected: boolean,
  verificationState: Record<string, StepVerificationState>
): 'completed' | 'current' | 'pending' | 'rejected' {
  if (isRejected && stage === currentStatus) {
    return 'rejected';
  }
  if (stage === 'approved') {
    return currentStatus === 'approved' ? 'completed' : 'pending';
  }

  const completed = isStepCompleted(stage, idx, currentIdx, verificationState);
  if (completed) {
    if (stage === currentStatus && !isRejected && verificationState[stage]?.status !== 'completed') {
      return 'current';
    }
    return 'completed';
  }

  if (stage === currentStatus && !isRejected) {
    return 'current';
  }

  return 'pending';
}

// ─── Vertical Stepper ─────────────────────────────────────────────────────────
function VerificationStepper({
  stages,
  currentStatus,
  selectedStep,
  verificationState,
  onSelectStep,
}: {
  stages: readonly string[];
  currentStatus: string;
  selectedStep: string;
  verificationState: Record<string, StepVerificationState>;
  onSelectStep: (stage: string) => void;
}) {
  const { t } = useLanguageContext();
  const isRejected = currentStatus === 'rejected';
  const currentIdx = getStageIndex(stages, currentStatus);

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-3">
        {t('admin.verificationProgress', 'Verification Progress')}
      </h3>
      <div className="relative">
        <div className="space-y-1.5 relative">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            const status = getStepStatus(stage, idx, currentIdx, currentStatus, isRejected, verificationState);
            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';
            const isSelected = stage === selectedStep;
            const isClickable = isCompleted || isCurrent || idx <= currentIdx;

            let dotClass = 'bg-white border-2 border-navy-200 text-navy-400';
            let dotContent = <span className="text-[10px] font-bold text-navy-400">{idx + 1}</span>;
            let textClass = 'text-navy-400 font-normal';

            if (isCompleted) {
              dotClass = 'bg-emerald-600 border-emerald-600 text-white shadow-sm';
              dotContent = <Check className="h-3.5 w-3.5 text-white stroke-[3]" />;
              textClass = 'text-emerald-950 font-semibold';
            } else if (isCurrent) {
              dotClass = 'bg-red-600 border-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.2)] text-white';
              dotContent = <div className="h-2 w-2 rounded-full bg-white" />;
              textClass = 'text-navy-900 font-bold';
            }

            return (
              <div key={stage} className="relative">
                {/* Segmented connector line to next step */}
                {!isLast && (
                  <div
                    className={cn(
                      'absolute left-[17px] top-6 bottom-[-6px] w-0.5 z-0 transition-colors duration-200',
                      isCompleted ? 'bg-emerald-500' : 'bg-navy-100',
                    )}
                  />
                )}

                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onSelectStep(stage)}
                  className={cn(
                    'flex items-center gap-2.5 w-full text-left px-1.5 py-1.5 rounded-lg transition-all relative z-10',
                    isSelected && 'bg-navy-100/80 shadow-xs font-semibold',
                    isClickable && !isSelected && 'hover:bg-navy-50/80',
                    !isClickable && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <div className={cn('z-10 h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all shadow-xs', dotClass)}>
                    {dotContent}
                  </div>
                  <span className={cn('text-xs transition-colors leading-snug truncate flex-1', textClass, isSelected && 'text-navy-900 font-bold')}>
                    {stageLabel(stage, t)}
                  </span>
                  {isCurrent && (
                    <span className="ml-auto text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100 shrink-0">
                      {t('admin.now', 'Now')}
                    </span>
                  )}
                  {isCompleted && !isCurrent && (
                    <span className="ml-auto text-[11px] text-emerald-600 font-bold shrink-0">
                      ✓
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          {isRejected && (
            <div className="flex items-center gap-2.5 px-1.5 py-1.5 mt-1">
              <div className="z-10 h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-red-500 shadow-sm">
                <XCircle className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs text-red-600 font-semibold">{stageLabel('rejected', t)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Verification History ─────────────────────────────────────────────────────
function VerificationHistory({ applicationId }: { applicationId: string }) {
  const { t } = useLanguageContext();
  const { data: logs, isLoading } = useQuery({
    queryKey: ['app-activity-logs', applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('application_activity_logs')
        .select('id, action, details, created_at')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });
      return (data ?? []) as ActivityLog[];
    },
  });

  if (isLoading) return <div className="text-xs text-navy-400 py-2">{t('admin.loadingHistory', 'Loading history…')}</div>;
  if (!logs?.length) return <div className="text-xs text-navy-400 py-2">{t('admin.noActivityRecorded', 'No activity recorded yet.')}</div>;

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-3 text-xs">
          <div className="h-2 w-2 rounded-full bg-navy-300 mt-1.5 shrink-0" />
          <div>
            <p className="font-medium text-navy-700">{log.action}</p>
            {log.details && <p className="text-navy-400">{log.details}</p>}
            <p className="text-navy-300 mt-0.5">{formatDate(log.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Step Validation Engine ───────────────────────────────────────────────────
function validateStep(
  stage: string,
  type: 'agent' | 'builder' | 'partner',
  app: AgentApplication | BuilderApplication | PartnerApplication,
  checks: Record<string, boolean>,
  t: (key: string, fallback?: string) => string,
): { valid: boolean; errors: string[]; message?: string } {
  if (stage === 'submitted') {
    return { valid: true, errors: [] };
  }

  if (type === 'builder') {
    const builderApp = app as BuilderApplication;

    switch (stage) {
      case 'pending_review': {
        const required = ['info_reviewed'];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompletePendingReview', 'Please review the application details before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'document_verification': {
        const required = ['docs_inspected'];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteDocumentChecks', 'Please complete Document Verification before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'company_verification': {
        const required = ['company_mca_gst', 'gst_active', 'track_record', 'address_verified'];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteCompanyChecks', 'Please complete all Company Verification checks before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'rera_verification': {
        const required = builderApp.rera_number
          ? ['rera_portal', 'rera_name_match', 'rera_no_complaints']
          : ['rera_exemption'];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteReraChecks', 'Please complete all RERA Verification checks before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'project_verification': {
        const required = [
          'checkBuilderCredentials',
          'checkCompanyNameMatchesRera',
          'checkProjectLocations',
          'checkNoPendingLegalDisputes',
        ];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteProjectChecks', 'Please complete all Project Verification checks before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'background_verification': {
        const required = [
          'checkCompanyCriminalRecord',
          'checkDirectorBackground',
          'checkFinancialHealth',
          'checkNoActiveLegalDisputes',
          'checkNoReraBlacklist',
        ];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteBackgroundChecks', 'Please complete all Background Verification checks before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      default:
        return { valid: true, errors: [] };
    }
  }

  if (type === 'agent') {
    const agentApp = app as AgentApplication;

    switch (stage) {
      case 'pending_review': {
        const required = ['info_reviewed'];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompletePendingReview', 'Please review the application details before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'document_verification': {
        const required = ['docs_inspected'];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteDocumentChecks', 'Please complete Document Verification before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'identity_verification': {
        const required = ['identity_match', 'contact_verified'];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteChecks', 'Please complete all Identity Verification checks before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'rera_verification': {
        const required = agentApp.license_number
          ? ['rera_portal_verified', 'rera_license_match']
          : ['rera_not_applicable'];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteReraChecks', 'Please complete all RERA Verification checks before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      case 'background_verification': {
        const required = [
          'checkCriminalRecord',
          'checkEmploymentHistory',
          'checkProfessionalReferences',
          'checkNoAdverseFindings',
        ];
        const missing = required.filter((c) => !checks[c]);
        if (missing.length > 0) {
          return {
            valid: false,
            errors: missing,
            message: t('admin.pleaseCompleteBackgroundChecks', 'Please complete all Background Verification checks before continuing.'),
          };
        }
        return { valid: true, errors: [] };
      }

      default:
        return { valid: true, errors: [] };
    }
  }

  // Partner type
  if (stage === 'pending_review' || stage === 'document_verification') {
    const required = [stage === 'pending_review' ? 'info_reviewed' : 'docs_inspected'];
    const missing = required.filter((c) => !checks[c]);
    if (missing.length > 0) {
      return {
        valid: false,
        errors: missing,
        message: t('admin.pleaseCompleteChecks', 'Please complete the verification checks for this step before continuing.'),
      };
    }
  }

  return { valid: true, errors: [] };
}

// ─── Agent step panels ────────────────────────────────────────────────────────
function AgentStepContent({
  stage,
  app,
  checks,
  onCheckChange,
  validationErrors,
  isCompleted,
  readOnly,
  verificationState,
  currentIdx,
}: {
  stage: string;
  app: AgentApplication;
  checks: Record<string, boolean>;
  onCheckChange: (key: string, checked: boolean) => void;
  validationErrors: string[];
  isCompleted: boolean;
  readOnly: boolean;
  verificationState: Record<string, StepVerificationState>;
  currentIdx: number;
}) {
  const { t } = useLanguageContext();
  const disabled = readOnly || isCompleted;

  switch (stage) {
    case 'submitted':
      return (
        <div className="space-y-4">
          <div className="p-4 bg-success-50 border border-success-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />
            <div>
              <p className="font-semibold text-success-800 text-sm">{t('admin.applicationReceived', 'Application Received')}</p>
              <p className="text-xs text-success-600">{t('admin.submittedOn', 'Submitted on {{date}}').replace('{{date}}', formatDate(app.created_at))}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={User} label={t('admin.applicantNameLabel', 'Applicant Name')} value={`${app.first_name} ${app.last_name}`} />
            <InfoBox icon={Mail} label={t('admin.emailLabel', 'Email')} value={app.email} />
            <InfoBox icon={Phone} label={t('admin.mobileLabel', 'Mobile')} value={app.phone} />
            <InfoBox icon={Calendar} label={t('admin.appliedDateLabel', 'Applied Date')} value={formatDate(app.created_at)} />
            <div className="col-span-2 p-3 bg-navy-50 rounded-lg border border-navy-100">
              <p className="text-xs text-navy-400 mb-1">{t('admin.applicationIdLabel', 'Application ID')}</p>
              <p className="text-xs font-mono text-navy-600 break-all">{app.id}</p>
            </div>
          </div>
        </div>
      );

    case 'pending_review':
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <User className="h-4 w-4 text-navy-400" /> {t('admin.generalInformation', 'General Information')}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={Mail} label={t('admin.emailLabel', 'Email')} value={app.email} />
            <InfoBox icon={Phone} label={t('admin.phoneLabel', 'Phone')} value={app.phone} />
            <InfoBox icon={Award} label={t('admin.specializationLabel', 'Specialization')} value={app.specialization} />
            <InfoBox icon={Clock} label={t('admin.experienceLabel', 'Experience')} value={app.experience_years ? t('admin.yrsValue', '{{count}} yrs').replace('{{count}}', String(app.experience_years)) : null} />
            <InfoBox icon={BadgeCheck} label={t('admin.reraLicenseNoLabel', 'RERA / License No.')} value={app.license_number} />
            <InfoBox icon={MapPin} label={t('admin.serviceAreasLabel', 'Service Areas')} value={app.assigned_areas?.join(', ')} />
            {app.bio && (
              <div className="col-span-2 p-3 bg-navy-50 rounded-lg border border-navy-100">
                <p className="text-xs text-navy-400 mb-1">{t('admin.bioDescriptionLabel', 'Bio / Description')}</p>
                <p className="text-sm text-navy-800">{app.bio}</p>
              </div>
            )}
          </div>
          <div className="space-y-2 pt-2 border-t border-navy-100">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            <CheckboxItem
              id="info_reviewed"
              label={t('admin.checkApplicantContactVerified', 'Applicant details and contact info reviewed and verified')}
              checked={!!checks.info_reviewed}
              onChange={(c) => onCheckChange('info_reviewed', c)}
              disabled={disabled}
              isError={validationErrors.includes('info_reviewed')}
            />
          </div>
        </div>
      );

    case 'document_verification':
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-navy-400" /> {t('admin.submittedDocuments', 'Submitted Documents')}
          </h4>
          {!app.id_doc_url && !app.license_doc_url ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">{t('admin.noDocumentsUploadedApplicant', 'No documents uploaded by the applicant.')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {app.id_doc_url && <div className="p-3 bg-white border border-navy-100 rounded-xl"><DocLink url={app.id_doc_url} bucket="agent-documents" label={t('admin.docGovtIdAadhaar', 'Govt ID / Aadhaar')} /></div>}
              {app.license_doc_url && <div className="p-3 bg-white border border-navy-100 rounded-xl"><DocLink url={app.license_doc_url} bucket="agent-documents" label={t('admin.docLicenseReraCertificate', 'License / RERA Certificate')} /></div>}
            </div>
          )}
          <div className="space-y-2 pt-2 border-t border-navy-100">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            <CheckboxItem
              id="docs_inspected"
              label={t('admin.checkDocsClear', 'All uploaded documents inspected and verified')}
              checked={!!checks.docs_inspected}
              onChange={(c) => onCheckChange('docs_inspected', c)}
              disabled={disabled}
              isError={validationErrors.includes('docs_inspected')}
            />
          </div>
        </div>
      );

    case 'identity_verification':
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-navy-400" /> {t('admin.identityVerificationHeading', 'Identity Verification')}
          </h4>
          <p className="text-xs text-navy-500">{t('admin.verifyIdentityMatch', "Verify the applicant's identity matches the submitted documents.")}</p>
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={User} label={t('admin.fullNameLabel', 'Full Name')} value={`${app.first_name} ${app.last_name}`} />
            <InfoBox icon={Phone} label={t('admin.phoneLabel', 'Phone')} value={app.phone} />
            <InfoBox icon={Mail} label={t('admin.emailLabel', 'Email')} value={app.email} />
            <InfoBox icon={BadgeCheck} label={t('admin.licenseReraNoLabel', 'License / RERA No.')} value={app.license_number} />
          </div>
          {app.id_doc_url && <div className="p-3 bg-white border border-navy-100 rounded-xl"><DocLink url={app.id_doc_url} bucket="agent-documents" label={t('admin.viewGovernmentId', 'View Government ID')} /></div>}
          <div className="space-y-2 pt-2 border-t border-navy-100">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            <CheckboxItem
              id="identity_match"
              label={t('admin.checkApplicantIdentityMatch', 'Identity matches submitted documents')}
              checked={!!checks.identity_match}
              onChange={(c) => onCheckChange('identity_match', c)}
              disabled={disabled}
              isError={validationErrors.includes('identity_match')}
            />
            <CheckboxItem
              id="contact_verified"
              label={t('admin.checkApplicantContactVerified', 'Contact details and phone verified')}
              checked={!!checks.contact_verified}
              onChange={(c) => onCheckChange('contact_verified', c)}
              disabled={disabled}
              isError={validationErrors.includes('contact_verified')}
            />
          </div>
        </div>
      );

    case 'rera_verification': {
      const hasRera = !!app.license_number;
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-navy-400" /> {t('admin.reraVerificationHeading', 'RERA Verification')}
          </h4>
          {hasRera ? (
            <>
              <InfoBox icon={BadgeCheck} label={t('admin.reraLicenseNumberLabel', 'RERA / License Number')} value={app.license_number} />
              {app.license_doc_url && <div className="p-3 bg-white border border-navy-100 rounded-xl"><DocLink url={app.license_doc_url} bucket="agent-documents" label={t('admin.viewReraCertificate', 'View RERA Certificate')} /></div>}
              <div className="space-y-2 pt-2 border-t border-navy-100">
                <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
                <CheckboxItem
                  id="rera_portal_verified"
                  label={t('admin.checkReraRegistration', 'RERA registration active and valid on state portal')}
                  checked={!!checks.rera_portal_verified}
                  onChange={(c) => onCheckChange('rera_portal_verified', c)}
                  disabled={disabled}
                  isError={validationErrors.includes('rera_portal_verified')}
                />
                <CheckboxItem
                  id="rera_license_match"
                  label={t('admin.checkReraNameMatch', 'Agent name matches RERA certificate')}
                  checked={!!checks.rera_license_match}
                  onChange={(c) => onCheckChange('rera_license_match', c)}
                  disabled={disabled}
                  isError={validationErrors.includes('rera_license_match')}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">{t('admin.noReraInfoProvided', 'No RERA Information Provided')}</p>
                  <p className="text-xs text-amber-600">{t('admin.applicantNoReraNote', 'Applicant has not submitted a RERA license number. Determine if RERA is applicable.')}</p>
                </div>
              </div>
              <CheckboxItem
                id="rera_not_applicable"
                label={t('admin.checkReraExemptionConfirmed', 'RERA exemption or non-applicability confirmed')}
                checked={!!checks.rera_not_applicable}
                onChange={(c) => onCheckChange('rera_not_applicable', c)}
                disabled={disabled}
                isError={validationErrors.includes('rera_not_applicable')}
              />
            </div>
          )}
        </div>
      );
    }

    case 'background_verification':
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-navy-400" /> {t('admin.backgroundVerificationHeading', 'Background Verification')}
          </h4>
          <p className="text-xs text-navy-500">{t('admin.completeBackgroundChecksNote', 'Complete all background checks before proceeding.')}</p>
          <div className="space-y-2">
            {[
              { id: 'checkCriminalRecord', label: t('admin.checkCriminalRecord', 'Criminal record check completed') },
              { id: 'checkEmploymentHistory', label: t('admin.checkEmploymentHistory', 'Employment history verified') },
              { id: 'checkProfessionalReferences', label: t('admin.checkProfessionalReferences', 'Professional references checked') },
              { id: 'checkNoAdverseFindings', label: t('admin.checkNoAdverseFindings', 'No adverse findings') },
            ].map(({ id, label }) => (
              <CheckboxItem
                key={id}
                id={id}
                label={label}
                checked={!!checks[id]}
                onChange={(c) => onCheckChange(id, c)}
                disabled={disabled}
                isError={validationErrors.includes(id)}
              />
            ))}
          </div>
        </div>
      );

    case 'final_review': {
      const allStages = AGENT_STAGES.slice(1, -1);
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t('admin.finalReviewSummary', 'Final Review Summary')}
          </h4>
          <div className="space-y-2">
            {allStages.map((s) => {
              const sIdx = AGENT_STAGES.indexOf(s as any);
              const isStepDone = isStepCompleted(s, sIdx, currentIdx, verificationState);
              return (
                <div
                  key={s}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    isStepDone
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : 'bg-navy-50/50 border-navy-100 text-navy-600',
                  )}
                >
                  {isStepDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <span className={cn('text-sm font-medium', isStepDone ? 'text-emerald-950 font-semibold' : 'text-navy-700')}>
                    {stageLabel(s, t)}
                  </span>
                  <span className={cn('ml-auto text-xs font-semibold', isStepDone ? 'text-emerald-700' : 'text-amber-600')}>
                    {isStepDone ? t('admin.verifiedCheckmark', '✓ Verified') : t('admin.stepPending', 'Pending')}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-navy-100">
            <InfoBox icon={User} label={t('admin.applicantLabel', 'Applicant')} value={`${app.first_name} ${app.last_name}`} />
            <InfoBox icon={Mail} label={t('admin.emailLabel', 'Email')} value={app.email} />
            <InfoBox icon={Phone} label={t('admin.phoneLabel', 'Phone')} value={app.phone} />
            <InfoBox icon={Award} label={t('admin.specializationLabel', 'Specialization')} value={app.specialization} />
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            {t('admin.approvingProvisionsAgentAccount', '⚠ Approving will provision an Agent Portal account linked to the registered mobile number ({{phone}}).').replace('{{phone}}', app.phone ?? '')}
          </div>
        </div>
      );
    }

    case 'approved':
      return (
        <div className="space-y-4">
          <div className="p-5 bg-success-50 border border-success-200 rounded-xl text-center">
            <CheckCircle2 className="h-10 w-10 text-success-600 mx-auto mb-2" />
            <p className="font-bold text-success-800 text-lg">{t('admin.applicationApproved', 'Application Approved')}</p>
            <p className="text-xs text-success-600 mt-1">{app.reviewed_at ? t('admin.approvedOn', 'Approved on {{date}}').replace('{{date}}', formatDate(app.reviewed_at)) : t('admin.approvalComplete', 'Approval complete')}</p>
          </div>
          <div className="p-3 bg-success-50 border border-success-200 rounded-xl flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-success-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success-800">{t('admin.agentPortalAccessEnabled', 'Agent Portal Access Enabled')}</p>
              <p className="text-xs text-success-600">{t('admin.loginViaOtpOn', 'Login via OTP on: {{phone}}').replace('{{phone}}', app.phone ?? '')}</p>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ─── Builder step panels ──────────────────────────────────────────────────────
function BuilderStepContent({
  stage,
  app,
  checks,
  onCheckChange,
  validationErrors,
  isCompleted,
  readOnly,
  verificationState,
  currentIdx,
}: {
  stage: string;
  app: BuilderApplication;
  checks: Record<string, boolean>;
  onCheckChange: (key: string, checked: boolean) => void;
  validationErrors: string[];
  isCompleted: boolean;
  readOnly: boolean;
  verificationState: Record<string, StepVerificationState>;
  currentIdx: number;
}) {
  const { t } = useLanguageContext();
  const disabled = readOnly || isCompleted;

  switch (stage) {
    case 'submitted':
      return (
        <div className="space-y-4">
          <div className="p-4 bg-success-50 border border-success-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />
            <div>
              <p className="font-semibold text-success-800 text-sm">{t('admin.builderApplicationReceived', 'Builder Application Received')}</p>
              <p className="text-xs text-success-600">{t('admin.submittedOn', 'Submitted on {{date}}').replace('{{date}}', formatDate(app.created_at))}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={Building2} label={t('admin.companyNameLabel', 'Company Name')} value={app.company_name} />
            <InfoBox icon={User} label={t('admin.contactPersonLabel', 'Contact Person')} value={app.contact_name} />
            <InfoBox icon={Mail} label={t('admin.emailLabel', 'Email')} value={app.email} />
            <InfoBox icon={Phone} label={t('admin.mobileLabel', 'Mobile')} value={app.phone} />
            <InfoBox icon={MapPin} label={t('admin.cityLabel2', 'City')} value={app.city} />
            <InfoBox icon={Calendar} label={t('admin.appliedDateLabel', 'Applied Date')} value={formatDate(app.created_at)} />
            <div className="col-span-2 p-3 bg-navy-50 rounded-lg border border-navy-100">
              <p className="text-xs text-navy-400 mb-1">{t('admin.applicationIdLabel', 'Application ID')}</p>
              <p className="text-xs font-mono text-navy-600 break-all">{app.id}</p>
            </div>
          </div>
        </div>
      );

    case 'pending_review':
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-navy-400" /> {t('admin.builderInformation', 'Builder Information')}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={Building2} label={t('admin.companyNameLabel', 'Company Name')} value={app.company_name} />
            <InfoBox icon={User} label={t('admin.contactPersonLabel', 'Contact Person')} value={app.contact_name} />
            <InfoBox icon={Mail} label={t('admin.emailLabel', 'Email')} value={app.email} />
            <InfoBox icon={Phone} label={t('admin.phoneLabel', 'Phone')} value={app.phone} />
            <InfoBox icon={MapPin} label={t('admin.cityLabel2', 'City')} value={app.city} />
            <InfoBox icon={BadgeCheck} label={t('admin.reraNumberLabel', 'RERA Number')} value={app.rera_number} />
            <InfoBox icon={Briefcase} label={t('admin.gstNumberLabel2', 'GST Number')} value={app.gst_number} />
            <InfoBox icon={Calendar} label={t('admin.establishedYearLabel', 'Established Year')} value={app.established_year?.toString()} />
            {app.website_url && <InfoBox icon={Globe} label={t('admin.websiteLabel2', 'Website')} value={app.website_url} />}
            {app.description && (
              <div className="col-span-2 p-3 bg-navy-50 rounded-lg border border-navy-100">
                <p className="text-xs text-navy-400 mb-1">{t('admin.companyDescriptionLabel', 'Company Description')}</p>
                <p className="text-sm text-navy-800">{app.description}</p>
              </div>
            )}
          </div>
          <div className="space-y-2 pt-2 border-t border-navy-100">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            <CheckboxItem
              id="info_reviewed"
              label={t('admin.checkApplicantContactVerified', 'Builder information and contact details reviewed and verified')}
              checked={!!checks.info_reviewed}
              onChange={(c) => onCheckChange('info_reviewed', c)}
              disabled={disabled}
              isError={validationErrors.includes('info_reviewed')}
            />
          </div>
        </div>
      );

    case 'document_verification': {
      const docs = [
        { url: app.gst_doc_url, label: t('admin.docGstCertificate', 'GST Certificate') },
        { url: app.rera_doc_url, label: t('admin.docReraCertificate', 'RERA Certificate') },
        { url: app.pan_doc_url, label: t('admin.docPanCard', 'PAN Card') },
      ].filter((d) => d.url);
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-navy-400" /> {t('admin.builderDocuments', 'Builder Documents')}
          </h4>
          {docs.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">{t('admin.noDocumentsUploadedBuilder', 'No documents uploaded by the builder.')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.label} className="p-3 bg-white border border-navy-100 rounded-xl">
                  <DocLink url={doc.url} bucket="builder-documents" label={doc.label} />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 pt-2 border-t border-navy-100">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            <CheckboxItem
              id="docs_inspected"
              label={t('admin.checkDocsClear', 'All uploaded documents inspected and verified')}
              checked={!!checks.docs_inspected}
              onChange={(c) => onCheckChange('docs_inspected', c)}
              disabled={disabled}
              isError={validationErrors.includes('docs_inspected')}
            />
          </div>
        </div>
      );
    }

    case 'company_verification':
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-navy-400" /> {t('admin.companyBusinessVerification', 'Company / Business Verification')}
          </h4>
          <p className="text-xs text-navy-500">{t('admin.verifyCompanyIdentityNote', 'Verify that the company identity, registration, and business information is valid.')}</p>
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={Building2} label={t('admin.companyNameLabel', 'Company Name')} value={app.company_name} />
            <InfoBox icon={User} label={t('admin.contactPersonLabel', 'Contact Person')} value={app.contact_name} />
            <InfoBox icon={Briefcase} label={t('admin.gstNumberLabel2', 'GST Number')} value={app.gst_number} />
            <InfoBox icon={MapPin} label={t('admin.cityLocationLabel', 'City / Location')} value={app.city} />
            <InfoBox icon={Calendar} label={t('admin.establishedYearLabel', 'Established Year')} value={app.established_year?.toString()} />
            {app.website_url && <InfoBox icon={Globe} label={t('admin.websiteLabel2', 'Website')} value={app.website_url} />}
          </div>
          {app.gst_doc_url && (
            <div className="p-3 bg-white border border-navy-100 rounded-xl">
              <p className="text-xs text-navy-500 mb-2 font-medium">{t('admin.gstRegistrationDocument', 'GST / Registration Document')}</p>
              <DocLink url={app.gst_doc_url} bucket="builder-documents" label={t('admin.viewGstCertificate', 'View GST Certificate')} />
            </div>
          )}
          <div className="space-y-2 pt-2 border-t border-navy-100">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            <CheckboxItem
              id="company_mca_gst"
              label={t('admin.checkCompanyMca', 'Company name verified on MCA / GST portal')}
              checked={!!checks.company_mca_gst}
              onChange={(c) => onCheckChange('company_mca_gst', c)}
              disabled={disabled}
              isError={validationErrors.includes('company_mca_gst')}
            />
            <CheckboxItem
              id="gst_active"
              label={t('admin.checkGstValid', 'GST number active and verified')}
              checked={!!checks.gst_active}
              onChange={(c) => onCheckChange('gst_active', c)}
              disabled={disabled}
              isError={validationErrors.includes('gst_active')}
            />
            <CheckboxItem
              id="track_record"
              label={t('admin.checkEstablishedYear', 'Established year and business track record confirmed')}
              checked={!!checks.track_record}
              onChange={(c) => onCheckChange('track_record', c)}
              disabled={disabled}
              isError={validationErrors.includes('track_record')}
            />
            <CheckboxItem
              id="address_verified"
              label={t('admin.checkBusinessAddress', 'Business address and city verified')}
              checked={!!checks.address_verified}
              onChange={(c) => onCheckChange('address_verified', c)}
              disabled={disabled}
              isError={validationErrors.includes('address_verified')}
            />
          </div>
        </div>
      );

    case 'rera_verification': {
      const hasRera = !!app.rera_number;
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-navy-400" /> {t('admin.reraVerificationHeading', 'RERA Verification')}
          </h4>
          {hasRera ? (
            <>
              <InfoBox icon={BadgeCheck} label={t('admin.reraNumberLabel', 'RERA Number')} value={app.rera_number} />
              {app.rera_doc_url && (
                <div className="p-3 bg-white border border-navy-100 rounded-xl">
                  <DocLink url={app.rera_doc_url} bucket="builder-documents" label={t('admin.viewReraCertificate', 'View RERA Certificate')} />
                </div>
              )}
              <div className="space-y-2 pt-2 border-t border-navy-100">
                <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
                <CheckboxItem
                  id="rera_portal"
                  label={t('admin.checkReraRegistration', 'RERA registration active and valid on state portal')}
                  checked={!!checks.rera_portal}
                  onChange={(c) => onCheckChange('rera_portal', c)}
                  disabled={disabled}
                  isError={validationErrors.includes('rera_portal')}
                />
                <CheckboxItem
                  id="rera_name_match"
                  label={t('admin.checkReraNameMatch', 'Company / entity name matches RERA certificate')}
                  checked={!!checks.rera_name_match}
                  onChange={(c) => onCheckChange('rera_name_match', c)}
                  disabled={disabled}
                  isError={validationErrors.includes('rera_name_match')}
                />
                <CheckboxItem
                  id="rera_no_complaints"
                  label={t('admin.checkReraNotBlacklisted', 'No RERA complaints or blacklist entries')}
                  checked={!!checks.rera_no_complaints}
                  onChange={(c) => onCheckChange('rera_no_complaints', c)}
                  disabled={disabled}
                  isError={validationErrors.includes('rera_no_complaints')}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">{t('admin.noReraNumberProvided', 'No RERA Number Provided')}</p>
                  <p className="text-xs text-amber-600">{t('admin.determineReraMandatoryNote', 'Determine if RERA registration is mandatory for this builder. If not applicable, note the reason.')}</p>
                </div>
              </div>
              <CheckboxItem
                id="rera_exemption"
                label={t('admin.checkReraExemptionConfirmed', 'RERA exemption or non-applicability confirmed')}
                checked={!!checks.rera_exemption}
                onChange={(c) => onCheckChange('rera_exemption', c)}
                disabled={disabled}
                isError={validationErrors.includes('rera_exemption')}
              />
            </div>
          )}
        </div>
      );
    }

    case 'project_verification':
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-navy-400" /> {t('admin.projectBuilderVerification', 'Project / Builder Verification')}
          </h4>
          <p className="text-xs text-navy-500">{t('admin.verifyProjectsPortfolioNote', "Verify the builder's listed projects and portfolio information.")}</p>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            {[
              { id: 'checkBuilderCredentials', label: t('admin.checkBuilderCredentials', 'Builder credentials verified') },
              { id: 'checkCompanyNameMatchesRera', label: t('admin.checkCompanyNameMatchesRera', 'Company name matches RERA records') },
              { id: 'checkProjectLocations', label: t('admin.checkProjectLocations', 'Project locations verified') },
              { id: 'checkNoPendingLegalDisputes', label: t('admin.checkNoPendingLegalDisputes', 'No pending legal disputes found') },
            ].map(({ id, label }) => (
              <CheckboxItem
                key={id}
                id={id}
                label={label}
                checked={!!checks[id]}
                onChange={(c) => onCheckChange(id, c)}
                disabled={disabled}
                isError={validationErrors.includes(id)}
              />
            ))}
          </div>
        </div>
      );

    case 'background_verification':
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-navy-400" /> {t('admin.backgroundVerificationHeading', 'Background Verification')}
          </h4>
          <p className="text-xs text-navy-500">{t('admin.completeBackgroundChecksBuilderNote', 'Complete all background checks for the builder and company.')}</p>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            {[
              { id: 'checkCompanyCriminalRecord', label: t('admin.checkCompanyCriminalRecord', 'Company criminal/legal record check') },
              { id: 'checkDirectorBackground', label: t('admin.checkDirectorBackground', 'Director/promoter background verified') },
              { id: 'checkFinancialHealth', label: t('admin.checkFinancialHealth', 'Financial health check completed') },
              { id: 'checkNoActiveLegalDisputes', label: t('admin.checkNoActiveLegalDisputes', 'No active legal disputes') },
              { id: 'checkNoReraBlacklist', label: t('admin.checkNoReraBlacklist', 'No RERA blacklist matches') },
            ].map(({ id, label }) => (
              <CheckboxItem
                key={id}
                id={id}
                label={label}
                checked={!!checks[id]}
                onChange={(c) => onCheckChange(id, c)}
                disabled={disabled}
                isError={validationErrors.includes(id)}
              />
            ))}
          </div>
        </div>
      );

    case 'final_review': {
      const allStages = BUILDER_STAGES.slice(1, -1);
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t('admin.finalReviewSummary', 'Final Review Summary')}
          </h4>
          <div className="space-y-2">
            {allStages.map((s) => {
              const sIdx = BUILDER_STAGES.indexOf(s as any);
              const isStepDone = isStepCompleted(s, sIdx, currentIdx, verificationState);
              return (
                <div
                  key={s}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    isStepDone
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : 'bg-navy-50/50 border-navy-100 text-navy-600',
                  )}
                >
                  {isStepDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <span className={cn('text-sm font-medium', isStepDone ? 'text-emerald-950 font-semibold' : 'text-navy-700')}>
                    {stageLabel(s, t)}
                  </span>
                  <span className={cn('ml-auto text-xs font-semibold', isStepDone ? 'text-emerald-700' : 'text-amber-600')}>
                    {isStepDone ? t('admin.verifiedCheckmark', '✓ Verified') : t('admin.stepPending', 'Pending')}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-navy-100">
            <InfoBox icon={Building2} label={t('admin.companyNameLabel', 'Company Name')} value={app.company_name} />
            <InfoBox icon={User} label={t('admin.contactPersonLabel', 'Contact Person')} value={app.contact_name} />
            <InfoBox icon={Mail} label={t('admin.emailLabel', 'Email')} value={app.email} />
            <InfoBox icon={Phone} label={t('admin.phoneLabel', 'Phone')} value={app.phone} />
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            {t('admin.approvingProvisionsBuilderAccount', '⚠ Approving will provision a Builder Portal account linked to the registered mobile number ({{phone}}).').replace('{{phone}}', app.phone ?? '')}
          </div>
        </div>
      );
    }

    case 'approved':
      return (
        <div className="space-y-4">
          <div className="p-5 bg-success-50 border border-success-200 rounded-xl text-center">
            <CheckCircle2 className="h-10 w-10 text-success-600 mx-auto mb-2" />
            <p className="font-bold text-success-800 text-lg">{t('admin.builderApplicationApproved', 'Builder Application Approved')}</p>
            <p className="text-xs text-success-600 mt-1">{app.reviewed_at ? t('admin.approvedOn', 'Approved on {{date}}').replace('{{date}}', formatDate(app.reviewed_at)) : t('admin.approvalComplete', 'Approval complete')}</p>
          </div>
          <div className="p-3 bg-success-50 border border-success-200 rounded-xl flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-success-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success-800">{t('admin.builderPortalAccessEnabled', 'Builder Portal Access Enabled')}</p>
              <p className="text-xs text-success-600">{`${app.company_name} — ${t('admin.loginViaOtpOn', 'Login via OTP on: {{phone}}').replace('{{phone}}', app.phone ?? '')}`}</p>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ─── Partner step panels ───────────────────────────────────────────────────────
function PartnerStepContent({
  stage,
  app,
  checks,
  onCheckChange,
  validationErrors,
  isCompleted,
  readOnly,
  verificationState,
  currentIdx,
}: {
  stage: string;
  app: PartnerApplication;
  checks: Record<string, boolean>;
  onCheckChange: (key: string, checked: boolean) => void;
  validationErrors: string[];
  isCompleted: boolean;
  readOnly: boolean;
  verificationState: Record<string, StepVerificationState>;
  currentIdx: number;
}) {
  const { t } = useLanguageContext();
  const disabled = readOnly || isCompleted;

  switch (stage) {
    case 'submitted':
      return (
        <div className="space-y-4">
          <div className="p-4 bg-success-50 border border-success-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />
            <div>
              <p className="font-semibold text-success-800 text-sm">{t('admin.partnerApplicationReceived', 'Business Partner Application Received')}</p>
              <p className="text-xs text-success-600">{t('admin.submittedOn', 'Submitted on {{date}}').replace('{{date}}', formatDate(app.created_at))}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={User} label="Full Name" value={app.full_name || `${app.name ?? ''} ${app.surname ?? ''}`.trim()} />
            <InfoBox icon={Building2} label="Business Name" value={app.business_name || app.company_name} />
            <InfoBox icon={Phone} label="Mobile Number" value={app.mobile_number} />
            <InfoBox icon={Mail} label="Email" value={app.email} />
            <InfoBox icon={Calendar} label={t('admin.appliedDateLabel', 'Applied Date')} value={formatDate(app.created_at)} />
            {app.application_number && (
              <div className="col-span-2 p-3 bg-navy-50 rounded-lg border border-navy-100">
                <p className="text-xs text-navy-400 mb-1">{t('admin.applicationNumberLabel', 'Application Number')}</p>
                <p className="text-xs font-mono text-navy-600 break-all">{app.application_number}</p>
              </div>
            )}
          </div>
        </div>
      );

    case 'pending_review': {
      const bankDetails = (typeof app.bank_account_details === 'object' && app.bank_account_details !== null)
        ? app.bank_account_details as Record<string, string>
        : null;

      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <User className="h-4 w-4 text-navy-400" /> Business Partner Information
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={User} label="Surname & Name" value={`${app.surname ?? ''} ${app.name ?? app.full_name ?? ''}`.trim()} />
            <InfoBox icon={Building2} label="Business Name" value={app.business_name || app.company_name} />
            <InfoBox icon={Phone} label="Mobile" value={app.mobile_number} />
            <InfoBox icon={Mail} label="Email" value={app.email} />
            <InfoBox icon={Briefcase} label="GST Number" value={app.gst_number} />
            <InfoBox icon={BadgeCheck} label="PAN Number" value={app.pan_number} />
            <InfoBox icon={ShieldCheck} label="Aadhaar Number" value={app.aadhaar_number} />
            <InfoBox icon={MapPin} label="Location (State / City / Dist)" value={[app.city, app.district, app.state].filter(Boolean).join(', ') || null} />
            {app.address_line_1 && (
              <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-400 mb-0.5">Address</p>
                <p className="text-xs font-medium text-slate-800">{app.address_line_1}</p>
              </div>
            )}
            {bankDetails && (
              <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-slate-500" /> Bank Account Details
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Holder:</span> <span className="font-semibold text-slate-800">{bankDetails.account_holder_name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Bank:</span> <span className="font-semibold text-slate-800">{bankDetails.bank_name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">A/C No:</span> <span className="font-mono font-semibold text-slate-800">{bankDetails.account_number ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">IFSC:</span> <span className="font-mono font-semibold text-slate-800">{bankDetails.ifsc_code ?? '—'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2 pt-2 border-t border-navy-100">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            <CheckboxItem
              id="info_reviewed"
              label="Partner identification and registration details reviewed and verified"
              checked={!!checks.info_reviewed}
              onChange={(c) => onCheckChange('info_reviewed', c)}
              disabled={disabled}
              isError={validationErrors.includes('info_reviewed')}
            />
          </div>
        </div>
      );
    }

    case 'document_verification': {
      const docs = [
        { url: app.business_reg_doc_url, label: 'Business Registration Proof' },
        { url: app.aadhaar_doc_url || app.id_doc_url, label: 'Aadhaar Card' },
        { url: app.pan_doc_url, label: 'PAN Card' },
        { url: app.gst_doc_url, label: 'GST Certificate' },
        { url: app.address_proof_doc_url, label: 'Address Proof' },
      ].filter((d) => d.url);
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-navy-400" /> Submitted Partner Documents
          </h4>
          {docs.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">No documents uploaded by the applicant.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.label} className="p-3 bg-white border border-navy-100 rounded-xl">
                  <DocLink url={doc.url} bucket="partner-documents" label={doc.label} />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 pt-2 border-t border-navy-100">
            <p className="text-xs font-semibold text-navy-600 uppercase tracking-wider">{t('admin.verificationChecklist', 'Verification Checklist')}</p>
            <CheckboxItem
              id="docs_inspected"
              label="All uploaded business and financial documents inspected and verified"
              checked={!!checks.docs_inspected}
              onChange={(c) => onCheckChange('docs_inspected', c)}
              disabled={disabled}
              isError={validationErrors.includes('docs_inspected')}
            />
          </div>
        </div>
      );
    }

    case 'final_review': {
      const allStages = PARTNER_STAGES.slice(1, -1);
      return (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t('admin.finalReviewSummary', 'Final Review Summary')}
          </h4>
          <div className="space-y-2">
            {allStages.map((s) => {
              const sIdx = PARTNER_STAGES.indexOf(s as any);
              const isStepDone = isStepCompleted(s, sIdx, currentIdx, verificationState);
              return (
                <div
                  key={s}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    isStepDone
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : 'bg-navy-50/50 border-navy-100 text-navy-600',
                  )}
                >
                  {isStepDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <span className={cn('text-sm font-medium', isStepDone ? 'text-emerald-950 font-semibold' : 'text-navy-700')}>
                    {stageLabel(s, t)}
                  </span>
                  <span className={cn('ml-auto text-xs font-semibold', isStepDone ? 'text-emerald-700' : 'text-amber-600')}>
                    {isStepDone ? t('admin.verifiedCheckmark', '✓ Verified') : t('admin.stepPending', 'Pending')}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-navy-100">
            <InfoBox icon={User} label={t('admin.partnerLabel', 'Partner')} value={app.full_name} />
            <InfoBox icon={Mail} label={t('admin.emailLabel', 'Email')} value={app.email} />
            <InfoBox icon={Phone} label={t('admin.mobileLabel', 'Mobile')} value={app.mobile_number} />
            <InfoBox icon={Briefcase} label={t('admin.partnerTypeLabel2', 'Partner Type')} value={app.partner_type} />
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            {t('admin.approvingProvisionsPartnerAccount', '⚠ Approving will provision a Partner Portal account linked to the registered mobile number ({{phone}}).').replace('{{phone}}', app.mobile_number ?? '')}
          </div>
        </div>
      );
    }

    case 'approved':
      return (
        <div className="space-y-4">
          <div className="p-5 bg-success-50 border border-success-200 rounded-xl text-center">
            <CheckCircle2 className="h-10 w-10 text-success-600 mx-auto mb-2" />
            <p className="font-bold text-success-800 text-lg">{t('admin.partnerApplicationApproved', 'Partner Application Approved')}</p>
            <p className="text-xs text-success-600 mt-1">{app.reviewed_at ? t('admin.approvedOn', 'Approved on {{date}}').replace('{{date}}', formatDate(app.reviewed_at)) : t('admin.approvalComplete', 'Approval complete')}</p>
          </div>
          <div className="p-3 bg-success-50 border border-success-200 rounded-xl flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-success-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success-800">{t('admin.partnerPortalAccessEnabled', 'Partner Portal Access Enabled')}</p>
              <p className="text-xs text-success-600">{`${app.full_name} — ${t('admin.loginViaOtpOn', 'Login via OTP on: {{phone}}').replace('{{phone}}', app.mobile_number ?? '')}`}</p>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────
export function ApplicationReviewDrawer({
  open,
  onClose,
  application,
  type,
}: ApplicationReviewDrawerProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLanguageContext();

  const isAgent = type === 'agent';
  const isBuilder = type === 'builder';
  const isPartner = type === 'partner';
  const stages = isAgent ? AGENT_STAGES : isBuilder ? BUILDER_STAGES : PARTNER_STAGES;

  const currentStatus = application?.status || 'pending_review';
  const currentIdx = getStageIndex(stages, currentStatus);
  const isTerminal = currentStatus === 'approved' || currentStatus === 'rejected';
  const isProvisioningFailed = (application as any)?.provisioning_status === 'PROVISIONING_FAILED';

  const [selectedStep, setSelectedStep] = useState<string>(currentStatus);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // State: verificationState dictionary per step
  const [verificationState, setVerificationState] = useState<Record<string, StepVerificationState>>(() => {
    return (application?.verification_state as Record<string, StepVerificationState>) || {};
  });

  // State: active checks per stage
  const [checksByStage, setChecksByStage] = useState<Record<string, Record<string, boolean>>>({});

  // Reset or load state when drawer opens or application changes
  useEffect(() => {
    if (open && application) {
      const initialVerificationState: Record<string, StepVerificationState> = {
        ...(application.verification_state as Record<string, StepVerificationState> || {}),
      };

      // Backfill completed steps if status is further along
      const appStageIdx = getStageIndex(stages, application.status || 'pending_review');
      stages.forEach((stg, i) => {
        if (i < appStageIdx && !initialVerificationState[stg]) {
          initialVerificationState[stg] = {
            status: 'completed',
            completed_at: application.created_at || new Date().toISOString(),
          };
        }
      });

      setVerificationState(initialVerificationState);
      setSelectedStep(application.status || 'pending_review');
      setShowReject(false);
      setRejectReason('');
      setNotes('');
      setShowHistory(false);
      setValidationErrors([]);
      setIsSaving(false);

      // Populate checks from verificationState
      const initialChecks: Record<string, Record<string, boolean>> = {};
      stages.forEach((stg) => {
        if (initialVerificationState[stg]?.checks) {
          initialChecks[stg] = { ...initialVerificationState[stg].checks };
        } else if (initialVerificationState[stg]?.status === 'completed') {
          // Default all true for already completed steps
          initialChecks[stg] = {
            info_reviewed: true,
            docs_inspected: true,
            company_mca_gst: true,
            gst_active: true,
            track_record: true,
            address_verified: true,
            rera_portal: true,
            rera_name_match: true,
            rera_no_complaints: true,
            rera_exemption: true,
            checkBuilderCredentials: true,
            checkCompanyNameMatchesRera: true,
            checkProjectLocations: true,
            checkNoPendingLegalDisputes: true,
            checkCompanyCriminalRecord: true,
            checkDirectorBackground: true,
            checkFinancialHealth: true,
            checkNoActiveLegalDisputes: true,
            checkNoReraBlacklist: true,
            checkCriminalRecord: true,
            checkEmploymentHistory: true,
            checkProfessionalReferences: true,
            checkNoAdverseFindings: true,
            identity_match: true,
            contact_verified: true,
            rera_portal_verified: true,
            rera_license_match: true,
            rera_not_applicable: true,
          };
        }
      });
      setChecksByStage(initialChecks);
    }
  }, [open, application?.id, application?.status]);

  const currentChecks = useMemo(() => {
    return checksByStage[selectedStep] || {};
  }, [checksByStage, selectedStep]);

  const handleCheckChange = (checkKey: string, checked: boolean) => {
    setChecksByStage((prev) => ({
      ...prev,
      [selectedStep]: {
        ...(prev[selectedStep] || {}),
        [checkKey]: checked,
      },
    }));
    // Remove from validation errors if checked
    if (checked) {
      setValidationErrors((prev) => prev.filter((k) => k !== checkKey));
    }
  };

  // ── Mutation ────────────────────────────────────────────────────────────────
  const actionMutation = useMutation({
    mutationFn: async (payload: {
      action: 'approve' | 'reject' | 'stage_change' | 'save_verification';
      new_stage?: string;
      verification_state?: Record<string, StepVerificationState>;
      remarks?: string;
    }) => {
      if (!application) return;
      const { data, error } = await supabase.functions.invoke('process-application', {
        body: { application_id: application.id, type, ...payload },
      });
      if (error) {
        console.error('Edge Function error:', error);
        let errorBody = null;
        try {
          if ((error as any).context && typeof (error as any).context.json === 'function') {
            errorBody = await (error as any).context.json();
          }
        } catch (e) {
          console.error('Unable to parse Edge Function error:', e);
        }

        const msg = errorBody?.error || errorBody?.message || error.message || '';
        if (msg.toLowerCase().includes('failed to send') || msg.toLowerCase().includes('fetch')) {
          throw new Error(t('admin.unableToConnectVerification', 'Unable to connect to the verification service. Please check your connection.'));
        }
        throw new Error(msg || t('admin.verificationFailedRetry', 'Verification failed. Please try again.'));
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: [`admin-${type}-applications`] });
      queryClient.invalidateQueries({ queryKey: ['app-activity-logs', application?.id] });

      if (payload.action === 'approve') {
        const who = isAgent ? t('admin.agentLabel', 'Agent') : isBuilder ? t('admin.builderLabel', 'Builder') : t('admin.partnerLabel', 'Partner');
        addToast('success', t('admin.applicationApprovedProvisioned', '{{who}} application approved. Portal access provisioned.').replace('{{who}}', who));
        onClose();
      } else if (payload.action === 'reject') {
        addToast('success', t('admin.applicationRejectedToast', 'Application rejected.'));
        onClose();
      } else if (payload.action === 'stage_change' && payload.new_stage) {
        const label = stageLabel(payload.new_stage, t);
        addToast('success', t('admin.verificationCompletedMovedTo', 'Verification completed. Moved to {{stage}}.').replace('{{stage}}', label));
        setSelectedStep(payload.new_stage);
        setNotes('');
        setValidationErrors([]);
      }
    },
    onError: (e: any) => {
      console.error('Application action error:', e);
      addToast('error', e.message || t('admin.unableToSaveStep', 'Unable to save this verification step. Please try again.'));
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  if (!application) return null;

  const title = isAgent
    ? `${(application as AgentApplication).first_name} ${(application as AgentApplication).last_name}`
    : isBuilder
      ? (application as BuilderApplication).company_name
      : (application as PartnerApplication).full_name;

  const selectedIdx = stages.indexOf(selectedStep as any);
  const isSelectedStepCompleted = verificationState[selectedStep]?.status === 'completed' || selectedIdx < currentIdx;

  // ── Next Button Handler (Validate → Save → Complete → Progress → Navigate) ─
  const handleNext = async () => {
    if (isSaving || actionMutation.isPending) return;

    // If viewing an already completed step earlier in the pipeline, simply navigate forward
    if (selectedStep !== currentStatus && isSelectedStepCompleted) {
      const nextIdx = selectedIdx + 1;
      if (nextIdx < stages.length) {
        setSelectedStep(stages[nextIdx]);
      }
      return;
    }

    // 1. If currently on final_review: handle Final Approval
    if (selectedStep === 'final_review') {
      const requiredStages = stages.slice(1, -2); // all verification stages before final_review & approved
      const incompleteStages = requiredStages.filter((s) => verificationState[s]?.status !== 'completed');

      if (incompleteStages.length > 0) {
        const incompleteLabels = incompleteStages.map((s) => stageLabel(s, t)).join(', ');
        addToast(
          'error',
          `${t('admin.cannotApproveIncompleteSteps', 'Cannot approve: Please complete all required verification steps first.')} (${incompleteLabels})`,
        );
        return;
      }

      // Partner approval guard validation
      if (isPartner) {
        const partnerApp = application as PartnerApplication;
        const validationErrs = validatePartnerDetailsForSubmission({
          partner_type: partnerApp.partner_type ?? '',
          full_name: partnerApp.full_name ?? '',
          mobile_number: partnerApp.mobile_number ?? '',
          email: partnerApp.email ?? '',
          company_name: partnerApp.company_name ?? '',
          years_of_experience: partnerApp.years_of_experience != null ? String(partnerApp.years_of_experience) : '',
          gst_number: partnerApp.gst_number ?? '',
          pan_number: partnerApp.pan_number ?? '',
          website: partnerApp.website ?? '',
          state: partnerApp.state ?? '',
        });
        if (Object.keys(validationErrs).length > 0) {
          const errorFields = Object.keys(validationErrs).join(', ');
          addToast(
            'error',
            t('admin.cannotApproveInvalidFields', 'Cannot approve: Partner application has invalid field values ({{fields}}). Ask the applicant to resubmit with corrected details.').replace('{{fields}}', errorFields),
          );
          return;
        }
      }

      setIsSaving(true);
      actionMutation.mutate({
        action: 'approve',
        remarks: notes || t('admin.approvedAfterFinalReview', 'Approved after final review.'),
      });
      return;
    }

    // 2. Validate current step
    const validation = validateStep(selectedStep, type, application, currentChecks, t);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      addToast('error', validation.message || t('admin.pleaseCompleteChecks', 'Please complete all required verification checks before continuing.'));
      return;
    }

    // 3. Validation passed: Prepare updated verification state
    const nextIdx = currentIdx + 1;
    if (nextIdx >= stages.length) return;
    const nextStage = stages[nextIdx];

    const updatedVerificationState: Record<string, StepVerificationState> = {
      ...(application.verification_state as Record<string, StepVerificationState> || {}),
      ...verificationState,
      [selectedStep]: {
        status: 'completed',
        completed_at: new Date().toISOString(),
        checks: currentChecks,
        notes: notes.trim() || undefined,
      },
    };

    // Update local state immediately for fast response
    setVerificationState(updatedVerificationState);
    setIsSaving(true);

    // 4. Save and advance stage in database via edge function
    actionMutation.mutate({
      action: 'stage_change',
      new_stage: nextStage,
      verification_state: updatedVerificationState,
      remarks: notes || t('admin.advancedToStage', 'Advanced to {{stage}}').replace('{{stage}}', stageLabel(nextStage, t)),
    });
  };

  // ── Previous Button Handler ────────────────────────────────────────────────
  const handlePrevious = () => {
    if (isSaving || actionMutation.isPending) return;
    const prevIdx = stages.indexOf(selectedStep as any) - 1;
    if (prevIdx >= 0) {
      setSelectedStep(stages[prevIdx]);
      setValidationErrors([]);
    }
  };

  // ── Reject Button Handler ──────────────────────────────────────────────────
  const handleReject = () => {
    if (!rejectReason.trim()) {
      addToast('error', t('admin.rejectionReasonRequired', 'Rejection reason is required.'));
      return;
    }
    actionMutation.mutate({ action: 'reject', remarks: rejectReason });
  };

  const renderStepContent = () => {
    if (currentStatus === 'rejected') {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">{t('admin.applicationRejectedTitle', 'Application Rejected')}</p>
            <p className="text-sm text-red-600 mt-1">{application.rejection_reason || t('admin.noReasonProvided', 'No reason provided.')}</p>
          </div>
        </div>
      );
    }

    if (isAgent) {
      return (
        <AgentStepContent
          stage={selectedStep}
          app={application as AgentApplication}
          checks={currentChecks}
          onCheckChange={handleCheckChange}
          validationErrors={validationErrors}
          isCompleted={isSelectedStepCompleted}
          readOnly={isTerminal}
          verificationState={verificationState}
          currentIdx={currentIdx}
        />
      );
    }
    if (isBuilder) {
      return (
        <BuilderStepContent
          stage={selectedStep}
          app={application as BuilderApplication}
          checks={currentChecks}
          onCheckChange={handleCheckChange}
          validationErrors={validationErrors}
          isCompleted={isSelectedStepCompleted}
          readOnly={isTerminal}
          verificationState={verificationState}
          currentIdx={currentIdx}
        />
      );
    }
    return (
      <PartnerStepContent
        stage={selectedStep}
        app={application as PartnerApplication}
        checks={currentChecks}
        onCheckChange={handleCheckChange}
        validationErrors={validationErrors}
        isCompleted={isSelectedStepCompleted}
        readOnly={isTerminal}
        verificationState={verificationState}
        currentIdx={currentIdx}
      />
    );
  };

  const renderFooter = () => {
    return (
      <div className="flex flex-col gap-3">
        {/* Reject panel */}
        {showReject && !isTerminal && (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
            <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> {t('admin.rejectApplicationHeading', 'Reject Application')}
            </p>
            <Textarea
              label={t('admin.reasonForRejectionLabel', 'Reason for Rejection *')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('admin.rejectionReasonPlaceholder', 'E.g. Invalid documents, RERA mismatch...')}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={handleReject}
                loading={actionMutation.isPending && actionMutation.variables?.action === 'reject'}
              >
                {t('admin.confirmRejection', 'Confirm Rejection')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>
                {t('admin.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Action bar */}
        {!isTerminal && (
          <div className="flex flex-wrap items-center gap-2 w-full">
            {!showReject && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                icon={<XCircle className="h-3.5 w-3.5" />}
                onClick={() => setShowReject(true)}
              >
                {t('admin.reject', 'Reject')}
              </Button>
            )}

            {isProvisioningFailed && (
              <div className="flex-1 px-3 py-1.5 ml-2 bg-red-50 text-red-700 text-xs font-medium rounded-lg border border-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {t('admin.provisioningFailedRetry', 'Account provisioning failed. Please retry.')}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Previous button */}
              {selectedStep !== stages[0] && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handlePrevious}
                  disabled={isSaving || actionMutation.isPending}
                >
                  {t('admin.previousStep', '← Previous')}
                </Button>
              )}

              {/* Primary Next / Save / Approve button */}
              <Button
                onClick={handleNext}
                loading={isSaving || actionMutation.isPending}
                disabled={isSaving || actionMutation.isPending}
                icon={<ChevronRight className="h-4 w-4" />}
                className={
                  isProvisioningFailed
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : selectedStep === 'final_review'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md font-semibold'
                      : 'bg-navy-800 text-white hover:bg-navy-900 font-semibold'
                }
              >
                {isSaving || actionMutation.isPending
                  ? t('admin.savingStep', 'Saving...')
                  : isProvisioningFailed
                    ? t('admin.retryProvisioning', 'Retry Provisioning')
                    : selectedStep === 'final_review'
                      ? isBuilder
                        ? t('admin.builderBtnApprove', 'Approve Builder')
                        : isAgent
                          ? t('admin.agentBtnApproveApplication', 'Approve Application')
                          : t('admin.partnerBtnApprove', 'Approve Partner')
                      : selectedStep !== currentStatus && isSelectedStepCompleted
                        ? t('admin.nextStep', 'Next →')
                        : nextButtonLabel(
                            currentStatus,
                            isAgent ? AGENT_NEXT_BUTTON : isBuilder ? BUILDER_NEXT_BUTTON : PARTNER_NEXT_BUTTON,
                            isAgent ? AGENT_NEXT_BUTTON_KEYS : isBuilder ? BUILDER_NEXT_BUTTON_KEYS : PARTNER_NEXT_BUTTON_KEYS,
                            t,
                          )}
              </Button>
            </div>
          </div>
        )}

        {application.status === 'approved' && (
          <div className="p-3 bg-success-50 text-success-700 text-sm rounded-xl border border-success-200 flex gap-2 items-center w-full">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{t('admin.applicationApprovedProvisionedNote', 'Application approved. Portal access has been provisioned.')}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('admin.reviewColon', 'Review:')} ${title}`}
      size="xl"
      footer={renderFooter()}
    >
      <div className="flex flex-col lg:flex-row gap-6 min-h-[520px]">
        {/* ── LEFT: Step workspace ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Step header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] text-navy-400 uppercase tracking-wider font-semibold">
                {`${isAgent ? t('admin.agentLabel', 'Agent') : isBuilder ? t('admin.builderLabel', 'Builder') : t('admin.partnerLabel', 'Partner')} ${t('admin.applicationCurrentStep', 'Application — Current Step')}`}
              </span>
              <h3 className="font-bold text-navy-900 text-lg leading-tight flex items-center gap-2">
                {stageLabel(selectedStep, t)}
                {isSelectedStepCompleted && selectedStep !== 'approved' && (
                  <span className="text-xs bg-success-50 text-success-700 font-semibold px-2 py-0.5 rounded-full border border-success-200">
                    {t('admin.stepCompleted', 'Verified')}
                  </span>
                )}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-900 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-navy-50 border border-navy-100"
            >
              <History className="h-3.5 w-3.5" />
              {t('admin.historyLabel', 'History')}
            </button>
          </div>

          {showHistory && (
            <div className="mb-4 p-3 bg-navy-50 rounded-xl border border-navy-100">
              <h4 className="text-xs font-semibold text-navy-600 mb-2 flex items-center gap-1.5">
                <History className="h-3 w-3" /> {t('admin.verificationActivity', 'Verification Activity')}
              </h4>
              <VerificationHistory applicationId={application.id} />
            </div>
          )}

          {/* Step content */}
          <div className="flex-1">{renderStepContent()}</div>

          {/* Notes */}
          {!isTerminal && selectedStep !== 'submitted' && selectedStep !== 'approved' && (
            <div className="mt-4 pt-4 border-t border-navy-100">
              <Textarea
                label={t('admin.verificationNotesOptional', 'Verification Notes (optional)')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('admin.addNotesPlaceholder', 'Add notes for this verification step...')}
                rows={2}
                disabled={isSaving}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT: Stepper ──────────────────────────────────────────────── */}
        <div className="lg:w-56 shrink-0 border-t lg:border-t-0 lg:border-l border-navy-100 lg:pl-5 pt-4 lg:pt-0">
          <VerificationStepper
            stages={stages}
            currentStatus={currentStatus}
            selectedStep={selectedStep}
            verificationState={verificationState}
            onSelectStep={(stage) => {
              setSelectedStep(stage);
              setShowReject(false);
              setValidationErrors([]);
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

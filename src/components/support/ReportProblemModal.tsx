import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  Upload,
  ArrowRight,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  createSupportTicket,
  uploadSupportAttachment,
  type SupportTicket,
} from '../../lib/support';
import { useAuth } from '../../lib/auth';
import { useToast } from '../toast';
import { cn } from '../../lib/utils';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted: (ticket: SupportTicket) => void;
}

const REPORT_TYPES = [
  { id: 'fake_listing', label: 'Fake or Fraudulent Property Listing', category: 'Verification & Safety', priority: 'High' as const },
  { id: 'wrong_info', label: 'Incorrect Price, Location, or Photos', category: 'Verification & Safety', priority: 'Medium' as const },
  { id: 'agent_misbehavior', label: 'Suspicious Agent or Scam Advance Request', category: 'Verification & Safety', priority: 'Urgent' as const },
  { id: 'technical_bug', label: 'Application Error / Broken Page / Upload Bug', category: 'Technical Support', priority: 'High' as const },
  { id: 'security', label: 'Account Security or Privacy Concern', category: 'Account & Profile', priority: 'Urgent' as const },
];

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({
  isOpen,
  onClose,
  onReportSubmitted,
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [reportType, setReportType] = useState(REPORT_TYPES[0].id);
  const [propertyInfo, setPropertyInfo] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentType = REPORT_TYPES.find((t) => t.id === reportType) || REPORT_TYPES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      addToast('error', 'Please sign in to report a problem.');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      addToast('error', 'Please describe the problem in detail (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);

    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let attachmentType: string | undefined;

      if (selectedFile) {
        const uploadRes = await uploadSupportAttachment(selectedFile, user.id);
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
        attachmentType = uploadRes.type;
      }

      const subject = `[REPORT] ${currentType.label}${propertyInfo ? ` - ${propertyInfo}` : ''}`;

      const ticket = await createSupportTicket({
        customerId: user.id,
        category: currentType.category as any,
        subject,
        description: `REPORT DETAILS:\nType: ${currentType.label}\nTarget: ${propertyInfo || 'N/A'}\n\nDescription:\n${description.trim()}`,
        priority: currentType.priority,
        attachmentUrl,
        attachmentName,
        attachmentType,
      });

      addToast('success', 'Thank you. Your report has been submitted to our security desk.');
      onReportSubmitted(ticket);
      onClose();
    } catch (err: any) {
      console.error('Report submission error:', err);
      addToast('error', err.message || 'Could not submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-rose-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-slate-900">
                Report a Problem or Scam
              </h2>
              <p className="text-xs text-rose-700 font-medium">
                Help us keep RealtyNow 100% verified and secure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Issue Type */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 uppercase tracking-wider">
              Type of Problem <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setReportType(type.id)}
                  className={cn(
                    'w-full p-2.5 rounded-xl border text-left font-semibold transition flex items-center justify-between cursor-pointer',
                    reportType === type.id
                      ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span>{type.label}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                    {type.priority}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Property / URL / Name */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 uppercase tracking-wider">
              Listing Title, Link, or Agent Name (Optional)
            </label>
            <input
              type="text"
              value={propertyInfo}
              onChange={(e) => setPropertyInfo(e.target.value)}
              placeholder="e.g. 3BHK in Gachibowli or Agent Name"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 uppercase tracking-wider">
              Description & Evidence <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details of what happened or why this listing/agent is suspicious..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none resize-none"
              required
            />
          </div>

          {/* File Attachment */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 uppercase tracking-wider">
              Evidence Screenshot (Optional)
            </label>
            {selectedFile ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="truncate font-semibold text-slate-800">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-400 hover:text-red-600 p-0.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-2.5 font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload screenshot or photo evidence</span>
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                  accept="image/*,.pdf"
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !description.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Security Report</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

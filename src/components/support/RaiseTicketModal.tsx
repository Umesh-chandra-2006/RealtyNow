import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Ticket,
  CheckCircle2,
  Paperclip,
  Building2,
  ArrowRight,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  createSupportTicket,
  uploadSupportAttachment,
  fetchCustomerPropertiesForTicket,
  type SupportCategory,
  type SupportPriority,
  type SupportTicket,
} from '../../lib/support';
import { useAuth } from '../../lib/auth';
import { useToast } from '../toast';
import { cn } from '../../lib/utils';

interface RaiseTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (ticket: SupportTicket) => void;
  initialCategory?: SupportCategory;
  initialSubject?: string;
  initialPropertyId?: string;
}

const CATEGORIES: SupportCategory[] = [
  'Property Listing',
  'Property Search',
  'Payments & Billing',
  'Account & Profile',
  'Subscription & Premium',
  'Verification & Safety',
  'Technical Support',
  'Contact & Support',
];

const PRIORITIES: { value: SupportPriority; label: string; desc: string; color: string }[] = [
  { value: 'Low', label: 'Low', desc: 'General queries or feedback', color: 'border-slate-200 text-slate-700' },
  { value: 'Medium', label: 'Medium', desc: 'Standard requests or minor issues', color: 'border-blue-200 text-blue-700 bg-blue-50/50' },
  { value: 'High', label: 'High', desc: 'Listing or payment blockage', color: 'border-amber-300 text-amber-800 bg-amber-50/50' },
  { value: 'Urgent', label: 'Urgent', desc: 'Critical system or security issue', color: 'border-red-300 text-red-800 bg-red-50/50' },
];

export const RaiseTicketModal: React.FC<RaiseTicketModalProps> = ({
  isOpen,
  onClose,
  onTicketCreated,
  initialCategory,
  initialSubject,
  initialPropertyId,
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [category, setCategory] = useState<SupportCategory>(initialCategory || 'Property Listing');
  const [subject, setSubject] = useState(initialSubject || '');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SupportPriority>('Medium');
  const [propertyId, setPropertyId] = useState<string>(initialPropertyId || '');
  const [contactPreference, setContactPreference] = useState<'Email' | 'Phone' | 'Chat'>('Email');

  const [userProperties, setUserProperties] = useState<{ id: string; title: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<SupportTicket | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchCustomerPropertiesForTicket(user.id).then(setUserProperties);
    }
  }, [user]);

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
    if (initialSubject) setSubject(initialSubject);
    if (initialPropertyId) setPropertyId(initialPropertyId);
  }, [initialCategory, initialSubject, initialPropertyId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast('error', 'File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      addToast('error', 'Please sign in to raise a support ticket.');
      return;
    }

    if (!subject.trim() || subject.trim().length < 5) {
      addToast('error', 'Please enter a descriptive subject (at least 5 characters).');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      addToast('error', 'Please explain your issue in detail (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);

    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let attachmentType: string | undefined;
      let attachmentSize: number | undefined;

      if (selectedFile) {
        setIsUploadingFile(true);
        const uploadRes = await uploadSupportAttachment(selectedFile, user.id);
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
        attachmentType = uploadRes.type;
        attachmentSize = uploadRes.size;
      }

      const ticket = await createSupportTicket({
        customerId: user.id,
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        propertyId: propertyId || undefined,
        contactPreference,
        attachmentUrl,
        attachmentName,
        attachmentType,
        attachmentSize,
      });

      setCreatedTicket(ticket);
      addToast('success', `Support ticket #${ticket.ticket_number} created successfully.`);
      onTicketCreated(ticket);
    } catch (err: any) {
      console.error('Ticket creation error:', err);
      addToast('error', err.message || 'Could not create support ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingFile(false);
    }
  };

  const handleResetAndClose = () => {
    setCreatedTicket(null);
    setSubject('');
    setDescription('');
    setSelectedFile(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Success Screen */}
        {createdTicket ? (
          <div className="p-8 text-center space-y-6 my-auto">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Request Registered
              </span>
              <h2 className="font-display text-2xl font-extrabold text-slate-900">
                Support Request Submitted
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Your support ticket has been created and assigned to our helpdesk team. You can track progress and reply at any time.
              </p>
            </div>

            {/* Ticket ID Card */}
            <div className="mx-auto max-w-xs rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ticket ID</span>
              <p className="font-mono text-2xl font-black text-slate-900 mt-0.5">
                #{createdTicket.ticket_number}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {createdTicket.status}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {createdTicket.category}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  onTicketCreated(createdTicket);
                  handleResetAndClose();
                }}
                className="rounded-xl bg-red-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 transition cursor-pointer"
              >
                View Ticket Conversation
              </button>
              <button
                onClick={handleResetAndClose}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Back to Help Center
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
                  <Ticket className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                    Raise a Support Ticket
                  </h2>
                  <p className="text-xs text-slate-500">
                    Provide details below. Our team will review and respond promptly.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-sm">
              {/* Category & Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Issue Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupportCategory)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Priority Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as SupportPriority)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label} — {p.desc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Subject / Summary <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Unable to publish property listing or price not updating"
                  maxLength={120}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  required
                />
              </div>

              {/* Description Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Detailed Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please explain the issue in detail. Include any error messages, steps taken, or specific requirements..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                  required
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Minimum 10 characters</span>
                  <span>{description.length} / 1000</span>
                </div>
              </div>

              {/* Optional Property Selector */}
              {userProperties.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span>Related Property (Optional)</span>
                  </label>
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    <option value="">-- No specific property selected --</option>
                    {userProperties.map((prop) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Contact Preference & Attachment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Contact Preference */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Contact Preference
                  </label>
                  <div className="flex items-center gap-2">
                    {(['Email', 'Phone', 'Chat'] as const).map((pref) => (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => setContactPreference(pref)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer',
                          contactPreference === pref
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        {pref}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Attachment Upload */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Attach Screenshot / File</span>
                    <span className="text-[10px] text-slate-400 font-normal">Max 10MB</span>
                  </label>
                  {selectedFile ? (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{selectedFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-slate-400 hover:text-red-600 p-1 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer">
                      <Upload className="h-3.5 w-3.5 text-slate-400" />
                      <span>Upload image, PDF, doc</span>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept="image/*,.pdf,.doc,.docx"
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Request...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Support Request</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Download,
  Eye,
  RefreshCw,
  Edit3,
  CreditCard,
  Building,
  Printer,
  Sparkles,
  Award,
  Check,
  FileCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Badge, Input, Select } from '../../components/ui';
import { formatDate, cn } from '../../lib/utils';
import { useToast } from '../../components/toast';

export function PartnerDocumentsPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // Modals state
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeDocToUpload, setActiveDocToUpload] = useState<any | null>(null);
  const [bankEditModalOpen, setBankEditModalOpen] = useState(false);

  // Selected file for upload
  const [selectedFileName, setSelectedFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  // 1. Fetch Partner record
  const {
    data: partner,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['partner-me', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('partners').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // 1b. Fetch Partner Bank Account record
  const { data: bankAccount } = useQuery({
    queryKey: ['partner-bank-account', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('partner_bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Bank Form State
  const [bankForm, setBankForm] = useState({
    pan_number: '',
    gst_number: '',
    bank_account_number: '',
    bank_name: '',
    bank_ifsc: '',
    upi_id: '',
  });

  // Populate bank form when partner data arrives
  React.useEffect(() => {
    if (partner || bankAccount) {
      setBankForm({
        pan_number: partner?.pan_number || '',
        gst_number: partner?.gst_number || '',
        bank_account_number: bankAccount?.account_number || '',
        bank_name: bankAccount?.bank_name || '',
        bank_ifsc: bankAccount?.ifsc_code || '',
        upi_id: localStorage.getItem('realtynow_partner_upi') || '',
      });
    }
  }, [partner, bankAccount]);

  // Update Bank & Tax Details Mutation
  const updateBankDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!partner?.id || !user?.id) throw new Error('Partner record not found');

      // 1. Update PAN & GST on partners table
      const { error: partnerErr } = await supabase
        .from('partners')
        .update({
          pan_number: bankForm.pan_number.toUpperCase().trim() || null,
          gst_number: bankForm.gst_number.toUpperCase().trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partner.id);
      if (partnerErr) throw partnerErr;

      // 2. Upsert bank account on partner_bank_accounts table
      if (bankForm.bank_account_number && bankForm.bank_ifsc) {
        const { error: bankErr } = await supabase
          .from('partner_bank_accounts')
          .upsert(
            {
              user_id: user.id,
              partner_id: partner.id,
              account_holder_name: partner.full_name || 'Channel Partner',
              bank_name: bankForm.bank_name.trim() || 'Bank',
              account_number: bankForm.bank_account_number.trim(),
              account_number_last4: bankForm.bank_account_number.trim().slice(-4),
              ifsc_code: bankForm.bank_ifsc.toUpperCase().trim(),
              verified: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (bankErr) {
          console.warn('Bank upsert note:', bankErr);
        }
      }

      if (bankForm.upi_id) {
        localStorage.setItem('realtynow_partner_upi', bankForm.upi_id.trim());
      }
    },
    onSuccess: () => {
      addToast('success', 'Tax & Bank details saved successfully!');
      setBankEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['partner-me'] });
      queryClient.invalidateQueries({ queryKey: ['partner-bank-account'] });
    },
    onError: (err: any) => {
      addToast('error', `Failed to update: ${err.message}`);
    },
  });

  // Simulate Document Upload
  const handleUploadDocument = () => {
    if (!selectedFileName) {
      addToast('warning', 'Please choose a file to upload');
      return;
    }

    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setUploadModalOpen(false);
      setSelectedFileName('');
      addToast('success', `${activeDocToUpload?.title || 'Document'} uploaded for admin verification!`);
      queryClient.invalidateQueries({ queryKey: ['partner-me'] });
    }, 1000);
  };

  const docs = [
    {
      id: 'pan',
      title: 'PAN Card / Tax Identity Proof',
      desc: 'Mandatory for TDS calculation (Section 194H) and Indian income tax compliance.',
      status: partner?.pan_number ? 'verified' : 'pending',
      identifier: partner?.pan_number || 'Not provided',
      uploadedAt: partner?.created_at,
      docType: 'identity',
    },
    {
      id: 'agreement',
      title: 'RealtyNow Channel Partner Agreement',
      desc: 'Official digital contract establishing your partner commission tier and payment policies.',
      status: partner?.status === 'active' ? 'verified' : 'pending',
      identifier: partner?.partner_code || 'RN-PARTNER',
      uploadedAt: partner?.approved_at || partner?.created_at,
      docType: 'contract',
      canViewAgreement: true,
    },
    {
      id: 'bank_proof',
      title: 'Bank Account & Cancelled Cheque',
      desc: 'Account details and IFSC code confirming beneficiary for NEFT/IMPS commission payouts.',
      status: bankAccount?.account_number ? 'verified' : 'pending',
      identifier: bankAccount?.bank_name
        ? `${bankAccount.bank_name} (•••• ${bankAccount.account_number?.slice(-4) || 'XXXX'})`
        : 'Not provided',
      uploadedAt: bankAccount?.created_at || partner?.created_at,
      docType: 'financial',
    },
    {
      id: 'gst',
      title: 'GST Certificate (Optional)',
      desc: 'Enables 18% GST input credit on commission payouts for registered business entities.',
      status: partner?.gst_number ? 'verified' : 'optional',
      identifier: partner?.gst_number || 'None (Exempt)',
      uploadedAt: partner?.created_at,
      docType: 'tax',
    },
  ];

  // Calculate KYC score
  const verifiedCount = docs.filter((d) => d.status === 'verified').length;
  const kycPercent = Math.round((verifiedCount / 3) * 100);

  return (
    <DashboardLayout sections={sections} title="Documents & KYC">
      <PageHeader
        title="Partner Documents & KYC Verification"
        subtitle="Review your submitted identity verification documents, partner channel agreement, and compliance status."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Edit3 className="h-4 w-4" />}
              onClick={() => setBankEditModalOpen(true)}
            >
              Update Bank / Tax Details
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* KYC Progress Banner */}
      <Card className="p-6 bg-gradient-to-r from-navy-950 via-navy-900 to-slate-900 text-white rounded-3xl mb-8 relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <ShieldCheck className="h-4 w-4" />
              <span>KYC Compliance Status</span>
            </div>
            <h3 className="font-display text-2xl font-black">
              {kycPercent >= 100 ? 'KYC Fully Verified & Active' : 'KYC Verification In Progress'}
            </h3>
            <p className="text-xs text-slate-300 max-w-xl font-medium">
              Your partner account is authorized to submit buyer and seller referrals, generate digital commission statements, and receive direct bank disbursements.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="text-center">
              <span className="font-display text-3xl font-black text-amber-400">{Math.min(kycPercent, 100)}%</span>
              <span className="text-[10px] text-slate-300 block font-semibold">Verification Score</span>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <Button
              size="sm"
              variant="gold"
              icon={<Award className="h-4 w-4" />}
              onClick={() => setAgreementModalOpen(true)}
            >
              View Agreement Certificate
            </Button>
          </div>
        </div>
      </Card>

      {/* Document Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {docs.map((doc) => {
          const isVerified = doc.status === 'verified';
          const isPending = doc.status === 'pending';
          const isOptional = doc.status === 'optional';

          return (
            <Card
              key={doc.id}
              className="p-5 bg-white border border-slate-200 shadow-2xs space-y-4 rounded-2xl flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-slate-900">{doc.title}</h4>
                      <span className="text-[11px] font-mono text-slate-500 font-bold block mt-0.5">
                        {doc.identifier}
                      </span>
                    </div>
                  </div>
                  <Badge variant={isVerified ? 'success' : isPending ? 'warning' : 'default'} className="text-[10px] uppercase">
                    {isVerified ? 'Verified' : isPending ? 'Action Required' : 'Optional'}
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 font-medium leading-relaxed">{doc.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  {isVerified ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500" />
                  )}
                  {isVerified ? 'Approved & Compliant' : 'Requires Document'}
                </span>

                <div className="flex items-center gap-1.5">
                  {doc.canViewAgreement && (
                    <Button size="sm" variant="ghost" onClick={() => setAgreementModalOpen(true)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View Agreement
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setActiveDocToUpload(doc);
                      setUploadModalOpen(true);
                    }}
                    icon={<Upload className="h-3.5 w-3.5" />}
                  >
                    Upload / Replace
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tax & Banking Overview Card */}
      <Card className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-display font-bold text-base text-slate-900">
                Direct Disbursement Account Summary
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Bank account linked for automatic wallet commission transfers & withdrawals.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<Edit3 className="h-3.5 w-3.5" />}
            onClick={() => setBankEditModalOpen(true)}
          >
            Edit Details
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase">PAN Number</span>
            <p className="font-mono font-bold text-xs text-slate-900 mt-1">
              {partner?.pan_number || 'Not provided'}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Bank Name</span>
            <p className="font-bold text-xs text-slate-900 mt-1">
              {bankAccount?.bank_name || 'Not provided'}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Account Number</span>
            <p className="font-mono font-bold text-xs text-slate-900 mt-1">
              {bankAccount?.account_number
                ? `•••• •••• ${bankAccount.account_number.slice(-4)}`
                : 'Not provided'}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase">IFSC Code / UPI</span>
            <p className="font-mono font-bold text-xs text-slate-900 mt-1">
              {bankAccount?.ifsc_code || localStorage.getItem('realtynow_partner_upi') || 'Not provided'}
            </p>
          </div>
        </div>
      </Card>

      {/* MODAL: Agreement Certificate Viewer */}
      {agreementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-slate-900">
                    Channel Partner Authorization Agreement
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    RealtyNow Digital Empanelment Contract & Certificate
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAgreementModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Certificate Body */}
            <div className="p-6 rounded-2xl border-2 border-dashed border-red-600/30 bg-radial from-red-50/40 via-white to-slate-50/50 space-y-4">
              <div className="text-center space-y-1">
                <span className="font-mono text-xs font-bold text-red-600 tracking-widest uppercase">
                  OFFICIAL PARTNER CERTIFICATE
                </span>
                <h2 className="font-display text-xl font-black text-navy-950">
                  REALTYNOW INDIA ENTERPRISE NETWORK
                </h2>
                <p className="text-xs text-slate-500 font-medium">This certifies that</p>
                <h3 className="font-display text-lg font-black text-red-600">
                  {partner?.company_name || partner?.full_name || 'Channel Business Partner'}
                </h3>
                <span className="font-mono text-xs font-bold bg-white px-3 py-1 rounded-full border border-slate-200 inline-block text-slate-700">
                  Partner Code: {partner?.partner_code || 'RNP-000002'}
                </span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs space-y-2 text-slate-600 leading-relaxed">
                <p>
                  is officially authorized as an approved <strong>Tier 1 Gold Business Partner</strong> to refer buyers, investors, sellers, and property seekers across Telangana & Andhra Pradesh on the RealtyNow Marketplace.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500 font-medium">
                  <li>Standard Commission Payout: Up to 1.5% on direct property transactions.</li>
                  <li>Home Loan Referral Incentive: Up to 0.40% on sanctioned loan amount.</li>
                  <li>Payout Cycle: Direct NEFT/IMPS wallet transfers within 72 hours of developer milestone closure.</li>
                </ul>
              </div>

              <div className="flex items-center justify-between text-xs pt-4 border-t border-slate-200 text-slate-500 font-medium">
                <div>
                  <span className="block text-[10px] text-slate-400">Authorized Signatory</span>
                  <span className="font-bold text-slate-800">RealtyNow Operations Team</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400">Empanelment Date</span>
                  <span className="font-bold text-slate-800">
                    {formatDate(partner?.approved_at || partner?.created_at || new Date().toISOString())}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setAgreementModalOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Printer className="h-4 w-4" />}
                onClick={() => window.print()}
              >
                Print Certificate
              </Button>
              <Button
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() => addToast('success', 'Agreement downloaded as PDF!')}
              >
                Download Agreement PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Upload Document */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Upload {activeDocToUpload?.title || 'Document'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Accepted formats: PDF, PNG, JPG (Max 5MB)
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-200 hover:border-red-500 rounded-2xl text-center space-y-3 bg-slate-50 transition-colors">
              <Upload className="h-8 w-8 text-slate-400 mx-auto" />
              <div>
                <label className="text-xs font-bold text-red-600 hover:underline cursor-pointer">
                  <span>Browse and select file</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFileName(e.target.files[0].name);
                      }
                    }}
                  />
                </label>
                <p className="text-[11px] text-slate-400 mt-1">or drag & drop file here</p>
              </div>
              {selectedFileName && (
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  <span>{selectedFileName}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUploadDocument}
                loading={uploading}
                disabled={!selectedFileName}
                icon={<Upload className="h-3.5 w-3.5" />}
              >
                Upload Document
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Update Bank & Tax Details */}
      {bankEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Update Tax & Bank Settlement Details
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Ensure PAN and IFSC code are accurate for automatic TDS and payouts.
                </p>
              </div>
              <button
                onClick={() => setBankEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">PAN Number *</label>
                  <Input
                    placeholder="ABCDE1234F"
                    value={bankForm.pan_number}
                    onChange={(e) => setBankForm({ ...bankForm, pan_number: e.target.value })}
                    className="text-xs uppercase mt-1 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">GST Number (Optional)</label>
                  <Input
                    placeholder="36ABCDE1234F1Z5"
                    value={bankForm.gst_number}
                    onChange={(e) => setBankForm({ ...bankForm, gst_number: e.target.value })}
                    className="text-xs uppercase mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Bank Name *</label>
                <Input
                  placeholder="e.g., HDFC Bank / ICICI Bank / SBI"
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Account Number *</label>
                  <Input
                    placeholder="50100234567890"
                    value={bankForm.bank_account_number}
                    onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value })}
                    className="text-xs mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">IFSC Code *</label>
                  <Input
                    placeholder="HDFC0001234"
                    value={bankForm.bank_ifsc}
                    onChange={(e) => setBankForm({ ...bankForm, bank_ifsc: e.target.value })}
                    className="text-xs uppercase mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">UPI ID for Quick Payouts</label>
                <Input
                  placeholder="partner@upi"
                  value={bankForm.upi_id}
                  onChange={(e) => setBankForm({ ...bankForm, upi_id: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setBankEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => updateBankDetailsMutation.mutate()}
                loading={updateBankDetailsMutation.isPending}
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
              >
                Save & Update Details
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default PartnerDocumentsPage;

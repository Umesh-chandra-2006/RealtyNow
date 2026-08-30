import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Copy,
  Check,
  QrCode,
  MessageCircle,
  ExternalLink,
  Download,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button } from '../../components/ui';
import { useToast } from '../../components/toast';

export function PartnerToolsPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: partner } = useQuery({
    queryKey: ['partner-me', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('partners').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const partnerCode = partner?.partner_code || 'RNP-000001';
  const referralUrl = `https://realtynow.in?ref=${partnerCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(referralUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    addToast('success', 'Referral link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(partnerCode);
    setCopiedCode(true);
    addToast('success', 'Partner code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const templates = [
    {
      title: 'Property Investment Pitch',
      msg: `Hi! Looking to buy premium plots, villas, or luxury apartments in Hyderabad? Browse top verified projects with zero brokerage on RealtyNow: ${referralUrl}`,
    },
    {
      title: 'Home Loans & Services',
      msg: `Need the best home loan interest rates or reliable interior & construction services? Check out RealtyNow's verified network: ${referralUrl}`,
    },
    {
      title: 'Direct Referral Intro',
      msg: `Hello, I'm partnering with RealtyNow — India's verified real estate platform. Use my partner code *${partnerCode}* or link ${referralUrl} for priority assistance.`,
    },
  ];

  return (
    <DashboardLayout sections={sections} title="Referral Link & QR">
      <PageHeader
        title="Partner Growth Tools & Referral Link"
        subtitle="Share your unique partner code, instant digital QR code, and pre-formatted WhatsApp templates to earn commissions on every client lead."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Link & QR Code */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6 bg-white border border-slate-200 shadow-2xs space-y-5 rounded-2xl">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-red-600" />
              Your Unique Referral Link
            </h3>

            <div>
              <label className="label">Custom Shareable URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralUrl}
                  className="input font-mono text-xs text-slate-700 bg-slate-50 select-all"
                />
                <Button onClick={handleCopyLink} size="sm" icon={copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
                  {copiedLink ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div>
              <label className="label">Partner Referral Code</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={partnerCode}
                  className="input font-mono font-bold text-sm text-slate-900 bg-slate-50 max-w-[200px]"
                />
                <Button variant="secondary" onClick={handleCopyCode} size="sm">
                  {copiedCode ? 'Copied' : 'Copy Code'}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                Clients can also enter this code manually when filling any property or service enquiry form on RealtyNow.
              </p>
            </div>
          </Card>

          {/* WhatsApp Pitch Templates */}
          <Card className="p-6 bg-white border border-slate-200 shadow-2xs space-y-4 rounded-2xl">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              One-Click WhatsApp Templates
            </h3>

            <div className="space-y-3">
              {templates.map((tpl, i) => {
                const waShareUrl = `https://wa.me/?text=${encodeURIComponent(tpl.msg)}`;
                return (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{tpl.title}</span>
                      <a
                        href={waShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                      >
                        Share via WhatsApp <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-xs text-slate-600 font-sans leading-relaxed">{tpl.msg}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Dynamic QR Code */}
        <div className="lg:col-span-5">
          <Card className="p-6 bg-white border border-slate-200 shadow-2xs text-center space-y-4 rounded-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold font-mono">
              <QrCode className="h-4 w-4" /> SCAN TO REFER
            </div>

            <h3 className="font-display text-lg font-bold text-slate-900">Partner Digital QR Code</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Show this QR code to prospective buyers or print it on your business cards to automatically attribute leads to your account.
            </p>

            <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 inline-block shadow-inner">
              <img src={qrCodeUrl} alt="RealtyNow Partner QR Code" className="w-48 h-48 mx-auto" />
            </div>

            <div className="pt-2">
              <a
                href={qrCodeUrl}
                download={`RealtyNow_Partner_QR_${partnerCode}.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition w-full"
              >
                <Download className="h-4 w-4" /> Download High-Res QR Code
              </a>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PartnerToolsPage;

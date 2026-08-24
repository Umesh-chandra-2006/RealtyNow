import { useState } from 'react';
import { PieChart, CheckCircle2, MessageCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, EmptyState, Button, Input, Textarea } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/useToast';

export function HomeLoansPage() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', loanAmount: '', message: '' });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = form.name.trim();
    const cleanPhone = form.phone.trim();
    const cleanEmail = form.email.trim();
    const cleanMessage = form.message.trim();

    if (!cleanName || !cleanPhone) {
      toast.addToast('error', 'Please provide your name and phone number.');
      return;
    }
    setSubmitting(true);
    let success = false;
    const msg = `Home Loan enquiry — Loan amount required: ₹${form.loanAmount || 'N/A'}. ${cleanMessage || ''}`;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_contact_enquiry', {
        p_name: cleanName,
        p_phone: cleanPhone,
        p_email: cleanEmail || null,
        p_message: msg,
        p_source: 'website',
        p_customer_id: user?.id ?? null,
        p_tags: ['home-loans', 'HOME_LOANS'],
      });
      if (!rpcError && (rpcData as any)?.success !== false) {
        success = true;
      }
    } catch (rpcErr) {
      console.warn('Home loans RPC submission error:', rpcErr);
    }

    if (!success) {
      try {
        const { error } = await supabase.from('enquiries').insert({
          name: cleanName,
          email: cleanEmail || null,
          phone: cleanPhone,
          customer_id: user?.id ?? null,
          property_id: null,
          source: 'website',
          status: 'new',
          message: msg,
          tags: ['home-loans', 'HOME_LOANS'],
        });
        if (!error) success = true;
      } catch (insertErr) {
        console.error('Home loans insert error:', insertErr);
      }
    }

    // Tier 4 Local storage backup queue
    if (!success) {
      try {
        const queue = JSON.parse(localStorage.getItem('realtynow_offline_leads') || '[]');
        queue.push({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          message: msg,
          loanAmount: form.loanAmount,
          service: 'home-loans',
          created_at: new Date().toISOString(),
        });
        localStorage.setItem('realtynow_offline_leads', JSON.stringify(queue));
        success = true;
      } catch (storageErr) {
        console.error('LocalStorage queue error:', storageErr);
      }
    }

    setSubmitting(false);
    if (success) {
      setSent(true);
      toast.addToast('success', 'Loan enquiry submitted successfully! Our advisor will contact you.');
    } else {
      toast.addToast('error', 'Failed to submit enquiry. Please try again or chat via WhatsApp.');
    }
  };

  const [calcAmount, setCalcAmount] = useState(5000000);
  const [calcRate, setCalcRate] = useState(8.5);
  const [calcTenure, setCalcTenure] = useState(20);

  const r = calcRate / 12 / 100;
  const n = calcTenure * 12;
  const emi = calcAmount > 0 && calcRate > 0 && calcTenure > 0
    ? Math.round((calcAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
    : 0;

  return (
    <div className="container-page py-12">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          <PieChart className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-navy-900">{t('homeLoans.title', 'Home Loans')}</h1>
          <p className="mt-1 text-navy-600">
            {t('homeLoans.subtitle', 'Easy home loans with lowest interest rates — share your details to get started.')}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Left Side: Form */}
        <Card className="p-6">
          {sent ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 shadow-xs">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 className="font-display text-2xl font-bold text-navy-900">
                {t('homeLoans.sentTitle', 'Request Received Successfully!')}
              </h2>
              <p className="mt-2 text-sm text-navy-600 max-w-md">
                {t('homeLoans.sentDesc', 'Thank you for your interest. Our home loan banking experts will contact you within 24 hours to guide your loan application.')}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setForm({ name: '', email: '', phone: '', loanAmount: '', message: '' });
                  }}
                  className="rounded-xl border border-navy-200 bg-white px-5 py-2.5 text-xs font-bold text-navy-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  Submit another request
                </button>
                <a
                  href={`https://wa.me/919494230774?text=${encodeURIComponent(`Hello RealtyNow, I submitted a home loan inquiry for ₹${form.loanAmount || '50,00,000'}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs"
                >
                  <MessageCircle className="h-4 w-4" /> Chat with Loan Expert
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input
                label={t('contact.name', 'Name')}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <Input
                label={t('contact.email', 'Email')}
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <Input
                label={t('contact.phone', 'Phone')}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
              <Input
                label={t('homeLoans.loanAmount', 'Loan Amount Required')}
                type="number"
                value={form.loanAmount}
                onChange={(e) => setForm((f) => ({ ...f, loanAmount: e.target.value }))}
                placeholder={t('homeLoans.loanAmountPlaceholder', 'e.g. 5000000')}
              />
              <Textarea
                label={t('homeLoans.notes', 'Anything else we should know?')}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder={t('homeLoans.notesPlaceholder', 'Employment type, existing loans, preferred bank...')}
              />
              <Button type="submit" loading={submitting}>
                {t('homeLoans.submitBtn', 'Submit Enquiry')}
              </Button>
            </form>
          )}
        </Card>

        {/* Right Side: EMI Calculator */}
        <div>
          <div className="bg-[#1a1b3a] rounded-3xl p-8 text-white shadow-xl bg-gradient-to-br from-[#1e1f42] to-[#12132b]">
            <h2 className="text-2xl font-bold font-display mb-2">Need a Home Loan?</h2>
            <p className="text-blue-100/70 text-sm mb-8">
              Estimate your EMI and get pre-approved in minutes.
            </p>

            <div className="space-y-6">
              {/* Loan Amount */}
              <div>
                <div className="flex justify-between items-end mb-3">
                  <label className="text-sm text-blue-100/80">Loan amount</label>
                  <span className="font-bold text-lg">₹{calcAmount.toLocaleString('en-IN')}</span>
                </div>
                <input 
                  type="range" 
                  min="100000" 
                  max="50000000" 
                  step="100000"
                  value={calcAmount} 
                  onChange={(e) => setCalcAmount(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400"
                />
              </div>

              {/* Interest Rate */}
              <div>
                <div className="flex justify-between items-end mb-3">
                  <label className="text-sm text-blue-100/80">Interest rate</label>
                  <span className="font-bold text-lg">{calcRate}%</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="15" 
                  step="0.1"
                  value={calcRate} 
                  onChange={(e) => setCalcRate(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400"
                />
              </div>

              {/* Tenure */}
              <div>
                <div className="flex justify-between items-end mb-3">
                  <label className="text-sm text-blue-100/80">Tenure</label>
                  <span className="font-bold text-lg">{calcTenure} yrs</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="30" 
                  step="1"
                  value={calcTenure} 
                  onChange={(e) => setCalcTenure(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400"
                />
              </div>
            </div>

            <div className="mt-8 mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
              <span className="text-sm text-blue-100/80">Estimated EMI</span>
              <span className="text-xl font-bold">₹{emi.toLocaleString('en-IN')}/mo</span>
            </div>

            <button 
              onClick={() => {
                setForm(f => ({ ...f, loanAmount: String(calcAmount) }));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-3.5 rounded-xl bg-white text-[#1a1b3a] font-bold hover:bg-neutral-100 transition-colors"
            >
              Check Eligibility
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

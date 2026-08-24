import { useState } from 'react';
import { Droplets, Phone, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, EmptyState, Button, Input, Textarea } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/useToast';

export function BorewellServicesPage() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', message: '' });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.addToast('error', 'Please provide your name and phone number.');
      return;
    }
    setSubmitting(true);
    let success = false;
    const msg = `Borewell Services enquiry — Location: ${form.location || 'N/A'}. ${form.message || ''}`;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_contact_enquiry', {
        p_name: form.name.trim(),
        p_phone: form.phone.trim(),
        p_email: form.email.trim() || null,
        p_message: msg,
        p_source: 'website',
        p_customer_id: user?.id ?? null,
        p_tags: ['borewell-services', 'BOREWELL_SERVICES', form.location.trim()].filter(Boolean),
      });
      if (!rpcError && (rpcData as any)?.success !== false) {
        success = true;
      }
    } catch (rpcErr) {
      console.warn('Borewell services RPC error:', rpcErr);
    }

    if (!success) {
      const { error } = await supabase.from('enquiries').insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim(),
        customer_id: user?.id ?? null,
        property_id: null,
        source: 'website',
        status: 'new',
        message: msg,
        tags: ['borewell-services', 'BOREWELL_SERVICES'],
      });
      if (!error) success = true;
    }

    setSubmitting(false);
    if (success) {
      setSent(true);
      toast.addToast('success', 'Service request submitted successfully!');
    } else {
      toast.addToast('error', 'Failed to submit request. Please try again.');
    }
  };

  return (
    <div className="container-page py-12">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <Droplets className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-navy-900">
            {t('borewell.title', 'Borewell Services')}
          </h1>
          <p className="mt-1 text-navy-600">
            {t('borewell.subtitle', 'Professional borewell drilling, maintenance & repair — tell us what you need.')}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Card className="p-6">
          {sent ? (
            <EmptyState
              title={t('borewell.sentTitle', 'Request received!')}
              description={t('borewell.sentDesc', "Our borewell team will contact you within 24 hours.")}
            />
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
                label={t('borewell.location', 'Property Location')}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder={t('borewell.locationPlaceholder', 'City / locality')}
              />
              <Textarea
                label={t('borewell.requirement', 'What do you need?')}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder={t('borewell.requirementPlaceholder', 'New drilling, repair, maintenance, pump installation...')}
              />
              <Button type="submit" loading={submitting}>
                {t('borewell.requestCallback', 'Request a Callback')}
              </Button>
            </form>
          )}
        </Card>

        <Card className="p-6 h-fit">
          <h2 className="font-display font-semibold text-navy-900">{t('contact.detailsHeader', 'Contact Details')}</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-red-600" /> <span className="text-navy-700">+91 94942 30774</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-red-600" /> <span className="text-navy-700">info@realtynow.in</span>
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-navy-600">
            <li>• {t('borewell.point1', 'Hydro survey & site assessment')}</li>
            <li>• {t('borewell.point2', 'High success rate drilling team')}</li>
            <li>• {t('borewell.point3', 'Pump installation & maintenance')}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

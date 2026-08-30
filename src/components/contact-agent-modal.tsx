import React, { useState, useEffect } from 'react';
import { ShieldCheck, MapPin, Send, CheckCircle2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ensureUserProfile } from '../lib/profile-utils';
import { Modal, Button, Input, Textarea } from './ui';
import { useToast } from './toast';
import { normalizePhoneNumber } from '../lib/utils';

export interface AgentDetails {
  id?: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  avatar_url?: string | null;
  profile_image_url?: string | null;
  company?: string | null;
  location?: string | null;
  is_verified?: boolean;
}

export interface ContactAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: {
    id: string;
    title: string;
    assigned_agent_id?: string | null;
    owner_id?: string | null;
    city_name?: string | null;
    locality_name?: string | null;
  };
  agentOverride?: AgentDetails | null;
}

export const ContactAgentModal: React.FC<ContactAgentModalProps> = ({
  isOpen,
  onClose,
  property,
  agentOverride,
}) => {
  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [agent, setAgent] = useState<AgentDetails | null>(agentOverride ?? null);
  const [loadingAgent, setLoadingAgent] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Prefill customer details when opened
  useEffect(() => {
    if (isOpen) {
      setSubmitted(false);
      setErrorMsg('');
      const defaultName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
        : user?.user_metadata?.full_name || '';
      setName(defaultName);
      setPhone(profile?.phone || user?.phone || '');
      setEmail(profile?.email || user?.email || '');
      setMessage('');
    }
  }, [isOpen, profile, user]);

  // Fetch assigned agent if not provided via agentOverride
  useEffect(() => {
    if (!isOpen) return;

    if (agentOverride) {
      setAgent(agentOverride);
      return;
    }

    const agentId = property.assigned_agent_id || property.owner_id;
    if (!agentId) {
      setAgent(null);
      return;
    }

    let isMounted = true;
    setLoadingAgent(true);

    supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone, whatsapp_number, avatar_url, profile_image_url, company, status')
      .eq('id', agentId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        setLoadingAgent(false);
        if (!error && data) {
          const fullName = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || 'Assigned Agent';
          setAgent({
            id: data.id,
            name: fullName,
            email: data.email,
            phone: data.phone,
            avatar_url: data.avatar_url || data.profile_image_url,
            company: data.company || 'RealtyNow Verified Partner',
            is_verified: true,
          });
        } else {
          setAgent({
            name: 'RealtyNow Property Advisor',
            company: 'RealtyNow Concierge Team',
            is_verified: true,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, property.assigned_agent_id, property.owner_id, agentOverride]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submitted) return;

    if (!name.trim()) {
      setErrorMsg('Please enter your full name');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Please enter your phone number');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      if (user?.id) {
        await ensureUserProfile(user.id);
      }
      const normalizedPhone = normalizePhoneNumber(phone);
      const agentId = agent?.id || property.assigned_agent_id || property.owner_id || null;

      // 1. Try canonical RPC
      const { data, error } = await supabase.rpc('submit_contact_lead', {
        p_property_id: property.id,
        p_agent_id: agentId,
        p_name: name.trim(),
        p_phone: normalizedPhone,
        p_email: email.trim() || null,
        p_message: message.trim() || null,
      });

      if (error || (data && (data as any)?.success === false)) {
        console.warn('submit_contact_lead RPC returned error or false, attempting direct insert:', error || data);

        // 2. Direct insert with full fields
        const insertPayload: Record<string, any> = {
          property_id: property.id,
          customer_id: user?.id ?? null,
          name: name.trim(),
          phone: normalizedPhone,
          email: email.trim() || null,
          message: message.trim() || null,
          source: 'property_contact_agent',
          lead_status: 'new',
          status: 'new',
        };

        if (agentId) {
          insertPayload.agent_id = agentId;
          insertPayload.assigned_to = agentId;
          insertPayload.assigned_at = new Date().toISOString();
        }

        let { error: directError } = await supabase.from('enquiries').insert(insertPayload);

        // If FK constraint error on agent_id (e.g. agent_id not in auth.users), fallback by keeping assigned_to
        if (directError && (directError.code === '23503' || directError.message?.toLowerCase().includes('foreign key') || directError.message?.toLowerCase().includes('agent_id'))) {
          console.warn('FK constraint error on agent_id, retrying with assigned_to only:', directError);
          delete insertPayload.agent_id;
          const retryRes = await supabase.from('enquiries').insert(insertPayload);
          directError = retryRes.error;
        }

        // If column error, retry with minimal core schema
        if (directError) {
          console.warn('Direct insert failed, attempting minimal core enquiry insert:', directError);
          const minimalPayload: Record<string, any> = {
            property_id: property.id,
            customer_id: user?.id ?? null,
            name: name.trim(),
            phone: normalizedPhone,
            email: email.trim() || null,
            message: message.trim() || null,
            status: 'new',
          };
          if (agentId) {
            minimalPayload.assigned_to = agentId;
          }
          const minimalRetry = await supabase.from('enquiries').insert(minimalPayload);
          if (minimalRetry.error) {
            console.error('All enquiry insertion tiers failed:', minimalRetry.error);
            throw minimalRetry.error;
          }
        }
      }

      setSubmitted(true);
      addToast('success', 'Enquiry sent successfully!');
    } catch (err: unknown) {
      console.error('Contact agent submission failed:', err);
      setErrorMsg('Unable to submit your enquiry right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const agentDisplayName = agent?.name || 'RealtyNow Property Advisor';
  const agentCompany = agent?.company || 'Verified Partner';
  const agentAvatar = agent?.avatar_url || agent?.profile_image_url;

  return (
    <Modal open={isOpen} onClose={onClose} title="Contact Us" size="md">
      {submitted ? (
        <div className="py-6 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-navy-900">Enquiry Submitted</h3>
            <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto">
              Thank you, <strong className="text-navy-900">{name.trim()}</strong>.
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              <strong className="text-navy-900">{agentDisplayName}</strong> will contact you shortly regarding <strong className="text-navy-900">{property.title}</strong>.
            </p>
          </div>
          <div className="pt-4">
            <Button variant="primary" onClick={onClose} className="w-full sm:w-auto px-8">
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Agent Information Header */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-50/70 via-slate-50 to-white border border-red-100 shadow-sm">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 border border-white shadow-md shrink-0 flex items-center justify-center">
              {loadingAgent ? (
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              ) : agentAvatar ? (
                <img src={agentAvatar} alt={agentDisplayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-slate-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-bold text-navy-900 text-base leading-snug truncate">
                  {agentDisplayName}
                </h4>
                {agent?.is_verified !== false && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Agent
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{agentCompany}</p>
              {(property.locality_name || property.city_name) && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 truncate">
                  <MapPin className="w-3 h-3 text-red-500" />
                  {[property.locality_name, property.city_name].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Interested in <strong className="text-navy-900">{property.title}</strong>? Send your details and the agent will contact you shortly.
          </p>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Email Address <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="email"
                placeholder="rahul@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Message <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </label>
              <Textarea
                rows={3}
                placeholder="I would like more information regarding pricing and site visit..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
              >
                {submitting ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Enquiry
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
};

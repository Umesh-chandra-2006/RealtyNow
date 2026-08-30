import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, CheckCircle2, Video, Home as HomeIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ensureUserProfile } from '../lib/profile-utils';
import { Modal, Button, Input, Textarea } from './ui';
import { useToast } from './toast';
import { normalizePhoneNumber } from '../lib/utils';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../lib/property-images';

export interface BookVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: {
    id: string;
    title: string;
    images?: string[] | null;
    cover_image_url?: string | null;
    city_name?: string | null;
    locality_name?: string | null;
    assigned_agent_id?: string | null;
    owner_id?: string | null;
  };
}

const TIME_SLOTS = [
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

export const BookVisitModal: React.FC<BookVisitModalProps> = ({
  isOpen,
  onClose,
  property,
}) => {
  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('11:00 AM');
  const [visitType, setVisitType] = useState<'Property Visit' | 'Virtual Visit'>('Property Visit');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Minimum date = tomorrow
  const minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

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
      setPreferredDate(minDate);
      setTimeSlot('11:00 AM');
      setVisitType('Property Visit');
      setMessage('');
    }
  }, [isOpen, profile, user, minDate]);

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
    if (!preferredDate) {
      setErrorMsg('Please select a preferred date');
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
      const agentId = property.assigned_agent_id || property.owner_id || null;

      // 1. Call canonical visit RPC (creates/updates Lead + Appointment + Notification)
      const { data, error } = await supabase.rpc('submit_visit_request', {
        p_property_id: property.id,
        p_agent_id: agentId,
        p_name: name.trim(),
        p_phone: normalizedPhone,
        p_email: email.trim() || null,
        p_preferred_date: preferredDate,
        p_time_slot: timeSlot,
        p_visit_type: visitType,
        p_message: message.trim() || null,
      });

      if (error) {
        console.warn('submit_visit_request RPC returned error, attempting direct insert:', error);
        const scheduledTime = new Date(
          `${preferredDate}T${timeSlot.includes('PM') && !timeSlot.startsWith('12') ? parseInt(timeSlot) + 12 : timeSlot.split(':')[0]}:00:00`
        ).toISOString();

        // 2. Create or find Lead first
        let leadId: string | null = null;
        try {
          const { data: leadRes } = await supabase
            .from('enquiries')
            .insert({
              property_id: property.id,
              agent_id: agentId,
              assigned_to: agentId,
              customer_id: user?.id ?? null,
              name: name.trim(),
              phone: normalizedPhone,
              email: email.trim() || null,
              message: `Requested ${visitType} on ${preferredDate} at ${timeSlot}`,
              source: 'site_visit',
              lead_status: 'site_visit',
              status: 'contacted',
              priority: 'high',
              follow_up_at: scheduledTime,
            })
            .select('id')
            .maybeSingle();
          leadId = leadRes?.id ?? null;
        } catch {
          // Non-blocking
        }

        // 3. Direct insert into appointments
        const insertPayload: Record<string, any> = {
          property_id: property.id,
          customer_id: user?.id ?? null,
          lead_id: leadId,
          name: name.trim(),
          phone: normalizedPhone,
          email: email.trim() || null,
          preferred_date: preferredDate,
          time_slot: timeSlot,
          visit_type: visitType,
          scheduled_at: scheduledTime,
          notes: message.trim() || null,
          status: 'requested',
          source: 'book_a_visit',
        };

        if (agentId) {
          insertPayload.agent_id = agentId;
        }

        let { error: directError } = await supabase.from('appointments').insert(insertPayload);

        if (directError && (directError.code === '23503' || directError.message?.toLowerCase().includes('foreign key'))) {
          delete insertPayload.agent_id;
          delete insertPayload.lead_id;
          const retryRes = await supabase.from('appointments').insert(insertPayload);
          directError = retryRes.error;
        }

        if (directError) {
          const minimalPayload: Record<string, any> = {
            property_id: property.id,
            customer_id: user?.id ?? null,
            scheduled_at: scheduledTime,
            notes: `${name.trim()} (${normalizedPhone}) - ${visitType}: ${message.trim() || 'No additional notes'}`,
            status: 'requested',
          };
          const minimalRetry = await supabase.from('appointments').insert(minimalPayload);
          if (minimalRetry.error) {
            console.error('All appointment insertion tiers failed:', minimalRetry.error);
            throw minimalRetry.error;
          }
        }
      }

      setSubmitted(true);
      addToast('success', 'Visit request submitted successfully!');
    } catch (err: unknown) {
      console.error('Book visit submission failed:', err);
      setErrorMsg('Unable to submit your visit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const thumbnail = getPropertyCoverImage(property as any);

  return (
    <Modal open={isOpen} onClose={onClose} title="Book a Property Visit" size="md">
      {submitted ? (
        <div className="py-6 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-navy-900">Visit Request Submitted Successfully</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Your request for <strong className="text-navy-900">{property.title}</strong> on{' '}
              <strong className="text-navy-900">{preferredDate}</strong> at <strong className="text-navy-900">{timeSlot}</strong> ({visitType}) has been logged. The agent will contact you to confirm.
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
          {/* Property Context Header */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-200 shrink-0">
              <img
                src={thumbnail}
                alt={property.title}
                onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-navy-900 text-sm truncate">{property.title}</h4>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                {[property.locality_name, property.city_name].filter(Boolean).join(', ') || 'Hyderabad'}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Visit Type Toggle */}
            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1.5">Visit Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisitType('Property Visit')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                    visitType === 'Property Visit'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <HomeIcon className="w-4 h-4" /> In-Person Visit
                </button>
                <button
                  type="button"
                  onClick={() => setVisitType('Virtual Visit')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                    visitType === 'Virtual Visit'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Video className="w-4 h-4" /> Video / Virtual Tour
                </button>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy-800 mb-1">
                  Preferred Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  min={minDate}
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-800 mb-1">
                  Preferred Time Slot <span className="text-red-500">*</span>
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-navy-900 focus:outline-none focus:border-red-500"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contact Details */}
            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Anish Kumar"
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
                placeholder="anish@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Notes / Special Requests <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </label>
              <Textarea
                rows={2}
                placeholder="Any special requirements or instructions..."
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
                  <>Submitting...</>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" /> Request Visit
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

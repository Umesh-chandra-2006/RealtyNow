import React from 'react';
import {
  MessageSquare,
  Ticket,
  Mail,
  Phone,
  MessageCircle,
  Clock,
  ArrowRight,
  Headphones,
} from 'lucide-react';
import type { SupportContactConfig } from '../../lib/support';

interface ContactSupportPanelProps {
  config: SupportContactConfig;
  onRaiseTicket: () => void;
  onOpenLiveChat: () => void;
}

export const ContactSupportPanel: React.FC<ContactSupportPanelProps> = ({
  config,
  onRaiseTicket,
  onOpenLiveChat,
}) => {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
            <Headphones className="h-3.5 w-3.5" />
            <span>Dedicated Customer Assistance</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            Still Need Help? Contact Our Support Team
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Choose your preferred support channel. We are here to assist with all your property and account needs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-center">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>{config.operatingHours}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Live Chat Channel */}
        {config.liveChatEnabled && (
          <div className="flex flex-col justify-between rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 via-white to-white p-5 hover:border-blue-300 hover:shadow-md transition">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white mb-3 shadow-md shadow-blue-600/20">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-base text-slate-900">Live Chat</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect instantly with our support team or AI assistant for fast answers.
              </p>
            </div>
            <button
              onClick={onOpenLiveChat}
              className="mt-4 flex items-center justify-between w-full rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
            >
              <span>Start Live Chat</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Support Ticket Channel */}
        {config.ticketSystemEnabled && (
          <div className="flex flex-col justify-between rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/50 via-white to-white p-5 hover:border-red-300 hover:shadow-md transition">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white mb-3 shadow-md shadow-red-600/20">
                <Ticket className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-base text-slate-900">Raise a Support Ticket</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Create a tracked ticket with screenshots, property references, and escalation options.
              </p>
            </div>
            <button
              onClick={onRaiseTicket}
              className="mt-4 flex items-center justify-between w-full rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer"
            >
              <span>Create Ticket</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Email Support */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-md transition">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 mb-3">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900">Email Support</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {config.email ? (
                <>Reach our helpdesk directly at <span className="font-semibold text-slate-800">{config.email}</span>.</>
              ) : (
                'Submit your request through our online ticket system for priority email updates.'
              )}
            </p>
          </div>
          {config.email ? (
            <a
              href={`mailto:${config.email}`}
              className="mt-4 flex items-center justify-between w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              <span>Send Email</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              onClick={onRaiseTicket}
              className="mt-4 flex items-center justify-between w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <span>Submit via Ticket</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Phone Support (if configured) */}
        {config.phone && (
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-md transition">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-3">
                <Phone className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-base text-slate-900">Phone Support</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Call our support desk during business hours: <span className="font-semibold text-slate-800">{config.phone}</span>
              </p>
            </div>
            <a
              href={`tel:${config.phone}`}
              className="mt-4 flex items-center justify-between w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
            >
              <span>Call Now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* WhatsApp Support (if configured) */}
        {config.whatsapp && (
          <div className="flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5 hover:border-emerald-300 hover:shadow-md transition">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white mb-3 shadow-md shadow-emerald-600/20">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-base text-slate-900">WhatsApp Helpdesk</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Chat with our representative on WhatsApp for quick inquiries.
              </p>
            </div>
            <a
              href={`https://wa.me/${config.whatsapp.replace(/[^0-9]/g, '')}?text=Hello%20RealtyNow%20Support`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-between w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
            >
              <span>Chat on WhatsApp</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

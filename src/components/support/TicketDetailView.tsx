import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Send,
  ShieldAlert,
  Loader2,
  Building2,
  User,
  Shield,
  Bot,
  Check,
  X,
  Download,
} from 'lucide-react';
import {
  fetchSupportTicketDetails,
  sendTicketReply,
  escalateSupportTicket,
  closeSupportTicket,
  uploadSupportAttachment,
  type SupportTicket,
  type SupportMessage,
  type SupportStatusHistory,
} from '../../lib/support';
import { useAuth } from '../../lib/auth';
import { useToast } from '../toast';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

interface TicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({ ticketId, onBack }) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [history, setHistory] = useState<SupportStatusHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Error and diagnostic states
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Reply Form State
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyFile, setReplyFile] = useState<File | null>(null);

  // Escalation Dialog State
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);

  // Close Confirmation State
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTicket = async () => {
    setIsLoading(true);
    setLoadError(null);
    setIsNotFound(false);
    setIsUnauthorized(false);

    try {
      const res = await fetchSupportTicketDetails(ticketId);
      if (res.error) {
        setLoadError(res.error);
        if (res.isNotFound) setIsNotFound(true);
        if (res.isUnauthorized) setIsUnauthorized(true);
      } else if (!res.ticket) {
        setIsNotFound(true);
      } else {
        setTicket(res.ticket);
        setMessages(res.messages);
        setHistory(res.history);
      }
    } catch (err: any) {
      console.error('Error loading ticket:', err);
      setLoadError(err?.message || 'Failed to load ticket conversation.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    if (!ticket?.id) return;

    // Supabase Realtime channel for live messages on this ticket using its database UUID
    const channel = supabase
      .channel(`support_ticket_messages_${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const newMsg = payload.new as SupportMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `id=eq.${ticket.id}`,
        },
        (payload) => {
          setTicket((prev) => (prev ? { ...prev, ...(payload.new as SupportTicket) } : (payload.new as SupportTicket)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !ticket) return;
    if (!replyText.trim() && !replyFile) {
      addToast('error', 'Please enter a message or attach a file.');
      return;
    }

    setIsSending(true);

    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let attachmentType: string | undefined;

      if (replyFile) {
        const uploadRes = await uploadSupportAttachment(replyFile, user.id);
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
        attachmentType = uploadRes.type;
      }

      await sendTicketReply({
        ticketId: ticket.id,
        senderId: user.id,
        senderType: 'customer',
        message: replyText.trim() || 'Attached file for review.',
        attachmentUrl,
        attachmentName,
        attachmentType,
      });

      setReplyText('');
      setReplyFile(null);
      addToast('success', 'Reply sent successfully.');
      loadTicket();
    } catch (err: any) {
      console.error('Send reply error:', err);
      addToast('error', err.message || 'Could not send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleEscalateSubmit = async () => {
    if (!user || !ticket || !escalateReason.trim()) {
      addToast('error', 'Please select or provide a reason for escalation.');
      return;
    }

    setIsEscalating(true);
    try {
      await escalateSupportTicket(ticket.id, user.id, escalateReason.trim());
      addToast('success', 'Ticket has been escalated to senior support management.');
      setShowEscalateModal(false);
      loadTicket();
    } catch (err: any) {
      console.error('Escalation error:', err);
      addToast('error', err.message || 'Could not escalate ticket.');
    } finally {
      setIsEscalating(false);
    }
  };

  const handleCloseTicketSubmit = async () => {
    if (!user || !ticket) return;
    setIsClosing(true);
    try {
      await closeSupportTicket(ticket.id, user.id);
      addToast('success', 'Support ticket marked as Closed.');
      setShowCloseModal(false);
      loadTicket();
    } catch (err: any) {
      console.error('Close ticket error:', err);
      addToast('error', err.message || 'Could not close ticket.');
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-32 rounded-xl bg-slate-200 animate-pulse" />
        <div className="h-48 rounded-3xl bg-slate-200 animate-pulse" />
        <div className="h-96 rounded-3xl bg-slate-200 animate-pulse" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center space-y-4 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900">
            {isUnauthorized
              ? 'Access Restricted'
              : isNotFound
              ? 'Support Ticket Not Found'
              : 'Unable to Load Support Ticket'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            {isUnauthorized
              ? 'You do not have permission to view this ticket. Please ensure you are logged into the account that created it.'
              : isNotFound
              ? `The ticket "${ticketId}" could not be located in our support records.`
              : (loadError || 'A database or connection issue prevented loading the ticket conversation.')}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onBack}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Back to Support Tickets
          </button>
          {!isNotFound && !isUnauthorized && (
            <button
              onClick={loadTicket}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4-Stage Support Progress Timeline
  const isClosed = ticket.status === 'Closed';
  const isResolved = ticket.status === 'Resolved' || isClosed;
  const isInProgress = ['In Progress', 'Waiting for Customer', 'Waiting for Internal Team', 'Resolved', 'Closed'].includes(ticket.status);
  const isAssigned = ['Assigned', 'In Progress', 'Waiting for Customer', 'Waiting for Internal Team', 'Resolved', 'Closed'].includes(ticket.status);

  return (
    <div className="space-y-6">
      {/* Top Back Navigation & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-red-600 bg-white border border-slate-200 px-3.5 py-2 rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to My Tickets</span>
        </button>

        <div className="flex items-center gap-2">
          {!ticket.is_escalated && !isClosed && (
            <button
              onClick={() => setShowEscalateModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
              <span>Request Escalation</span>
            </button>
          )}

          {!isClosed && (
            <button
              onClick={() => setShowCloseModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 text-slate-500" />
              <span>Mark Resolved / Close</span>
            </button>
          )}
        </div>
      </div>

      {/* Ticket Overview Header Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-black text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-xl">
                #{ticket.ticket_number}
              </span>
              <span
                className={cn(
                  'text-xs font-bold px-2.5 py-1 rounded-full border',
                  ticket.status === 'Resolved'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : ticket.status === 'Closed'
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
                )}
              >
                {ticket.status}
              </span>
              <span
                className={cn(
                  'text-xs font-bold px-2.5 py-1 rounded-full border',
                  ticket.priority === 'Urgent'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : ticket.priority === 'High'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                )}
              >
                Priority: {ticket.priority}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {ticket.category}
              </span>
              {ticket.is_escalated && (
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Escalated to Senior Management</span>
                </span>
              )}
            </div>

            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              {ticket.subject}
            </h1>

            {ticket.properties && (
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
                <Building2 className="h-3.5 w-3.5 text-red-500" />
                <span>Related Property: <strong className="text-slate-900">{ticket.properties.title}</strong></span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 lg:text-right shrink-0 space-y-1">
            <p>Created: {format(new Date(ticket.created_at), 'MMM dd, yyyy • h:mm a')}</p>
            <p>Last Activity: {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}</p>
            {ticket.assigned_profile && (
              <p className="font-semibold text-slate-700">
                Assigned Officer: {ticket.assigned_profile.first_name} {ticket.assigned_profile.last_name || ''}
              </p>
            )}
          </div>
        </div>

        {/* 4-Stage Transparent Support Progress Timeline */}
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Resolution Progress
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            {/* Step 1: Created */}
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-900 truncate">Ticket Created</p>
                <p className="text-[10px] text-emerald-700 truncate">
                  {format(new Date(ticket.created_at), 'h:mm a')}
                </p>
              </div>
            </div>

            {/* Step 2: Assigned */}
            <div
              className={cn(
                'flex items-center gap-2.5 p-3 rounded-2xl border transition',
                isAssigned
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full shrink-0',
                  isAssigned ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                )}
              >
                {isAssigned ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">2</span>}
              </div>
              <div className="min-w-0">
                <p className={cn('text-xs font-bold truncate', isAssigned ? 'text-emerald-900' : 'text-slate-500')}>
                  Assigned Team
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {isAssigned ? 'Helpdesk Review' : 'Pending'}
                </p>
              </div>
            </div>

            {/* Step 3: Investigation */}
            <div
              className={cn(
                'flex items-center gap-2.5 p-3 rounded-2xl border transition',
                isInProgress
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full shrink-0',
                  isResolved
                    ? 'bg-emerald-600 text-white'
                    : isInProgress
                    ? 'bg-blue-600 text-white animate-pulse'
                    : 'bg-slate-200 text-slate-400'
                )}
              >
                {isResolved ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className={cn('text-xs font-bold truncate', isInProgress ? 'text-blue-900' : 'text-slate-500')}>
                  Investigation
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {isInProgress ? 'In Progress' : 'Pending'}
                </p>
              </div>
            </div>

            {/* Step 4: Resolution */}
            <div
              className={cn(
                'flex items-center gap-2.5 p-3 rounded-2xl border transition',
                isResolved
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full shrink-0',
                  isResolved ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                )}
              >
                {isResolved ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">4</span>}
              </div>
              <div className="min-w-0">
                <p className={cn('text-xs font-bold truncate', isResolved ? 'text-emerald-900' : 'text-slate-500')}>
                  Resolution
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {isResolved ? 'Completed' : 'Pending'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Messages Thread */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40 space-y-6">
        <h3 className="font-display font-bold text-base text-slate-900 flex items-center justify-between">
          <span>Conversation History</span>
          <span className="text-xs font-semibold text-slate-400">{messages.length} messages</span>
        </h3>

        <div className="space-y-4">
          {messages.map((msg) => {
            const isCustomer = msg.sender_type === 'customer';
            const isSystem = msg.sender_type === 'system';

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="mx-auto my-3 max-w-lg rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center text-xs font-medium text-slate-600 shadow-2xs"
                >
                  <span>{msg.message}</span>
                  <span className="ml-2 text-[10px] text-slate-400">
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3 max-w-2xl',
                  isCustomer ? 'ml-auto flex-row-reverse' : 'mr-auto'
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl shrink-0 text-white font-bold text-xs shadow-xs',
                    isCustomer ? 'bg-red-600' : msg.sender_type === 'ai' ? 'bg-indigo-600' : 'bg-navy-900'
                  )}
                >
                  {isCustomer ? (
                    <User className="h-4.5 w-4.5" />
                  ) : msg.sender_type === 'ai' ? (
                    <Bot className="h-4.5 w-4.5" />
                  ) : (
                    <Shield className="h-4.5 w-4.5" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={cn(
                    'rounded-2xl p-4 space-y-2 border text-sm',
                    isCustomer
                      ? 'bg-red-600 text-white border-red-600 rounded-tr-xs shadow-md shadow-red-600/10'
                      : 'bg-slate-50 text-slate-800 border-slate-200 rounded-tl-xs'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-between gap-4 text-[11px] font-bold border-b pb-1.5',
                      isCustomer ? 'border-white/20 text-white/80' : 'border-slate-200 text-slate-500'
                    )}
                  >
                    <span>
                      {isCustomer
                        ? 'You (Customer)'
                        : msg.sender_type === 'ai'
                        ? 'RealtyNow AI Support Assistant'
                        : `RealtyNow Support Officer ${msg.sender_profile?.first_name ? `(${msg.sender_profile.first_name})` : ''}`}
                    </span>
                    <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                  </div>

                  <p className="leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                    {msg.message}
                  </p>

                  {/* Attachment Preview */}
                  {msg.attachment_url && (
                    <div
                      className={cn(
                        'mt-2.5 flex items-center justify-between rounded-xl p-2.5 text-xs font-semibold',
                        isCustomer ? 'bg-white/15 text-white' : 'bg-white border border-slate-200 text-slate-800'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="h-4 w-4 shrink-0" />
                        <span className="truncate">{msg.attachment_name || 'Attached Document'}</span>
                      </div>
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'p-1 rounded-lg hover:bg-white/20 transition shrink-0 ml-2',
                          isCustomer ? 'text-white' : 'text-slate-600'
                        )}
                        title="Download attachment"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Composer Form */}
        {!isClosed ? (
          <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-100 space-y-3">
            <div className="relative">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your response to support team here..."
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none transition"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Attachment Picker */}
              <div>
                {replyFile ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800">
                    <Paperclip className="h-3.5 w-3.5 text-red-500" />
                    <span className="max-w-[150px] truncate">{replyFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setReplyFile(null)}
                      className="p-0.5 text-slate-400 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-red-600 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Attach Screenshot / File</span>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setReplyFile(file);
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Submit Reply Button */}
              <button
                type="submit"
                disabled={isSending || (!replyText.trim() && !replyFile)}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending Response...</span>
                  </>
                ) : (
                  <>
                    <span>Send Message</span>
                    <Send className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium">
            This support ticket is marked as Closed. If you need further assistance, please raise a new ticket.
          </div>
        )}
      </div>

      {/* Escalation Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-amber-600">
              <div className="p-2 rounded-xl bg-amber-100">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">Request Escalation</h3>
                <p className="text-xs text-slate-500">Escalate to Senior Support Management</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If your request requires urgent executive attention or has not progressed as expected, please state your reason:
            </p>

            <div className="space-y-2">
              {[
                'Listing remains blocked or unverified beyond standard SLA',
                'Payment deduction error requiring urgent refund review',
                'Incorrect or unhelpful response received from representative',
                'Critical security or fraudulent account concern',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setEscalateReason(reason)}
                  className={cn(
                    'w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer',
                    escalateReason === reason
                      ? 'border-amber-400 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="Or explain reason for escalation..."
              rows={2}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowEscalateModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEscalateSubmit}
                disabled={isEscalating || !escalateReason.trim()}
                className="px-4 py-2 rounded-xl bg-amber-600 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isEscalating ? 'Escalating...' : 'Confirm Escalation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Ticket Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900">Close Support Ticket?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Mark this issue as resolved. You can always raise a new ticket if needed.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseTicketSubmit}
                disabled={isClosing}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
              >
                {isClosing ? 'Closing...' : 'Yes, Mark Closed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

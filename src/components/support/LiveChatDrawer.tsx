import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../toast';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

interface LiveChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRaiseTicket: () => void;
}

interface ChatMessage {
  id: string;
  sender_type: 'customer' | 'ai' | 'admin' | 'system';
  message: string;
  created_at: string;
}

const QUICK_PROMPTS = [
  'How to list my property?',
  'Why is my listing in verification?',
  'What are the Pro plan benefits?',
  'How to contact human support agent?',
];

export const LiveChatDrawer: React.FC<LiveChatDrawerProps> = ({
  isOpen,
  onClose,
  onRaiseTicket,
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender_type: 'ai',
      message:
        "Hello! I'm your RealtyNow Support Assistant. How can I help you with your property listings, searches, payments, or account today?",
      created_at: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages.length]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const msg = (textToSend || inputText).trim();
    if (!msg) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender_type: 'customer',
      message: msg,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    // AI automated assistant response logic for common questions
    setTimeout(() => {
      let reply = '';
      const lower = msg.toLowerCase();

      if (lower.includes('list') || lower.includes('post') || lower.includes('sell')) {
        reply =
          'You can list properties by going to "List Property" in your portal. Free accounts can publish up to 5 active properties every month!';
      } else if (lower.includes('verif') || lower.includes('approval') || lower.includes('review')) {
        reply =
          'Our verification team reviews all listings within 4-12 hours to verify title details, coordinates, and photo quality.';
      } else if (lower.includes('pro') || lower.includes('premium') || lower.includes('plan') || lower.includes('subscription')) {
        reply =
          'RealtyNow Pro unlocks unlimited listings, verified builder badges, priority buyer leads, and AI property valuations. Check "Subscription" tab in your portal.';
      } else if (lower.includes('human') || lower.includes('agent') || lower.includes('talk') || lower.includes('call')) {
        reply =
          'You can connect with our dedicated human support team by raising a support ticket or selecting a contact channel in the Help Center.';
      } else {
        reply =
          'Thank you for reaching out! For detailed resolution, you can also raise a dedicated Support Ticket with file attachments and track its timeline.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender_type: 'ai',
          message: reply,
          created_at: new Date().toISOString(),
        },
      ]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Chat Header */}
      <div className="px-5 py-4 bg-navy-950 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white font-bold shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-navy-950" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-white">RealtyNow Live Assistant</h3>
            <p className="text-[11px] text-emerald-400 font-medium">Online • Instant Support</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 custom-scrollbar text-xs">
        {messages.map((m) => {
          const isUser = m.sender_type === 'customer';

          return (
            <div
              key={m.id}
              className={cn('flex gap-2 max-w-[85%]', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full shrink-0 text-white text-[10px] font-bold mt-1',
                  isUser ? 'bg-red-600' : 'bg-navy-900'
                )}
              >
                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>

              <div
                className={cn(
                  'p-3 rounded-2xl space-y-1',
                  isUser
                    ? 'bg-red-600 text-white rounded-tr-xs shadow-xs'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-xs'
                )}
              >
                <p className="leading-relaxed whitespace-pre-line">{m.message}</p>
                <div
                  className={cn(
                    'text-[9px] flex items-center justify-end gap-1',
                    isUser ? 'text-white/70' : 'text-slate-400'
                  )}
                >
                  <span>{format(new Date(m.created_at), 'h:mm a')}</span>
                  {isUser && <CheckCheck className="h-3 w-3 text-white/80" />}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic bg-white p-2.5 rounded-2xl border border-slate-200/80 max-w-[120px] shadow-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
            <span>Typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Quick Prompts */}
      <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendMessage(prompt)}
            className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600 whitespace-nowrap transition cursor-pointer shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-red-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="p-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-2 text-center">
          <button
            onClick={() => {
              onClose();
              onRaiseTicket();
            }}
            className="text-[11px] font-bold text-red-600 hover:underline"
          >
            Need a tracked ticket instead? Click here
          </button>
        </div>
      </div>
    </div>
  );
};

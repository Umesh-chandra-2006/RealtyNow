import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { Spinner } from './ui';
import { callAI } from '../lib/ai';
import { useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useLanguageContext } from '../lib/i18n/language-context';
import { VoiceSearchButton } from './voice-search-button';
import { generateSpeech } from '../lib/elevenlabs';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIAssistant({ context }: { context?: string }) {
  const { t } = useLanguageContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  // AI Hub page has its own embedded assistant, and portal/admin/dashboard routes
  // have data tables and forms — hide floating widget there so it doesn't block action buttons.
  const hidden =
    ['/ai-advisor', '/ai-property-advisor', '/ai_property_advisor', '/ai-hub'].includes(
      location.pathname,
    ) ||
    location.pathname.startsWith('/portal') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/agent') ||
    location.pathname.startsWith('/builder') ||
    location.pathname.startsWith('/partner');

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: t(
          'ai.welcomeMessage',
          "Hi! I'm RealtyNow's AI assistant. Ask me about properties, listings, or real estate in general.",
        ),
      },
    ]);
  }, [t]);

  const quickPrompts = [
    t('ai.quickPrompt1', 'Find 3BHK apartments under 1 crore in Mumbai'),
    t('ai.quickPrompt2', 'What documents do I need to list a property?'),
    t('ai.quickPrompt3', 'Suggest areas in Hyderabad for renting under 30k'),
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      setOpen(true);
      const customEv = e as CustomEvent<{ prompt?: string }>;
      if (customEv.detail?.prompt) {
        send(customEv.detail.prompt);
      }
    };
    window.addEventListener('open-ai-assistant', handleOpen);
    return () => window.removeEventListener('open-ai-assistant', handleOpen);
  }, []);

  const send = async (text: string, isVoice = false) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const result = await callAI('chat', { message: text, context });
      setMessages((m) => [...m, { role: 'assistant', content: result }]);
      if (isVoice) {
        generateSpeech(result);
      }
    } catch (err) {
      const errorMsg = `${t('ai.errorMessage', "Sorry, I couldn't process that.")} ${err instanceof Error ? err.message : t('ai.tryAgain', 'Try again.')}`;
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: errorMsg,
        },
      ]);
      if (isVoice) {
        generateSpeech(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (hidden) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 md:bottom-10 right-3 md:right-6 z-40 flex flex-col items-end gap-2.5 md:gap-3 pointer-events-none pb-safe">
        <a
          href={`https://wa.me/919494230774?text=${encodeURIComponent('Hi RealtyNow, I would like to inquire about your property services.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-cardHover transition hover:bg-[#20bd5a] pointer-events-auto"
          aria-label="Chat on WhatsApp"
        >
          <svg className="h-5 w-5 md:h-6 md:w-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
        </a>
        <button
          onClick={() => setOpen(true)}
          aria-label={t('ai.assistant', 'AI Assistant')}
          className="flex h-10 w-10 items-center justify-center gap-2 rounded-full bg-navy-700 p-0 text-sm font-bold text-white shadow-cardHover transition hover:bg-navy-800 pointer-events-auto md:h-auto md:w-auto md:rounded-full md:px-4 md:py-3"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-gold-400" /> <span className="hidden md:inline">{t('ai.assistant', 'AI Assistant')}</span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 flex h-[520px] max-h-[calc(100dvh-5rem)] w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-cardHover"
            >
              <div className="flex items-center justify-between border-b border-navy-100 bg-navy-700 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                    <Bot className="h-5 w-5 text-gold-400" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-semibold">{t('ai.title', 'RealtyNow AI')}</p>
                    <p className="text-xs text-navy-300">{t('ai.online', 'Online')}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-navy-50/30">
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
                        m.role === 'user'
                          ? 'bg-navy-700 text-white rounded-br-sm'
                          : 'bg-white border border-navy-100 text-navy-800 rounded-bl-sm',
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-white border border-navy-100 px-3.5 py-2.5">
                      <Spinner className="h-4 w-4 text-navy-500" />
                    </div>
                  </div>
                )}
                {messages.length === 1 && !loading && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-navy-400">{t('ai.tryAsking', 'Try asking:')}</p>
                    {quickPrompts.map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="block w-full rounded-lg border border-navy-100 bg-white px-3 py-2 text-left text-xs text-navy-700 hover:border-navy-300 hover:bg-navy-50"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 border-t border-navy-100 bg-white p-3"
              >
                <div className="relative flex-1 flex items-center">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('ai.placeholder', 'Type your message...')}
                    className="w-full rounded-lg border border-navy-200 py-2 pl-3 pr-10 text-sm focus:border-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-200"
                  />
                  <div className="absolute right-1">
                    <VoiceSearchButton
                      onResult={(text) => {
                        send(text, true);
                      }}
                      className="h-7 w-7 !p-0 rounded-md"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-700 text-white hover:bg-navy-800 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

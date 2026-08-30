import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Send,
  Users,
  MessageSquare,
  Copy,
  Check,
  Bot,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { callAI } from '../../lib/ai';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Input, Button, Spinner, Badge } from '../../components/ui';
import { useToast } from '../../components/toast';
import { cn, formatPrice } from '../../lib/utils';
import type { Property } from '../../lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  timestamp: string;
}

export function AgentAiAssistant() {
  const { user, profile } = useAuth();
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const { addToast } = useToast();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello ${profile?.first_name || 'Agent'}! I'm your RealtyNow AI Sales Copilot. I can analyze your leads, craft personalized WhatsApp follow-ups, handle client objections, or generate high-converting property pitches. How can I help you close more deals today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch agent's real assigned leads
  const { data: leads } = useQuery({
    queryKey: ['agent-copilot-leads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquiries')
        .select('id, name, email, phone, message, status, lead_status, created_at, property:properties(id, title, price, purpose, locality_name, city_name)')
        .or(`agent_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((e) => ({
        ...e,
        property: Array.isArray(e.property) ? e.property[0] : e.property,
      }));
    },
    enabled: !!user,
  });

  // Fetch agent's listed / assigned properties
  const { data: properties } = useQuery({
    queryKey: ['agent-copilot-properties', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, price, purpose, bedrooms, bathrooms, built_up_area, locality_name, city_name, status')
        .or(`assigned_agent_id.eq.${user!.id},owner_id.eq.${user!.id}`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Property[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const pushAssistant = (content: string, isError = false) => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content,
        isError,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    addToast('success', 'Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const runTask = async (promptLabel: string, task: Parameters<typeof callAI>[0], payload: Record<string, unknown>) => {
    if (loading) return;
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: promptLabel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLoading(true);
    try {
      const result = await callAI(task, payload);
      pushAssistant(result);
    } catch (err: any) {
      pushAssistant(err?.message || 'Unable to complete AI request. Please try again.', true);
      addToast('error', 'AI Copilot error');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    await runTask(text, 'chat', {
      message: text,
      context: `User is a registered Real Estate Agent on RealtyNow. Leads count: ${leads?.length || 0}, Properties listed: ${properties?.length || 0}.`,
    });
  };

  const handleLeadSummary = () => {
    if (!leads || leads.length === 0) {
      addToast('info', 'No active leads found to summarize.');
      return;
    }
    const selected = selectedLeadId ? leads.find((l) => l.id === selectedLeadId) : leads[0];
    runTask(
      `Summarize lead: ${selected?.name || 'Latest Client'}`,
      'lead_summary',
      {
        name: selected?.name,
        phone: selected?.phone,
        message: selected?.message,
        property_interested: selected?.property?.title || 'General Enquiry',
        budget: selected?.property?.price ? formatPrice(selected.property.price, selected.property.purpose) : 'Unspecified',
        location: selected?.property?.locality_name || 'Hyderabad',
      }
    );
  };

  const handleWhatsAppPitch = () => {
    const lead = leads?.find((l) => l.id === selectedLeadId) || leads?.[0];
    const property = properties?.find((p) => p.id === selectedPropertyId) || properties?.[0];

    const leadName = lead?.name || 'Valued Client';
    const propertyTitle = property?.title || lead?.property?.title || 'Premium Property';
    const location = property?.locality_name || 'prime location';

    runTask(
      `Draft WhatsApp Follow-up for ${leadName}`,
      'chat',
      {
        message: `Write a warm, highly-professional WhatsApp follow-up message to a client named "${leadName}" regarding the property "${propertyTitle}" in ${location}. Include:
1. Enthusiastic greeting from RealtyNow Agent ${profile?.first_name || ''}
2. Key highlight of the property
3. Invitation to schedule a private site visit this weekend
4. Call-to-action to reply or call directly. Keep it under 80 words and formatted with WhatsApp emojis and bold text (*like this*).`,
        context: 'agent_whatsapp_pitch',
      }
    );
  };

  const handleObjectionScript = (objectionType: string) => {
    runTask(
      `Handle Objection: "${objectionType}"`,
      'chat',
      {
        message: `Provide a proven, polite, and persuasive 3-step script for an Indian real estate agent responding to a customer objection: "${objectionType}". Include:
Step 1: Acknowledge & Validate
Step 2: Reframe with Market Reality & Value Evidence
Step 3: Closing Question to Secure Site Visit or Commitment.`,
        context: 'objection_handling',
      }
    );
  };

  return (
    <DashboardLayout sections={agentSections} title="AI Sales Copilot" badge="Agent">
      <PageHeader
        title="AI Sales Copilot"
        subtitle="Empower your daily sales workflow with instant lead analysis, personalized follow-ups, and deal negotiation scripts."
      />

      {/* Quick Action Control Bar */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {/* Lead Selector & Action */}
        <Card className="p-4 bg-navy-900 text-white border-navy-800">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-gold-400" />
            <h4 className="text-sm font-bold">Lead Intelligence</h4>
          </div>
          <p className="text-xs text-navy-300 mb-3">Select a lead to summarize requirements & next actions.</p>
          <div className="space-y-2">
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full text-xs rounded-lg bg-navy-800 border border-navy-700 text-white p-2 focus:ring-1 focus:ring-gold-400 outline-none"
            >
              <option value="">-- Select Active Lead --</option>
              {leads?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.property?.title ? l.property.title.slice(0, 20) + '...' : 'General'})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              className="w-full bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold border-none"
              onClick={handleLeadSummary}
              disabled={loading || !leads || leads.length === 0}
              icon={<Sparkles className="h-3.5 w-3.5" />}
            >
              Summarize Lead Strategy
            </Button>
          </div>
        </Card>

        {/* WhatsApp Generator */}
        <Card className="p-4 bg-navy-900 text-white border-navy-800">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-bold">WhatsApp Follow-Up</h4>
          </div>
          <p className="text-xs text-navy-300 mb-3">Generate instant high-converting messages for your pipeline.</p>
          <div className="space-y-2">
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full text-xs rounded-lg bg-navy-800 border border-navy-700 text-white p-2 focus:ring-1 focus:ring-emerald-400 outline-none"
            >
              <option value="">-- Match with Property --</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title.slice(0, 28)}... ({p.locality_name || p.city_name})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none"
              onClick={handleWhatsAppPitch}
              disabled={loading}
              icon={<Send className="h-3.5 w-3.5" />}
            >
              Draft WhatsApp Script
            </Button>
          </div>
        </Card>

        {/* Objection Handling */}
        <Card className="p-4 bg-navy-900 text-white border-navy-800">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-bold">Objection Handling</h4>
          </div>
          <p className="text-xs text-navy-300 mb-2">Instant persuasive scripts for common buyer doubts.</p>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              onClick={() => handleObjectionScript('Price is too high / Beyond budget')}
              disabled={loading}
              className="text-[11px] p-2 bg-navy-800 hover:bg-navy-700 text-navy-200 rounded-lg text-left truncate transition"
            >
              💰 Price too high
            </button>
            <button
              onClick={() => handleObjectionScript('Waiting for market rate to drop')}
              disabled={loading}
              className="text-[11px] p-2 bg-navy-800 hover:bg-navy-700 text-navy-200 rounded-lg text-left truncate transition"
            >
              📉 Waiting for dip
            </button>
            <button
              onClick={() => handleObjectionScript('Need higher home loan eligibility')}
              disabled={loading}
              className="text-[11px] p-2 bg-navy-800 hover:bg-navy-700 text-navy-200 rounded-lg text-left truncate transition"
            >
              🏦 Home loan doubts
            </button>
            <button
              onClick={() => handleObjectionScript('Considering multiple competing projects')}
              disabled={loading}
              className="text-[11px] p-2 bg-navy-800 hover:bg-navy-700 text-navy-200 rounded-lg text-left truncate transition"
            >
              🏢 Comparing projects
            </button>
          </div>
        </Card>
      </div>

      {/* Main Copilot Interactive Chat Console */}
      <Card className="flex flex-col h-[65vh] p-0 overflow-hidden shadow-lg border-navy-100">
        <div className="bg-navy-50/80 px-4 py-3 border-b border-navy-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gold-100 text-gold-700 rounded-lg">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy-900">RealtyNow Agent Intelligence</p>
              <p className="text-[11px] text-navy-500">Connected to active listings & CRM inventory</p>
            </div>
          </div>
          <Badge variant="success" className="text-xs">
            Live Copilot Active
          </Badge>
        </div>

        {/* Message Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm relative group',
                  m.role === 'user'
                    ? 'bg-navy-900 text-white rounded-br-none'
                    : m.isError
                      ? 'bg-error-50 text-error-700 border border-error-200 rounded-bl-none'
                      : 'bg-white text-navy-900 border border-navy-100 rounded-bl-none'
                )}
              >
                {m.role === 'assistant' && !m.isError && (
                  <div className="mb-2 flex items-center justify-between border-b border-navy-100/60 pb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-gold-600">
                      <Sparkles className="h-3.5 w-3.5" /> Agent AI Response
                    </span>
                    <button
                      onClick={() => handleCopy(m.content, i)}
                      className="text-navy-400 hover:text-navy-700 transition flex items-center gap-1 text-xs font-medium"
                      title="Copy response"
                    >
                      {copiedIndex === i ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.content}</div>
                <div
                  className={cn(
                    'mt-2 text-[10px]',
                    m.role === 'user' ? 'text-navy-300 text-right' : 'text-navy-400'
                  )}
                >
                  {m.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-white border border-navy-100 px-4 py-3 shadow-sm">
                <Spinner className="h-4 w-4 text-gold-600" />
                <span className="text-xs text-navy-600 font-medium animate-pulse">
                  Analyzing inventory & formulating sales strategy...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2 border-t border-navy-100 p-3 bg-white"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything: 'Write a site visit confirmation', 'How to pitch 3BHK in Gachibowli', etc..."
            className="flex-1"
            disabled={loading}
          />
          <Button
            type="submit"
            variant="primary"
            icon={<Send className="h-4 w-4" />}
            disabled={loading || !input.trim()}
          >
            Ask AI
          </Button>
        </form>
      </Card>
    </DashboardLayout>
  );
}

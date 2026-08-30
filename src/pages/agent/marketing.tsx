import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Megaphone,
  Copy,
  Check,
  Send,
  Sparkles,
  Building2,
  MessageSquare,
  Instagram,
  Linkedin,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { callAI } from '../../lib/ai';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getAgentSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Button, Badge, Spinner, Textarea } from '../../components/ui';
import { useToast } from '../../components/toast';
import { formatPrice, generatePropertyUrl } from '../../lib/utils';
import type { Property } from '../../lib/types';

export function AgentMarketing() {
  const { user, profile } = useAuth();
  const { t } = useLanguageContext();
  const agentSections = getAgentSections(t);
  const { addToast } = useToast();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<'whatsapp' | 'instagram' | 'linkedin' | 'email'>('whatsapp');
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch agent's properties
  const { data: properties, isLoading: propsLoading } = useQuery({
    queryKey: ['agent-marketing-properties', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*, cities(name), localities(name), property_types(name)')
        .or(`assigned_agent_id.eq.${user!.id},owner_id.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Property[];
    },
    enabled: !!user,
  });

  const selectedProperty = properties?.find((p) => p.id === selectedPropertyId) || properties?.[0];

  const handleGenerateCopy = async () => {
    if (!selectedProperty) {
      addToast('info', 'Please select a property first.');
      return;
    }

    setLoading(true);
    const propTitle = selectedProperty.title;
    const propPrice = formatPrice(selectedProperty.price, selectedProperty.purpose);
    const propBhk = selectedProperty.bedrooms ? `${selectedProperty.bedrooms} BHK` : '';
    const propLocation = [selectedProperty.locality_name, selectedProperty.city_name].filter(Boolean).join(', ');
    const propUrl = window.location.origin + generatePropertyUrl(selectedProperty);
    const agentName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Verified Agent';
    const agentPhone = profile?.phone || '';

    let prompt = '';
    if (activeChannel === 'whatsapp') {
      prompt = `Write a high-converting, premium WhatsApp Broadcast message for an Indian property listing.
Property: ${propTitle} (${propBhk})
Location: ${propLocation}
Price: ${propPrice} (${selectedProperty.purpose})
Agent: ${agentName} (${agentPhone})
Link: ${propUrl}

Requirements:
1. Catchy headline with emojis (🔥 🏡 ✨)
2. 3-4 bullet points highlighting key amenities, prime connectivity & ready possession
3. Transparent pricing & exclusive site visit invite
4. Direct call to action to reply or call.
Format with WhatsApp bold markers (*text*). Keep under 100 words.`;
    } else if (activeChannel === 'instagram') {
      prompt = `Write an engaging Instagram caption for a real estate listing.
Property: ${propTitle} (${propBhk}) in ${propLocation}. Price: ${propPrice}.
Include:
1. Hook in the first line
2. Lifestyle benefits & luxury details
3. Call-to-action: "DM for price breakdown & site visit tour"
4. 15 targeted hashtags (#HyderabadRealEstate #LuxuryHomes #PropertyForSale #RealtyNow etc.)`;
    } else if (activeChannel === 'linkedin') {
      prompt = `Write a professional LinkedIn post highlighting this property as an exceptional investment / living opportunity.
Property: ${propTitle} in ${propLocation}.
Include:
1. Macro infrastructure corridor insights
2. Rental yield & appreciation potential
3. Developer credibility & RERA compliance
4. Call to connect with certified agent ${agentName}.`;
    } else {
      prompt = `Write a professional client email newsletter introducing this new exclusive property listing: ${propTitle} in ${propLocation} for ${propPrice}. Include warm greeting, property features table, and a calendar invite link for property walkthrough.`;
    }

    try {
      const result = await callAI('chat', {
        message: prompt,
        context: 'agent_marketing_generator',
      });
      setGeneratedContent(result);
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to generate copy');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    addToast('success', 'Marketing copy copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!generatedContent) return;
    const url = `https://wa.me/?text=${encodeURIComponent(generatedContent)}`;
    window.open(url, '_blank');
  };

  return (
    <DashboardLayout sections={agentSections} title="Marketing Hub" badge="Agent">
      <PageHeader
        title="Marketing & Campaign Hub"
        subtitle="Generate automated social media captions, WhatsApp broadcast blasts, and high-impact property flyers powered by AI."
      />

      <div className="grid gap-6 lg:grid-cols-3 mt-4">
        {/* Left: Property Selection & Channel Setup */}
        <div className="space-y-6">
          <Card className="p-5 border-navy-100">
            <h3 className="font-display font-bold text-navy-900 text-base mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gold-500" /> 1. Select Listing
            </h3>
            {propsLoading ? (
              <Spinner className="h-5 w-5" />
            ) : properties && properties.length > 0 ? (
              <div className="space-y-3">
                <select
                  value={selectedPropertyId || (selectedProperty?.id ?? '')}
                  onChange={(e) => {
                    setSelectedPropertyId(e.target.value);
                    setGeneratedContent('');
                  }}
                  className="w-full text-sm rounded-lg border border-navy-200 p-2.5 bg-white text-navy-900 focus:ring-2 focus:ring-gold-400 outline-none"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — {formatPrice(p.price, p.purpose)}
                    </option>
                  ))}
                </select>

                {selectedProperty && (
                  <div className="rounded-xl bg-navy-50 p-3 text-xs space-y-1.5 border border-navy-100">
                    <p className="font-bold text-navy-900 line-clamp-1">{selectedProperty.title}</p>
                    <p className="text-navy-600">
                      📍 {selectedProperty.locality_name || ''}, {selectedProperty.city_name || ''}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-red-600">
                        {formatPrice(selectedProperty.price, selectedProperty.purpose)}
                      </span>
                      <Badge variant="gold" className="text-[10px]">
                        {selectedProperty.purpose}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-navy-500">No listed properties found. List a property first to market it.</p>
            )}
          </Card>

          <Card className="p-5 border-navy-100">
            <h3 className="font-display font-bold text-navy-900 text-base mb-3 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-gold-500" /> 2. Marketing Channel
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setActiveChannel('whatsapp');
                  setGeneratedContent('');
                }}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition ${
                  activeChannel === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-navy-100 bg-white text-navy-700 hover:bg-navy-50'
                }`}
              >
                <MessageSquare className="h-4 w-4 text-emerald-600" /> WhatsApp Blast
              </button>

              <button
                onClick={() => {
                  setActiveChannel('instagram');
                  setGeneratedContent('');
                }}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition ${
                  activeChannel === 'instagram'
                    ? 'border-pink-500 bg-pink-50 text-pink-800'
                    : 'border-navy-100 bg-white text-navy-700 hover:bg-navy-50'
                }`}
              >
                <Instagram className="h-4 w-4 text-pink-600" /> Instagram Post
              </button>

              <button
                onClick={() => {
                  setActiveChannel('linkedin');
                  setGeneratedContent('');
                }}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition ${
                  activeChannel === 'linkedin'
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-navy-100 bg-white text-navy-700 hover:bg-navy-50'
                }`}
              >
                <Linkedin className="h-4 w-4 text-blue-600" /> LinkedIn Insight
              </button>

              <button
                onClick={() => {
                  setActiveChannel('email');
                  setGeneratedContent('');
                }}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition ${
                  activeChannel === 'email'
                    ? 'border-gold-500 bg-gold-50 text-gold-900'
                    : 'border-navy-100 bg-white text-navy-700 hover:bg-navy-50'
                }`}
              >
                <FileText className="h-4 w-4 text-gold-600" /> Client Newsletter
              </button>
            </div>

            <Button
              variant="primary"
              className="w-full mt-4"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={handleGenerateCopy}
              disabled={loading || !selectedProperty}
            >
              {loading ? 'Generating Campaign...' : 'Generate Marketing Copy'}
            </Button>
          </Card>
        </div>

        {/* Right: Generated Campaign Editor & Instant Broadcast */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 border-navy-100 flex flex-col h-full min-h-[480px]">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3 mb-4">
              <div>
                <h3 className="font-display font-bold text-navy-900 text-lg">Generated Campaign Creative</h3>
                <p className="text-xs text-navy-500">
                  Targeted for {activeChannel.toUpperCase()} • Ready to share or customize
                </p>
              </div>
              {generatedContent && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    onClick={handleCopy}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  {activeChannel === 'whatsapp' && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      icon={<Send className="h-3.5 w-3.5" />}
                      onClick={handleOpenWhatsApp}
                    >
                      Broadcast
                    </Button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
                <Spinner className="h-8 w-8 text-gold-600" />
                <p className="font-bold text-navy-900 text-sm">Crafting viral real estate copy...</p>
                <p className="text-xs text-navy-500 max-w-sm">
                  Applying behavioral copywriting principles to maximize enquiry conversions.
                </p>
              </div>
            ) : generatedContent ? (
              <div className="flex-1 flex flex-col space-y-3">
                <Textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="flex-1 min-h-[320px] font-sans text-sm leading-relaxed p-4 bg-slate-50/70 border-navy-100"
                />
                <p className="text-[11px] text-navy-400">
                  💡 Tip: You can edit the text directly before broadcasting to your client lists.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3 border-2 border-dashed border-navy-100 rounded-2xl">
                <div className="p-3 bg-gold-50 text-gold-600 rounded-2xl">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h4 className="font-display font-bold text-navy-900 text-base">No Campaign Generated Yet</h4>
                <p className="text-xs text-navy-500 max-w-md">
                  Choose a property on the left, select your channel (WhatsApp, Instagram, LinkedIn, or Email), and click{' '}
                  <strong>Generate Marketing Copy</strong>.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

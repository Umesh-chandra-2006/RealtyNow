import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Bot,
  Search,
  FileText,
  Languages,
  TrendingUp,
  UserCheck,
  Zap,
  ArrowRight,
  ShieldCheck,
  Loader2,
  MapPin,
  Bed,
  ExternalLink,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { callAI } from '../../lib/ai';
import { VoiceSearchButton } from '../../components/voice-search-button';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { supabase } from '../../lib/supabase';
import { formatCompactPrice, generatePropertyUrl, getPropertyPrice } from '../../lib/utils';
import { normalizeSearchQuery } from '../../lib/properties';
import type { Property } from '../../lib/types';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';

// ── Smart Search Live Results ────────────────────────────────
interface SmartSearchResult {
  properties: Property[];
  total: number;
  aiAnswer?: string;
  isLoading: boolean;
  error?: string;
}

const PURPOSE_CHIPS = [
  { label: 'All', value: '' },
  { label: '🏠 For Rent', value: 'Rent' },
  { label: '🏢 For Sale', value: 'Sale' },
];

const TYPE_CHIPS = [
  { label: 'All Types', value: '' },
  { label: 'Apartment', value: 'apartment' },
  { label: 'Villa', value: 'villa' },
  { label: 'Plot', value: 'plot' },
  { label: 'House', value: 'house' },
  { label: 'Office', value: 'office' },
  { label: 'Shop', value: 'shop' },
];

const RENT_RE = /\b(rent|rental|lease|to let|on rent)\b/i;
const BUY_RE = /\b(buy|sale|sell|purchase|for sale)\b/i;

function detectPurposeFromQuery(q: string): 'Rent' | 'Sale' | '' {
  if (RENT_RE.test(q)) return 'Rent';
  if (BUY_RE.test(q)) return 'Sale';
  return '';
}

function detectTypeFromQuery(q: string): string {
  const lower = q.toLowerCase();
  if (/\b(plot|plots|land|open plot)\b/.test(lower)) return 'plot';
  if (/\b(apartment|flat|flats)\b/.test(lower)) return 'apartment';
  if (/\b(villa|villas|bungalow)\b/.test(lower)) return 'villa';
  if (/\b(house|houses|home)\b/.test(lower)) return 'house';
  if (/\b(office|commercial)\b/.test(lower)) return 'office';
  if (/\b(shop|retail|showroom)\b/.test(lower)) return 'shop';
  return '';
}

async function doLiveSearch(
  rawQuery: string,
  purposeOverride: string,
  typeOverride: string,
): Promise<{ properties: Property[]; total: number }> {
  const { normalized } = normalizeSearchQuery(rawQuery);

  // Detect intent from the raw query text
  const purposeFromQuery = detectPurposeFromQuery(rawQuery);
  const typeFromQuery = detectTypeFromQuery(rawQuery);

  const purpose = purposeOverride || purposeFromQuery;
  const typeHint = typeOverride || typeFromQuery;

  // Strip stopwords for location/keyword extraction
  const STOPWORDS = /\b(rent|rental|lease|to let|on rent|buy|sale|sell|purchase|for sale|show|find|search|looking|want|need|apartment|flat|villa|house|plot|land|office|shop|properties|property|for|in|at|near|around|the|a|an|me|i)\b/gi;
  const locationTokens = normalized
    .replace(STOPWORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  let query = supabase
    .from('v_properties_search')
    .select('*', { count: 'exact' })
    .or('status.eq.published,status.eq.live,is_live.eq.true')
    .order('published_at', { ascending: false })
    .limit(9);

  if (purpose) query = query.eq('purpose', purpose);
  if (typeHint) query = query.ilike('property_type_name', `%${typeHint}%`);

  // Apply location/keyword tokens
  for (const token of locationTokens) {
    query = query.ilike('search_document', `%${token}%`);
  }

  // If no meaningful tokens extracted but we have purposeOrType, skip text filter
  // (prevents zero-result when user types just "Rent" and tokens array is empty)

  const { data, count, error } = await query;
  if (error) throw error;
  return { properties: (data ?? []) as Property[], total: count ?? 0 };
}

// ── Property Result Card ─────────────────────────────────────
function SmartResultCard({ property: p }: { property: Property }) {
  const img = getPropertyCoverImage(p);
  const where = [(p as any).locality_name, (p as any).city_name].filter(Boolean).join(', ');
  const price = formatCompactPrice(getPropertyPrice(p), p.purpose);

  return (
    <Link
      to={generatePropertyUrl(p)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-xl border border-slate-800 bg-slate-950 hover:border-red-500/40 hover:bg-slate-900 transition-all p-3"
    >
      <div className="relative w-24 h-20 shrink-0 rounded-lg overflow-hidden bg-slate-800">
        <img
          src={img}
          alt={p.title}
          onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <span className={`absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.purpose === 'Rent' ? 'bg-blue-600' : 'bg-red-600'} text-white`}>
          {p.purpose === 'Rent' ? 'RENT' : 'SALE'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-red-400 transition-colors">{p.title}</p>
        {where && (
          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 shrink-0" /> <span className="line-clamp-1">{where}</span>
          </p>
        )}
        <p className="text-sm font-extrabold text-red-400 mt-1">{price}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {(p as any).property_type_name && (
            <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full">{(p as any).property_type_name}</span>
          )}
          {p.bedrooms != null && (
            <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Bed className="w-2 h-2" /> {p.bedrooms} BHK
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-red-400 shrink-0 mt-1 transition-colors" />
    </Link>
  );
}

export const AIHubPage: React.FC = () => {
  const { t } = useLanguageContext();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const defaultTab = searchParams.get('tab') as 'assistant' | 'smart-search' | 'recommendations' | 'generator' | 'lead-summary' | 'translation' | 'market';
  
  const [activeTab, setActiveTab] = useState<
    'assistant' | 'smart-search' | 'recommendations' | 'generator' | 'lead-summary' | 'translation' | 'market'
  >(defaultTab || 'assistant');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  /** Renders AI text with [label](url) links as clickable elements. */
  const renderAIText = (text: string) => {
    const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = LINK_RE.exec(text)) !== null) {
      if (match.index > last) parts.push(text.slice(last, match.index));
      const [, label, href] = match;
      const isInternal = href.startsWith('/');
      parts.push(
        isInternal ? (
          <Link
            key={key++}
            to={href}
            className="text-red-400 underline hover:text-red-300 font-medium transition-colors"
          >
            {label}
          </Link>
        ) : (
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 underline hover:text-red-300 font-medium transition-colors"
          >
            {label}
          </a>
        ),
      );
      last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    const withBreaks: React.ReactNode[] = [];
    parts.forEach((part, idx) => {
      if (typeof part === 'string') {
        const lines = part.split('\n');
        lines.forEach((line, li) => {
          withBreaks.push(line);
          if (li < lines.length - 1) withBreaks.push(<br key={`br-${idx}-${li}`} />);
        });
      } else {
        withBreaks.push(part);
      }
    });
    return <>{withBreaks}</>;
  };

  // Chat State
  const [chatInput, setChatInput] = useState<string>('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Hello! I am your RealtyNow AI Property Advisor. Ask me anything about property prices, buying vs renting in India, home loans, or top localities!',
    },
  ]);

  // ── Smart Search State ───────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [purposeFilter, setPurposeFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [smartResults, setSmartResults] = useState<SmartSearchResult>({
    properties: [],
    total: 0,
    isLoading: false,
  });
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (query: string, purpose: string, type: string) => {
    if (!query.trim() && !purpose && !type) {
      setSmartResults({ properties: [], total: 0, isLoading: false });
      setAiAnswer('');
      setHasSearched(false);
      return;
    }

    setSmartResults((prev) => ({ ...prev, isLoading: true, error: undefined }));
    setHasSearched(true);

    try {
      const { properties, total } = await doLiveSearch(query, purpose, type);
      setSmartResults({ properties, total, isLoading: false });

      // For longer/complex queries, also get an AI-generated answer
      if (query.trim().split(/\s+/).length >= 3) {
        const aiRes = await callAI('chat', { message: query });
        setAiAnswer(aiRes);
      } else {
        setAiAnswer('');
      }
    } catch {
      setSmartResults({ properties: [], total: 0, isLoading: false, error: 'Search failed. Please try again.' });
    }
  }, []);

  // Debounced auto-search: fires 500ms after user stops typing
  useEffect(() => {
    if (activeTab !== 'smart-search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(searchQuery, purposeFilter, typeFilter);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, purposeFilter, typeFilter, activeTab, runSearch]);

  // Auto-detect purpose/type chip when user types
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const detected = detectPurposeFromQuery(searchQuery);
    if (detected && !purposeFilter) setPurposeFilter(detected);
    const detectedType = detectTypeFromQuery(searchQuery);
    if (detectedType && !typeFilter) setTypeFilter(detectedType);
  }, [searchQuery]);

  // Generator State
  const [genTitle, setGenTitle] = useState<string>('Luxury 3BHK Apartment');
  const [genCity, setGenCity] = useState<string>('Mumbai');
  const [genLocality, setGenLocality] = useState<string>('Worli');
  const [genType, setGenType] = useState<string>('Residential Apartment');
  const [genBedrooms, setGenBedrooms] = useState<number>(3);
  const [genOutput, setGenOutput] = useState<{ title?: string; description?: string; seo?: string } | null>(null);

  // Lead Summary State
  const [leadText, setLeadText] = useState<string>(
    'Hi, I am Rahul Verma interested in buying a 3BHK in HSR Layout Bengaluru. My budget is around 1.2 Crore. Looking for ready-to-move properties with bank pre-approval ready.',
  );
  const [leadSummaryOutput, setLeadSummaryOutput] = useState<string>('');

  // Translation State
  const [transText, setTransText] = useState<string>(
    'Spacious 3 BHK sea-facing apartment in Worli with modern amenities, gated security, and covered parking.',
  );
  const [transLang, setTransLang] = useState<string>('Hindi');
  const [transOutput, setTransOutput] = useState<string>('');

  // Market Insights State
  const [marketCity, setMarketCity] = useState<string>('Bengaluru');
  const [marketLocality, setMarketLocality] = useState<string>('HSR Layout');
  const [marketOutput, setMarketOutput] = useState<string>('');

  // Recommendation State
  const [recInput, setRecInput] = useState<string>(
    '2BHK apartment in IT corridors under 80 Lakhs with metro connectivity',
  );
  const [recOutput, setRecOutput] = useState<string>('');

  // Handlers
  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || loading) return;

    const userText = chatInput.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setChatInput('');
    setLoading(true);

    try {
      const res = await callAI('chat', { message: userText });
      setMessages((prev) => [...prev, { role: 'assistant', text: res }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, I encountered an issue. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCopy = async () => {
    setLoading(true);
    try {
      const desc = await callAI('description', {
        title: genTitle,
        city: genCity,
        locality: genLocality,
        type: genType,
        bedrooms: genBedrooms,
      });
      const title = await callAI('title', {
        city: genCity,
        locality: genLocality,
        type: genType,
        bedrooms: genBedrooms,
        purpose: 'Sale',
      });
      const seo = await callAI('seo', {
        title: genTitle,
        city: genCity,
        locality: genLocality,
      });
      setGenOutput({ title, description: desc, seo });
    } finally {
      setLoading(false);
    }
  };

  const handleSummarizeLead = async () => {
    setLoading(true);
    try {
      const res = await callAI('lead_summary', { message: leadText });
      setLeadSummaryOutput(res);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    setLoading(true);
    try {
      const res = await callAI('translate', { text: transText, language: transLang });
      setTransOutput(res);
    } finally {
      setLoading(false);
    }
  };

  const handleMarketInsights = async () => {
    setLoading(true);
    try {
      const res = await callAI('market_insights', { city: marketCity, locality: marketLocality });
      setMarketOutput(res);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendations = async () => {
    setLoading(true);
    try {
      const res = await callAI('recommend', { message: recInput });
      setRecOutput(res);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-red-400" /> {t('ai.phase1', 'Phase 1 — AI Foundation Suite')}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            RealtyNow{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-amber-400">
              {t('ai.subtitle', 'AI Property Advisor')}
            </span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            {t(
              'ai.description',
              'Powered by OpenRouter AI (GPT-4o Mini). Search using voice, generate property copy, summarize customer leads, and analyze locality price trends in real-time.',
            )}
          </p>

          <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg w-fit mx-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />{' '}
            {t('ai.activeStatus', 'Active & Connected to OpenRouter AI Engine')}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
          {[
            { id: 'assistant', label: 'AI Assistant', icon: Bot },
            { id: 'smart-search', label: 'Smart Search', icon: Search },
            { id: 'recommendations', label: 'Recommendations', icon: Zap },
            { id: 'generator', label: 'Copy Generator', icon: FileText },
            { id: 'lead-summary', label: 'Lead Summary', icon: UserCheck },
            { id: 'translation', label: 'AI Translation', icon: Languages },
            { id: 'market', label: 'Market Insights', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as typeof activeTab);
                  setSearchParams({ tab: tab.id });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
                  active
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: AI Assistant Chat */}
        {activeTab === 'assistant' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-red-500" /> Interactive AI Real Estate Assistant
              </h3>
              <span className="text-xs text-slate-400">Ask in English or Voice</span>
            </div>

            <div className="h-80 overflow-y-auto space-y-4 pr-2">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-md p-4 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-red-600 text-white rounded-br-none'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-none'
                    }`}
                  >
                    {renderAIText(m.text)}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 text-slate-400 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin" /> Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about properties in Mumbai, buying guide, home loans..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
              <VoiceSearchButton onResult={(text) => setChatInput(text)} />
              <button
                type="submit"
                disabled={loading || !chatInput.trim()}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm flex items-center gap-1.5"
              >
                Send <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: AI Smart Search — LIVE PROPERTY SEARCH */}
        {activeTab === 'smart-search' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-4xl mx-auto space-y-5">
            {/* Header */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-red-500" /> AI Smart Property Search
              </h3>
              <p className="text-xs text-slate-400">
                Type anything — "Rent", "3 BHK Hyderabad", "open plot" — results update automatically from live RealtyNow listings.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Try "Rent", "2 BHK Hyderabad", "plot for sale", "villa under 1 crore"...'
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-24 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setPurposeFilter(''); setTypeFilter(''); }}
                    className="text-slate-500 hover:text-white p-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <VoiceSearchButton onResult={(t) => setSearchQuery(t)} />
              </div>
            </div>

            {/* Purpose Quick-Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Purpose:</span>
              {PURPOSE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setPurposeFilter(chip.value)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    purposeFilter === chip.value
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Type Quick-Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type:</span>
              {TYPE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setTypeFilter(chip.value)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    typeFilter === chip.value
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Results */}
            {smartResults.isLoading && (
              <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                <span className="text-sm">Searching RealtyNow listings…</span>
              </div>
            )}

            {!smartResults.isLoading && hasSearched && (
              <>
                {/* Result count + search to page link */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    {smartResults.total > 0
                      ? <><span className="text-white font-bold">{smartResults.total}</span> properties found</>
                      : 'No properties found'}
                    {searchQuery && <> for "<span className="text-red-400">{searchQuery}</span>"</>}
                    {purposeFilter && <> • <span className="text-blue-400">{purposeFilter}</span></>}
                    {typeFilter && <> • <span className="text-amber-400 capitalize">{typeFilter}</span></>}
                  </p>
                  {smartResults.total > 0 && (
                    <Link
                      to={`/search?q=${encodeURIComponent(searchQuery)}${purposeFilter ? `&purpose=${purposeFilter}` : ''}${typeFilter ? `&type=${typeFilter}` : ''}`}
                      className="text-[11px] text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 transition-colors"
                    >
                      View all <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {smartResults.properties.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {smartResults.properties.map((p) => (
                      <SmartResultCard key={p.id} property={p} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-3">
                    <Search className="w-10 h-10 text-slate-700 mx-auto" />
                    <p className="text-sm text-slate-400">No listings match your search right now.</p>
                    <p className="text-xs text-slate-500">Try a different keyword, location, or clear some filters.</p>
                    <Link
                      to={`/search${purposeFilter ? `?purpose=${purposeFilter}` : ''}`}
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors"
                    >
                      Browse all listings <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* AI answer for complex queries */}
                {aiAnswer && (
                  <div className="bg-slate-950 border border-slate-700/50 rounded-xl p-4 space-y-2 mt-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> AI Analysis
                    </h4>
                    <p className="text-sm text-slate-200 leading-relaxed">{renderAIText(aiAnswer)}</p>
                  </div>
                )}
              </>
            )}

            {!hasSearched && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                {[
                  { label: '🏠 Rent in Hyderabad', q: 'Rent', p: 'Rent', type: '' },
                  { label: '🏢 Apartments for Sale', q: 'apartment', p: 'Sale', type: 'apartment' },
                  { label: '🌿 Open Plots', q: 'open plot', p: '', type: 'plot' },
                  { label: '🏘️ 2 BHK Houses', q: '2 BHK house', p: '', type: 'house' },
                  { label: '💼 Commercial Office', q: 'office', p: 'Sale', type: 'office' },
                  { label: '🏖️ Luxury Villas', q: 'villa', p: 'Sale', type: 'villa' },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setSearchQuery(s.q);
                      setPurposeFilter(s.p);
                      setTypeFilter(s.type);
                    }}
                    className="text-left text-xs bg-slate-900 border border-slate-800 hover:border-red-500/40 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-2.5 rounded-xl transition-all font-medium"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Recommendations */}
        {activeTab === 'recommendations' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-red-500" /> AI Property Matchmaker &amp; Locality Recommendations
              </h3>
              <p className="text-xs text-slate-400">
                Tell the AI your budget, preferences, and city — it will recommend properties and localities.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300">Your requirements:</label>
              <textarea
                rows={3}
                value={recInput}
                onChange={(e) => setRecInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500"
              />
              <button
                onClick={handleRecommendations}
                disabled={loading}
                className="bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-red-500 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Get Recommendations
              </button>
            </div>

            {recOutput && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {recOutput}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Copy Generator */}
        {activeTab === 'generator' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-500" /> AI Property Copy &amp; SEO Generator
              </h3>
              <p className="text-xs text-slate-400">
                Generate listing title, description, and SEO meta for your property listing instantly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300">Title:</label>
                <input
                  type="text"
                  value={genTitle}
                  onChange={(e) => setGenTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">City:</label>
                <input
                  type="text"
                  value={genCity}
                  onChange={(e) => setGenCity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Locality:</label>
                <input
                  type="text"
                  value={genLocality}
                  onChange={(e) => setGenLocality(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Bedrooms:</label>
                <input
                  type="number"
                  value={genBedrooms}
                  onChange={(e) => setGenBedrooms(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Property Type:</label>
                <input
                  type="text"
                  value={genType}
                  onChange={(e) => setGenType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white mt-1"
                />
              </div>
            </div>

            <button
              onClick={handleGenerateCopy}
              disabled={loading}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Generate Copy &amp; SEO
            </button>

            {genOutput && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div>
                  <span className="text-xs font-bold text-red-400 uppercase">Generated Title:</span>
                  <p className="text-sm font-semibold text-white mt-1">{genOutput.title}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase">Generated Description:</span>
                  <p className="text-sm text-slate-300 leading-relaxed mt-1">{genOutput.description}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-400 uppercase">SEO Meta Description:</span>
                  <p className="text-xs text-slate-400 mt-1">{genOutput.seo}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(`${genOutput.title}\n\n${genOutput.description}\n\nSEO: ${genOutput.seo}`)}
                  className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg transition-all"
                >
                  {copied ? '✓ Copied!' : 'Copy All'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Lead Summary */}
        {activeTab === 'lead-summary' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-red-500" /> AI Customer Lead Summarizer
              </h3>
              <p className="text-xs text-slate-400">
                Summarize long customer inquiry messages into quick actionable bullet points for agents.
              </p>
            </div>

            <div className="space-y-3">
              <textarea
                rows={4}
                value={leadText}
                onChange={(e) => setLeadText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500"
              />
              <button
                onClick={handleSummarizeLead}
                disabled={loading}
                className="bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-red-500 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Summarize Lead
              </button>
            </div>

            {leadSummaryOutput && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {leadSummaryOutput}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: AI Translation */}
        {activeTab === 'translation' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Languages className="w-5 h-5 text-red-500" /> AI Multilingual Real Estate Translator
              </h3>
              <p className="text-xs text-slate-400">Translate property copy into major Indian languages.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Target Language:</label>
                <select
                  value={transLang}
                  onChange={(e) => setTransLang(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white mt-1"
                >
                  <option value="Hindi">Hindi (हिन्दी)</option>
                  <option value="Telugu">Telugu (తెలుగు)</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                  <option value="Kannada">Kannada (కన్నడ)</option>
                  <option value="Marathi">Marathi (मराठी)</option>
                  <option value="Bengali">Bengali (বাংলা)</option>
                </select>
              </div>

              <textarea
                rows={3}
                value={transText}
                onChange={(e) => setTransText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500"
              />

              <button
                onClick={handleTranslate}
                disabled={loading}
                className="bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-red-500 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Translate Text
              </button>

              {transOutput && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200">
                  {transOutput}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: Market Insights */}
        {activeTab === 'market' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-500" /> AI Market &amp; Locality Insights Generator
              </h3>
              <p className="text-xs text-slate-400">
                Generate price per sqft trends, appreciation estimates, and locality advantages.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">City:</label>
                <input
                  type="text"
                  value={marketCity}
                  onChange={(e) => setMarketCity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Locality:</label>
                <input
                  type="text"
                  value={marketLocality}
                  onChange={(e) => setMarketLocality(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white mt-1"
                />
              </div>
            </div>

            <button
              onClick={handleMarketInsights}
              disabled={loading}
              className="bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-red-500 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Analyze Market
            </button>

            {marketOutput && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {marketOutput}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

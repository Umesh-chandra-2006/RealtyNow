import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Ticket,
  Headphones,
  BookOpen,
  ChevronDown,
  ArrowRight,
  FileQuestion,
} from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard-layout';
import { getPortalSections } from './sections';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { useAuth } from '../../lib/auth';
import {
  KNOWLEDGE_ARTICLES,
  fetchMySupportTickets,
  fetchSupportContactConfig,
  type SupportCategory,
  type KnowledgeArticle,
  type SupportTicket,
  type SupportContactConfig,
} from '../../lib/support';
import { HelpCenterHero } from '../../components/support/HelpCenterHero';
import { SupportCategoryGrid } from '../../components/support/SupportCategoryGrid';
import { KnowledgeBaseArticleModal } from '../../components/support/KnowledgeBaseArticleModal';
import { ContactSupportPanel } from '../../components/support/ContactSupportPanel';
import { RaiseTicketModal } from '../../components/support/RaiseTicketModal';
import { MyTicketsView } from '../../components/support/MyTicketsView';
import { TicketDetailView } from '../../components/support/TicketDetailView';
import { LiveChatDrawer } from '../../components/support/LiveChatDrawer';
import { ReportProblemModal } from '../../components/support/ReportProblemModal';
import { cn } from '../../lib/utils';

export function PortalHelp() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Navigation Tabs: 'knowledge' | 'tickets' | 'contact'
  const tabParam = searchParams.get('tab') as 'knowledge' | 'tickets' | 'contact' | null;
  const selectedTicketId = searchParams.get('ticket');
  const activeTab = tabParam || (selectedTicketId ? 'tickets' : 'knowledge');

  // Category filter in knowledge base
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null);

  // Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('All');

  // Contact config
  const [contactConfig, setContactConfig] = useState<SupportContactConfig>({
    operatingHours: 'Mon - Sat: 9:00 AM - 7:00 PM IST',
    liveChatEnabled: true,
    ticketSystemEnabled: true,
  });

  // Modal States
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [showRaiseTicket, setShowRaiseTicket] = useState(false);
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [showReportProblem, setShowReportProblem] = useState(false);

  // Expanded FAQ accordion IDs
  const [expandedFaqIds, setExpandedFaqIds] = useState<Record<string, boolean>>({
    'art-list-property-steps': true,
    'art-search-filters': true,
  });

  // Load user tickets
  const loadTickets = async () => {
    if (!user?.id) return;
    setTicketsLoading(true);
    try {
      const data = await fetchMySupportTickets(user.id);
      setTickets(data);
    } catch (err) {
      console.warn('Error loading tickets:', err);
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    fetchSupportContactConfig().then(setContactConfig);
  }, [user?.id]);

  // Compute ticket counts
  const ticketCounts = React.useMemo(() => {
    const open = tickets.filter((t) => ['Open', 'Assigned', 'Reopened'].includes(t.status)).length;
    const inProgress = tickets.filter((t) =>
      ['In Progress', 'Waiting for Customer', 'Waiting for Internal Team'].includes(t.status)
    ).length;
    const resolved = tickets.filter((t) => t.status === 'Resolved').length;
    return { open, inProgress, resolved, total: tickets.length };
  }, [tickets]);

  // Tab switching helper
  const setTab = (tab: 'knowledge' | 'tickets' | 'contact') => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    params.delete('ticket');
    setSearchParams(params);
  };

  const handleSelectTicket = (ticket: SupportTicket | string) => {
    const ticketId = typeof ticket === 'string' ? ticket : ticket.id;
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'tickets');
    params.set('ticket', ticketId);
    setSearchParams(params);
  };

  const handleBackToTicketsList = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('ticket');
    params.set('tab', 'tickets');
    setSearchParams(params);
    loadTickets();
  };

  const toggleFaq = (id: string) => {
    setExpandedFaqIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter articles based on active category
  const displayedArticles = React.useMemo(() => {
    if (selectedCategory) {
      return KNOWLEDGE_ARTICLES.filter((a) => a.category === selectedCategory);
    }
    return KNOWLEDGE_ARTICLES;
  }, [selectedCategory]);

  return (
    <DashboardLayout
      sections={getPortalSections(t)}
      title={t('portal.helpCenter', 'Help Center & Support')}
    >
      <div className="space-y-8 pb-12">
        {/* Hero Section */}
        <HelpCenterHero
          onSearchSelect={(article) => setSelectedArticle(article)}
          onRaiseTicket={() => setShowRaiseTicket(true)}
          onContactSupport={() => setTab('contact')}
          onReportProblem={() => setShowReportProblem(true)}
          onViewMyTickets={(status) => {
            if (status) setTicketStatusFilter(status);
            setTab('tickets');
          }}
          ticketCounts={ticketCounts}
        />

        {/* Main Tab Navigation Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('knowledge')}
              className={cn(
                'flex items-center gap-2 py-4 px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer',
                activeTab === 'knowledge'
                  ? 'border-red-600 text-red-600 font-extrabold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              )}
            >
              <BookOpen className="h-4 w-4" />
              <span>Knowledge Base & FAQs</span>
            </button>

            <button
              onClick={() => setTab('tickets')}
              className={cn(
                'flex items-center gap-2 py-4 px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer',
                activeTab === 'tickets'
                  ? 'border-red-600 text-red-600 font-extrabold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              )}
            >
              <Ticket className="h-4 w-4" />
              <span>My Support Tickets</span>
              {ticketCounts.total > 0 && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-extrabold',
                    ticketCounts.open > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  )}
                >
                  {ticketCounts.open > 0 ? `${ticketCounts.open} active` : ticketCounts.total}
                </span>
              )}
            </button>

            <button
              onClick={() => setTab('contact')}
              className={cn(
                'flex items-center gap-2 py-4 px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer',
                activeTab === 'contact'
                  ? 'border-red-600 text-red-600 font-extrabold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              )}
            >
              <Headphones className="h-4 w-4" />
              <span>Contact Support</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Knowledge Base & FAQs */}
        {activeTab === 'knowledge' && (
          <div className="space-y-10">
            {/* 8 Support Category Grid */}
            <SupportCategoryGrid
              activeCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />

            {/* Articles List / Accordions */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                    {selectedCategory
                      ? `${selectedCategory} Guides & FAQs (${displayedArticles.length})`
                      : `Frequently Asked Questions (${displayedArticles.length})`}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Click any topic to expand details, instructions, and troubleshooting steps.
                  </p>
                </div>

                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs font-bold text-red-600 hover:underline self-start sm:self-center"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {displayedArticles.map((article) => {
                  const isExpanded = !!expandedFaqIds[article.id];

                  return (
                    <div
                      key={article.id}
                      className={cn(
                        'rounded-2xl border transition overflow-hidden bg-white',
                        isExpanded
                          ? 'border-red-200 shadow-md shadow-slate-200/50'
                          : 'border-slate-200/80 hover:border-slate-300'
                      )}
                    >
                      {/* Accordion Header */}
                      <button
                        onClick={() => toggleFaq(article.id)}
                        className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0 transition',
                              isExpanded
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-red-50 group-hover:text-red-600'
                            )}
                          >
                            <FileQuestion className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-display text-sm sm:text-base font-bold text-slate-900 group-hover:text-red-600 transition">
                              {article.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {article.category}
                              </span>
                              {article.popular && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                                  Popular
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <ChevronDown
                          className={cn(
                            'h-5 w-5 text-slate-400 group-hover:text-red-600 transition-transform duration-200 shrink-0',
                            isExpanded && 'rotate-180 text-red-600'
                          )}
                        />
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 border-t border-slate-100 space-y-4 text-xs sm:text-sm text-slate-600 bg-slate-50/40 animate-in fade-in duration-150">
                          <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-medium leading-relaxed">
                            {article.summary}
                          </div>

                          <div className="space-y-2 leading-relaxed">
                            {article.content.map((p, idx) => (
                              <p key={idx}>{p}</p>
                            ))}
                          </div>

                          {article.steps && (
                            <div className="space-y-2 pt-1">
                              <p className="font-bold text-slate-900">Key Steps:</p>
                              <ol className="space-y-1.5 pl-2">
                                {article.steps.map((st, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-[10px] font-bold mt-0.5">
                                      {i + 1}
                                    </span>
                                    <span>{st}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                            <button
                              onClick={() => setSelectedArticle(article)}
                              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5"
                            >
                              <span>Open Full Article with Related Guides</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>

                            <span className="text-[11px] text-slate-400">
                              Did this answer your question?
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Support CTA Banner */}
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-navy-950 to-slate-900 p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1.5 text-center md:text-left">
                <h3 className="font-display text-xl font-bold text-white">
                  Still have questions or facing an issue?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg">
                  Our customer success team is available to assist you with listings, payments, and account inquiries.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowRaiseTicket(true)}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 transition cursor-pointer"
                >
                  Raise a Support Ticket
                </button>
                <button
                  onClick={() => setTab('contact')}
                  className="rounded-xl border border-slate-700 bg-white/10 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
                >
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: My Support Tickets */}
        {activeTab === 'tickets' && (
          <div>
            {selectedTicketId ? (
              <TicketDetailView
                ticketId={selectedTicketId}
                onBack={handleBackToTicketsList}
              />
            ) : (
              <MyTicketsView
                tickets={tickets}
                isLoading={ticketsLoading}
                onSelectTicket={handleSelectTicket}
                onRaiseTicket={() => setShowRaiseTicket(true)}
                activeStatusFilter={ticketStatusFilter}
                onStatusFilterChange={setTicketStatusFilter}
              />
            )}
          </div>
        )}

        {/* TAB 3: Contact Support Panel */}
        {activeTab === 'contact' && (
          <ContactSupportPanel
            config={contactConfig}
            onRaiseTicket={() => setShowRaiseTicket(true)}
            onOpenLiveChat={() => setShowLiveChat(true)}
          />
        )}
      </div>

      {/* Modals & Drawers */}
      <KnowledgeBaseArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onSelectArticle={(art) => setSelectedArticle(art)}
        onRaiseTicket={() => setShowRaiseTicket(true)}
        onContactSupport={() => setTab('contact')}
      />

      <RaiseTicketModal
        isOpen={showRaiseTicket}
        onClose={() => setShowRaiseTicket(false)}
        onTicketCreated={(newTicket) => {
          loadTickets();
          handleSelectTicket(newTicket);
        }}
      />

      <LiveChatDrawer
        isOpen={showLiveChat}
        onClose={() => setShowLiveChat(false)}
        onRaiseTicket={() => setShowRaiseTicket(true)}
      />

      <ReportProblemModal
        isOpen={showReportProblem}
        onClose={() => setShowReportProblem(false)}
        onReportSubmitted={(newTicket) => {
          loadTickets();
          handleSelectTicket(newTicket);
        }}
      />
    </DashboardLayout>
  );
}

import React, { useState, useRef } from 'react';
import {
  Search,
  Sparkles,
  Headphones,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  X,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { searchKnowledgeBase, type KnowledgeArticle } from '../../lib/support';
import { useClickOutside } from '../../hooks/useClickOutside';

interface HelpCenterHeroProps {
  onSearchSelect: (article: KnowledgeArticle) => void;
  onRaiseTicket: () => void;
  onContactSupport: () => void;
  onViewMyTickets: (statusFilter?: string) => void;
  onReportProblem: () => void;
  ticketCounts?: {
    open: number;
    inProgress: number;
    resolved: number;
    total: number;
  };
}

export const HelpCenterHero: React.FC<HelpCenterHeroProps> = ({
  onSearchSelect,
  onRaiseTicket,
  onContactSupport,
  onViewMyTickets,
  onReportProblem,
  ticketCounts,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const searchResults = React.useMemo(() => {
    return searchKnowledgeBase(query);
  }, [query]);

  const handleSelect = (article: KnowledgeArticle) => {
    onSearchSelect(article);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-navy-900 p-6 sm:p-10 text-white shadow-xl shadow-slate-900/10 border border-slate-800">
      {/* Decorative ambient gradients */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-red-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-rose-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-1 text-xs font-bold text-red-400 backdrop-blur-md mb-4">
          <Sparkles className="h-3.5 w-3.5 text-red-400" />
          <span>RealtyNow Customer Support Hub</span>
        </div>

        {/* Heading */}
        <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
          How can we help you today?
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-medium">
          Search articles for property listings, verification, payments, subscriptions, and safety, or connect with our support team.
        </p>

        {/* Search Input Bar */}
        <div ref={dropdownRef} className="relative mt-6 max-w-2xl mx-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-4.5 h-5 w-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search help, articles, questions, or issues (e.g. property not visible, refund)..."
              className="w-full rounded-2xl border border-slate-700 bg-white/10 backdrop-blur-md py-4 pl-12 pr-12 text-sm font-medium text-white placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-red-500/30 focus:border-red-500 transition shadow-lg"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 p-1 rounded-full text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Autocomplete & Results Dropdown */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl overflow-hidden max-h-96 overflow-y-auto text-left">
              {searchResults.length > 0 ? (
                <div>
                  <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                    <span>{query ? 'Matching Articles' : 'Popular Help Topics'}</span>
                    <span className="text-[10px] font-normal text-slate-400">{searchResults.length} results</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {searchResults.map((article) => (
                      <button
                        key={article.id}
                        onClick={() => handleSelect(article)}
                        className="w-full px-3.5 py-2.5 text-left rounded-xl hover:bg-slate-50 transition flex items-start gap-3 group cursor-pointer"
                      >
                        <div className="mt-0.5 rounded-lg bg-red-50 p-2 text-red-600 shrink-0 group-hover:bg-red-600 group-hover:text-white transition">
                          <FileQuestion className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-red-600 transition">
                              {article.title}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {article.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{article.summary}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-red-600 group-hover:translate-x-0.5 transition shrink-0 self-center" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-800">No matching articles found</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Couldn't find an answer for "{query}"? Our support team is here to assist you.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onRaiseTicket();
                      }}
                      className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
                    >
                      Raise a Support Ticket
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onContactSupport();
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Contact Support
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick CTA Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onRaiseTicket}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 hover:shadow-red-700/40 active:scale-98 transition cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Raise a Ticket</span>
          </button>
          <button
            onClick={onContactSupport}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20 hover:border-slate-600 active:scale-98 transition cursor-pointer"
          >
            <Headphones className="h-4 w-4 text-slate-300" />
            <span>Contact Support</span>
          </button>
          <button
            onClick={onReportProblem}
            className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 active:scale-98 transition cursor-pointer"
          >
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <span>Report a Problem</span>
          </button>
        </div>

        {/* User Support Status Counter Summary */}
        {ticketCounts && ticketCounts.total > 0 && (
          <div className="mt-7 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Your Support Activity:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onViewMyTickets('Open')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
              >
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold">{ticketCounts.open} Open</span>
              </button>
              <button
                onClick={() => onViewMyTickets('Pending')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 transition cursor-pointer"
              >
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="font-bold">{ticketCounts.inProgress} In Progress</span>
              </button>
              <button
                onClick={() => onViewMyTickets('Resolved')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-bold">{ticketCounts.resolved} Resolved</span>
              </button>
              <button
                onClick={() => onViewMyTickets('All')}
                className="flex items-center gap-1 font-bold text-slate-300 hover:text-white px-2 py-1 transition cursor-pointer"
              >
                <span>View All ({ticketCounts.total})</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

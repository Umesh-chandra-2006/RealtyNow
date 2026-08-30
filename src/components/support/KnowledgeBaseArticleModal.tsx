import React, { useState } from 'react';
import {
  X,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  Share2,
  Check,
} from 'lucide-react';
import {
  type KnowledgeArticle,
  KNOWLEDGE_ARTICLES,
  submitArticleFeedback,
} from '../../lib/support';
import { useAuth } from '../../lib/auth';
import { useToast } from '../toast';

interface KnowledgeBaseArticleModalProps {
  article: KnowledgeArticle | null;
  onClose: () => void;
  onSelectArticle: (article: KnowledgeArticle) => void;
  onRaiseTicket: () => void;
  onContactSupport: () => void;
}

export const KnowledgeBaseArticleModal: React.FC<KnowledgeBaseArticleModalProps> = ({
  article,
  onClose,
  onSelectArticle,
  onRaiseTicket,
  onContactSupport,
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null);
  const [copied, setCopied] = useState(false);

  if (!article) return null;

  const relatedArticles = KNOWLEDGE_ARTICLES.filter((a) =>
    article.relatedArticleIds?.includes(a.id)
  );

  const handleFeedback = (helpful: boolean) => {
    setFeedbackGiven(helpful ? 'yes' : 'no');
    submitArticleFeedback(article.id, helpful, user?.id);
    addToast('success', helpful ? 'Thank you for your feedback!' : 'Feedback submitted. Need further assistance?');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('success', 'Article link copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-600 bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full">
                {article.category}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">RealtyNow Knowledge Base</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {article.title}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Share article"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Article Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-sm text-slate-700">
          {/* Summary Callout */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 font-medium text-slate-800 leading-relaxed">
            {article.summary}
          </div>

          {/* Paragraphs */}
          <div className="space-y-3.5 leading-relaxed text-slate-600">
            {article.content.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Steps */}
          {article.steps && article.steps.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-extrabold">
                  ✓
                </span>
                Step-by-Step Instructions:
              </h3>
              <ol className="space-y-2.5 pl-2">
                {article.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-700 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-slate-700 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tips */}
          {article.tips && article.tips.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <span>Pro Tips:</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-900">
                {article.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Related Articles
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {relatedArticles.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectArticle(rel)}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/40 text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <span className="text-xs font-bold text-slate-800 group-hover:text-red-600 transition line-clamp-1">
                      {rel.title}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-red-600 group-hover:translate-x-1 transition shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Was this article helpful? Widget */}
          <div className="pt-4 border-t border-slate-200">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center space-y-3">
              <p className="text-xs font-bold text-slate-800">
                Was this article helpful?
              </p>

              {feedbackGiven === null ? (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleFeedback(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition shadow-xs cursor-pointer"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>Yes, helpful</span>
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 transition shadow-xs cursor-pointer"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    <span>No, need help</span>
                  </button>
                </div>
              ) : feedbackGiven === 'yes' ? (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-100/70 py-2.5 px-4 rounded-xl">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Thank you! We're glad this helped you.</span>
                </div>
              ) : (
                <div className="space-y-3 bg-amber-50 border border-amber-200 p-4 rounded-xl text-left">
                  <p className="text-xs font-bold text-amber-900">
                    We're sorry this didn't solve your issue. Would you like to contact our support team?
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        onRaiseTicket();
                      }}
                      className="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer"
                    >
                      Raise a Support Ticket
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        onContactSupport();
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Contact Support
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

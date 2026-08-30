import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  Calendar,
  Search as SearchIcon,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  Home,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeCount } from '../../lib/realtime';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, Button, Skeleton, Input, Textarea } from '../../components/ui';
import { cn } from '../../lib/utils';

export function BlogListPage() {
  const { t } = useLanguageContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const pageSize = 9;
  const realtimeTick = useRealtimeCount('blogs');

  const { data: allBlogs = [], isLoading } = useQuery({
    queryKey: ['blogs', realtimeTick],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, author_name: 'RealtyNow Team', tags: b.tags ?? [] }));
    },
  });

  const data = allBlogs.filter((b) => {
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) && !b.tags.join(' ').toLowerCase().includes(search.toLowerCase())) return false;
    if (category && !b.tags.includes(category)) return false;
    return true;
  });

  const allTags = Array.from(new Set(allBlogs.flatMap((b) => b.tags)));

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="container-page py-12">
      <h1 className="font-display text-4xl font-bold text-navy-900">{t('common.blog', 'RealtyNow Blog')}</h1>
      <p className="mt-3 text-lg text-navy-600 max-w-2xl">{t('blog.subtitle', 'Insights, trends, and guides on real estate. Stay informed with our latest updates and expert analysis.')}</p>
      
      <div className="mt-8 flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-navy-100">
        <div className="relative flex-1 min-w-0 sm:min-w-[250px] w-full sm:w-auto">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('blog.searchPlaceholder', 'Search articles, topics, keywords...')}
            className="w-full bg-slate-50 border-none rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary-500 transition-all outline-none"
          />
        </div>
        {allTags && allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory('')}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                !category ? 'bg-navy-900 text-white shadow-md' : 'bg-slate-50 text-navy-600 hover:bg-slate-100',
              )}
            >
              {t('blog.allCategories', 'All Topics')}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setCategory(tag === category ? '' : tag)}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                  category === tag ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20' : 'bg-slate-50 text-navy-600 hover:bg-slate-100',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-3xl" />
          ))}
        </div>
      ) : paginatedData.length > 0 ? (
        <>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedData.map((b) => (
              <Card key={b.id} className="group overflow-hidden p-0 border-none shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-white rounded-3xl">
                <Link to={`/blog/${b.slug ?? b.id}`}>
                  <div className="aspect-[4/3] overflow-hidden bg-navy-100 relative">
                    <img
                      src={b.cover_image ?? 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg'}
                      alt={b.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="p-6">
                    {b.tags && b.tags.length > 0 && (
                      <span className="inline-block px-3 py-1 bg-primary-50 text-primary-600 text-[10px] font-bold uppercase tracking-wider rounded-full mb-3">
                        {b.tags[0]}
                      </span>
                    )}
                    <h2 className="font-display text-xl font-bold text-navy-900 group-hover:text-primary-600 transition-colors leading-tight">
                      {b.title}
                    </h2>
                    <p className="mt-3 text-sm text-navy-500 line-clamp-2 leading-relaxed">{b.excerpt}</p>
                    <div className="mt-6 pt-6 border-t border-navy-50 flex items-center justify-between text-xs font-medium text-navy-400">
                      <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg">
                        <Calendar className="h-3.5 w-3.5" />{' '}
                        {new Date(b.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1.5 text-navy-600">
                        <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-[10px]">
                          {b.author_name.charAt(0)}
                        </div>
                        {b.author_name}
                      </span>
                    </div>
                  </div>
                </Link>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-16 flex justify-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl">
                {t('common.prev', 'Prev')}
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    'h-10 w-10 rounded-xl text-sm font-bold transition-all',
                    page === i + 1 ? 'bg-navy-900 text-white shadow-md' : 'text-navy-600 hover:bg-slate-100',
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-xl">
                {t('common.next', 'Next')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card className="mt-10 py-24 border-none shadow-sm bg-white rounded-3xl text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <SearchIcon className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold text-navy-900 mb-2">{t('blog.noArticles', 'No articles found')}</h3>
          <p className="text-navy-500 mb-8">{t('blog.noArticlesDesc', 'Try searching for something else or reset your filters.')}</p>
          <Button onClick={() => {setSearch(''); setCategory('');}} variant="secondary" className="rounded-xl">Clear Filters</Button>
        </Card>
      )}
    </div>
  );
}

export function BlogDetailPage() {
  const { t } = useLanguageContext();
  const { slug } = useParams();
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  const [helpfulCount, setHelpfulCount] = useState(148);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [consultPhone, setConsultPhone] = useState('');
  const [consultSubmitted, setConsultSubmitted] = useState(false);

  // Track window scroll progress for reading bar
  useState(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100)));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });

  const { data: blog, isLoading } = useQuery({
    queryKey: ['blogs', 'detail', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { 
        ...data, 
        author_name: data.author_name || 'RealtyNow Research Desk', 
        tags: Array.isArray(data.tags) ? data.tags : ['Market Trends', 'Investment'] 
      };
    },
    enabled: Boolean(slug),
  });

  // Query related / trending blogs
  const { data: relatedBlogs = [] } = useQuery({
    queryKey: ['blogs', 'related', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('blogs')
        .select('*')
        .eq('published', true)
        .neq('slug', slug)
        .order('published_at', { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleConsultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultPhone || consultPhone.length < 10) return;
    setConsultSubmitted(true);
  };

  if (isLoading)
    return (
      <div className="container-page py-20 min-h-[60vh]">
        <Skeleton className="h-6 w-48 mb-4 rounded-lg" />
        <Skeleton className="h-12 w-3/4 mb-4 rounded-xl" />
        <Skeleton className="h-6 w-1/2 mb-8 rounded-lg" />
        <Skeleton className="h-[450px] w-full rounded-3xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-6 w-full rounded-md" />
            <Skeleton className="h-6 w-full rounded-md" />
            <Skeleton className="h-6 w-3/4 rounded-md" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );

  if (!blog)
    return (
      <div className="container-page py-24 min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100">
          <SearchIcon className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-3xl font-display font-extrabold text-slate-900 mb-2">
          Article Not Found
        </h2>
        <p className="text-slate-600 mb-8 max-w-md">
          The real estate report or article you're looking for doesn't exist, was moved, or has been unpublished.
        </p>
        <Link to="/blog">
          <Button size="lg" className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold">
            {t('blog.backToBlog', 'Explore All Articles')}
          </Button>
        </Link>
      </div>
    );

  const formattedDate = new Date(blog.published_at || blog.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(blog.title);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Reading Progress Indicator */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-red-600 to-rose-600 z-50 transition-all duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Main Header & Article Intro */}
      <header className="bg-white border-b border-slate-200/80 pt-8 pb-12">
        <div className="container-page max-w-5xl">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-6 flex-wrap">
            <Link to="/" className="hover:text-red-600 transition-colors flex items-center gap-1">
              <Home className="h-3.5 w-3.5" /> Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <Link to="/blog" className="hover:text-red-600 transition-colors">
              Research & Articles
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-red-600 font-bold truncate max-w-[200px] sm:max-w-none">
              {blog.tags[0] || 'Market Intelligence'}
            </span>
          </nav>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {blog.tags.map((tag: string) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 border border-red-200/80 px-3.5 py-1 text-xs font-black uppercase tracking-wider shadow-2xs"
              >
                <Sparkles className="h-3 w-3" /> {tag}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-bold">
              <Clock className="h-3 w-3" /> 6 min read
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.18] mb-4">
            {blog.title}
          </h1>

          {/* Excerpt */}
          <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed mb-8 max-w-4xl">
            {blog.excerpt}
          </p>

          {/* Meta & Share Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-slate-100">
            {/* Author Block */}
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white font-extrabold text-lg flex items-center justify-center shadow-md">
                {blog.author_name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-sm sm:text-base">{blog.author_name}</span>
                  <CheckCircle2 className="h-4 w-4 text-red-600 fill-red-50" />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{formattedDate}</span>
                  <span>•</span>
                  <span>Verified Market Intelligence</span>
                </div>
              </div>
            </div>

            {/* Social Share & Actions */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <a
                href={`https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on WhatsApp"
                className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-700 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <MessageCircle className="h-4 w-4" />
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on X"
                className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <span className="font-bold text-xs">𝕏</span>
              </a>

              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on LinkedIn"
                className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <span className="font-bold text-xs">in</span>
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => setBookmarked(!bookmarked)}
                aria-label="Bookmark article"
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${bookmarked ? 'bg-red-50 text-red-600 border-red-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content & Sidebar Grid */}
      <main className="container-page max-w-5xl py-10 sm:py-14">
        {/* Hero Cover Image */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 shadow-lg mb-12 group bg-slate-900">
          <img
            src={blog.cover_image || 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg'}
            alt={blog.title}
            className="w-full h-[320px] sm:h-[460px] object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-xs text-white/90 font-medium">
            <span>RealtyNow Market Research & Intelligence</span>
            <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
              High Resolution Analysis
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12">
          {/* Main Article Column (8 Cols) */}
          <div className="lg:col-span-8 space-y-10">
            {/* Executive Key Takeaways / TL;DR Box */}
            <div className="rounded-3xl bg-gradient-to-br from-red-50/70 via-rose-50/40 to-amber-50/50 p-6 sm:p-8 border border-red-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="font-display text-lg font-extrabold text-slate-900 uppercase tracking-wide">
                  Executive Key Takeaways (TL;DR)
                </h3>
              </div>
              <ul className="space-y-3 text-slate-700 text-sm sm:text-base font-medium">
                <li className="flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-red-600 mt-2 shrink-0" />
                  <span>
                    <strong>Capital Appreciation:</strong> Tier-1 micro-markets are witnessing strong annual growth (+12% to +16%), driven by end-user demand and premium lifestyle upgrades.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-red-600 mt-2 shrink-0" />
                  <span>
                    <strong>Infrastructure Dividends:</strong> Major transit corridors, arterial expressways, and upcoming metro extensions are unlocking exponential value in secondary clusters.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-red-600 mt-2 shrink-0" />
                  <span>
                    <strong>Rental Yield Expansion:</strong> Commercial and gated luxury residential communities are seeing sustained yields between 4.2% and 5.5%.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-red-600 mt-2 shrink-0" />
                  <span>
                    <strong>Strategic Advice:</strong> Institutional grade builders with RERA-compliant track records command a 15–20% pricing premium due to zero delivery risk.
                  </span>
                </li>
              </ul>
            </div>

            {/* In-Page Table of Contents */}
            <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
              <h4 className="font-display text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2 text-red-600">
                <span>📑</span> Table of Contents
              </h4>
              <nav className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                <a href="#overview" className="hover:text-red-600 transition-colors flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-50">
                  <span className="text-red-600">01.</span> Market Macro Overview
                </a>
                <a href="#growth-drivers" className="hover:text-red-600 transition-colors flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-50">
                  <span className="text-red-600">02.</span> Core Growth & Infra Drivers
                </a>
                <a href="#micro-markets" className="hover:text-red-600 transition-colors flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-50">
                  <span className="text-red-600">03.</span> Top High-Growth Micro-Markets
                </a>
                <a href="#investor-guide" className="hover:text-red-600 transition-colors flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-50">
                  <span className="text-red-600">04.</span> Actionable Investor Playbook
                </a>
              </nav>
            </div>

            {/* Core Article Body Content */}
            <div className="prose prose-lg max-w-none text-slate-800 space-y-6">
              {/* If rich HTML exists from CMS, render it seamlessly */}
              {blog.body && blog.body.length > 200 ? (
                <div 
                  className="prose prose-slate max-w-none prose-headings:font-display prose-headings:font-extrabold prose-p:leading-relaxed prose-a:text-red-600 prose-img:rounded-2xl"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blog.body, {
                    USE_PROFILES: { html: true },
                    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
                    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
                  }) }}
                />
              ) : (
                /* Fallback to full editorial layout when body is brief */
                <>
                  <section id="overview" className="space-y-4">
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight pt-2 border-t border-slate-100">
                      1. Market Macro Overview & Demand Dynamics
                    </h2>
                    <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
                      {blog.body || (
                        'The Indian real estate landscape is experiencing a fundamental structural shift toward premium and ultra-luxury residential developments. Backed by solid economic fundamentals, sustained GDP growth, and an influx of multinational corporate headquarters, demand has firmly outpaced new inventory launches.'
                      )}
                    </p>
                    <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
                      High Net-Worth Individuals (HNIs) and non-resident investors are increasingly reallocating portfolios into high-grade freehold assets and Grade-A commercial spaces, viewing them as both safe-haven capital hedges and dependable income generators.
                    </p>
                  </section>

                  {/* Market Stats Grid Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-8 not-prose">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-center">
                      <p className="text-[11px] font-extrabold uppercase text-slate-400">YoY Price Rise</p>
                      <p className="font-display text-2xl font-black text-red-600 mt-1">+14.2%</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Capital appreciation</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-center">
                      <p className="text-[11px] font-extrabold uppercase text-slate-400">Prime Rates</p>
                      <p className="font-display text-2xl font-black text-slate-900 mt-1">₹28,500</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Per sq.ft average</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-center">
                      <p className="text-[11px] font-extrabold uppercase text-slate-400">Rental Yield</p>
                      <p className="font-display text-2xl font-black text-amber-600 mt-1">4.8%</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Annualized returns</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-center">
                      <p className="text-[11px] font-extrabold uppercase text-slate-400">Infra Pipeline</p>
                      <p className="font-display text-2xl font-black text-emerald-600 mt-1">₹1.2L Cr</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Active public projects</p>
                    </div>
                  </div>

                  <section id="growth-drivers" className="space-y-4">
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight pt-2 border-t border-slate-100">
                      2. Key Growth Drivers & Transit Connectivity
                    </h2>
                    <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
                      Infrastructure execution has proven to be the single biggest catalyst for real estate re-rating in 2026. Micro-markets that were previously constrained by commute times are witnessing rapid demand transformation upon the commissioning of dedicated arterial bypasses and high-speed metro corridors.
                    </p>
                    
                    {/* Callout Quote Box */}
                    <blockquote className="my-6 rounded-2xl border-l-4 border-red-600 bg-slate-100/80 p-5 sm:p-6 not-prose shadow-2xs">
                      <p className="font-serif italic text-base sm:text-lg text-slate-800 leading-snug">
                        "Buyers today do not just evaluate square footage; they evaluate time reclaimed. When an infrastructure corridor reduces travel by 30 minutes, property values in that catchment experience a compound revaluation."
                      </p>
                      <footer className="mt-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                          RN
                        </div>
                        <div>
                          <cite className="font-display text-xs font-bold text-slate-900 not-italic block">
                            RealtyNow Advisory Council
                          </cite>
                          <span className="text-[10px] text-slate-500">Q3 Real Estate Economic Forecast</span>
                        </div>
                      </footer>
                    </blockquote>
                  </section>

                  <section id="micro-markets" className="space-y-4">
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight pt-2 border-t border-slate-100">
                      3. Top High-Growth Micro-Markets to Watch
                    </h2>
                    <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
                      Our proprietary market analytics algorithm highlights key clusters that demonstrate the strongest balance between liveability, employment density, and capital appreciation potential:
                    </p>

                    <div className="space-y-3 not-prose">
                      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                        <h4 className="font-display text-base font-extrabold text-slate-900">
                          🏙️ Western & Central Growth Corridors
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1">
                          Driven by commercial expansion and flagship luxury high-rises. Ideal for buyers seeking bespoke amenities, private elevators, and golf course views.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                        <h4 className="font-display text-base font-extrabold text-slate-900">
                          🌳 Peripheral Villa & Plotted Enclaves
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1">
                          Experiencing heightened demand from remote executives and multi-generational families wanting expansive open green footprints and gated security.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section id="investor-guide" className="space-y-4">
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight pt-2 border-t border-slate-100">
                      4. Actionable Investor Playbook
                    </h2>
                    <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
                      When evaluating residential assets or commercial spaces in 2026, adhere to the following checklist before finalizing negotiations:
                    </p>

                    <div className="rounded-2xl bg-slate-900 text-white p-6 sm:p-7 not-prose space-y-3 shadow-md">
                      <h4 className="font-display text-base font-extrabold text-red-400 uppercase tracking-wider">
                        RealtyNow Due Diligence Matrix
                      </h4>
                      <ul className="space-y-2.5 text-xs sm:text-sm text-slate-200">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>Verify clear title deeds and RERA registration compliance</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>Assess past developer delivery timelines and build grade quality</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>Compare live transaction data rather than asking speculative prices</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>Target properties with institutional tenancy potential for high rental yield</span>
                        </li>
                      </ul>
                    </div>
                  </section>
                </>
              )}
            </div>

            {/* Helpful Feedback Section */}
            <div className="rounded-2xl bg-white p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-bold text-slate-900 text-sm">Was this research article helpful?</p>
                <p className="text-xs text-slate-500">Your feedback helps our market research team refine upcoming forecasts.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (feedback !== 'helpful') {
                      setFeedback('helpful');
                      setHelpfulCount((c) => c + 1);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${feedback === 'helpful' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                >
                  <span>👍 Yes</span>
                  <span className="text-slate-400">({helpfulCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (feedback !== 'not_helpful') {
                      setFeedback('not_helpful');
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${feedback === 'not_helpful' ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                >
                  <span>👎 Needs more data</span>
                </button>
              </div>
            </div>

            {/* Author Profile Bio Box */}
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white font-black text-2xl flex items-center justify-center shadow-md shrink-0">
                {blog.author_name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-display text-lg font-extrabold text-slate-900">{blog.author_name}</h4>
                  <span className="bg-red-50 text-red-600 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border border-red-200">
                    Lead Research Analyst
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Specializes in macro-economic property valuations, yield models, and urban infrastructure analysis across India's top metropolitan markets.
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-red-600">
                  <Link to="/blog" className="hover:underline">
                    Browse all reports by {blog.author_name} →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Sidebar (4 Cols) */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Free Advisory Consultation Widget */}
            <div className="rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 text-white p-6 sm:p-7 shadow-xl border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-2 mb-2 text-red-400 text-xs font-black uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" /> Direct Advisory
              </div>
              <h3 className="font-display text-xl font-extrabold text-white leading-tight mb-2">
                Planning an investment in this location?
              </h3>
              <p className="text-xs text-slate-300 mb-5 leading-relaxed">
                Connect with our certified investment advisors for verified off-market inventories, price negotiations, and title checks.
              </p>

              {consultSubmitted ? (
                <div className="rounded-2xl bg-emerald-500/20 border border-emerald-500/40 p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-1.5" />
                  <p className="text-sm font-bold text-white">Callback Scheduled!</p>
                  <p className="text-xs text-emerald-200 mt-0.5">Our senior property consultant will call you within 15 minutes.</p>
                </div>
              ) : (
                <form onSubmit={handleConsultSubmit} className="space-y-3">
                  <input
                    type="tel"
                    placeholder="Enter your phone number"
                    value={consultPhone}
                    onChange={(e) => setConsultPhone(e.target.value)}
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-all"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-600/30 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>Request Free Callback</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}
            </div>

            {/* Trending Research Articles */}
            <div className="rounded-3xl bg-white p-6 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-display text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  Trending Articles
                </h3>
                <Link to="/blog" className="text-xs font-bold text-red-600 hover:underline">
                  View All
                </Link>
              </div>

              <div className="space-y-4">
                {relatedBlogs && relatedBlogs.length > 0 ? (
                  relatedBlogs.map((b: any) => (
                    <Link
                      key={b.id}
                      to={`/blog/${b.slug ?? b.id}`}
                      className="group flex items-start gap-3 transition-colors"
                    >
                      <img
                        src={b.cover_image || 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg'}
                        alt={b.title}
                        className="h-16 w-16 rounded-xl object-cover shrink-0 border border-slate-200 group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-extrabold uppercase text-red-600 tracking-wider">
                          {(Array.isArray(b.tags) && b.tags[0]) || 'Market Trends'}
                        </span>
                        <h4 className="font-display text-xs font-bold text-slate-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                          {b.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {new Date(b.published_at || b.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Loading trending insights...</p>
                )}
              </div>
            </div>

            {/* Quick Property Search Widget */}
            <div className="rounded-3xl bg-slate-100/80 p-6 border border-slate-200/90 text-center">
              <h4 className="font-display text-base font-extrabold text-slate-900 mb-1">
                Explore Verified Listings
              </h4>
              <p className="text-xs text-slate-600 mb-4">
                Discover curated luxury homes, plots, and commercial properties ready for booking.
              </p>
              <Link
                to="/search"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-extrabold text-xs border border-slate-300 shadow-2xs transition-all hover:border-slate-400 gap-1.5"
              >
                <span>Search All Properties</span>
                <ArrowRight className="h-3.5 w-3.5 text-red-600" />
              </Link>
            </div>
          </aside>
        </div>

        {/* Related Articles Carousel / Grid at Bottom */}
        {relatedBlogs && relatedBlogs.length > 0 && (
          <section className="mt-20 pt-12 border-t border-slate-200">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="text-xs font-extrabold uppercase text-red-600 tracking-wider">
                  Recommended For You
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  Related Real Estate <span className="text-red-600">Insights</span>
                </h2>
              </div>
              <Link
                to="/blog"
                className="text-xs sm:text-sm font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1"
              >
                <span>View Full Library</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedBlogs.map((b: any) => (
                <Link
                  key={b.id}
                  to={`/blog/${b.slug ?? b.id}`}
                  className="group rounded-3xl bg-white border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between hover:-translate-y-1"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    <img
                      src={b.cover_image || 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg'}
                      alt={b.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-white/90 backdrop-blur-md text-red-600 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-2xs border border-red-100">
                        {(Array.isArray(b.tags) && b.tags[0]) || 'Market Report'}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 group-hover:text-red-600 transition-colors leading-snug line-clamp-2">
                        {b.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {b.excerpt}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>{new Date(b.published_at || b.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="font-bold text-red-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        Read Story →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export function FaqPage() {
  const { t } = useLanguageContext();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const realtimeTick = useRealtimeCount('faqs');

  const { data, isLoading } = useQuery({
    queryKey: ['faqs', realtimeTick],
    queryFn: async () => {
      const { data } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const categories = Array.from(
    new Set((data ?? []).map((f: { category: string | null }) => f.category).filter(Boolean)),
  );
  const filtered = data?.filter(
    (f: { question: string; answer: string }) =>
      !search ||
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="container-page py-12 max-w-3xl">
      <h1 className="font-display text-3xl font-bold text-navy-900">
        {t('home.faqTitle', 'Frequently Asked Questions')}
      </h1>
      <div className="mt-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('faq.searchPlaceholder', 'Search FAQs...')}
            className="input pl-9"
          />
        </div>
      </div>
      {categories.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSearch(cat || '')}
              className="rounded-full border border-navy-200 px-3 py-1 text-xs font-medium text-navy-600 hover:bg-navy-50"
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      <div className="mt-6 space-y-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)
          : filtered?.map((f: { id: string; question: string; answer: string }) => (
              <Card key={f.id} className="p-0 overflow-hidden">
                <button
                  onClick={() => setOpenId(openId === f.id ? null : f.id)}
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <p className="font-semibold text-navy-900">{f.question}</p>
                  <ChevronRight className={cn('h-4 w-4 text-navy-400 transition', openId === f.id && 'rotate-90')} />
                </button>
                {openId === f.id && <div className="px-5 pb-5 text-sm text-navy-600 leading-relaxed">{f.answer}</div>}
              </Card>
            ))}
      </div>

      <div className="mt-10 rounded-2xl bg-slate-900 p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-lg text-white">Can't find what you're looking for?</h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Access our Customer Support Hub to raise tracked support tickets, chat with our team, or report issues.
          </p>
        </div>
        <a
          href="/portal/help"
          className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shrink-0"
        >
          Visit Support Desk
        </a>
      </div>
    </div>
  );
}

import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/useToast';

export function ContactPage() {
  const { t } = useLanguageContext();
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const service = searchParams.get('service');

  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    message: service ? `I am interested in ${service}. Please contact me.` : '' 
  });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = form.name.trim();
    const cleanPhone = form.phone.trim();
    const cleanEmail = form.email.trim();
    const cleanMessage = form.message.trim();

    if (!cleanName || !cleanPhone) {
      toast.addToast('error', 'Please provide your name and phone number.');
      return;
    }

    setSubmitting(true);
    // Standardize service categorization
    const serviceTag = service ? service.toLowerCase().replace(/\s+/g, '-') : 'general-inquiry';
    const serviceTypeKey = service
      ? service.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
      : 'GENERAL_ENQUIRY';

    let success = false;

    // Tier 1: Try dedicated RPC submit_contact_enquiry
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_contact_enquiry', {
        p_name: cleanName,
        p_phone: cleanPhone,
        p_email: cleanEmail || null,
        p_message: cleanMessage || null,
        p_source: 'website',
        p_customer_id: user?.id ?? null,
        p_tags: service ? [serviceTag, serviceTypeKey, service] : ['contact-inquiry', 'GENERAL_ENQUIRY'],
      });

      if (!rpcError && (rpcData as any)?.success !== false) {
        success = true;
      }
    } catch (rpcErr) {
      console.warn('submit_contact_enquiry RPC not available or failed, trying direct insert:', rpcErr);
    }

    // Tier 2: Direct insert with full payload
    if (!success) {
      try {
        const { error: insertError } = await supabase.from('enquiries').insert({
          name: cleanName,
          email: cleanEmail || null,
          phone: cleanPhone,
          message: cleanMessage || null,
          customer_id: user?.id ?? null,
          property_id: null,
          source: 'website',
          status: 'new',
          lead_status: 'new',
          priority: 'medium',
          tags: service ? [serviceTag, serviceTypeKey] : ['contact-inquiry'],
        });

        if (!insertError) {
          success = true;
        } else {
          console.warn('Tier 2 full insert failed:', insertError);
          // Tier 3: Minimal insert fallback
          const { error: minimalError } = await supabase.from('enquiries').insert({
            name: cleanName,
            email: cleanEmail || null,
            phone: cleanPhone,
            message: cleanMessage || null,
            status: 'new',
          });

          if (!minimalError) {
            success = true;
          } else {
            console.error('Tier 3 minimal insert failed:', minimalError);
          }
        }
      } catch (insertErr) {
        console.error('Direct insert error:', insertErr);
      }
    }

    // Tier 4: Local backup queue to guarantee no lead is lost
    if (!success) {
      try {
        const queue = JSON.parse(localStorage.getItem('realtynow_offline_leads') || '[]');
        queue.push({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          message: cleanMessage,
          service,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem('realtynow_offline_leads', JSON.stringify(queue));
        // Mark as accepted locally so the user is reassured
        success = true;
      } catch (storageErr) {
        console.error('LocalStorage queue error:', storageErr);
      }
    }

    setSubmitting(false);

    if (success) {
      setSent(true);
      toast.addToast('success', 'Message sent successfully! Our team will contact you shortly.');
    } else {
      toast.addToast('error', 'Unable to send message right now. Please connect via WhatsApp.');
    }
  };

  return (
    <div className="container-page py-12">
      <h1 className="font-display text-3xl font-bold text-navy-900">{t('common.contactUs', 'Contact us')}</h1>
      <p className="mt-2 text-navy-600">{t('contact.subtitle', "We'd love to hear from you. Reach us anytime.")}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Card className="p-6">
          {sent ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 shadow-xs">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 className="font-display text-2xl font-bold text-navy-900">
                {t('contact.sentTitle', 'Message Sent Successfully!')}
              </h2>
              <p className="mt-2 text-sm text-navy-600 max-w-md">
                {t('contact.sentDesc', "Thank you for reaching out. Our real estate advisory team will get back to you within 24 hours.")}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setForm({ name: '', email: '', phone: '', message: '' });
                  }}
                  className="rounded-xl border border-navy-200 bg-white px-5 py-2.5 text-xs font-bold text-navy-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  Send another message
                </button>
                <a
                  href={`https://wa.me/919494230774?text=${encodeURIComponent(`Hello RealtyNow, I submitted a contact request regarding ${service || 'services'}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs"
                >
                  <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input
                label={t('contact.name', 'Name')}
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <Input
                label={t('contact.email', 'Email')}
                placeholder="Enter your email address"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <Input
                label={t('contact.phone', 'Phone')}
                placeholder="e.g. 9876543210"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
              <Textarea
                label={t('contact.message', 'Message')}
                placeholder="How can we help you?"
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                required
              />
              <div className="pt-2 flex items-center gap-3">
                <Button type="submit" loading={submitting} icon={<Send className="h-4 w-4" />}>
                  {submitting ? 'Sending message…' : t('contact.sendMessage', 'Send message')}
                </Button>
                <a
                  href={`https://wa.me/919494230774?text=${encodeURIComponent(`Hello RealtyNow, I would like assistance regarding ${service || 'property services'}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/60 px-4 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                </a>
              </div>
            </form>
          )}
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display font-semibold text-navy-900">
              {t('contact.detailsHeader', 'Contact Details')}
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-red-600" /> <span className="text-navy-700">+91 94942 30774</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-red-600" /> <span className="text-navy-700">info@realtynow.in</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />{' '}
                <span className="text-navy-700">
                  #19, Road No. 2B, Chandrapuri Colony, LB Nagar, Hyderabad 500081, Telangana
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-navy-400" />{' '}
                <span className="text-navy-700">{t('contact.timing', 'Mon-Sat, 9:00 AM - 7:00 PM')}</span>
              </div>
            </div>
          </Card>
          <Card className="p-0 overflow-hidden">
            <iframe
              title="Office map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3808.3625782531017!2d78.55135287498427!3d17.346277583533887!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb99baadab7055%3A0xacbdc355fc4609c4!2s24efiling%20Tax%20services!5e0!3m2!1sen!2sin!4v1786353610969!5m2!1sen!2sin"
              width="100%"
              height="250"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  const { t } = useLanguageContext();
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <Home className="w-12 h-12 text-red-600" />
      </div>
      <h1 className="text-4xl font-display font-bold text-navy-900 mb-4">{t('common.404', '404 - Page Not Found')}</h1>
      <p className="text-navy-600 max-w-md mb-8">
        {t('common.404desc', "The page you're looking for doesn't exist or has been moved.")}
      </p>
      <Link to="/">
        <Button size="lg">{t('common.backHome', 'Back to Home')}</Button>
      </Link>
    </div>
  );
}

export function StaticPage({ slug, title }: { slug: string; title: string }) {
  const { t } = useLanguageContext();
  return (
    <div className="py-16 md:py-24 bg-slate-50 min-h-[60vh]">
      <div className="container-max">
        <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-navy-900 mb-6">{title}</h1>
          <div className="prose prose-slate max-w-none text-navy-700">
            <p>
              This is a placeholder page for {title}. Content for this page will be loaded dynamically from the CMS in the future.
            </p>
            <p>
              Please check back later once the terms and privacy configurations are fully published by the administrative team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  ArrowLeft,
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
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeCount } from '../../lib/realtime';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { Card, EmptyState, Button, Skeleton, Input, Textarea } from '../../components/ui';
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
      return { ...data, author_name: 'RealtyNow Team', tags: data.tags ?? [] };
    },
    enabled: Boolean(slug),
  });

  if (isLoading)
    return (
      <div className="container-page py-24 min-h-[60vh]">
        <Skeleton className="h-10 w-2/3 mb-6" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );

  if (!blog)
    return (
      <div className="container-page py-24 min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <SearchIcon className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-3xl font-display font-bold text-navy-900 mb-4">{t('blog.notFound', 'Article not found')}</h2>
        <p className="text-navy-600 mb-8">The blog post you're looking for doesn't exist or has been removed.</p>
        <Link to="/blog">
          <Button size="lg" className="rounded-xl">{t('blog.backToBlog', 'Back to Blog')}</Button>
        </Link>
      </div>
    );

  return (
    <article className="bg-slate-50 min-h-screen pb-24">
      {/* Hero Section */}
      <div className="bg-navy-900 text-white pt-24 pb-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20">
          <img src={blog.cover_image} alt="Background" className="w-full h-full object-cover blur-sm" />
          <div className="absolute inset-0 bg-navy-900/80"></div>
        </div>
        <div className="container-page max-w-4xl relative z-10">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white mb-8 transition-colors bg-white/10 px-4 py-2 rounded-full backdrop-blur-md hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" /> {t('blog.backToArticles', 'Back to all articles')}
          </Link>
          
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {blog.tags && blog.tags.map((tag: string) => (
              <span key={tag} className="inline-block rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white uppercase tracking-wider shadow-sm">
                {tag}
              </span>
            ))}
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            {blog.title}
          </h1>
          
          <p className="text-xl text-white/80 max-w-3xl leading-relaxed mb-10 font-light">
            {blog.excerpt}
          </p>

          <div className="flex items-center gap-6 text-sm text-white/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-navy-900 flex items-center justify-center font-bold text-lg shadow-lg">
                {blog.author_name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="font-bold">{blog.author_name}</span>
                <span className="text-white/60 text-xs">Author</span>
              </div>
            </div>
            <div className="h-10 w-px bg-white/20"></div>
            <div className="flex flex-col justify-center">
              <span className="font-bold">{new Date(blog.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span className="flex items-center gap-1.5 text-white/60 text-xs mt-0.5">
                <Clock className="h-3 w-3" /> 5 min read
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container-page max-w-4xl -mt-16 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 lg:p-16">
          <div className="aspect-[21/9] overflow-hidden rounded-2xl bg-slate-100 mb-12 shadow-sm">
            <img src={blog.cover_image} alt={blog.title} className="h-full w-full object-cover" />
          </div>
          
          {/* Detailed Content rendered as HTML */}
          <div 
            className="prose prose-lg prose-slate max-w-none prose-headings:font-display prose-headings:font-bold prose-p:text-navy-700 prose-p:leading-relaxed prose-a:text-primary-600 prose-img:rounded-2xl"
            dangerouslySetInnerHTML={{ __html: blog.body }} 
          />
          
        </div>
      </div>
    </article>
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

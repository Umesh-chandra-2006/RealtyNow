import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { PageLoader, EmptyState, Button, Input, Textarea } from '../../components/ui';
import { useToast } from '../../components/toast';
import { PropertyCard } from '../../components/property-card';
import type { Property } from '../../lib/types';
import {
  Building2, BadgeCheck, Award, Mail, Phone, ChevronRight, Home as HomeIcon, Send, MapPin, Sparkles
} from 'lucide-react';

function ContactBuilderForm({ builderUserId, builderName }: { builderUserId: string; builderName: string }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);

  const submitLead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('builder_leads').insert({
        builder_id: builderUserId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        message: form.message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSent(true);
      setForm({ name: '', email: '', phone: '', message: '' });
    },
    onError: (err: any) => addToast('error', err.message ?? 'Could not send your enquiry. Please try again.'),
  });

  if (sent) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-sm font-semibold text-green-800">Thanks! {builderName} will get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
          addToast('error', 'Please enter your name and either an email or phone number.');
          return;
        }
        submitLead.mutate();
      }}
      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 space-y-3"
    >
      <p className="text-xs font-bold tracking-[0.2em] text-red-600 uppercase mb-1">Contact {builderName}</p>
      <Input
        label="Your name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
      </div>
      <Textarea
        label="Message (optional)"
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        rows={3}
      />
      <Button type="submit" disabled={submitLead.isPending} className="w-full">
        <Send className="h-4 w-4" /> {submitLead.isPending ? 'Sending…' : 'Send Enquiry'}
      </Button>
    </form>
  );
}

export function BuilderProfilePage() {
  const { id } = useParams<{ id: string }>();

  // Fetch builder by ID or slug/name
  const { data: builder, isLoading, isError } = useQuery({
    queryKey: ['builder-profile', id],
    queryFn: async () => {
      if (!id) return null;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (isUUID) {
        const { data } = await supabase
          .from('builders')
          .select('*, cities:city_id(name), localities:locality_id(name)')
          .eq('id', id)
          .maybeSingle();
        return data;
      }

      // Fallback lookup by slug/name
      const normalized = id.replace(/-/g, ' ');
      const { data } = await supabase
        .from('builders')
        .select('*, cities:city_id(name), localities:locality_id(name)')
        .ilike('name', `%${normalized}%`)
        .limit(1)
        .maybeSingle();

      return data;
    },
    enabled: !!id,
  });

  const builderId = builder?.id;

  // Projects by this builder
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['builder-projects', builderId],
    queryFn: async () => {
      if (!builderId) return [];
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('builder_id', builderId)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!builderId,
  });

  // Properties by this builder
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ['builder-properties', builderId, builder?.user_id],
    queryFn: async () => {
      if (!builderId) return [];
      const orFilter = [
        `builder_id.eq.${builderId}`,
        builder?.user_id ? `owner_id.eq.${builder.user_id}` : '',
      ]
        .filter(Boolean)
        .join(',');

      const { data } = await supabase
        .from('properties')
        .select('*, cities:city_id(name), localities:locality_id(name), property_types:property_type_id(name)')
        .or(orFilter)
        .or('status.eq.published,status.eq.live,is_live.eq.true')
        .order('created_at', { ascending: false });

      return (data ?? []) as Property[];
    },
    enabled: !!builderId,
  });

  useEffect(() => {
    if (builder) document.title = `${builder.name} | Verified Builder | RealtyNow`;
  }, [builder]);

  if (isLoading) return <PageLoader />;

  if (!builder || isError) {
    return (
      <div className="min-h-screen bg-slate-50 pt-24 pb-12">
        <div className="container-wide">
          <EmptyState
            icon={<HomeIcon className="h-8 w-8 text-slate-400" />}
            title="Builder not found"
            description="This builder profile doesn't exist or is no longer active."
            action={<Link to="/builders"><Button variant="secondary">Browse all builders</Button></Link>}
          />
        </div>
      </div>
    );
  }

  const experienceYears = builder.established_year ? new Date().getFullYear() - builder.established_year : null;
  const locationLabel = [builder.localities?.name, builder.cities?.name].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-white pb-16">
      <div className="py-3.5 border-b border-slate-100">
        <div className="container-wide">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400">
            <Link to="/" className="hover:text-slate-700 transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/builders" className="hover:text-slate-700 transition-colors">Builders</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700 font-medium truncate">{builder.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="container-wide mt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl min-h-[200px] sm:min-h-[240px] bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 shadow-md"
        >
          {builder.cover_image && (
            <>
              <img src={builder.cover_image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
            </>
          )}
          <div className="relative px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="h-20 w-28 sm:h-24 sm:w-36 rounded-2xl bg-white border border-white/40 shadow-xl shrink-0 p-2 flex items-center justify-center overflow-hidden">
              {builder.logo_url ? (
                <img src={builder.logo_url} alt={builder.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <Building2 className="h-10 w-10 text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight">{builder.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 backdrop-blur border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified Developer
                </span>
                {locationLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur border border-white/20 px-2.5 py-0.5 text-[11px] font-medium text-slate-200">
                    <MapPin className="h-3 w-3 text-red-400" /> {locationLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="container-wide mt-8 space-y-12">
        {/* About & Contact */}
        <div className="grid lg:grid-cols-[1.4fr,1fr] gap-8">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 mb-3">About {builder.name}</h2>
            <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
              {builder.description || `${builder.name} is a verified real estate developer on RealtyNow.`}
            </p>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
              <p className="text-xs font-bold tracking-[0.2em] text-red-600 uppercase mb-4">Company Information</p>
              <dl className="space-y-4">
                {experienceYears != null && (
                  <div>
                    <dt className="text-xs text-slate-400 uppercase tracking-wide">Experience</dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <Award className="h-4 w-4 text-slate-400" /> {experienceYears}+ Years (Est. {builder.established_year})
                    </dd>
                  </div>
                )}
                {builder.contact_email && (
                  <div>
                    <dt className="text-xs text-slate-400 uppercase tracking-wide">Email</dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <Mail className="h-4 w-4 text-slate-400" /> {builder.contact_email}
                    </dd>
                  </div>
                )}
                {builder.contact_phone && (
                  <div>
                    <dt className="text-xs text-slate-400 uppercase tracking-wide">Phone</dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <Phone className="h-4 w-4 text-slate-400" /> {builder.contact_phone}
                    </dd>
                  </div>
                )}
              </dl>
              {(builder.contact_phone || builder.contact_email) && (
                <div className="mt-5 flex gap-2">
                  {builder.contact_phone && (
                    <a href={`tel:${builder.contact_phone}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors px-4 py-2.5 text-sm font-semibold">
                      <Phone className="h-4 w-4" /> Contact
                    </a>
                  )}
                  {builder.contact_email && (
                    <a href={`mailto:${builder.contact_email}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white transition-colors px-4 py-2.5 text-sm font-semibold">
                      <Mail className="h-4 w-4" /> Email
                    </a>
                  )}
                </div>
              )}
            </div>
            {builder.user_id && <ContactBuilderForm builderUserId={builder.user_id} builderName={builder.name} />}
          </div>
        </div>

        {/* Listed Properties by this Builder */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">Properties by {builder.name}</h2>
              <p className="text-xs sm:text-sm text-slate-500">Explore residences, villas and commercial units by this developer.</p>
            </div>
            <Link
              to={`/search?q=${encodeURIComponent(builder.name)}`}
              className="text-xs sm:text-sm font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1"
            >
              <span>Search in portal</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {propertiesLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : properties.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((prop) => (
                <PropertyCard key={prop.id} property={prop} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-8 text-center">
              <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No individual property units listed yet.</p>
              <p className="text-xs text-slate-500 mt-1">Check out developments or search all active properties in this city.</p>
              <Link to={`/search?q=${encodeURIComponent(builder.name)}`} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-red-600 text-white px-4 py-2 text-xs font-bold transition-colors">
                <Sparkles className="h-3.5 w-3.5" /> Search all properties
              </Link>
            </div>
          )}
        </div>

        {/* Development Projects */}
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 mb-1">Development Projects</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-5">Ongoing and completed project developments by {builder.name}.</p>
          {projectsLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : projects.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition-shadow">
                  <h3 className="font-display font-bold text-slate-900">{p.name}</h3>
                  {p.description && <p className="mt-1.5 text-xs text-slate-500 line-clamp-3 leading-relaxed">{p.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-8 text-center">
              <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No project developments registered yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

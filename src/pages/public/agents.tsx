import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PageLoader } from '../../components/ui';
import {
  Star,
  Phone,
  MessageCircle,
  Building2,
  Mail,
  BadgeCheck,
  MapPin,
  Home,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Award,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';

const AGENT_COVERS = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80',
];

function getAgentCover(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AGENT_COVERS[hash % AGENT_COVERS.length];
}

export function AgentsPage() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ['all-agents'],
    queryFn: async () => {
      const { data: agentProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'agent')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!agentProfiles || agentProfiles.length === 0) return [];

      // Fetch active listings count for all agents in parallel
      const { data: propCounts } = await supabase
        .from('properties')
        .select('assigned_agent_id, owner_id')
        .or('status.eq.published,is_live.eq.true');

      const countsByAgent = new Map<string, number>();
      (propCounts ?? []).forEach((p) => {
        if (p.assigned_agent_id) {
          countsByAgent.set(p.assigned_agent_id, (countsByAgent.get(p.assigned_agent_id) ?? 0) + 1);
        }
        if (p.owner_id) {
          countsByAgent.set(p.owner_id, (countsByAgent.get(p.owner_id) ?? 0) + 1);
        }
      });

      return agentProfiles.map((agent) => ({
        ...agent,
        listings_count: countsByAgent.get(agent.id) ?? 0,
      }));
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50/70 pt-20 sm:pt-24 pb-16">
      <div className="container-wide">
        {/* Page Header */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-700">
              <Sparkles className="h-3.5 w-3.5 fill-red-600 text-red-600" /> Verified Network
            </span>
            <span className="text-xs font-semibold text-slate-500">Certified Real Estate Advisors</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Our Top <span className="text-red-600">Agents</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl font-medium">
            Meet our experienced real estate professionals ready to help you discover, evaluate, and close your dream property.
          </p>
        </div>

        {/* Cinematic Agent Cards Grid */}
        <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {agents?.map((agent, i) => {
            const coverImage = getAgentCover(agent.id);
            const agentName = `${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim() || 'Real Estate Agent';
            const companyName = agent.company || 'Premier Real Estate Partner';

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                whileHover={{ y: -6 }}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm hover:shadow-xl hover:border-red-200 transition-all duration-300"
              >
                {/* 1. Cinematic Hero Banner */}
                <div className="relative h-36 w-full overflow-hidden bg-slate-900">
                  <img
                    src={coverImage}
                    alt="Agent cover"
                    className="h-full w-full object-cover opacity-75 transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent" />

                  {/* Top Badges on Banner */}
                  <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white border border-white/10">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" /> RERA Verified
                    </span>
                  </div>

                  <div className="absolute right-3.5 top-3.5">
                    <div className="flex items-center gap-1 bg-amber-500/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-white shadow-xs">
                      <Star className="h-3 w-3 fill-white text-white" />
                      <span className="text-[11px] font-extrabold">5.0</span>
                    </div>
                  </div>
                </div>

                {/* 2. Overlapping Profile Avatar & Details */}
                <div className="relative px-5 pt-0 pb-5 flex-1 flex flex-col">
                  <div className="flex items-end justify-between -mt-12 mb-3">
                    <div className="relative">
                      {agent.avatar_url ? (
                        <img
                          src={agent.avatar_url}
                          alt={agentName}
                          className="h-20 w-20 rounded-2xl object-cover border-4 border-white shadow-lg bg-white"
                        />
                      ) : (
                        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-2xl font-black text-white border-4 border-white shadow-lg">
                          {agent.first_name?.[0] ?? 'A'}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white" title="Active">
                        <BadgeCheck className="h-3.5 w-3.5 fill-emerald-500 text-white" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                      <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span>Hyderabad</span>
                    </div>
                  </div>

                  {/* Name & Agency */}
                  <div>
                    <h3 className="font-display text-xl font-extrabold text-slate-900 group-hover:text-red-600 transition-colors line-clamp-1">
                      {agentName}
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500 flex items-center gap-1 line-clamp-1">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{companyName}</span>
                    </p>
                  </div>

                  {/* Specialization Tags */}
                  {agent.specialization && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {agent.specialization.split(',').slice(0, 3).map((spec: string, idx: number) => (
                        <span
                          key={idx}
                          className="bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 text-[10px] font-bold px-2.5 py-0.5 rounded-md transition-colors"
                        >
                          {spec.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Key Stats Strip */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2 py-2.5 px-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-red-600 shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Listings</p>
                        <p className="text-xs font-extrabold text-slate-900">{agent.listings_count > 0 ? `${agent.listings_count} Properties` : 'Verified Portfolio'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Response</p>
                        <p className="text-xs font-extrabold text-slate-900">&lt; 15 mins</p>
                      </div>
                    </div>
                  </div>

                  {/* Bio Excerpt */}
                  <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed flex-1">
                    {agent.bio || 'Experienced real estate advisor specializing in residential and commercial properties with verified client satisfaction.'}
                  </p>

                  {/* 3. Card Footer & Profile View CTA */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Contact Action Icons */}
                    <div className="flex items-center gap-1.5">
                      {agent.phone && (
                        <a
                          href={`tel:${agent.phone}`}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Call Agent"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {agent.phone && (
                        <a
                          href={`https://wa.me/${agent.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title="Chat on WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      {agent.email && (
                        <a
                          href={`mailto:${agent.email}`}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          title="Email Agent"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                    </div>

                    {/* Profile View Button */}
                    <Link
                      to={`/agents/${agent.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-md shadow-red-600/20 hover:shadow-lg hover:shadow-red-600/30 active:scale-95 transition-all group/btn"
                    >
                      <span>Profile View</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

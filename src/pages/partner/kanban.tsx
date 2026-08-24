import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Kanban as KanbanIcon,
  Plus,
  Handshake,
  User,
  Phone,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Building2,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguageContext } from '../../lib/i18n/language-context';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getPartnerSections } from '../portal/sections';
import { Card, Button, Badge, Skeleton } from '../../components/ui';
import { formatDate, formatPrice, buildWhatsAppUrl, cn } from '../../lib/utils';
import { useToast } from '../../components/toast';

const KANBAN_STAGES = [
  { id: 'pending', label: '1. Verification', color: 'border-amber-400 bg-amber-50/50', badge: 'bg-amber-100 text-amber-800' },
  { id: 'verified', label: '2. Verified', color: 'border-blue-400 bg-blue-50/50', badge: 'bg-blue-100 text-blue-800' },
  { id: 'assigned', label: '3. Assigned to Agent', color: 'border-purple-400 bg-purple-50/50', badge: 'bg-purple-100 text-purple-800' },
  { id: 'in_process', label: '4. In Process / Visits', color: 'border-cyan-400 bg-cyan-50/50', badge: 'bg-cyan-100 text-cyan-800' },
  { id: 'completed', label: '5. Closed & Won', color: 'border-emerald-400 bg-emerald-50/50', badge: 'bg-emerald-100 text-emerald-800' },
];

export function PartnerKanbanPage() {
  const { t } = useLanguageContext();
  const sections = getPartnerSections(t);
  const { user } = useAuth();
  const { addToast } = useToast();

  const { data: partner } = useQuery({
    queryKey: ['partner-me', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('partners').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals = [], isLoading, refetch } = useQuery({
    queryKey: ['partner-kanban-referrals', partner?.id],
    queryFn: async () => {
      if (!partner?.id) return [];
      const { data } = await supabase
        .from('referrals')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!partner?.id,
  });

  const columns = useMemo(() => {
    const map: Record<string, any[]> = {
      pending: [],
      verified: [],
      assigned: [],
      in_process: [],
      completed: [],
    };
    referrals.forEach((r: any) => {
      if (map[r.status]) {
        map[r.status].push(r);
      } else if (r.status === 'cancelled' || r.status === 'rejected') {
        // keep completed/closed
      } else {
        map.pending.push(r);
      }
    });
    return map;
  }, [referrals]);

  return (
    <DashboardLayout sections={sections} title="Kanban Flow">
      <PageHeader
        title="Partner Referrals Kanban Flow"
        subtitle="Visual pipeline tracking the live lifecycle of your client referrals from verification to commission closure."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Link to="/partner/referrals/new">
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                Submit Referral
              </Button>
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-96 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-6">
          {KANBAN_STAGES.map((stage) => {
            const items = columns[stage.id] || [];
            return (
              <div key={stage.id} className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-3 min-w-[260px] h-[calc(100vh-280px)] overflow-hidden">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3 shrink-0">
                  <span className="font-display text-xs font-black text-slate-800">{stage.label}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black font-mono', stage.badge)}>
                    {items.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {items.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
                      No referrals in this stage
                    </div>
                  ) : (
                    items.map((r: any) => {
                      const clientName = r.details?.customer_name || r.details?.name || 'Customer';
                      const clientPhone = r.details?.customer_phone || r.details?.phone || '';
                      return (
                        <Card
                          key={r.id}
                          className="p-3.5 bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all space-y-2.5 rounded-xl"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-[10px] font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {r.referral_code || 'RN-REF'}
                            </span>
                            <span className="capitalize text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded">
                              {r.category || r.referral_type}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{clientName}</h4>
                            {clientPhone && <p className="text-[11px] text-slate-500">{clientPhone}</p>}
                          </div>

                          {r.eligible_amount && (
                            <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100 text-[11px] font-bold text-emerald-800">
                              Value: {formatPrice(r.eligible_amount)}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                            <span>{formatDate(r.created_at)}</span>
                            <Link
                              to={`/partner/referrals/${r.id}`}
                              className="text-red-600 font-bold hover:underline inline-flex items-center gap-0.5"
                            >
                              Details <ArrowRight className="h-2.5 w-2.5" />
                            </Link>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

export default PartnerKanbanPage;

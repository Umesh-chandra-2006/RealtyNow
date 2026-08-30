import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  StickyNote,
  Users,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardLayout, PageHeader } from '../../components/dashboard-layout';
import { getBuilderSections } from '../portal/sections';
import { useLanguageContext } from '../../lib/i18n';
import { Badge, Button, Card, EmptyState, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useRealtimeCount } from '../../lib/realtime';
import { logBuilderAudit } from '../../lib/builder-audit';
import { formatDateTime, isUuid } from '../../lib/utils';

type BuilderLeadStatus = 'new' | 'contacted' | 'site_visit' | 'negotiation' | 'won' | 'lost' | 'closed';
type BuilderLeadActivityType = 'note' | 'call' | 'email' | 'meeting' | 'site_visit' | 'status_change';

interface BuilderLead {
  id: string;
  builder_id: string;
  project_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: BuilderLeadStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
}

interface BuilderLeadActivity {
  id: string;
  lead_id: string;
  builder_id: string;
  activity_type: BuilderLeadActivityType;
  notes: string | null;
  activity_date: string;
}

const ACTIVITY_ICON: Record<BuilderLeadActivityType, React.ReactNode> = {
  note: <StickyNote className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Users className="h-4 w-4" />,
  site_visit: <MapPin className="h-4 w-4" />,
  status_change: <RefreshCw className="h-4 w-4" />,
};

const ACTIVITY_LABEL: Record<BuilderLeadActivityType, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  site_visit: 'Site Visit',
  status_change: 'Status Change',
};

import { ProfessionalCrmTable } from '../../components/crm/ProfessionalCrmTable';

function CrmLeadList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: leads, isLoading, error, refetch } = useQuery({
    queryKey: ['builder-crm-leads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_leads')
        .select('*, builder_projects(id, name, status, cover_image, cities(name), localities(name))')
        .eq('builder_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  return (
    <ProfessionalCrmTable
      leads={leads ?? []}
      isLoading={isLoading}
      error={error instanceof Error ? error.message : null}
      sourceType="builder"
      onRefresh={() => refetch()}
      onViewActivity={(leadId) => navigate(`/builder/crm/${leadId}`)}
    />
  );
}

function CrmLeadDetail({ leadId }: { leadId: string }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const realtimeTick = useRealtimeCount('builder_lead_activities', { column: 'lead_id', value: leadId });

  const [activityType, setActivityType] = useState<BuilderLeadActivityType>('note');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['builder-crm-lead', leadId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('builder_leads')
        .select('*')
        .eq('id', leadId)
        .eq('builder_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as BuilderLead | null;
    },
    enabled: !!user && !!leadId && isUuid(leadId),
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['builder-lead-activities', leadId, realtimeTick],
    queryFn: async () => {
      if (!isUuid(leadId)) return [];
      const { data, error } = await supabase
        .from('builder_lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('activity_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BuilderLeadActivity[];
    },
    enabled: !!leadId && isUuid(leadId),
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      const payload = {
        lead_id: leadId,
        builder_id: user!.id,
        activity_type: activityType,
        notes: notes.trim() || null,
        activity_date: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('builder_lead_activities').insert(payload).select('id').single();
      if (error) throw error;
      return data?.id as string | undefined;
    },
    onSuccess: async (id) => {
      await logBuilderAudit('create', 'builder_lead_activities', id ?? null, { lead_id: leadId, activity_type: activityType });
      queryClient.invalidateQueries({ queryKey: ['builder-lead-activities', leadId] });
      setNotes('');
      setActivityType('note');
      addToast('success', 'Activity logged');
    },
    onError: (err) => addToast('error', err instanceof Error ? err.message : 'Failed to log activity'),
  });

  const submitActivity = () => {
    if (!notes.trim() && activityType === 'note') {
      addToast('error', 'Add a note before submitting');
      return;
    }
    setSubmitting(true);
    addActivity.mutate(undefined, { onSettled: () => setSubmitting(false) });
  };

  if (leadLoading) {
    return <p className="text-sm text-navy-500">Loading lead…</p>;
  }

  if (!lead) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-6 w-6" />}
        title="Lead not found"
        description="This lead doesn't exist or doesn't belong to you."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-navy-900">{lead.name}</h3>
            <p className="text-sm text-navy-500">{lead.email || 'No email'} · {lead.phone || 'No phone'}</p>
            {lead.message && <p className="mt-2 text-sm text-navy-700">{lead.message}</p>}
          </div>
          <Badge variant={lead.status === 'won' ? 'success' : lead.status === 'lost' ? 'error' : 'info'} className="capitalize">
            {lead.status.replace('_', ' ')}
          </Badge>
        </div>
      </Card>

      <Card className="p-5">
        <h4 className="mb-3 font-display text-base font-bold text-navy-900">Log an activity</h4>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <Select value={activityType} onChange={(e) => setActivityType(e.target.value as BuilderLeadActivityType)}>
            {(Object.keys(ACTIVITY_LABEL) as BuilderLeadActivityType[]).map((type) => (
              <option key={type} value={type}>
                {ACTIVITY_LABEL[type]}
              </option>
            ))}
          </Select>
          <Textarea
            placeholder="Add notes about this interaction…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={submitActivity} loading={submitting}>
            Add activity
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h4 className="mb-4 font-display text-base font-bold text-navy-900">Activity timeline</h4>
        {activitiesLoading ? (
          <p className="text-sm text-navy-500">Loading activity…</p>
        ) : !activities || activities.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="No activity yet"
            description="Log a call, email, or note to start the timeline."
          />
        ) : (
          <div className="space-y-0">
            {activities.map((a, i) => (
              <div key={a.id} className="relative flex gap-3 pb-6 last:pb-0">
                {i !== activities.length - 1 && (
                  <span className="absolute left-4 top-9 bottom-0 w-px bg-navy-100" aria-hidden />
                )}
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-600">
                  {ACTIVITY_ICON[a.activity_type]}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-navy-900">{ACTIVITY_LABEL[a.activity_type]}</p>
                    <span className="text-xs text-navy-400">{formatDateTime(a.activity_date)}</span>
                  </div>
                  {a.notes && <p className="mt-1 text-sm text-navy-600">{a.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function BuilderCrm() {
  const { t } = useLanguageContext();
  const builderSections = getBuilderSections(t);
  const { leadId } = useParams<{ leadId: string }>();

  return (
    <DashboardLayout sections={builderSections} title="CRM" badge="Builder">
      {leadId ? (
        <>
          <div className="mb-4">
            <Link to="/builder/crm" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600 hover:text-navy-900">
              <ArrowLeft className="h-4 w-4" /> Back to CRM
            </Link>
          </div>
          <PageHeader title="Lead Activity" subtitle="Timeline of interactions for this lead." />
          <CrmLeadDetail leadId={leadId} />
        </>
      ) : (
        <>
          <PageHeader title="CRM" subtitle="Select a lead to view its activity timeline." />
          <CrmLeadList />
        </>
      )}
    </DashboardLayout>
  );
}
